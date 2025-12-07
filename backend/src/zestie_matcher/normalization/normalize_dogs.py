#!/usr/bin/env python3
"""Normalize and merge dog data from Animal Haven, Muddy Paws, NYCACC, and Wagtopia."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


BASE_DIR = Path(__file__).resolve().parents[3]
DEFAULT_ANIMAL_HAVEN = BASE_DIR / "data" / "raw" / "animal_haven" / "animalhaven.json"
DEFAULT_MUDDY_PAWS = BASE_DIR / "data" / "raw" / "muddy_paws" / "muddypaws.json"
DEFAULT_NYCACC = BASE_DIR / "data" / "raw" / "nycacc" / "feed.json"
DEFAULT_WAGTOPIA = BASE_DIR / "data" / "raw" / "wagtopia" / "wagtopia.json"
DEFAULT_OUTPUT = BASE_DIR / "data" / "normalized" / "dogs.json"


def build_profile_id(source_id: str, source_animal_id: Optional[str], detail_url: Optional[str]) -> str:
    if source_animal_id:
        return f"{source_id}:{source_animal_id}"
    digest = hashlib.sha256(f"{source_id}:{detail_url or ''}".encode("utf-8")).hexdigest()[:12]
    return f"{source_id}:{digest}"


def extract_age_from_text(age_text: Optional[str]) -> tuple[Optional[float], Optional[int], Optional[int]]:
    """Return (years, months, weeks) without converting months into years."""
    if not age_text:
        return None, None, None
    text = age_text.lower()
    years: Optional[float] = None
    months: Optional[int] = None
    weeks: Optional[int] = None

    year_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(years?|yrs?|yr|yo|y/o)\b", text)
    if year_match:
        value = float(year_match.group(1))
        if value <= 30:  # guard against dates like 2025
            years = value

    if months is None:
        month_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(months?|mos?|mo)\b", text)
        if month_match:
            value = float(month_match.group(1))
            if value <= 240:  # <= 20 years
                months = int(round(value))

    if weeks is None:
        week_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(weeks?|wks?|wk)\b", text)
        if week_match:
            value = float(week_match.group(1))
            if value <= 520:  # <= 10 years in weeks
                weeks = int(round(value))

    return years, months, weeks


def derive_age_group(age_years: Optional[float], age_months: Optional[int], age_text: Optional[str]) -> Optional[str]:
    if age_years is not None:
        if age_years < 1:
            return "Puppy"
        if age_years < 2:
            return "Young"
        if age_years < 8:
            return "Adult"
        return "Senior"
    if age_months is not None:
        if age_months < 12:
            return "Puppy"
        if age_months < 24:
            return "Young"
        if age_months < 96:
            return "Adult"
        return "Senior"
    if not age_text:
        return None
    text = age_text.lower()
    if "puppy" in text or "baby" in text:
        return "Puppy"
    if "young" in text:
        return "Young"
    if "adult" in text:
        return "Adult"
    if "senior" in text:
        return "Senior"
    return None


def format_age_display(age_years: Optional[float], age_months: Optional[int], raw_text: Optional[str]) -> Optional[str]:
    """
    Prefer explicit years. Show months when under ~18 months; otherwise round months into years.
    """
    if age_months is not None:
        if age_months >= 18 and age_years is None:
            age_years = round(age_months / 12.0, 1)
        else:
            return f"{int(age_months)} months"
    if age_years is not None:
        trimmed = f"{age_years:.1f}".rstrip("0").rstrip(".")
        return f"{trimmed} years"
    return raw_text


def resolve_age(age_text: Optional[str]) -> tuple[Optional[float], Optional[int], Optional[str], Optional[str]]:
    """
    Extract age only from the provided age field (no description inference).
    Converts weeks to months; if months >=18, also surfaces years for display.
    """
    age_years: Optional[float] = None
    age_months: Optional[int] = None
    source_text: Optional[str] = age_text
    if age_text:
        years, months, weeks = extract_age_from_text(age_text)
        if years is not None:
            age_years = years
        if months is not None:
            age_months = months
        if months is None and weeks is not None:
            age_months = max(1, int(round(weeks * 12 / 52)))

    display = format_age_display(age_years, age_months, source_text)
    age_group = derive_age_group(age_years, age_months, source_text)
    return age_years, age_months, display, age_group


def clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = html.unescape(str(value))
    text = text.replace("\xa0", " ")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def parse_weight_lbs(weight_text: Optional[str]) -> Optional[float]:
    if weight_text is None:
        return None
    if isinstance(weight_text, (int, float)):
        return float(weight_text)
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)", str(weight_text))
    if not match:
        return None
    return float(match.group(1))


def derive_size(weight_lbs: Optional[float]) -> Optional[str]:
    if weight_lbs is None:
        return None
    if weight_lbs <= 10:
        return "XS"
    if weight_lbs <= 25:
        return "S"
    if weight_lbs <= 50:
        return "M"
    if weight_lbs <= 80:
        return "L"
    return "XL"


def map_size_label(size_text: Optional[str]) -> Optional[str]:
    if not size_text:
        return None
    text = size_text.lower()
    if "extra" in text or "x-large" in text or "xl" in text:
        return "XL"
    if "large" in text or text == "lg":
        return "L"
    if "medium" in text or "med." in text or text.startswith("med"):
        return "M"
    if "small" in text or text == "sm":
        return "S"
    if "toy" in text or "mini" in text or "tiny" in text:
        return "XS"
    return None


def split_breed(breed_text: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not breed_text:
        return None, None
    parts = [part.strip() for part in breed_text.split(",") if part.strip()]
    if not parts:
        return None, None
    primary = parts[0]
    secondary = parts[1] if len(parts) > 1 else None
    return primary, secondary


def map_status(status_raw: Optional[str]) -> str:
    if not status_raw:
        return "Unknown"
    normalized = status_raw.strip().lower()
    if normalized in {"available", "adoptable", "fostered"}:
        return "Available"
    if normalized in {"pending", "on hold", "hold", "adoption pending"}:
        return "Pending"
    if normalized in {"adopted"}:
        return "Adopted"
    return "Unknown"


def normalize_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"yes", "true", "y", "1"}:
        return True
    if text in {"no", "false", "n", "0"}:
        return False
    if "not sure" in text or "unknown" in text or "unsure" in text:
        return None
    return None


def normalize_compatibility(value: Any) -> Optional[bool]:
    normalized = normalize_bool(value)
    if normalized is not None:
        return normalized
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"ok", "okay", "good"}:
        return True
    return None


def parse_energy_level(text: Optional[str]) -> Optional[int]:
    if not text:
        return None
    lower = text.lower()
    if "energy level" not in lower:
        return None
    segment = lower.split("energy level", 1)[1]
    if ":" in segment:
        segment = segment.split(":", 1)[1]
        nums = re.findall(r"([0-9]{1,2})", segment)
        for num in nums:
            value = int(num)
            if 0 < value <= 10:
                return value
    else:
        nums = re.findall(r"([0-9]{1,2})", segment)
        for num in reversed(nums):
            value = int(num)
            if 0 < value <= 10:
                return value
    return None


def parse_house_trained(text: Optional[str]) -> Optional[bool]:
    if not text:
        return None
    lowered = text.lower()
    if re.search(r"not (yet )?(house[- ]?trained|house[- ]?broken|potty trained)", lowered):
        return False
    if re.search(r"working on (house|potty)[- ]?training", lowered):
        return None
    if re.search(r"(house|potty)[- ]?trained", lowered) or "housebroken" in lowered:
        return True
    return None


def parse_crate_trained(text: Optional[str]) -> Optional[bool]:
    if not text:
        return None
    lowered = text.lower()
    if "not crate trained" in lowered:
        return False
    if "crate trained" in lowered:
        return True
    return None


def parse_spayed_neutered(text: Optional[str]) -> Optional[bool]:
    if not text:
        return None
    lowered = text.lower()
    if re.search(r"not (yet )?(spayed|neutered)", lowered):
        return False
    if "spayed" in lowered or "neutered" in lowered:
        return True
    return None


def parse_vaccinations_up_to_date(text: Optional[str]) -> Optional[bool]:
    if not text:
        return None
    lowered = text.lower()
    if "up to date on" in lowered and "vacc" in lowered:
        return True
    if "utd on" in lowered and "vaccine" in lowered:
        return True
    return None


def parse_foster_to_adopt(text: Optional[str]) -> Optional[bool]:
    if not text:
        return None
    lowered = text.lower()
    if "foster-to-adopt" in lowered or "foster to adopt" in lowered:
        return True
    return None


def normalize_animal_haven(dog: Dict[str, Any], scraped_at: Optional[str]) -> Dict[str, Any]:
    source_id = "animal_haven"
    detail_url = dog.get("detail_url")
    source_animal_id = None
    if detail_url:
        match = re.search(r"/dogs/([^/?#]+)", detail_url)
        if match:
            num = re.match(r"(\d+)", match.group(1))
            if num:
                source_animal_id = num.group(1)
    breed_text = dog.get("breed")
    breed_primary, breed_secondary = split_breed(breed_text)
    weight_lbs = parse_weight_lbs(dog.get("weight"))
    age_text_raw = dog.get("age")
    age_text = clean_text(age_text_raw) or age_text_raw
    description_raw = dog.get("description")
    description_clean = clean_text(description_raw)
    age_years, age_months, age_text_display, age_group = resolve_age(age_text)
    tags = dog.get("tags") or []
    tags_lower = [t.lower() for t in tags]
    solo_dog_only = any("single dog home" in t for t in tags_lower)
    adult_only_home_preferred = any("adult-only home" in t for t in tags_lower)
    working_on_leash = any("working on leash manners" in t for t in tags_lower)
    return {
        "id": build_profile_id(source_id, source_animal_id, detail_url),
        "source_id": source_id,
        "source_animal_id": source_animal_id,
        "detail_url": detail_url,
        "name": dog.get("name"),
        "species": "Dog",
        "sex": dog.get("gender"),
        "age_years": age_years,
        "age_months": age_months,
        "age_group": age_group,
        "age_text": age_text_display,
        "weight_lbs": weight_lbs,
        "size": derive_size(weight_lbs),
        "breed_primary": breed_primary,
        "breed_secondary": breed_secondary,
        "breed_text": breed_text,
        "status_raw": dog.get("status"),
        "status": map_status(dog.get("status")),
        "public_url": detail_url,
        "adopt_url": None,
        "location_label": dog.get("location"),
        "location_city": "Manhattan",
        "location_state": "NY",
        "current_location_zip": None,
        "intake_date": None,
        "scraped_at": scraped_at,
        "last_updated_at": None,
        "description": description_clean or description_raw,
        "description_html": None,
        "behavior_notes": description_clean or description_raw,
        "primary_photo_url": (dog.get("preview_image") or (dog.get("images") or [None])[0]),
        "photo_urls": dog.get("images") or [],
        "video_urls": [],
        "tags": tags,
        "good_with_dogs": None,
        "good_with_kids": None,
        "good_with_cats": None,
        "best_with_experienced_owner": None,
        "needs_quiet_neighborhood": None,
        "apartment_ok": None,
        "requires_fenced_yard": None,
        "solo_dog_only": solo_dog_only or None,
        "energy_level": None,
        "house_trained": None,
        "crate_trained": None,
        "leash_trained": False if working_on_leash else None,
        "adult_only_home_preferred": adult_only_home_preferred or None,
        "vaccinations_up_to_date": None,
        "spayed_neutered": parse_spayed_neutered(dog.get("description")),
        "hypoallergenic": None,
        "needs_foster": None,
        "foster_to_adopt_candidate": None,
        "raw": dog,
    }


def normalize_muddy_paws(dog: Dict[str, Any], scraped_at: Optional[str]) -> Dict[str, Any]:
    source_id = "muddy_paws"
    source_animal_id = str(dog.get("animal_id")) if dog.get("animal_id") is not None else None
    detail_url = dog.get("detail_url")
    breed_text = dog.get("breed")
    breed_primary, breed_secondary = split_breed(breed_text)
    weight_lbs = parse_weight_lbs(dog.get("weight_lbs"))
    age_text_raw = dog.get("age")
    age_text = clean_text(age_text_raw) or age_text_raw
    description_text = dog.get("description")
    description_clean = clean_text(description_text)
    age_years, age_months, age_text_display, age_group = resolve_age(age_text)
    solo_dog_only = bool(dog.get("solo_dog_only"))
    good_with_dogs = False if solo_dog_only else None
    tags: List[str] = []
    for label in dog.get("attributes") or []:
        tags.append(label)
    for badge in dog.get("badges") or []:
        label = badge.get("label")
        if label:
            tags.append(label)
    attributes_lower = [str(a).lower() for a in dog.get("attributes") or []]
    attribute_values_lower = [str(item.get("value", "")).lower() for item in dog.get("attribute_data") or []]
    adult_only_home_preferred = any(
        "adult-only home preferred" in v or "adult home preferred" in v for v in attribute_values_lower + attributes_lower
    )
    foster_to_adopt = any(
        "foster to adopt" in v or "trial adoption candidate" in v for v in attribute_values_lower + attributes_lower
    )
    return {
        "id": build_profile_id(source_id, source_animal_id, detail_url),
        "source_id": source_id,
        "source_animal_id": source_animal_id,
        "detail_url": detail_url,
        "public_url": detail_url,
        "adopt_url": None,
        "name": dog.get("name"),
        "species": "Dog",
        "sex": dog.get("sex"),
        "age_years": age_years,
        "age_months": age_months,
        "age_group": age_group,
        "age_text": age_text_display,
        "weight_lbs": weight_lbs,
        "size": derive_size(weight_lbs),
        "breed_primary": breed_primary,
        "breed_secondary": breed_secondary,
        "breed_text": breed_text,
        "status_raw": dog.get("status"),
        "status": map_status(dog.get("status")),
        "location_label": "Muddy Paws Foster Network",
        "location_city": "Manhattan",
        "location_state": "NY",
        "current_location_zip": None,
        "intake_date": None,
        "scraped_at": scraped_at,
        "last_updated_at": None,
        "description": description_clean or description_text,
        "description_html": None,
        "behavior_notes": description_clean or description_text,
        "primary_photo_url": dog.get("cover_photo") or (dog.get("photos") or [None])[0],
        "photo_urls": dog.get("photos") or [],
        "video_urls": dog.get("videos") or [],
        "tags": tags,
        "good_with_dogs": good_with_dogs,
        "good_with_kids": None,
        "good_with_cats": None,
        "best_with_experienced_owner": bool(dog.get("best_for_experienced_parent")),
        "needs_quiet_neighborhood": bool(dog.get("quiet_neighborhood_recommended")),
        "apartment_ok": None,
        "requires_fenced_yard": None,
        "solo_dog_only": solo_dog_only,
        "adult_only_home_preferred": adult_only_home_preferred or None,
        "foster_to_adopt_candidate": bool(dog.get("foster_to_adopt_candidate") or foster_to_adopt),
        "energy_level": dog.get("energy_rating"),
        "house_trained": dog.get("housebroken"),
        "crate_trained": dog.get("crate_rating_when_alone") is not None,
        "leash_trained": dog.get("leash_walking_rating") is not None,
        "special_needs": bool(dog.get("needs_special_care")),
        "special_needs_text": None,
        "medical_needs_text": None,
        "vaccinations_up_to_date": parse_vaccinations_up_to_date(description_clean or description_text or ""),
        "spayed_neutered": parse_spayed_neutered(description_clean or description_text or ""),
        "hypoallergenic": None,
        "needs_foster": None,
        "raw": dog,
    }


def normalize_nycacc(pet: Dict[str, Any], scraped_at: Optional[str], feed_updated: Optional[str]) -> Dict[str, Any]:
    source_id = "nycacc"
    source_animal_id = pet.get("id")
    detail_url = pet.get("adopets_link") or pet.get("detail_url") or pet.get("link")
    breed_text = pet.get("breed_text")
    breed_primary, breed_secondary = split_breed(breed_text)
    weight_lbs = parse_weight_lbs(pet.get("weight"))
    age_text_raw = pet.get("age")
    age_text = clean_text(age_text_raw) or age_text_raw
    description_html = pet.get("description_html") or pet.get("summaryHtml")
    description_raw = pet.get("description") or description_html
    description_clean = clean_text(description_raw)
    age_years, age_months, age_text_display, age_group = resolve_age(age_text)
    photos = pet.get("photos") or pet.get("photo_urls") or []
    desc = (description_clean or "").lower()
    house_trained = "house trained" in desc or "house-trained" in desc
    return {
        "id": build_profile_id(source_id, source_animal_id, detail_url),
        "source_id": source_id,
        "source_animal_id": source_animal_id,
        "detail_url": detail_url,
        "public_url": detail_url,
        "adopt_url": pet.get("adopets_link"),
        "name": pet.get("name"),
        "species": "Dog",
        "sex": pet.get("gender"),
        "age_years": age_years,
        "age_months": age_months,
        "age_group": age_group,
        "age_text": age_text_display,
        "weight_lbs": weight_lbs,
        "size": derive_size(weight_lbs),
        "breed_primary": breed_primary,
        "breed_secondary": breed_secondary,
        "breed_text": breed_text,
        "status_raw": pet.get("status"),
        "status": map_status(pet.get("status")),
        "location_label": pet.get("locationInShelter") or pet.get("location"),
        "location_city": None,
        "location_state": None,
        "current_location_zip": pet.get("postal_code") or None,
        "intake_date": pet.get("intakeDate"),
        "scraped_at": scraped_at,
        "last_updated_at": feed_updated,
        "description": description_clean or description_raw,
        "description_html": description_html,
        "behavior_notes": clean_text(pet.get("behavior_notes")) or description_clean or description_raw,
        "primary_photo_url": photos[0] if photos else None,
        "photo_urls": photos,
        "video_urls": pet.get("youTubeIds") or pet.get("video_urls") or [],
        "tags": pet.get("tags") or [],
        "good_with_dogs": None,
        "good_with_kids": None,
        "good_with_cats": None,
        "best_with_experienced_owner": None,
        "needs_quiet_neighborhood": None,
        "apartment_ok": None,
        "requires_fenced_yard": None,
        "solo_dog_only": None,
        "energy_level": None,
        "house_trained": True if house_trained else None,
        "crate_trained": None,
        "leash_trained": None,
        "special_needs": None,
        "special_needs_text": None,
        "medical_needs_text": None,
        "vaccinations_up_to_date": parse_vaccinations_up_to_date(description_clean or description_raw or ""),
        "spayed_neutered": parse_spayed_neutered(description_clean or description_raw or ""),
        "hypoallergenic": None,
        "needs_foster": None,
        "foster_to_adopt_candidate": parse_foster_to_adopt(pet.get("description") or ""),
        "raw": pet,
    }


def normalize_wagtopia(dog: Dict[str, Any], scraped_at: Optional[str]) -> Dict[str, Any]:
    source_id = "wagtopia"
    source_animal_id = str(dog.get("pet_id")) if dog.get("pet_id") is not None else None
    detail_url = dog.get("detail_url") or dog.get("public_url")
    breed_primary = dog.get("primary_breed")
    breed_secondary = dog.get("secondary_breed") or None
    breed_text_parts = [part for part in [breed_primary, breed_secondary] if part]
    breed_text = ", ".join(breed_text_parts) if breed_text_parts else None
    weight_lbs = parse_weight_lbs(dog.get("weight"))
    size_text = dog.get("size")
    size = derive_size(weight_lbs) or map_size_label(size_text)
    age_text_raw = dog.get("age")
    age_text = clean_text(age_text_raw) or age_text_raw
    description_text = dog.get("description") or ""
    description_clean = clean_text(description_text)
    age_years, age_months, age_text_display, age_group = resolve_age(age_text)
    good_with_dogs = normalize_compatibility(dog.get("is_ok_with_other_dogs"))
    good_with_cats = normalize_compatibility(dog.get("is_ok_with_other_cats"))
    good_with_kids = normalize_compatibility(dog.get("is_ok_with_other_kids"))
    solo_dog_only = True if good_with_dogs is False else None
    house_trained = parse_house_trained(description_clean or description_text)
    crate_trained = parse_crate_trained(description_clean or description_text)
    spayed_neutered = parse_spayed_neutered(description_clean or description_text)
    vaccinations_up_to_date = parse_vaccinations_up_to_date(description_clean or description_text)
    foster_to_adopt_candidate = parse_foster_to_adopt(description_clean or description_text)
    return {
        "id": build_profile_id(source_id, source_animal_id, detail_url),
        "source_id": source_id,
        "source_animal_id": source_animal_id,
        "detail_url": detail_url,
        "public_url": dog.get("public_url") or detail_url,
        "adopt_url": dog.get("adopt_url"),
        "name": dog.get("name"),
        "species": "Dog",
        "sex": dog.get("sex"),
        "age_years": age_years,
        "age_months": age_months,
        "age_group": age_group,
        "age_text": age_text_display,
        "weight_lbs": weight_lbs,
        "size": size,
        "breed_primary": breed_primary,
        "breed_secondary": breed_secondary,
        "breed_text": breed_text,
        "status_raw": dog.get("status"),
        "status": map_status(dog.get("status")),
        "location_label": dog.get("shelter_name") or dog.get("current_location"),
        "location_city": None,
        "location_state": dog.get("shelter_state"),
        "current_location_zip": dog.get("current_location_zip"),
        "intake_date": None,
        "scraped_at": scraped_at,
        "last_updated_at": None,
        "description": description_clean or description_text,
        "description_html": dog.get("description_html"),
        "behavior_notes": description_clean or description_text,
        "primary_photo_url": dog.get("primary_photo_url"),
        "photo_urls": dog.get("photo_urls") or [],
        "video_urls": dog.get("video_urls") or [],
        "tags": [],
        "good_with_dogs": good_with_dogs,
        "good_with_kids": good_with_kids,
        "good_with_cats": good_with_cats,
        "best_with_experienced_owner": None,
        "needs_quiet_neighborhood": None,
        "apartment_ok": None,
        "requires_fenced_yard": None,
        "solo_dog_only": solo_dog_only,
        "energy_level": parse_energy_level(description_text),
        "house_trained": house_trained,
        "crate_trained": crate_trained,
        "leash_trained": None,
        "special_needs": normalize_bool(dog.get("has_special_need")),
        "special_needs_text": None,
        "medical_needs_text": None,
        "vaccinations_up_to_date": vaccinations_up_to_date,
        "spayed_neutered": spayed_neutered,
        "hypoallergenic": None,
        "needs_foster": normalize_bool(dog.get("needs_foster")),
        "foster_to_adopt_candidate": foster_to_adopt_candidate,
        "raw": dog,
    }


def normalize_all(
    animal_haven: Dict[str, Any],
    muddy: Dict[str, Any],
    nycacc: Dict[str, Any],
    wagtopia: Dict[str, Any],
) -> List[Dict[str, Any]]:
    dogs: List[Dict[str, Any]] = []
    for dog in animal_haven.get("dogs") or []:
        dogs.append(normalize_animal_haven(dog, animal_haven.get("scraped_at")))
    for dog in muddy.get("dogs") or []:
        dogs.append(normalize_muddy_paws(dog, muddy.get("scraped_at")))
    feed_updated = nycacc.get("feed_updated")
    scraped_at = nycacc.get("fetched_at")
    for pet in nycacc.get("pets") or []:
        if (pet.get("species") or "").lower() != "dog" and (pet.get("type") or "").lower() != "dog":
            continue
        dogs.append(normalize_nycacc(pet, scraped_at, feed_updated))
    for dog in wagtopia.get("dogs") or []:
        dogs.append(normalize_wagtopia(dog, wagtopia.get("scraped_at")))
    return dogs


def read_optional_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_output(data: Dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def parse_args(argv: Optional[Iterable[str]]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize and merge dog data into a unified feed")
    parser.add_argument("--animal-haven", type=Path, default=DEFAULT_ANIMAL_HAVEN, help="Path to Animal Haven JSON")
    parser.add_argument("--muddy-paws", type=Path, default=DEFAULT_MUDDY_PAWS, help="Path to Muddy Paws JSON")
    parser.add_argument("--nycacc", type=Path, default=DEFAULT_NYCACC, help="Path to NYCACC feed JSON")
    parser.add_argument("--wagtopia", type=Path, default=DEFAULT_WAGTOPIA, help="Path to Wagtopia feed JSON")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output path for normalized JSON")
    return parser.parse_args(list(argv) if argv is not None else None)


def main(argv: Optional[Iterable[str]] = None) -> int:
    args = parse_args(argv)
    animal_haven = read_optional_json(args.animal_haven)
    muddy = read_optional_json(args.muddy_paws)
    nycacc = read_optional_json(args.nycacc)
    wagtopia = read_optional_json(args.wagtopia)
    dogs = normalize_all(animal_haven, muddy, nycacc, wagtopia)
    result = {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(dogs),
        "sources": {
            "animal_haven": {"path": str(args.animal_haven), "count": len(animal_haven.get("dogs") or [])},
            "muddy_paws": {"path": str(args.muddy_paws), "count": len(muddy.get("dogs") or [])},
            "nycacc": {"path": str(args.nycacc), "count": len(nycacc.get("pets") or [])},
            "wagtopia": {"path": str(args.wagtopia), "count": len(wagtopia.get("dogs") or [])},
        },
        "dogs": dogs,
    }
    write_output(result, args.output)
    print(f"Wrote {len(dogs)} dogs to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
