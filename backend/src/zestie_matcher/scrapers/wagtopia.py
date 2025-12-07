#!/usr/bin/env python3
"""Scrape adoptable dog data from Wagtopia (Petstablished public search API)."""
from __future__ import annotations

import argparse
import dataclasses
import json
import sys
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Sequence

import requests

SEARCH_URL = "https://petstablished.com/api/v2/public/search/"
PET_URL = SEARCH_URL + "pet/{pet_id}"
DEFAULT_ZIP = "10001"
DEFAULT_GEO_RANGE = 200  # miles
DEFAULT_STATES = ("NY",)
DEFAULT_TIMEOUT = 30  # Increased from 15 to handle slow API responses
DEFAULT_LIMIT = 100  # Reasonable default to avoid extremely long scrapes
DEFAULT_OUTPUT = Path("data/raw/wagtopia/wagtopia.json")
USER_AGENT = "ShelterDogMatcherBot/0.1 (+https://github.com/Yulufu/zestie_matcher)"


@dataclasses.dataclass
class PetSummary:
    pet_id: int
    name: str
    age: Optional[str]
    size: Optional[str]
    sex: Optional[str]
    status: Optional[str]
    primary_breed: Optional[str]
    secondary_breed: Optional[str]
    public_url: Optional[str]
    adopt_url: Optional[str]
    foster_url: Optional[str]
    photo_url: Optional[str]
    shelter_name: Optional[str]
    shelter_id: Optional[int]
    shelter_state: Optional[str]
    raw: Dict[str, any]


@dataclasses.dataclass
class PetDetail:
    pet: Dict[str, any]
    shelter: Dict[str, any]
    raw: Dict[str, any]


def normalize_state(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return str(value).strip().upper()


def infer_state_from_zip(zip_code: Optional[str]) -> Optional[str]:
    if not zip_code:
        return None
    match = re.match(r"(\d{3})", str(zip_code))
    if not match:
        return None
    prefix = int(match.group(1))
    if 100 <= prefix <= 149:
        return "NY"
    return None


def is_matching_state(detail: PetDetail, target_states: Sequence[str]) -> bool:
    if not target_states:
        return True
    desired = {normalize_state(s) for s in target_states if s}
    pet = detail.pet
    shelter = detail.shelter
    candidates: List[Optional[str]] = []
    candidates.append(normalize_state(shelter.get("state")))
    candidates.append(normalize_state(pet.get("current_state")))
    for key in ("current_location_zip", "current_zip", "postalcode"):
        if pet.get(key):
            candidates.append(infer_state_from_zip(pet.get(key)))
        if shelter.get(key):
            candidates.append(infer_state_from_zip(shelter.get(key)))
    location_label = pet.get("current_location") or ""
    match = re.search(r",\s*([A-Za-z]{2})\b", location_label)
    if match:
        candidates.append(match.group(1).upper())
    for candidate in candidates:
        if candidate and candidate in desired:
            return True
    return False


def build_summary(raw: Dict[str, any]) -> PetSummary:
    return PetSummary(
        pet_id=int(raw["pet_id"]),
        name=raw.get("pet_name") or "",
        age=raw.get("age"),
        size=raw.get("size"),
        sex=raw.get("sex"),
        status=raw.get("status"),
        primary_breed=raw.get("primary_breed"),
        secondary_breed=raw.get("secondary_breed"),
        public_url=raw.get("public_url"),
        adopt_url=raw.get("adopt_url"),
        foster_url=raw.get("foster_url"),
        photo_url=raw.get("results_photo_url") or raw.get("large_results_photo_url"),
        shelter_name=raw.get("shelter_name"),
        shelter_id=raw.get("shelter_id"),
        shelter_state=normalize_state(raw.get("shelter_state")),
        raw=raw,
    )


def build_detail(raw: Dict[str, any]) -> PetDetail:
    pet = raw.get("pet") or {}
    shelter = raw.get("shelter") or {}
    return PetDetail(pet=pet, shelter=shelter, raw=raw)


def fetch_search_page(
    page: int, *, zip_code: str, geo_range: int, session: requests.Session
) -> Dict[str, any]:
    params = {
        "animal": "Dog",
        "zip": zip_code,
        "geo_range": geo_range,
        "mode": "Pet",
        "page": page,
    }
    resp = session.get(
        SEARCH_URL, params=params, timeout=DEFAULT_TIMEOUT, headers={"User-Agent": USER_AGENT}
    )
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, dict) or "pets" not in data:
        raise RuntimeError("Unexpected response from Wagtopia search API")
    return data


