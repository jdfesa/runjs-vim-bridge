"""Build an additive RunJS patch. See runjs_bridge for implementation modules."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from runjs_bridge.archive import digest, parse_archive, packed_files, content, integrity
from runjs_bridge.build import main

if __name__ == '__main__':
    main()
