from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Dict

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_VIEWS_PATH = BASE_DIR / "data" / "normalized" / "views.json"


class ViewManager:
    def __init__(self, path: Path | None = None) -> None:
        self._path = path or DEFAULT_VIEWS_PATH
        self._views: Dict[str, int] = {}
        self._lock = Lock()

    def load(self) -> None:
        try:
            text = self._path.read_text(encoding="utf-8")
            data = json.loads(text)
            if isinstance(data, dict):
                self._views = {str(k): int(v) for k, v in data.items()}
            else:
                self._views = {}
        except FileNotFoundError:
            self._views = {}
        except json.JSONDecodeError:
            self._views = {}

    def get_views(self) -> Dict[str, int]:
        return dict(self._views)

    def increment(self, dog_id: str) -> int:
        with self._lock:
            current = self._views.get(dog_id, 0) + 1
            self._views[dog_id] = current
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(json.dumps(self._views, indent=2), encoding="utf-8")
            return current


view_manager = ViewManager()
