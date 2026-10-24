"""Electron ASAR parsing, additive packing and byte verification."""

import copy
import hashlib
import json
import struct

BLOCK_SIZE = 4 * 1024 * 1024

def digest(data):
    return hashlib.sha256(data).hexdigest()


def parse_archive(data):
    if len(data) < 16:
        raise ValueError('Truncated ASAR header.')
    first, header_size, pickle_size, string_size = struct.unpack('<4I', data[:16])
    if (first != 4 or pickle_size + 4 != header_size or
            8 + header_size > len(data) or 16 + string_size > 8 + header_size):
        raise ValueError('Invalid ASAR header.')
    raw = data[16:16 + string_size]
    return json.loads(raw), raw, data[8 + header_size:]


def packed_files(entries, prefix=''):
    for name, entry in entries.items():
        path = prefix + name
        if 'files' in entry:
            yield from packed_files(entry['files'], path + '/')
        elif 'offset' in entry and not entry.get('unpacked'):
            yield path, entry


def content(payload, entry):
    offset = int(entry['offset'])
    result = payload[offset:offset + entry['size']]
    if offset < 0 or entry['size'] < 0 or len(result) != entry['size']:
        raise ValueError('Invalid ASAR entry extent.')
    return result


def integrity(data):
    return {
        'algorithm': 'SHA256', 'hash': digest(data), 'blockSize': BLOCK_SIZE,
        'blocks': [digest(data[i:i + BLOCK_SIZE]) for i in range(0, len(data), BLOCK_SIZE)],
    }


def append_files(header, payload, additions):
    updated = copy.deepcopy(header)
    output = bytearray(payload)
    for name, data in additions.items():
        parent = updated['files']
        parts = name.split('/')
        for part in parts[:-1]:
            parent = parent.setdefault(part, {'files': {}})['files']
        parent[parts[-1]] = {'size': len(data), 'offset': str(len(output)), 'integrity': integrity(data)}
        output.extend(data)
    raw = json.dumps(updated, separators=(',', ':'), ensure_ascii=False).encode()
    body = struct.pack('<I', len(raw)) + raw
    body += b'\0' * (-len(body) % 4)
    inner = struct.pack('<I', len(body)) + body
    return struct.pack('<II', 4, len(inner)) + inner + output


def verify(original_entries, payload, result, additions):
    header, raw, packed = parse_archive(result)
    entries = dict(packed_files(header['files']))
    mismatches = []
    for name, entry in entries.items():
        data = content(packed, entry)
        if name not in additions:
            if data != content(payload, original_entries[name]):
                raise ValueError('Original bytes changed: ' + name)
        if 'integrity' in entry:
            metadata = entry['integrity']
            size = metadata['blockSize']
            blocks = [digest(data[i:i + size]) for i in range(0, len(data), size)]
            if metadata['hash'] != digest(data) or metadata['blocks'] != blocks:
                if (name in additions or entry != original_entries[name] or
                        data != content(payload, original_entries[name])):
                    raise ValueError('New integrity mismatch: ' + name)
                mismatches.append(name)
    for name, data in additions.items():
        if content(packed, entries[name]) != data:
            raise ValueError('Added bytes mismatch: ' + name)
    return raw, len(entries), mismatches
