#!/usr/bin/env python3
"""Fetch adoptable dogs from RescueGroups and filter for the tri-state area."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

import requests

DEFAULT_STATES = ("NY", "NJ", "CT")
API_URL = "https://api.rescuegroups.org/v5/public/animals"
OUTPUT_PATH = Path("data/raw/rescuegroups/tri_state_dogs.json")


def require_api_key() -> str:
    api_key = os.environ.get("RESCUEGROUPS_API_KEY")
    if not api_key:
        raise RuntimeError("RESCUEGROUPS_API_KEY environment variable is not set")
    return api_key


def fetch_animals(api_key: str, limit: int, states_filter: Optional[Sequence[str]] = None) -> Dict[str, Any]:
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json",
    }
    params = {
        "filter[species]": "Dog",
        "filter[status]": "Available",
        "limit": limit,
        "fields[animals]": ",".join(
            [
                "name",
                "ageGroup",
                "sex",
                "breedPrimary",
                "breedSecondary",
                "sizeGroup",
                "descriptionText",
                "pictureUrl",
                "locationCity",
                "locationState",
            ]
        ),
    }
    if states_filter:
        state_values = ",".join(sorted({state.upper() for state in states_filter if state}))
        if state_values:
            params["filter[locations.state]"] = state_values
    response = requests.get(API_URL, headers=headers, params=params, timeout=20)
    response.raise_for_status()
    return response.json()


def load_fixture(path: Path) -> Dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def build_lookup(included: Sequence[Dict[str, Any]], type_name: str) -> Dict[str, Dict[str, Any]]:
    lookup: Dict[str, Dict[str, Any]] = {}
    for item in included or []:
        if item.get("type") == type_name:
            lookup[item["id"]] = item.get("attributes", {})
    return lookup


def extract_animals(payload: Dict[str, Any], states: Optional[Sequence[str]]) -> List[Dict[str, Any]]:
    states_upper = {state.upper() for state in states} if states else None
    included = payload.get("included") or []
    location_lookup = build_lookup(included, "locations")
    picture_lookup = build_lookup(included, "pictures")

    records: List[Dict[str, Any]] = []
    for entry in payload.get("data", []):
        attributes = entry.get("attributes", {})
        location_attrs: Dict[str, Any] = {}
        for item in entry.get("relationships", {}).get("locations", {}).get("data", []):
            location_id = item.get("id")
            if location_id:
                location_attrs = location_lookup.get(location_id, {})
                break
        state = (
            location_attrs.get("stateProvince")
            or location_attrs.get("state")
            or attributes.get("locationState")
            or ""
        ).upper()
        if states_upper and state not in states_upper:
            continue
        city = location_attrs.get("city") or attributes.get("locationCity")
        postal_code = location_attrs.get("postalcode") or attributes.get("locationPostalcode")
        picture_urls: List[str] = []
        for pic in entry.get("relationships", {}).get("pictures", {}).get("data", []):
            pic_attrs = picture_lookup.get(pic.get("id"), {})
            large = pic_attrs.get("large") or {}
            url = large.get("url")
            if url:
                picture_urls.append(url)
        if not picture_urls:
            attr_url = attributes.get("pictureUrl")
            if attr_url:
                picture_urls.append(attr_url)
        records.append(
            {
                "id": entry.get("id"),
                "name": attributes.get("name"),
                "age_group": attributes.get("ageGroup"),
                "sex": attributes.get("sex"),
                "breed_primary": attributes.get("breedPrimary"),
                "breed_secondary": attributes.get("breedSecondary"),
                "size_group": attributes.get("sizeGroup"),
                "description": attributes.get("descriptionText"),
                "status": attributes.get("status"),
                "location": {
                    "city": city,
                    "state": state,
                    "postal_code": postal_code,
                },
                "photos": picture_urls,
            }
        )
    return records


def write_output(data: Dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def parse_states(value: Optional[str]) -> List[str]:
    if not value:
        return list(DEFAULT_STATES)
    return [part.strip().upper() for part in value.split(",") if part.strip()]


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Fetch RescueGroups dogs for the tri-state area")
    parser.add_argument("--states", help="Comma separated list of state abbreviations (default NY,NJ,CT)")
    parser.add_argument("--all-states", action="store_true", help="Include dogs from every state")
    parser.add_argument("--limit", type=int, default=100, help="Maximum number of animals to fetch (max 100)")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH, help="Path for the JSON output")
    parser.add_argument("--fixture", type=Path, help="Optional fixture file to use instead of the API")
    parser.add_argument("--count-only", action="store_true", help="Print the count without writing a file")
    args = parser.parse_args(list(argv) if argv is not None else None)

    states: Optional[List[str]]
    if args.all_states:
        states = None
    else:
        states = parse_states(args.states)
        if not states:
            parser.error("states list cannot be empty")

    if args.fixture:
        payload = load_fixture(args.fixture)
    else:
        api_key = require_api_key()
        if args.limit > 100:
            parser.error("limit cannot exceed 100 (RescueGroups API maximum)")
        payload = fetch_animals(api_key, args.limit, states)

    dogs = extract_animals(payload, states)
    result = {
        "source": "RescueGroups",
        "states": states if states is not None else ["ALL"],
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(dogs),
        "dogs": dogs,
    }
    if args.count_only:
        print(f"Found {len(dogs)} dogs")
    else:
        write_output(result, args.output)
        print(f"Saved {len(dogs)} dogs to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
