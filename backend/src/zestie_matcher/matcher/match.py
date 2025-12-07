"""Matcher & ranker with completeness-aware explore slots and structured reasons."""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parents[3]
DEFAULT_FEED_PATH = BASE_DIR / "data/normalized/dogs.json"
DEFAULT_VIEWS_PATH = BASE_DIR / "data/normalized/views.json"

# Defaults
DEFAULT_TOP_N = 14
DEFAULT_EXPLORE_SLOTS = 6
DEFAULT_SOURCE_CAP = None
DEFAULT_EXPLORATION_K = 0.1
DEFAULT_MIN_CORE = 0.0

# Key fields counted toward completeness
COMPLETENESS_FIELDS = [
    "good_with_kids",
    "good_with_dogs",
    "good_with_cats",
    "size",
    "age_group",
    "energy_level",
    "house_trained",
    "special_needs",
    "needs_foster",
    "vaccinations_up_to_date",
    "spayed_neutered",
    "location_label",
    "status",
]

SIZE_ORDER = ["XS", "S", "M", "L", "XL"]
AGE_ORDER = ["Puppy", "Young", "Adult", "Senior"]


@dataclass
class Preference:
    field: str
    hardness: str  # "must" | "strong" | "nice"
    weight: float = 1.0
    value: Any = True
    must_be_known: bool = False