def fetch_pet_detail(pet_id: int, *, session: requests.Session, retries: int = 2) -> Dict[str, any]:
    """Fetch pet detail with retry logic."""
    url = PET_URL.format(pet_id=pet_id)
    last_error = None

    for attempt in range(retries + 1):
        try:
            resp = session.get(url, timeout=DEFAULT_TIMEOUT, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            return resp.json()
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            last_error = e
            if attempt < retries:
                wait_time = (attempt + 1) * 2  # 2s, 4s
                time.sleep(wait_time)
                continue
            raise last_error


def build_record(summary: PetSummary, detail: PetDetail) -> Dict[str, any]:
    pet = detail.pet
    shelter = detail.shelter
    photo_urls: List[str] = []
    for photo in pet.get("photos") or []:
        url = photo.get("main_photo_url") or photo.get("thumb_url")
        if url:
            photo_urls.append(url)
    primary_photo = summary.photo_url or (photo_urls[0] if photo_urls else None)
    video_urls: List[str] = []
    if pet.get("youtube_url"):
        video_urls.append(pet["youtube_url"])
    for url in pet.get("youtube_urls") or []:
        if url:
            video_urls.append(url)
    detail_url = summary.public_url or f"https://www.wagtopia.com/search/pet?id={summary.pet_id}"
    return {
        "pet_id": summary.pet_id,
        "name": summary.name or pet.get("name"),
        "sex": summary.sex or pet.get("sex"),
        "age": summary.age or pet.get("age"),
        "size": summary.size or pet.get("size"),
        "status": summary.status or pet.get("status"),
        "weight": pet.get("weight"),
        "primary_breed": summary.primary_breed or pet.get("primary_breed"),
        "secondary_breed": summary.secondary_breed or pet.get("secondary_breed"),
        "description": pet.get("description"),
        "description_html": pet.get("description"),
        "adoption_fee": pet.get("adoption_fee"),
        "detail_url": detail_url,
        "public_url": summary.public_url,
        "adopt_url": summary.adopt_url or pet.get("adopt_url"),
        "foster_url": summary.foster_url or pet.get("foster_url"),
        "current_location": pet.get("current_location"),
        "current_location_zip": pet.get("current_location_zip") or pet.get("current_zip"),
        "shelter_name": summary.shelter_name or shelter.get("organization_name"),
        "shelter_state": normalize_state(summary.shelter_state or shelter.get("state")),
        "shelter_email": shelter.get("email") or summary.raw.get("shelter_email"),
        "shelter_phone": shelter.get("phone") or summary.raw.get("shelter_phone_number"),
        "primary_photo_url": primary_photo,
        "photo_urls": photo_urls,
        "video_urls": video_urls,
        "has_special_need": pet.get("has_special_need"),
        "is_ok_with_other_dogs": pet.get("is_ok_with_other_dogs"),
        "is_ok_with_other_cats": pet.get("is_ok_with_other_cats"),
        "is_ok_with_other_kids": pet.get("is_ok_with_other_kids"),
        "options": pet.get("options") or [],
        "needs_foster": pet.get("needs_foster"),
    }


def scrape_wagtopia(
    zip_code: str = DEFAULT_ZIP,
    geo_range: int = DEFAULT_GEO_RANGE,
    states: Sequence[str] = DEFAULT_STATES,
    *,
    max_pages: Optional[int] = None,
    limit: Optional[int] = None,
    page_delay: float = 0.1,
    workers: int = 10,
    search_fetcher: Optional[Callable[[int], Dict[str, any]]] = None,
    detail_fetcher: Optional[Callable[[int], Dict[str, any]]] = None,
) -> Dict[str, any]:
    if workers < 1:
        raise ValueError("workers must be at least 1")

    search_session = requests.Session()
    thread_local = threading.local()

    def get_detail_session() -> requests.Session:
        if not hasattr(thread_local, "session"):
            thread_local.session = requests.Session()
        return thread_local.session

    default_search = lambda page: fetch_search_page(
        page, zip_code=zip_code, geo_range=geo_range, session=search_session
    )
    default_detail = lambda pet_id: fetch_pet_detail(pet_id, session=get_detail_session())
    search_fetcher = search_fetcher or default_search
    detail_fetcher = detail_fetcher or default_detail

    scraped_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    dogs: List[Dict[str, any]] = []
    dogs_lock = threading.Lock()

    first_page = search_fetcher(1)
    total_pages = first_page.get("total_pages") or 1
    pages_to_fetch = min(total_pages, max_pages) if max_pages else total_pages

    def fetch_and_build(summary: PetSummary) -> Optional[Dict[str, any]]:
        try:
            detail_raw = detail_fetcher(summary.pet_id)
            detail = build_detail(detail_raw)
        except Exception as e:
            print(
                f"Warning: Failed to fetch details for pet {summary.pet_id} ({summary.name}): {e}",
                file=sys.stderr,
            )
            return None
        if not is_matching_state(detail, states):
            return None
        return build_record(summary, detail)

    def process_page(data: Dict[str, any], executor: ThreadPoolExecutor) -> None:
        summaries: List[PetSummary] = []
        remaining = None
        if limit is not None:
            with dogs_lock:
                remaining = max(limit - len(dogs), 0)
        for raw_summary in data.get("pets") or []:
            if remaining is not None and len(summaries) >= remaining:
                break
            summaries.append(build_summary(raw_summary))

        if not summaries:
            return

        futures = [executor.submit(fetch_and_build, summary) for summary in summaries]
        for future in as_completed(futures):
            record = future.result()
            if record is None:
                continue
            if limit is not None:
                with dogs_lock:
                    if len(dogs) >= limit:
                        continue
                    dogs.append(record)
            else:
                with dogs_lock:
                    dogs.append(record)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        process_page(first_page, executor)
        for page in range(2, pages_to_fetch + 1):
            if limit is not None and len(dogs) >= limit:
                break
            time.sleep(page_delay)
            page_data = search_fetcher(page)
            process_page(page_data, executor)

    return {
        "source_url": "https://www.wagtopia.com/search",
        "scraped_at": scraped_at,
        "zip": zip_code,
        "geo_range": geo_range,
        "states": [normalize_state(s) for s in states if s],
        "page_count": pages_to_fetch,
        "dog_count": len(dogs),
        "dogs": dogs,
    }


def load_search_fixture(path: Path) -> Callable[[int], Dict[str, any]]:
    data = json.loads(path.read_text())

    def fetch(page: int) -> Dict[str, any]:
        return data

    return fetch


def load_detail_fixture_dir(path: Path) -> Callable[[int], Dict[str, any]]:
    def fetch(pet_id: int) -> Dict[str, any]:
        file_path = path / f"wagtopia_pet_{pet_id}.json"
        if not file_path.exists():
            raise FileNotFoundError(f"Detail fixture not found for pet_id={pet_id}: {file_path}")
        return json.loads(file_path.read_text())

    return fetch


def format_markdown(payload: Dict[str, any]) -> str:
    lines = [
        f"# Wagtopia dogs ({payload['dog_count']} found)",
        "",
        f"- Zip: {payload['zip']} (range {payload['geo_range']} miles)",
        f"- States filter: {', '.join(payload['states']) or 'all'}",
        f"- Scraped at: {payload['scraped_at']}",
        "",
    ]
    for dog in payload["dogs"]:
        lines.append(f"## {dog.get('name') or 'Unknown'}")
        lines.append(f"- ID: {dog.get('pet_id')}")
        lines.append(f"- Breed: {dog.get('primary_breed')}" + (f" / {dog.get('secondary_breed')}" if dog.get('secondary_breed') else ""))
        lines.append(f"- Age: {dog.get('age')} | Size: {dog.get('size')} | Sex: {dog.get('sex')}")
        lines.append(f"- Status: {dog.get('status')}")
        if dog.get("current_location") or dog.get("current_location_zip") or dog.get("shelter_state"):
            parts = [p for p in [dog.get("current_location"), dog.get("current_location_zip"), dog.get("shelter_state")] if p]
            lines.append(f"- Location: {' | '.join(parts)}")
        if dog.get("adopt_url"):
            lines.append(f"- Adopt: {dog['adopt_url']}")
        if dog.get("detail_url"):
            lines.append(f"- Detail: {dog['detail_url']}")
        if dog.get("primary_photo_url"):
            lines.append(f"- Photo: {dog['primary_photo_url']}")
        lines.append("")
    return "\n".join(lines)


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", default=DEFAULT_ZIP, help="Zip code to center the search (default: 10001)")
    parser.add_argument(
        "--geo-range", type=int, default=DEFAULT_GEO_RANGE, help="Radius in miles for the search area"
    )
    parser.add_argument(
        "--states",
        default=",".join(DEFAULT_STATES),
        help="Comma-separated list of state codes to keep (blank for all)",
    )
    parser.add_argument("--max-pages", type=int, help="Limit number of result pages to fetch")
    parser.add_argument("--limit", type=int, help="Maximum number of dogs to collect")
    parser.add_argument("--page-delay", type=float, default=0.1, help="Delay between page requests in seconds")
    parser.add_argument("--workers", type=int, default=10, help="Number of concurrent detail fetch workers")
    parser.add_argument("--output", type=Path, help="Write JSON to this path")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    parser.add_argument("--fixture", type=Path, help="Use a saved search response instead of live calls")
    parser.add_argument(
        "--detail-fixtures-dir",
        type=Path,
        help="Directory containing wagtopia_pet_<id>.json detail fixtures",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    states = [s.strip() for s in (args.states.split(",") if args.states else []) if s.strip()]

    search_fetcher = load_search_fixture(args.fixture) if args.fixture else None
    detail_fetcher = load_detail_fixture_dir(args.detail_fixtures_dir) if args.detail_fixtures_dir else None

    payload = scrape_wagtopia(
        zip_code=args.zip,
        geo_range=args.geo_range,
        states=states,
        max_pages=args.max_pages,
        limit=args.limit,
        page_delay=args.page_delay,
        search_fetcher=search_fetcher,
        detail_fetcher=detail_fetcher,
    )

    if args.format == "markdown":
        output_text = format_markdown(payload)
    else:
        output_text = json.dumps(payload, indent=2)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output_text)
    else:
        sys.stdout.write(output_text)
        if not output_text.endswith("\n"):
            sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
