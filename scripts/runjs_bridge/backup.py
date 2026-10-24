"""Create a private full-app backup and portable rollback tooling."""
import os
import shutil
import subprocess

from .archive import digest


def create(root, stage, folder, manifest, app):
    folder.mkdir(parents=True, exist_ok=False)
    os.chmod(folder, 0o700)
    shutil.copy2(stage / 'manifest.json', folder / 'manifest.json')
    backup_sources = [(root / 'scripts/restore-runjs.py', 'restore-runjs.py'),
                      (root / 'README.md', 'README.md')]
    backup_sources.extend((source, source.name)
                          for source in sorted((root / 'patches/runjs-4.1.0').iterdir()) if source.is_file())
    shutil.copytree(root / 'scripts/runjs_bridge', folder / 'runjs_bridge',
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    shutil.copytree(root / 'patches/runjs-4.1.0/bridge-host', folder / 'bridge-host')
    for source, name in backup_sources:
        shutil.copy2(source, folder / name)
    for relative in manifest['original_hashes']:
        target = folder / 'original-files' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(app / relative, target)
    subprocess.run(['ditto', '-c', '-k', '--sequesterRsrc', '--keepParent',
                    str(app), str(folder / 'runjs-original.zip')], check=True)
    subprocess.run(['unzip', '-tq', str(folder / 'runjs-original.zip')], check=True,
                   stdout=subprocess.DEVNULL)
    for relative, expected in manifest['original_hashes'].items():
        if digest((folder / 'original-files' / relative).read_bytes()) != expected:
            raise SystemExit('Backup hash mismatch: ' + relative)
        if digest((app / relative).read_bytes()) != expected:
            raise SystemExit('The app changed while backing up: ' + relative)
