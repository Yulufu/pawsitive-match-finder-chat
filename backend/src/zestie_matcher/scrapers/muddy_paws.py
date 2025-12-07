#!/usr/bin/env python3
"""Scrape adoptable dog data from Muddy Paws Rescue."""
from __future__ import annotations

import argparse
import dataclasses
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, List, Optional

import requests

DEFAULT_LISTING_URL = "https://www.muddypawsrescue.org/adoptable-dogs"
DEFAULT_API_URL = "https://mpr-public-api.uk.r.appspot.com/dogs"
DOG_DETAIL_URL = "https://mpr-public-api.uk.r.appspot.com/dog/{animal_id}"
DEFAULT_TIMEOUT = 15
DEFAULT_SAVE_PATH = Path("data/raw/muddy_paws/muddypaws.json")
USER_AGENT = "ShelterDogMatcherBot/0.1 (+https://github.com/Yulufu/zestie_matcher)"

DISCOUNT_TOOLTIPS = {
    "⭐️ Dog Of The Month! ⭐️": "Adoption fee reduced to $150 this month!",
    "Reduced Fee 🍎 Native New Yorker": "Learn more: https://www.muddypawsrescue.org/news/nativenewyorkers2024",
}


@dataclasses.dataclass
class Badge:
    label: str
    badge_type: str
    tooltip: Optional[str] = None


@dataclasses.dataclass
class MuddyDogRecord:
    name: str
    animal_id: str
    status: str
    sex: Optional[str]
    breed: Optional[str]
    age: Optional[str]
    weight_lbs: Optional[str]
    description: Optional[str]
    cover_photo: Optional[str]
    photos: List[str]
    videos: List[dict]
    attributes: List[str]
    attribute_data: List[dict]
    discount_banner_text: Optional[str]
    display_reduced_fee_banner: bool
    detail_url: str
    next_event_date: Optional[str]
    walking_status: Optional[str]
    walking_device: Optional[str]
    altered: Optional[bool]
    show_on_website: bool
    trial_adoption_candidate: bool
    foster_to_adopt_candidate: bool
    needs_special_care: bool
    quiet_neighborhood_recommended: bool
    bonded_pair: bool
    best_for_experienced_parent: bool
    solo_dog_only: bool
    featured: bool
    pending: bool
    prioritized_badge: Optional[str]
    priority_type: Optional[str]
    badges: List[Badge]
    general_personality: Optional[str]
    daily_routine: Optional[str]
    housebroken: Optional[str]
    energy_rating: Optional[str]
    leash_walking_rating: Optional[str]
    leash_behaviors: Optional[str]
    crate_rating_when_alone: Optional[str]
    crate_rating_detail: Optional[str]
    sleeping_through_the_night: Optional[str]
    other_quirks: Optional[str]
    what_makes_him_her_happy: Optional[str]
    what_makes_him_her_nervous: Optional[str]
    other_displayed_behaviors: Optional[str]
    time_left_alone: Optional[str]
    time_to_settle_in_crate: Optional[str]
    acclimated_to_environment: Optional[str]
    currently_eating: Optional[str]
    display_order: int


class ScrapeError(RuntimeError):
    """Raised when scraping fails in a fatal way."""


def normalize_whitespace(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split()).strip()


