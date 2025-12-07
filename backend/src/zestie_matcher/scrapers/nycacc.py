#!/usr/bin/env python3
"""Fetch adoptable pets from the NYC ACC Flutter API (list + optional detail links)."""
from __future__ import annotations

import argparse
import json
import sys
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

import requests
from bs4 import BeautifulSoup

TOKEN_URL = "https://pets.mcgilldevtech.com/token"
GRAPHQL_URL = "https://pets.mcgilldevtech.com/graphql"
API_KEY = "jKbOSNYtJn5qhYbsv9IKL6OEt7etN6jcALlerH82"
ORGANIZATION = "accofnyc"
CLIENT_NAME = "ACC Web"
CLIENT_VERSION = "Sat Jul 12 08:24:37 AM CDT 2025"

FEED_QUERY = """
fragment ACCPetFragment on Pet {
  id
  name
  age
  type
  species
  link
  gender
  summaryHtml
  weight
  location
  locationInShelter
  photos
  youTubeIds
  intakeDate
}
query ACCGetFeed {
  feed {
    __typename
    updated
    pets {
      ...ACCPetFragment
    }
  }
}
"""

ADOPET_QUERY = """
  query ACCAdopetsStatus($id: ID!) {
    adopetStatus(id: $id){
      link
    }
  }
"""


def base_headers() -> Dict[str, str]:
    return {
        "accept": "application/json; charset=UTF-8",
        "content-type": "application/json; charset=UTF-8",
        "x-api-key": API_KEY,
        "referer": "https://nycacc.app/",
        "sec-ch-ua": '"Chromium";v="141", "Not?A_Brand";v="8"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "user-agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
        ),
        "apollographql-client-name": CLIENT_NAME,
        "apollographql-client-version": CLIENT_VERSION,
    }


def fetch_token(session: requests.Session, device_id: str, timeout: float) -> str:
    headers = base_headers()
    payload = {"deviceId": device_id, "organization": ORGANIZATION}
    response = session.post(TOKEN_URL, headers=headers, json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    token = data.get("access_token")
    if not token:
        raise RuntimeError("token endpoint did not return access_token")
    return token


def graphql_headers(token: str) -> Dict[str, str]:
    headers = base_headers()
    headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_feed(session: requests.Session, token: str, timeout: float) -> Dict[str, Any]:
    payload = {"query": FEED_QUERY}
    response = session.post(GRAPHQL_URL, headers=graphql_headers(token), json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL feed returned errors: {data['errors']}")
    return data


def fetch_adopet_status(
    session: requests.Session, token: str, pet_id: str, timeout: float
) -> Optional[str]:
    payload = {"query": ADOPET_QUERY, "variables": {"id": pet_id}}
    response = session.post(GRAPHQL_URL, headers=graphql_headers(token), json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    if "errors" in data:
        return None
    return (data.get("data") or {}).get("adopetStatus", {}).get("link")


def clean_html(html_text: Optional[str]) -> str:
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, "html.parser")
    return soup.get_text(separator=" ", strip=True)


def build_profile_id(source_id: str, source_animal_id: Optional[str], detail_url: Optional[str]) -> str:
    if source_animal_id:
        return f"{source_id}:{source_animal_id}"
    key = f"{source_id}:{detail_url or ''}"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
    return f"{source_id}:{digest}"


def normalize_pets(
    feed_data: Dict[str, Any],
    include_details: bool,
    session: requests.Session,
    token: str,
    timeout: float,
    allowed_types: Optional[set[str]] = None,
) -> Dict[str, Any]:
    feed = (feed_data.get("data") or {}).get("feed") or {}
    pets: List[Dict[str, Any]] = []
    for pet in feed.get("pets", []):
        if allowed_types:
            pet_type = (pet.get("type") or "").strip().lower()
            pet_species = (pet.get("species") or "").strip().lower()
            if pet_type not in allowed_types and pet_species not in allowed_types:
                continue
        pet_copy = dict(pet)
        if include_details:
            link = fetch_adopet_status(session, token, pet.get("id", ""), timeout)
            if link:
                pet_copy["adopets_link"] = link
        source_id = "nycacc"
        source_animal_id = pet.get("id")
        detail_url = pet_copy.get("adopets_link") or pet.get("link")
        pet_copy["source_id"] = source_id
        pet_copy["source_animal_id"] = source_animal_id
        pet_copy["profile_id"] = build_profile_id(source_id, source_animal_id, detail_url)
        pet_copy["detail_url"] = detail_url
        pet_copy["status_raw"] = pet.get("status")
        pet_copy["status"] = "Unknown"
        pet_copy["location_label"] = pet.get("locationInShelter") or pet.get("location")
        photos = pet.get("photos") or []
        pet_copy["primary_photo_url"] = photos[0] if photos else None
        pet_copy["photo_urls"] = photos
        pet_copy["video_urls"] = pet.get("youTubeIds") or []
        pet_copy["description_html"] = pet.get("summaryHtml")
        pet_copy["description"] = clean_html(pet.get("summaryHtml"))
        pet_copy["age_text"] = pet.get("age")
        pets.append(pet_copy)
    return {
        "source": "nycacc.app",
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "feed_updated": feed.get("updated"),
        "count": len(pets),
        "pets": pets,
    }


def write_output(data: Dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def parse_args(argv: Optional[Iterable[str]]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch adoptable pets from nycacc.app GraphQL API")
    parser.add_argument(
        "--device-id",
        default=str(uuid4()),
        help="Device ID sent to the token endpoint (default: random UUID)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/raw/nycacc/feed.json"),
        help="Path to write the JSON output",
    )
    parser.add_argument(
        "--include-details",
        action="store_true",
        help="Also fetch adopetStatus per pet to capture the Adopets link",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="Request timeout in seconds",
    )
    parser.add_argument(
        "--type",
        dest="pet_type",
        default="Dog",
        help='Pet type to include (default: "Dog").',
    )
    parser.add_argument(
        "--all-types",
        action="store_true",
        help="Include all pet types instead of filtering to dogs.",
    )
    return parser.parse_args(list(argv) if argv is not None else None)


def main(argv: Optional[Iterable[str]] = None) -> int:
    args = parse_args(argv)
    session = requests.Session()
    allowed_types: Optional[set[str]]
    if args.all_types:
        allowed_types = None
    else:
        allowed_types = {args.pet_type.lower()} if args.pet_type else None
    try:
        token = fetch_token(session, args.device_id, args.timeout)
        feed_data = fetch_feed(session, token, args.timeout)
        result = normalize_pets(
            feed_data,
            args.include_details,
            session,
            token,
            args.timeout,
            allowed_types=allowed_types,
        )
    except requests.HTTPError as exc:
        resp = exc.response
        if resp is not None:
            print(f"Request failed ({resp.status_code}): {resp.text}", file=sys.stderr)
        else:
            print(f"Request failed: {exc}", file=sys.stderr)
        return 1
    except requests.RequestException as exc:
        print(f"Request failed: {exc}", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    write_output(result, args.output)
    print(f"Saved {result['count']} pets to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
