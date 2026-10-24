"""Restore RunJS

Restore only the files changed by the patch and the outer app signature.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description='Restore RunJS from a verified backup.')
    parser.add_argument('backup', nargs='?', type=Path, default=Path(sys.argv[0]).resolve().parent)
    args = parser.parse_args()
    folder = args.backup.resolve()
    if not (folder / 'manifest.json').is_file():
        raise SystemExit('Specify the backup directory containing manifest.json.')
    manifest = json.loads((folder / 'manifest.json').read_text())
    app = Path(manifest['app'])
    result = subprocess.run(['pgrep', '-f', str(app / 'Contents/MacOS/RunJS')], capture_output=True)
    if result.returncode == 0:
        raise SystemExit('Close RunJS before restoring it.')
    if result.returncode not in (0, 1):
        raise SystemExit('Could not verify whether RunJS is closed.')
    for relative, expected in manifest.get('installed_hashes', {}).items():
        target = app / relative
        if hashlib.sha256(target.read_bytes()).hexdigest() != expected:
            raise SystemExit('RunJS changed after patching; refusing to overwrite: ' + relative)
    for relative, expected in manifest['original_hashes'].items():
        source = folder / 'original-files' / relative
        if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
            raise SystemExit('Backup hash mismatch: ' + relative)
    for relative in manifest['original_hashes']:
        source = folder / 'original-files' / relative
        target = app / relative
        temporary = target.with_name(target.name + '.restore-tmp')
        shutil.copy2(source, temporary)
        os.replace(temporary, target)
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    print('Pre-install RunJS restored. The full backup remains in runjs-original.zip.')
