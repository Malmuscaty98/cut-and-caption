"""Entry point used by the launchers: imports the engine from this folder directly (no editable
install / .pth file — macOS can flag those hidden and Python then skips them)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cutcaption.cli import main  # noqa: E402

main()
