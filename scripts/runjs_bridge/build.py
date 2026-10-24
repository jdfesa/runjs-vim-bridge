"""Build orchestration and manifest output; never modifies the app."""

import argparse
import copy
import json
from pathlib import Path
import plistlib

from .archive import digest, parse_archive, packed_files, append_files, verify
from .composition import ROOT, PATCH_VERSION, compose, normalize_appearance

def main():
    parser = argparse.ArgumentParser(description='Build the patch without modifying RunJS.')
    parser.add_argument('--app', type=Path, required=True,
                        help='Path to your RunJS 4.1.0 app bundle.')
    parser.add_argument('--output', type=Path, default=ROOT / 'build',
                        help='Build directory (default: build/ in this checkout).')
    parser.add_argument('--appearance', type=normalize_appearance,
                        choices=['native', 'mint'], default='native',
                        help='Optional Mint Dark profile (mint); default: native appearance.')
    parser.add_argument('--upgrade', action='store_true',
                        help='Replace a recognized earlier bridge patch; back up before installing.')
    parser.add_argument('--relative-lines', action='store_true',
                        help='Show relative line numbers with an absolute current line.')
    parser.add_argument('--no-host-commands', dest='host_commands', action='store_false',
                        help='Build only feedback/visuals without native save/quit adapters.')
    args = parser.parse_args()
    APP = args.app.resolve()
    STAGE = args.output.resolve()
    if STAGE.is_relative_to(APP) or APP.is_relative_to(STAGE):
        raise SystemExit('Build output must not overlap the application bundle.')
    STAGE.mkdir(parents=True, exist_ok=True)
    original = (APP / 'Contents/Resources/app.asar').read_bytes()
    header, raw_header, payload = parse_archive(original)
    info_bytes = (APP / 'Contents/Info.plist').read_bytes()
    info = plistlib.loads(info_bytes)
    if info['CFBundleShortVersionString'] != '4.1.0':
        raise SystemExit('This proof of concept only supports RunJS 4.1.0.')
    if info['ElectronAsarIntegrity']['Resources/app.asar']['hash'] != digest(raw_header):
        raise SystemExit('ASAR header integrity mismatch; refusing to build the patch.')
    original_entries = dict(packed_files(header['files']))
    additions, previous_patch = compose(original_entries, payload, args)
    result = append_files(header, payload, additions)
    checked_raw, verified_count, preexisting_mismatches = verify(original_entries, payload, result, additions)
    (STAGE / 'app.patched.asar').write_bytes(result)
    updated_info = copy.deepcopy(info)
    updated_info['ElectronAsarIntegrity']['Resources/app.asar']['hash'] = digest(checked_raw)
    fmt = plistlib.FMT_BINARY if info_bytes.startswith(b'bplist') else plistlib.FMT_XML
    updated_info_bytes = plistlib.dumps(updated_info, fmt=fmt, sort_keys=False)
    (STAGE / 'Info.patched.plist').write_bytes(updated_info_bytes)
    original_paths = [
        'Contents/Resources/app.asar', 'Contents/Info.plist',
        'Contents/MacOS/RunJS', 'Contents/_CodeSignature/CodeResources',
    ]
    manifest = {
        'app': str(APP), 'version': '4.1.0', 'patch_version': PATCH_VERSION,
        'appearance': args.appearance, 'upgrade_from': previous_patch,
        'relative_line_numbers': args.relative_lines, 'host_commands': args.host_commands,
        'original_hashes': {path: digest((APP / path).read_bytes()) for path in original_paths},
        'patched_asar_hash': digest(result), 'patched_header_hash': digest(checked_raw),
        'patched_info_hash': digest(updated_info_bytes),
        'changed_virtual_files': list(additions), 'verified_packed_files': verified_count,
        'preexisting_integrity_mismatches_preserved': preexisting_mismatches,
        'validation_scope': 'ASAR bytes, metadata and changed-file integrity; no native UI test',
    }
    (STAGE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'build': 'PASS', 'verified_packed_files': verified_count,
                      'changed_virtual_files': list(additions),
                      'asar_integrity': 'preserved and recalculated for changed files',
                      'preexisting_mismatches_preserved': preexisting_mismatches}))
