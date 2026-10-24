"""Prepare isolated real-engine host-command parsing tests, not native app tests."""
import importlib.util
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def main():
    spec = importlib.util.spec_from_file_location('vim_audit', ROOT / 'scripts/prepare-vim-audit.py')
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    output = audit.main()
    commands = (ROOT / 'patches/runjs-4.1.0/bridge-host/commands.cjs').read_text()
    (output / 'host-commands.js').write_text(
        '(()=>{const module={exports:{}};\n' + commands + '\nwindow.HostCommands=module.exports;})();\n')
    for name in ['index.html', 'runner.js']:
        shutil.copy2(ROOT / 'tests/host-audit' / name, output / name)


if __name__ == '__main__':
    main()
