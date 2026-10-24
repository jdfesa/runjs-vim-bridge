"""Restore from a verified backup (also works outside the checkout)."""
import sys
from pathlib import Path
import subprocess
sys.path.insert(0, str(Path(__file__).resolve().parent))
from runjs_bridge.restore import main

if __name__ == '__main__':
    main()
