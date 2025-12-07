#!/usr/bin/env python3
"""Ad-hoc CLI to rank dogs from the normalized feed."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

from .match import (
    DEFAULT_FEED_PATH,
    DEFAULT_EXPLORATION_K,
    DEFAULT_EXPLORE_SLOTS,
    DEFAULT_MIN_CORE,
    DEFAULT_SOURCE_CAP,
    DEFAULT_TOP_N,
    Preference,
    load_normalized_feed,
    load_views,
    rank_dogs,
)


def parse_preferences(raw: str) -> List[Preference]:
    if not raw:
        return []
    data = json.loads(raw)
    prefs: List[Preference] = []
    for field, cfg in data.items():
        prefs.append(
            Preference(
                field=field,
                hardness=cfg.get("hardness", "nice"),
                weight=cfg.get("weight", 1.0),
                value=cfg.get("value", True),
                must_be_known=cfg.get("must_be_known", False),
            )
        )
    return prefs


def parse_desired(raw: str) -> Dict[str, Any]:
    if not raw:
        return {}
    return json.loads(raw)


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Rank dogs from the normalized feed")
    parser.add_argument("--feed", type=Path, default=DEFAULT_FEED_PATH, help="Path to normalized dogs JSON")
    parser.add_argument("--views", type=Path, default=None, help="Path to views JSON (optional)")
    parser.add_argument("--prefs", type=str, default="", help='JSON string of preferences, e.g. {"good_with_kids": {"hardness": "must", "weight": 1.0}}')
    parser.add_argument("--desired", type=str, default="", help='JSON string of desired base filters, e.g. {"size": "M"}')
    parser.add_argument("--top", type=int, default=DEFAULT_TOP_N, help="Number of dogs to return")
    parser.add_argument("--source-cap", type=int, default=DEFAULT_SOURCE_CAP, help="Max per source in results")
    parser.add_argument("--explore-slots", type=int, default=DEFAULT_EXPLORE_SLOTS, help="Slots reserved for exploration")
    parser.add_argument("--min-core", type=float, default=DEFAULT_MIN_CORE, help="Minimum core_score gate for exploration candidates")
    parser.add_argument("--min-completeness", type=float, default=0.0, help="Minimum completeness for explore candidates")
    parser.add_argument("--exploration-k", type=float, default=DEFAULT_EXPLORATION_K, help="k value for views-based exploration bonus")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    args = parser.parse_args(argv)

    dogs = load_normalized_feed(args.feed)
    views = load_views(args.views) if args.views else {}
    preferences = parse_preferences(args.prefs)
    desired = parse_desired(args.desired)

    ranked = rank_dogs(
        dogs,
        preferences,
        desired=desired,
        views=views,
        top_n=args.top,
        source_cap=args.source_cap,
        exploration_slots=args.explore_slots,
        exploration_k=args.exploration_k,
        min_core_score=args.min_core,
        min_completeness=args.min_completeness,
    )
    output = [
        {
            "id": item["dog"]["id"],
            "name": item["dog"].get("name"),
            "source": item["dog"].get("source_id"),
            "core_score": round(item["core_score"], 3),
            "final_score": round(item["final_score"], 3),
            "reasons": item.get("reasons") or [],
        }
        for item in ranked
    ]
    if args.pretty:
        print(json.dumps(output, indent=2))
    else:
        print(json.dumps(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
