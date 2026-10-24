"""Prepare a local real-engine audit without modifying RunJS or publishing its code."""

import argparse
import importlib.util
import json
from pathlib import Path
import plistlib
import re
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
MODULES = [15237, 23653, 28527, 97923, 71275]
SUPPORTED_BUNDLE_SHA256 = '469ba2be820babe8b76c490209def8e09de0d3b479770b6064cd210d34054243'


def extract_module(source, module_id):
    # RunJS 4.1.0-specific webpack layout, not a general-purpose JS parser.
    start = re.search(r'(?<!\d)' + str(module_id) + r'\(([^)]*)\)\{', source)
    if not start:
        raise ValueError(f'Missing pinned editor module: {module_id}')
    end = re.search(r'\},\d+\([^)]*\)\{', source[start.end():])
    if not end:
        raise ValueError(f'Unrecognized editor module boundary: {module_id}')
    body = source[start.end() - 1:start.end() + end.start() + 1]
    return f'function({start.group(1)})' + body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', type=Path, required=True, help='Your RunJS 4.1.0 app bundle.')
    parser.add_argument('--output', type=Path, required=True, help='Private temporary directory outside this checkout.')
    parser.add_argument('--neovim', default='nvim', help='Reference Neovim executable (default: nvim).')
    args = parser.parse_args()
    output = args.output.resolve()
    if output.is_relative_to(ROOT) or ROOT.is_relative_to(output):
        raise SystemExit('Audit assets must stay in a private directory outside this checkout.')
    if output.exists() and any(output.iterdir()):
        raise SystemExit('Use an empty audit output directory.')
    app = args.app.resolve()
    if output.is_relative_to(app) or app.is_relative_to(output):
        raise SystemExit('Audit output must not overlap the application bundle.')
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    if info.get('CFBundleShortVersionString') != '4.1.0':
        raise SystemExit('This extractor supports RunJS 4.1.0 only.')
    spec = importlib.util.spec_from_file_location('bridge_builder', ROOT / 'scripts/build-patch.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    header, raw, payload = builder.parse_archive((app / 'Contents/Resources/app.asar').read_bytes())
    if info['ElectronAsarIntegrity']['Resources/app.asar']['hash'] != builder.digest(raw):
        raise SystemExit('ASAR header integrity mismatch; refusing the audit.')
    entries = dict(builder.packed_files(header['files']))
    bundle = builder.content(payload, entries['index-bundle.js'])
    if builder.digest(bundle) != SUPPORTED_BUNDLE_SHA256:
        raise SystemExit('Unknown RunJS editor bundle fingerprint; refusing version-specific extraction.')
    source = bundle.decode()
    modules = {str(module_id): extract_module(source, module_id) for module_id in MODULES}
    output.mkdir(parents=True, exist_ok=True)
    bootstrap = (
        'const cache={};function load(id){if(cache[id])return cache[id].exports;'
        'const module={exports:{}};cache[id]=module;modules[id](module,module.exports,load);'
        'return module.exports;}window.CodeMirror=load(15237);load(71275);'
    )
    fixture = '(()=>{const modules={' + ','.join(k + ':' + v for k, v in modules.items()) + '};' + bootstrap + '})();\n'
    (output / 'engine.js').write_text(fixture)
    subprocess.run(['node', '--check', str(output / 'engine.js')], check=True)
    (output / 'engine.css').write_bytes(builder.content(payload, entries['index.css']))
    metadata = {
        'runjs': '4.1.0', 'bundle_sha256': builder.digest(bundle),
        'cases_sha256': builder.digest((ROOT / 'tests/vim-audit/cases.json').read_bytes()),
        'module_sha256': {k: builder.digest(v.encode()) for k, v in modules.items()},
        'scope': 'isolated engine; no native RunJS routing, file save or quit test',
    }
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    for name in ['cases.json', 'runner.js', 'index.html']:
        shutil.copy2(ROOT / 'tests/vim-audit' / name, output / name)
    subprocess.run([args.neovim, '--headless', '--clean', '-u', 'NONE', '-i', 'NONE', '-n',
                    '-l', str(ROOT / 'tests/vim-audit/reference.lua'),
                    str(output / 'cases.json'), str(output / 'reference.json')],
                   check=True, cwd=output, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(json.dumps({'prepare': 'PASS', 'runjs': '4.1.0', 'fixtures': len(json.loads((output / 'cases.json').read_text())),
                      'private_output': str(output), 'app_modified': False}))
    return output


if __name__ == '__main__':
    main()
