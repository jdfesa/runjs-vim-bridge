"""Install RunJS Vim Mode Patch

Back up before modifying files and restore originals if local signing fails.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

from .backup import create as create_backup


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description='Install the built patch with a verified backup.')
    parser.add_argument('--build-dir', type=Path, default=root / 'build',
                        help='Build directory (default: build/ in this checkout).')
    args = parser.parse_args()
    stage = args.build_dir.resolve()
    folder = Path.home() / '.local/share/runjs-vim-bridge/backups' / ('runjs-4.1.0-' + uuid.uuid4().hex[:12])
    manifest = json.loads((stage / 'manifest.json').read_text())
    app = Path(manifest['app'])
    result = subprocess.run(['pgrep', '-f', str(app / 'Contents/MacOS/RunJS')], capture_output=True)
    if result.returncode != 1:
        raise SystemExit('RunJS must be closed and its process state must be verifiable.')
    for relative, expected in manifest['original_hashes'].items():
        if hashlib.sha256((app / relative).read_bytes()).hexdigest() != expected:
            raise SystemExit('The app changed since the build: ' + relative)
    for name, key in [('app.patched.asar', 'patched_asar_hash'), ('Info.patched.plist', 'patched_info_hash')]:
        if hashlib.sha256((stage / name).read_bytes()).hexdigest() != manifest[key]:
            raise SystemExit('Built artifact hash mismatch: ' + name)
    create_backup(root, stage, folder, manifest, app)
    changed = False
    try:
        for source_name, relative in [('app.patched.asar', 'Contents/Resources/app.asar'),
                                      ('Info.patched.plist', 'Contents/Info.plist')]:
            target = app / relative
            temporary = target.with_name(target.name + '.patch-tmp')
            shutil.copy2(stage / source_name, temporary)
            os.replace(temporary, target)
            changed = True
        # Sign only this local app copy; do not change system protections.
        subprocess.run(['codesign', '--force', '--sign', '-',
                        '--preserve-metadata=entitlements,requirements,flags,runtime', str(app)], check=True)
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    except BaseException:
        if changed:
            subprocess.run([sys.executable, str(folder / 'restore-runjs.py')], check=True)
        raise
    manifest['backup_directory'] = str(folder)
    manifest['installed_hashes'] = {
        relative: hashlib.sha256((app / relative).read_bytes()).hexdigest()
        for relative in manifest['original_hashes']
    }
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'install': 'PASS', 'backup_directory': str(folder),
                      'signature': 'local ad-hoc, verified', 'preferences': 'unchanged'}))
