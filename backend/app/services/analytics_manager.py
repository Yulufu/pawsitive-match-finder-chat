from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from threading import Lock
from typing import Dict, Any

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_ANALYTICS_PATH = BASE_DIR / "data" / "analytics" / "usage.json"


class AnalyticsManager:
    def __init__(self, path: Path | None = None) -> None:
        self._path = path or DEFAULT_ANALYTICS_PATH
        self._data: Dict[str, Any] = {}
        self._lock = Lock()

    def _init_defaults(self) -> None:
        self._data = {
            "total_sessions": 0,
            "recommend_calls": 0,
            "dog_views": 0,
            "explore_slots_served": 0,
            "prompt_accepts": 0,
            "prompt_declines": 0,
            "popular_filters": {},
            "daily": {},
        }

    def _prune_old_daily(self, keep_days: int = 90) -> None:
        daily = self._data.get("daily")
        if not daily:
            return
        cutoff = (datetime.utcnow() - timedelta(days=keep_days)).strftime("%Y-%m-%d")
        self._data["daily"] = {date: stats for date, stats in daily.items() if date >= cutoff}

    def load(self) -> None:
        try:
            if self._path.exists():
                text = self._path.read_text(encoding="utf-8")
                self._data = json.loads(text)
            else:
                self._init_defaults()
        except (json.JSONDecodeError, OSError):
            self._init_defaults()
        self._prune_old_daily()

    def save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._path.with_suffix(self._path.suffix + ".tmp")
        temp_path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
        temp_path.replace(self._path)

    def _increment_daily(self, key: str, amount: int) -> None:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        daily = self._data.setdefault("daily", {})
        day_bucket = daily.setdefault(today, {})
        day_bucket[key] = day_bucket.get(key, 0) + amount

    def increment(self, key: str, amount: int = 1) -> None:
        with self._lock:
            self._data[key] = self._data.get(key, 0) + amount
            self._increment_daily(key, amount)
            self.save()

    def track_filter(self, field: str, value: str) -> None:
        if not value:
            return
        with self._lock:
            filters = self._data.setdefault("popular_filters", {})
            field_bucket = filters.setdefault(field, {})
            field_bucket[value] = field_bucket.get(value, 0) + 1
            self.save()

    def record_prompt(self, accepted: bool) -> None:
        key = "prompt_accepts" if accepted else "prompt_declines"
        self.increment(key)

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            return json.loads(json.dumps(self._data))


analytics_manager = AnalyticsManager()
