"""Install a verified build with full backup and rollback."""
import sys
from pathlib import Path
import subprocess
sys.path.insert(0, str(Path(__file__).resolve().parent))
from runjs_bridge.install import main

if __name__ == '__main__':
    main()
