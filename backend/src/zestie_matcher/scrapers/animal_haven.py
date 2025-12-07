#!/usr/bin/env python3
"""Scrape adoptable dog data from Animal Haven.

This tool walks the public Animal Haven dogs page, follows each profile link,
collects the structured bio data (breed, age, weight, adoption fee, tags,
description, gallery images), and emits a consolidated JSON or Markdown report.
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

DEFAULT_LISTING_URL = "https://animalhaven.org/adopt/dogs"
DEFAULT_TIMEOUT = 15
DEFAULT_OUTPUT_PATH = Path("data/raw/animal_haven/animalhaven.json")
USER_AGENT = "ShelterDogMatcherBot/0.1 (+https://github.com/Yulufu/zestie_matcher)"


@dataclasses.dataclass
class DogPreview:
    name: str
    detail_url: str
    age: Optional[str]
    gender: Optional[str]
    image_url: Optional[str]
    needs_special_care: bool


@dataclasses.dataclass
class DogDetail:
    name: Optional[str]
    gender: Optional[str]
    breed: Optional[str]
    age: Optional[str]
    weight: Optional[str]
    adoption_fee: Optional[str]
    location: Optional[str]
    description: Optional[str]
    tags: List[str]
    images: List[str]


@dataclasses.dataclass
class DogRecord:
    name: str
    detail_url: str
    gender: Optional[str]
    breed: Optional[str]
    age: Optional[str]
    weight: Optional[str]
    adoption_fee: Optional[str]
    location: Optional[str]
    description: Optional[str]
    tags: List[str]
    images: List[str]
    preview_image: Optional[str]
    needs_special_care: bool


class ScrapeError(RuntimeError):
    """Raised when scraping fails in a fatal way."""


_whitespace_re = None


def _get_whitespace_re():
    global _whitespace_re
    if _whitespace_re is None:
        import re as _re

        _whitespace_re = _re.compile(r"\s+")
    return _whitespace_re


def normalize_text(value: str) -> str:
    return _get_whitespace_re().sub(" ", value).strip()


def fetch_html(url: str, timeout: int) -> str:
    resp = requests.get(url, timeout=timeout, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.text


def parse_listing_cards(html: str, base_url: str) -> List[DogPreview]:
    soup = BeautifulSoup(html, "html.parser")
    cards: List[DogPreview] = []
    for card in soup.select(".pet-preview"):
        name_el = card.select_one(".pet-preview__name")
        link_el = card.select_one(".pet-preview__link")
        if not name_el or not link_el or not link_el.get("href"):
            continue
        name = normalize_text(name_el.get_text(" "))
        detail_url = urljoin(base_url, link_el["href"])
        age_el = card.select_one(".pet-preview__age")
        age = normalize_text(age_el.get_text(" ")) if age_el else None
        gender_el = card.select_one(".pet-preview__gender .sr-only")
        gender = normalize_text(gender_el.get_text(" ")).rstrip(".") if gender_el else None
        image_el = card.select_one(".pet-preview__photo")
        image_url = urljoin(base_url, image_el["src"]) if image_el and image_el.get("src") else None
        special_care = bool(card.select_one(".pet-preview__special-care"))
        cards.append(
            DogPreview(
                name=name,
                detail_url=detail_url,
                age=age,
                gender=gender,
                image_url=image_url,
                needs_special_care=special_care,
            )
        )
    if not cards:
        raise ScrapeError("No pet preview cards were found on the listing page")
    return cards


def _extract_subtitle(detail: BeautifulSoup) -> tuple[Optional[str], Optional[str], Optional[str]]:
    gender = breed = age = None
    subtitle = detail.select_one(".pet-profile__subtitle")
    if not subtitle:
        return gender, breed, age
    items = subtitle.find_all("li")
    for item in items:
        sr = item.select_one(".sr-only")
        if sr:
            gender = normalize_text(sr.get_text(" ")).rstrip(".")
            continue
        text = normalize_text(item.get_text(" "))
        if not text:
            continue
        normalized = text.lstrip("• ")
        if any(word in normalized.lower() for word in ("year", "years", "month", "months")):
            age = normalized
        elif not breed:
            breed = normalized
    return gender, breed, age


def _extract_tags(prop: BeautifulSoup) -> List[str]:
    tags: List[str] = []
    list_el = prop.select_one(".pet-profile__attributes")
    if list_el:
        tags.extend([normalize_text(li.get_text(" ")) for li in list_el.select("li") if normalize_text(li.get_text(" "))])
    else:
        text = normalize_text(prop.select_one(".pet-profile__property-description") or "")
        if text:
            tags.append(text)
    return tags


def parse_detail_page(html: str, detail_url: str) -> DogDetail:
    soup = BeautifulSoup(html, "html.parser")
    title_el = soup.select_one(".pet-profile__name")
    name = normalize_text(title_el.get_text(" ")) if title_el else None
    subtitle_gender, subtitle_breed, subtitle_age = _extract_subtitle(soup)

    weight = adoption_fee = location = None
    tags: List[str] = []
    for prop in soup.select(".pet-profile__property"):
        title_el = prop.select_one(".pet-profile__property-title")
        value_el = prop.select_one(".pet-profile__property-description")
        if not title_el:
            continue
        label = normalize_text(title_el.get_text(" "))
        label_lower = label.lower()
        if "things to know" in label_lower:
            tags = _extract_tags(prop)
            continue
        value = normalize_text(value_el.get_text(" ")) if value_el else None
        if not value:
            continue
        if label_lower.startswith("weight"):
            weight = value
        elif label_lower.startswith("adoption fee"):
            adoption_fee = value
        elif label_lower.startswith("location"):
            location = value

    description_el = soup.select_one(".pet-profile__description-text")
    description = description_el.get_text("\n").strip() if description_el else None

    image_urls: List[str] = []
    for image in soup.select(".pet-gallery__image"):
        src = image.get("src")
        if not src:
            continue
        absolute = urljoin(detail_url, src)
        if absolute not in image_urls:
            image_urls.append(absolute)

    return DogDetail(
        name=name,
        gender=subtitle_gender,
        breed=subtitle_breed,
        age=subtitle_age,
        weight=weight,
        adoption_fee=adoption_fee,
        location=location,
        description=description,
        tags=tags,
        images=image_urls,
    )


def combine_preview_and_detail(preview: DogPreview, detail: Optional[DogDetail]) -> DogRecord:
    detail = detail or DogDetail(
        name=None,
        gender=None,
        breed=None,
        age=None,
        weight=None,
        adoption_fee=None,
        location=None,
        description=None,
        tags=[],
        images=[],
    )
    images = detail.images or ([] if not preview.image_url else [preview.image_url])
    needs_special_care = preview.needs_special_care or any(
        "special" in (tag or "").lower() or "heartworm" in (tag or "").lower() or "paraly" in (tag or "").lower()
        for tag in detail.tags
    )
    return DogRecord(
        name=detail.name or preview.name,
        detail_url=preview.detail_url,
        gender=detail.gender or preview.gender,
        breed=detail.breed,
        age=detail.age or preview.age,
        weight=detail.weight,
        adoption_fee=detail.adoption_fee,
        location=detail.location,
        description=detail.description,
        tags=detail.tags,
        images=images,
        preview_image=preview.image_url,
        needs_special_care=needs_special_care,
    )


def scrape_animal_haven(
    listing_url: str = DEFAULT_LISTING_URL,
    *,
    fetcher: Callable[[str], str],
    max_dogs: Optional[int] = None,
) -> dict:
    listing_html = fetcher(listing_url)
    previews = parse_listing_cards(listing_html, listing_url)
    if max_dogs is not None:
        previews = previews[:max_dogs]
    dogs: List[DogRecord] = []
    for preview in previews:
        detail_data: Optional[DogDetail]
        try:
            detail_html = fetcher(preview.detail_url)
            detail_data = parse_detail_page(detail_html, preview.detail_url)
        except Exception as exc:  # noqa: BLE001
            print(f"Warning: failed to fetch detail page for {preview.name}: {exc}", file=sys.stderr)
            detail_data = None
        dogs.append(combine_preview_and_detail(preview, detail_data))
    scraped_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    return {
        "source_url": listing_url,
        "scraped_at": scraped_at,
        "dog_count": len(dogs),
        "dogs": [dataclasses.asdict(d) for d in dogs],
    }


def build_markdown(result: dict) -> str:
    lines = [
        f"# Animal Haven adoptable dogs ({result['dog_count']})",
        f"- Source: {result['source_url']}",
        f"- Scraped at: {result['scraped_at']}",
        "",
    ]
    for dog in result["dogs"]:
        lines.append(f"## {dog['name']}")
        lines.append(f"- Detail: {dog['detail_url']}")
        if dog.get("breed"):
            lines.append(f"- Breed: {dog['breed']}")
        if dog.get("gender") or dog.get("age"):
            parts = [p for p in (dog.get("gender"), dog.get("age")) if p]
            if parts:
                lines.append(f"- Profile: {' / '.join(parts)}")
        if dog.get("weight"):
            lines.append(f"- Weight: {dog['weight']}")
        if dog.get("adoption_fee"):
            lines.append(f"- Adoption fee: {dog['adoption_fee']}")
        if dog.get("location"):
            lines.append(f"- Location: {dog['location']}")
        if dog.get("needs_special_care"):
            lines.append("- Needs special care: Yes")
        if dog.get("tags"):
            lines.append("- Things to know: " + ", ".join(dog["tags"]))
        if dog.get("description"):
            lines.append("")
            lines.append(dog["description"])
            lines.append("")
    return "\n".join(lines).strip() + "\n"


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Scrape Animal Haven dog listings")
    parser.add_argument("--url", default=DEFAULT_LISTING_URL, help="Listing page to scrape")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="HTTP timeout in seconds")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of dogs (useful for tests)")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="Output format")
    parser.add_argument("--output", type=Path, help="Write output to this path (defaults to stdout)")
    args = parser.parse_args(list(argv) if argv is not None else None)

    def network_fetcher(url: str) -> str:
        return fetch_html(url, args.timeout)

    result = scrape_animal_haven(args.url, fetcher=network_fetcher, max_dogs=args.limit)

    if args.format == "json":
        output_text = json.dumps(result, indent=2) + "\n"
    else:
        output_text = build_markdown(result)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output_text)
    else:
        sys.stdout.write(output_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
