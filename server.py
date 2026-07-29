import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from backend.server import app

__all__ = ["app"]