def clean_multiline(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value.replace("\r\n", "\n").strip()
    return None


def clean_attribute_text(value: str) -> str:
    if not value:
        return ""
    text = value.replace("<br>", " ")
    return normalize_whitespace(text)


def format_weight(pounds: Optional[float]) -> Optional[str]:
    if pounds is None:
        return None
    try:
        return f"{float(pounds):.1f} lbs"
    except (TypeError, ValueError):
        return None


def fetch_api_data(url: str, timeout: int) -> List[dict]:
    resp = requests.get(url, timeout=timeout, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        raise ScrapeError("Unexpected API payload (expected list)")
    return data


def fetch_dog_detail(animal_id: str, timeout: int) -> dict:
    resp = requests.get(
        DOG_DETAIL_URL.format(animal_id=animal_id), timeout=timeout, headers={"User-Agent": USER_AGENT}
    )
    resp.raise_for_status()
    return resp.json()


def derive_priority(raw: dict, attrs: List[str], discount_text: Optional[str]) -> tuple[Optional[str], Optional[str], bool, bool]:
    status = raw.get("Status") or ""
    pending = "pending" in status.lower()
    featured = discount_text == "⭐️ Dog Of The Month! ⭐️"
    lowered_attrs = [attr.lower() for attr in attrs]

    if pending:
        return status, "pending", featured, pending
    if discount_text:
        type_label = "featured" if featured else "promotion"
        return discount_text, type_label, featured, pending
    trials = any("trial adoption candidate" in attr for attr in lowered_attrs)
    fosters = any("foster to adopt candidate" in attr for attr in lowered_attrs)
    if trials or fosters:
        return "Trial adoption candidate", "attribute", featured, pending
    if any("bonded pair" in attr for attr in lowered_attrs):
        return "Bonded pair", "attribute", featured, pending
    if any("quiet neighborhood" in attr for attr in lowered_attrs):
        return "Best fit for a quiet neighborhood", "attribute", featured, pending
    if any("experienced" in attr for attr in lowered_attrs):
        return "Best fit for experienced pet parent", "attribute", featured, pending
    return None, None, featured, pending


def attribute_flags(attrs: List[str]) -> dict:
    lowered = [attr.lower() for attr in attrs]
    special_keywords = ("heartworm", "medical", "special", "paralyzed", "seizure", "neurological")
    solo_keywords = ("solo dog", "only dog", "solo pup")
    return {
        "trial": any("trial adoption candidate" in attr for attr in lowered),
        "foster": any("foster to adopt candidate" in attr for attr in lowered),
        "needs_special_care": any(keyword in attr for keyword in special_keywords for attr in lowered),
        "quiet": any("quiet neighborhood" in attr for attr in lowered),
        "bonded": any("bonded pair" in attr for attr in lowered),
        "experienced": any("experienced" in attr for attr in lowered),
        "solo": any(keyword in attr for keyword in solo_keywords for attr in lowered),
    }


def normalize_dog(raw: dict, *, listing_url: str, order: int) -> MuddyDogRecord:
    attributes = [clean_attribute_text(attr) for attr in raw.get("Attributes", []) if attr]
    flags = attribute_flags(attributes)
    discount_text = raw.get("DiscountWebsiteBannerText") or None
    badge, badge_type, featured, pending = derive_priority(raw, attributes, discount_text)
    animal_id = str(raw.get("Animal_ID") or raw.get("SalesforceId") or order)
    age = raw.get("Age") or None
    if age == "a year":
        age = "1 year"
    description = clean_multiline(raw.get("Description"))

    attribute_tooltips: dict[str, Optional[str]] = {}
    for entry in raw.get("AttributeData") or []:
        label = clean_attribute_text(entry.get("label") or "")
        if label:
            attribute_tooltips[label] = entry.get("websiteTooltip")

    badges: List[Badge] = []

    def add_badge(label: Optional[str], badge_type_value: str, tooltip: Optional[str] = None) -> None:
        if not label:
            return
        badges.append(Badge(label=label, badge_type=badge_type_value, tooltip=tooltip))

    status_label = raw.get("Status") or "Pending adoption"
    if pending:
        add_badge(status_label, "status")
    if discount_text:
        add_badge(discount_text, "discount", DISCOUNT_TOOLTIPS.get(discount_text))
    if flags["trial"]:
        add_badge("Trial adoption candidate", "attribute", attribute_tooltips.get("Trial adoption candidate"))
    if flags["foster"]:
        foster_label = "Foster to adopt candidate"
        add_badge(foster_label, "attribute", attribute_tooltips.get(foster_label))
    if flags["solo"]:
        add_badge("Best fit as solo dog", "attribute", attribute_tooltips.get("Best fit as solo dog"))
    if flags["quiet"]:
        add_badge(
            "Best fit for a quiet neighborhood",
            "attribute",
            attribute_tooltips.get("Best fit for a quiet neighborhood"),
        )
    if flags["bonded"]:
        add_badge("Bonded pair", "attribute", attribute_tooltips.get("Bonded pair"))
    if flags["experienced"]:
        add_badge(
            "Best fit for experienced pet parent",
            "attribute",
            attribute_tooltips.get("Best fit for experienced pet parent"),
        )

    return MuddyDogRecord(
        name=raw.get("Name") or "Unknown",
        animal_id=animal_id,
        status=raw.get("Status") or "Unknown",
        sex=raw.get("Sex"),
        breed=raw.get("Breed"),
        age=age,
        weight_lbs=format_weight(raw.get("CurrentWeightPounds")),
        description=description,
        cover_photo=raw.get("CoverPhoto"),
        photos=[photo for photo in raw.get("Photos", []) if photo],
        videos=[video for video in raw.get("Videos", []) if isinstance(video, dict)],
        attributes=attributes,
        attribute_data=raw.get("AttributeData", []),
        discount_banner_text=discount_text,
        display_reduced_fee_banner=bool(raw.get("DisplayReducedFeeBannerOnWebsite")),
        detail_url=f"{listing_url.replace('/adoptable-dogs', '/adoptable')}?dog={animal_id}",
        next_event_date=raw.get("NextConfirmedAdoptionEventDate"),
        walking_status=raw.get("WalkingStatus"),
        walking_device=raw.get("WalkingDevice") or raw.get("WalkingDeviceOther"),
        altered=raw.get("Altered"),
        show_on_website=bool(raw.get("ShowOnWebsite", True)),
        trial_adoption_candidate=flags["trial"],
        foster_to_adopt_candidate=flags["foster"],
        needs_special_care=flags["needs_special_care"],
        quiet_neighborhood_recommended=flags["quiet"],
        bonded_pair=flags["bonded"],
        best_for_experienced_parent=flags["experienced"],
        solo_dog_only=flags["solo"],
        featured=featured,
        pending=pending,
        prioritized_badge=badge or (badges[0].label if badges else None),
        priority_type=badge_type or (badges[0].badge_type if badges else None),
        badges=badges,
        general_personality=clean_multiline(raw.get("GeneralPersonality")),
        daily_routine=clean_multiline(raw.get("DailyRoutine")),
        housebroken=clean_multiline(raw.get("Housebroken")),
        energy_rating=clean_multiline(raw.get("Energy_Rating")),
        leash_walking_rating=clean_multiline(raw.get("LeashWalkingRating")),
        leash_behaviors=clean_multiline(raw.get("DescribeLeashWalking")),
        crate_rating_when_alone=clean_multiline(raw.get("CrateRatingWhenAlone")),
        crate_rating_detail=clean_multiline(raw.get("CrateRatingWhileAloneDetail")),
        sleeping_through_the_night=clean_multiline(raw.get("SleepingThroughTheNight")),
        other_quirks=clean_multiline(raw.get("OtherQuirks")),
        what_makes_him_her_happy=clean_multiline(raw.get("WhatMakesHimHerHappy")),
        what_makes_him_her_nervous=clean_multiline(raw.get("WhatMakesHimHerNervousOrUnhappy")),
        other_displayed_behaviors=clean_multiline(raw.get("OtherDisplayedBehaviors")),
        time_left_alone=clean_multiline(raw.get("TimeLeftAlone")),
        time_to_settle_in_crate=clean_multiline(raw.get("TimeToSettleInCrate")),
        acclimated_to_environment=clean_multiline(raw.get("AcclimatedToEnvironment")),
        currently_eating=clean_multiline(raw.get("DogFood_Brand")),
        display_order=order,
    )


def scrape_muddy_paws(
    *,
    api_url: str = DEFAULT_API_URL,
    listing_url: str = DEFAULT_LISTING_URL,
    fetcher: Optional[Callable[[str], List[dict]]] = None,
    detail_fetcher: Optional[Callable[[str], dict]] = None,
    raw_dogs: Optional[List[dict]] = None,
    limit: Optional[int] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict:
    if raw_dogs is None:
        fetcher = fetcher or (lambda url: fetch_api_data(url, timeout))
        raw_dogs = fetcher(api_url)
    detail_fetcher = detail_fetcher or (lambda animal_id: fetch_dog_detail(animal_id, timeout))

    filtered = [dog for dog in raw_dogs if dog.get("ShowOnWebsite", True)]
    if limit is not None:
        filtered = filtered[:limit]

    records: List[MuddyDogRecord] = []
    for index, dog in enumerate(filtered):
        animal_id = str(dog.get("Animal_ID") or dog.get("SalesforceId") or index)
        try:
            detail_data = detail_fetcher(animal_id) or {}
        except Exception as exc:  # noqa: BLE001
            print(f"Warning: failed to fetch detail for {animal_id}: {exc}", file=sys.stderr)
            detail_data = {}
        merged = dict(dog)
        merged.update(detail_data)
        records.append(normalize_dog(merged, listing_url=listing_url, order=index))

    counts = {
        "total": len(records),
        "featured": sum(1 for dog in records if dog.featured),
        "pending": sum(1 for dog in records if dog.pending),
        "available": sum(1 for dog in records if not dog.pending),
    }
    scraped_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    return {
        "source_url": listing_url,
        "api_url": api_url,
        "scraped_at": scraped_at,
        "counts": counts,
        "dogs": [dataclasses.asdict(dog) for dog in records],
    }


def build_markdown(result: dict) -> str:
    lines = [
        f"# Muddy Paws adoptable dogs ({result['counts']['total']})",
        f"- Listing: {result['source_url']}",
        f"- API: {result['api_url']}",
        f"- Scraped at: {result['scraped_at']}",
        "",
    ]
    for dog in result["dogs"]:
        badge = f" ({dog['prioritized_badge']})" if dog.get("prioritized_badge") else ""
        lines.append(f"## {dog['name']}{badge}")
        lines.append(f"- Detail: {dog['detail_url']}")
        profile = [value for value in (dog.get("breed"), dog.get("sex"), dog.get("age")) if value]
        if profile:
            lines.append(f"- Profile: {', '.join(profile)}")
        if dog.get("weight_lbs"):
            lines.append(f"- Weight: {dog['weight_lbs']}")
        if dog.get("pending"):
            lines.append("- Status: Pending adoption")
        elif dog.get("featured"):
            lines.append("- Status: Featured promotion")
        if dog.get("trial_adoption_candidate"):
            lines.append("- Trial adoption candidate")
        if dog.get("foster_to_adopt_candidate"):
            lines.append("- Foster-to-adopt candidate")
        if dog.get("needs_special_care"):
            lines.append("- Needs special care")
        if dog.get("badges"):
            badge_texts = []
            for badge in dog["badges"]:
                text = badge["label"]
                if badge.get("tooltip"):
                    text = f"{text} ({badge['tooltip']})"
                badge_texts.append(text)
            lines.append("- Badges: " + "; ".join(badge_texts))
        detail_pairs = [
            ("General personality", dog.get("general_personality")),
            ("Daily routine", dog.get("daily_routine")),
            ("Housebroken", dog.get("housebroken")),
            ("Energy rating", dog.get("energy_rating")),
            ("Leash walking rating", dog.get("leash_walking_rating")),
            ("Leash behaviors", dog.get("leash_behaviors")),
            ("Crate rating", dog.get("crate_rating_when_alone")),
            ("Crate notes", dog.get("crate_rating_detail")),
            ("Sleeps through night", dog.get("sleeping_through_the_night")),
            ("Time left alone", dog.get("time_left_alone")),
            ("Time to settle in crate", dog.get("time_to_settle_in_crate")),
            ("Acclimated to environment", dog.get("acclimated_to_environment")),
            ("Other quirks", dog.get("other_quirks")),
            ("What makes happy", dog.get("what_makes_him_her_happy")),
            ("What makes nervous", dog.get("what_makes_him_her_nervous")),
            ("Other behaviors", dog.get("other_displayed_behaviors")),
            ("Currently eating", dog.get("currently_eating")),
        ]
        for label, value in detail_pairs:
            if value:
                lines.append(f"- {label}: {value}")
        if dog.get("description"):
            lines.append("")
            lines.append(dog["description"])
            lines.append("")
    return "\n".join(lines).strip() + "\n"


def write_output(content: str, output_path: Optional[str]) -> None:
    if output_path:
        Path(output_path).write_text(content, encoding="utf-8")
    else:
        sys.stdout.write(content)


def save_json_snapshot(result: dict, save_path: Path) -> None:
    save_path.parent.mkdir(parents=True, exist_ok=True)
    save_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Scrape Muddy Paws adoptable dogs")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Muddy Paws API endpoint")
    parser.add_argument("--listing-url", default=DEFAULT_LISTING_URL, help="Public listing page URL")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="HTTP timeout in seconds")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="Output format")
    parser.add_argument("--fixture", help="Path to local JSON fixture for the dog list")
    parser.add_argument("--detail-fixture", help="Optional JSON mapping of animal_id -> detail payload for offline runs")
    parser.add_argument("--output", help="Path to write the final output (defaults to stdout)")
    parser.add_argument("--save-json", help=f"Optional path to also save JSON (e.g. {DEFAULT_SAVE_PATH})")
    parser.add_argument("--limit", type=int, help="Limit number of dogs (useful for debugging)")
    args = parser.parse_args(list(argv) if argv is not None else None)

    raw_dogs: Optional[List[dict]] = None
    detail_fetcher = None
    if args.fixture:
        fixture_path = Path(args.fixture)
        if not fixture_path.exists():
            raise ScrapeError(f"Fixture not found: {fixture_path}")
        raw_dogs = json.loads(fixture_path.read_text(encoding="utf-8"))
    if args.detail_fixture:
        detail_path = Path(args.detail_fixture)
        if not detail_path.exists():
            raise ScrapeError(f"Detail fixture not found: {detail_path}")
        detail_map = json.loads(detail_path.read_text(encoding="utf-8"))

        def _detail_lookup(animal_id: str) -> dict:
            return detail_map.get(str(animal_id), {})

        detail_fetcher = _detail_lookup

    result = scrape_muddy_paws(
        api_url=args.api_url,
        listing_url=args.listing_url,
        raw_dogs=raw_dogs,
        detail_fetcher=detail_fetcher,
        limit=args.limit,
        timeout=args.timeout,
    )

    if args.format == "json":
        content = json.dumps(result, indent=2) + "\n"
    else:
        content = build_markdown(result)

    write_output(content, args.output)

    if args.save_json:
        save_json_snapshot(result, Path(args.save_json))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