def load_normalized_feed(path: Path = DEFAULT_FEED_PATH) -> List[Dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    return data.get("dogs") or []


def load_views(path: Path = DEFAULT_VIEWS_PATH) -> Dict[str, int]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def status_score(status: Optional[str]) -> float:
    if not status:
        return 0.25
    s = status.lower()
    if s == "available":
        return 1.0
    if s == "pending":
        return 0.5
    return 0.25


def closeness(value: Optional[str], target: Optional[str], order: List[str]) -> Optional[float]:
    if not value or not target:
        return None
    if value == target:
        return 1.0
    try:
        dist = abs(order.index(value) - order.index(target))
    except ValueError:
        return 0.4
    if dist == 1:
        return 0.7
    return 0.4


def completeness_score(dog: Dict[str, Any]) -> float:
    present = 0
    for field in COMPLETENESS_FIELDS:
        if dog.get(field) is not None:
            present += 1
    return present / len(COMPLETENESS_FIELDS)


def location_match_score(dog: Dict[str, Any], desired: Dict[str, Any]) -> float:
    loc_pref = desired.get("location_label")
    if not loc_pref:
        return 0.0
    label = (dog.get("location_label") or "").lower()
    state = (dog.get("location_state") or "").lower()
    wants = loc_pref.lower()
    wants_state = (desired.get("location_state") or "").lower()
    if label == wants:
        return 1.0
    if wants_state and state == wants_state:
        return 0.7
    return 0.4


def base_score(
    dog: Dict[str, Any],
    desired: Dict[str, Any],
    opted_in_special_needs: bool = False,
) -> Tuple[float, List[Dict[str, Any]]]:
    reasons: List[Dict[str, Any]] = []
    components: List[float] = []
    # Status
    status_val = status_score(dog.get("status"))
    components.append(status_val)
    reasons.append({"field": "status", "effect": "base", "message": f"status score {status_val:.2f}"})
    # Special needs penalty by default
    if dog.get("special_needs") is True and not opted_in_special_needs:
        components.append(0.6)
        reasons.append({"field": "special_needs", "effect": "base", "message": "needs special care"})
    # Location rough match
    loc_pref = desired.get("location_label")
    if loc_pref:
        label = (dog.get("location_label") or "").lower()
        state = (dog.get("location_state") or "").lower()
        wants = loc_pref.lower()
        wants_state = (desired.get("location_state") or "").lower()
        if label == wants:
            components.append(1.0)
            reasons.append({"field": "location_label", "effect": "base", "message": "location match"})
        elif wants_state and state == wants_state:
            components.append(0.7)
            reasons.append({"field": "location_state", "effect": "base", "message": "same state"})
        else:
            components.append(0.4)
            reasons.append({"field": "location_label", "effect": "base", "message": "different location"})
    # Size/age as base (optional; can be turned off by omitting desired)
    size_pref = desired.get("size")
    size_val = dog.get("size")
    size_component = closeness(size_val, size_pref, SIZE_ORDER) if size_pref else None
    if size_component is not None:
        components.append(size_component)
        reasons.append({"field": "size", "effect": "base", "message": f"size closeness {size_component:.2f}"})
    age_pref = desired.get("age_group")
    age_val = dog.get("age_group")
    age_component = closeness(age_val, age_pref, AGE_ORDER) if age_pref else None
    if age_component is not None:
        components.append(age_component)
        reasons.append({"field": "age_group", "effect": "base", "message": f"age closeness {age_component:.2f}"})
    if not components:
        return 0.5, reasons
    return sum(components) / len(components), reasons


def preference_contribution(pref: Preference, dog: Dict[str, Any]) -> Tuple[float, bool, str]:
    value = dog.get(pref.field)
    hardness = pref.hardness.lower()

    if pref.must_be_known and value is None:
        return 0.0, True, "unknown not allowed"

    target = pref.value
    if hardness == "must":
        if value is None:
            return 0.0, False, "unknown"
        if isinstance(value, bool) and isinstance(target, bool):
            if value != target:
                return 0.0, True, "explicit conflict"
            return pref.weight, False, "match"
        if target is not None:
            if str(value).lower() != str(target).lower():
                return 0.0, True, "mismatch"
            return pref.weight, False, "match"
        if value is False:
            return 0.0, True, "explicit false"
        return pref.weight if value in (True,) else 0.0, False, "match" if value else "unknown"

    if value is None:
        return 0.0, False, "unknown"

    if isinstance(value, bool):
        if value is True:
            return pref.weight if hardness == "strong" else pref.weight / 2.0, False, "match"
        return (-pref.weight if hardness == "strong" else -pref.weight / 2.0), False, "conflict"

    if target is None:
        return 0.0, False, "neutral"
    if str(value).lower() == str(target).lower():
        return pref.weight if hardness == "strong" else pref.weight / 2.0, False, "match"
    return (-pref.weight if hardness == "strong" else -pref.weight / 2.0), False, "conflict"


def preferences_score(preferences: Iterable[Preference], dog: Dict[str, Any]) -> Tuple[float, bool, List[Dict[str, Any]]]:
    total = 0.0
    drop = False
    reasons: List[Dict[str, Any]] = []
    active_weights = 0.0
    for pref in preferences:
        contribution, should_drop, note = preference_contribution(pref, dog)
        if should_drop:
            reasons.append({"field": pref.field, "effect": "drop", "message": f"Must failed: {note}"})
            drop = True
            break
        total += contribution
        active_weights += abs(pref.weight)
        if contribution > 0:
            reasons.append({"field": pref.field, "effect": "match", "message": f"{pref.field} matched"})
        elif contribution < 0:
            reasons.append({"field": pref.field, "effect": "negative", "message": f"{pref.field} conflicted"})
        else:
            reasons.append({"field": pref.field, "effect": "neutral", "message": f"{pref.field} {note}"})
    if active_weights > 0:
        total = total / active_weights
    return total, drop, reasons


def exploration_bonus(dog_id: str, views: Dict[str, int], k: float = DEFAULT_EXPLORATION_K) -> float:
    seen = views.get(dog_id, 0)
    return k / math.sqrt(1 + seen)


def score_dog(
    dog: Dict[str, Any],
    desired: Dict[str, Any],
    preferences: Iterable[Preference],
    views: Optional[Dict[str, int]] = None,
    exploration_k: float = DEFAULT_EXPLORATION_K,
) -> Optional[Dict[str, Any]]:
    pref_list = list(preferences)
    pref_score, drop, pref_reasons = preferences_score(pref_list, dog)
    if drop:
        return None
    opted_in_special = any(
        p.field == "special_needs" and p.value is True and p.hardness.lower() in ("nice", "strong", "must")
        for p in pref_list
    )
    base, base_reasons = base_score(dog, desired, opted_in_special_needs=opted_in_special)
    core_score = base + pref_score
    bonus = exploration_bonus(dog["id"], views or {}, exploration_k)
    final_score = core_score + bonus
    reasons = pref_reasons + base_reasons
    return {
        "dog": dog,
        "base_score": base,
        "pref_score": pref_score,
        "core_score": core_score,
        "exploration_bonus": bonus,
        "final_score": final_score,
        "reasons": reasons,
        "completeness": completeness_score(dog),
    }


def apply_source_cap(scored: List[Dict[str, Any]], cap: Optional[int]) -> List[Dict[str, Any]]:
    if cap is None or cap <= 0:
        return scored
    picked: List[Dict[str, Any]] = []
    counts: Dict[str, int] = {}
    for item in scored:
        source = item["dog"].get("source_id") or "unknown"
        if counts.get(source, 0) < cap:
            picked.append(item)
            counts[source] = counts.get(source, 0) + 1
    return picked


def rank_dogs(
    dogs: List[Dict[str, Any]],
    preferences: Iterable[Preference],
    desired: Optional[Dict[str, Any]] = None,
    views: Optional[Dict[str, int]] = None,
    top_n: int = DEFAULT_TOP_N,
    source_cap: Optional[int] = DEFAULT_SOURCE_CAP,
    exploration_slots: int = DEFAULT_EXPLORE_SLOTS,
    exploration_k: float = DEFAULT_EXPLORATION_K,
    min_core_score: float = DEFAULT_MIN_CORE,
    min_completeness: float = 0.0,
    tag_explore_reason: bool = True,
) -> List[Dict[str, Any]]:
    desired = desired or {}
    views = views or {}
    scored: List[Dict[str, Any]] = []
    for dog in dogs:
        res = score_dog(dog, desired, preferences, views=views, exploration_k=exploration_k)
        if res:
            scored.append(res)
    scored.sort(key=lambda x: x["final_score"], reverse=True)
    capped = apply_source_cap(scored, source_cap)
    if exploration_slots <= 0 or top_n <= 0:
        return capped[:top_n]

    best_count = max(0, top_n - exploration_slots)
    best = capped[:best_count]
    # Track how many dogs from each source are already in the best list so that
    # Explore can preferentially surface under-represented sources when possible.
    source_counts_best: Dict[str, int] = {}
    for item in best:
        source = item["dog"].get("source_id") or "unknown"
        source_counts_best[source] = source_counts_best.get(source, 0) + 1

    used_ids = {item["dog"]["id"] for item in best}
    remainder = [item for item in scored if item["dog"]["id"] not in used_ids]
    explore_pool = [
        item for item in remainder
        if item["core_score"] >= min_core_score and item["completeness"] >= min_completeness
    ]
    explore_pool.sort(
        key=lambda x: (
            views.get(x["dog"]["id"], 0),  # low views first
            source_counts_best.get(x["dog"].get("source_id") or "unknown", 0),  # sources with fewer best hits first
            x["completeness"],            # low completeness first
            x["dog"].get("special_needs") is True,  # special care later unless requested explicitly
            -x["final_score"],            # then stronger overall (with bonus)
        )
    )
    explore = explore_pool[:exploration_slots]
    used_ids.update(item["dog"]["id"] for item in explore)

    if len(explore) < exploration_slots:
        fallback_candidates = [item for item in remainder if item["dog"]["id"] not in used_ids]

        def fallback_key(item: Dict[str, Any]) -> Tuple[float, ...]:
            dog = item["dog"]
            loc_score = location_match_score(dog, desired)
            size_score_raw = closeness(dog.get("size"), desired.get("size"), SIZE_ORDER)
            size_score = 0.0 if size_score_raw is None else size_score_raw
            age_score_raw = closeness(dog.get("age_group"), desired.get("age_group"), AGE_ORDER)
            age_score = 0.0 if age_score_raw is None else age_score_raw
            sex_score = 0.0
            if desired.get("sex"):
                sex_score = 1.0 if str(dog.get("sex") or "").lower() == str(desired.get("sex")).lower() else 0.0
            return (
                -loc_score,
                -size_score,
                -age_score,
                -sex_score,
                dog.get("special_needs") is True,
                views.get(dog["id"], 0),
                item["completeness"],
                -item["final_score"],
            )

        fallback_candidates.sort(key=fallback_key)
        needed = exploration_slots - len(explore)
        explore.extend(fallback_candidates[:needed])

    if tag_explore_reason:
        for item in explore:
            item["reasons"].append({"field": "explore_slot", "effect": "explore", "message": "Shown in Explore to surface lower-info dogs"})
    combined = best + explore
    # Mark section
    for item in combined:
        item["section"] = "best" if item in best else "explore"
    return combined[:top_n]


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
