import os
from pathlib import Path


def data_directory(root: Path) -> Path:
    configured = Path(os.environ.get("DATA_DIR") or "data")
    return (configured if configured.is_absolute() else root / configured).resolve()
