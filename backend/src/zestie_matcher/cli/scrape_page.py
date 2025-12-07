#!/usr/bin/env python3
"""Utility to pull structured text from rescue-dog listing pages.

Given one or more URLs, this script fetches the HTML, extracts the most
interesting textual bits (title, headings, key paragraphs, tables/lists) and
prints a Markdown summary to stdout. It is intentionally lightweight so you can
paste the output straight into research notes or transform it into JSON later.
"""
from __future__ import annotations

import argparse
import collections
import dataclasses
import json
import re
import sys
import textwrap
from datetime import datetime
from typing import Iterable, List, Optional

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

DEFAULT_TIMEOUT = 15
USER_AGENT = (
    "ShelterDogMatcherBot/0.1 (+https://github.com/Yulufu/zestie_matcher)"
)


@dataclasses.dataclass
class HeadingSummary:
    level: str
    text: str
    context: str


@dataclasses.dataclass
class ParagraphSummary:
    text: str


@dataclasses.dataclass
class ImageSummary:
    alt: str
    src: str


@dataclasses.dataclass
class KeyValue:
    label: str
    value: str


@dataclasses.dataclass
class PageSummary:
    url: str
    fetched_at: str
    title: str
    meta_description: Optional[str]
    layout_hint: str
    headings: List[HeadingSummary]
    paragraphs: List[ParagraphSummary]
    key_values: List[KeyValue]
    lists: List[List[str]]
    images: List[ImageSummary]
    links: List[str]
    ctas: List[str]


_whitespace_re = re.compile(r"\s+")


def normalize_text(value: str) -> str:
    return _whitespace_re.sub(" ", value).strip()


def fetch_html(url: str, timeout: int) -> str:
    resp = requests.get(url, timeout=timeout, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.text


def extract_layout_hint(soup: BeautifulSoup) -> str:
    body = soup.body
    if not body:
        return "No <body> found"
    tag_counts = collections.Counter(
        child.name for child in body.find_all(recursive=False) if isinstance(child, Tag)
    )
    summary = ", ".join(
        f"{tag or 'unknown'}×{count}" for tag, count in tag_counts.most_common(5)
    )
    return summary or "Body contained primarily text nodes"


def extract_headings(soup: BeautifulSoup, max_items: int = 10) -> List[HeadingSummary]:
    headings: List[HeadingSummary] = []
    for heading in soup.select("h1, h2, h3"):
        if not isinstance(heading, Tag):
            continue
        text = normalize_text(heading.get_text(" "))
        if not text:
            continue
        context_parts: List[str] = []
        sibling = heading.next_sibling
        while sibling and len(" ".join(context_parts)) < 240:
            if isinstance(sibling, NavigableString):
                snippet = normalize_text(str(sibling))
                if snippet:
                    context_parts.append(snippet)
            elif isinstance(sibling, Tag) and sibling.name in {"p", "ul", "ol"}:
                snippet = normalize_text(sibling.get_text(" "))
                if snippet:
                    context_parts.append(snippet)
            sibling = sibling.next_sibling
        headings.append(
            HeadingSummary(level=heading.name.upper(), text=text, context=" ".join(context_parts))
        )
        if len(headings) >= max_items:
            break
    return headings


def extract_paragraphs(soup: BeautifulSoup, max_items: int = 5) -> List[ParagraphSummary]:
    container = soup.find("main") or soup.body or soup
    paragraphs: List[ParagraphSummary] = []
    for p in container.find_all("p"):
        text = normalize_text(p.get_text(" "))
        if len(text) < 20:
            continue
        paragraphs.append(ParagraphSummary(text=text))
        if len(paragraphs) >= max_items:
            break
    return paragraphs


def extract_key_values(soup: BeautifulSoup, max_items: int = 10) -> List[KeyValue]:
    pairs: List[KeyValue] = []
    for dl in soup.find_all("dl"):
        dts = dl.find_all("dt")
        dds = dl.find_all("dd")
        for dt, dd in zip(dts, dds):
            label = normalize_text(dt.get_text(" "))
            value = normalize_text(dd.get_text(" "))
            if label and value:
                pairs.append(KeyValue(label=label, value=value))
                if len(pairs) >= max_items:
                    return pairs
    # Fallback: look for table rows that look like label/value
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) == 2:
                label = normalize_text(cells[0].get_text(" "))
                value = normalize_text(cells[1].get_text(" "))
                if label and value:
                    pairs.append(KeyValue(label=label, value=value))
                    if len(pairs) >= max_items:
                        return pairs
    return pairs


def extract_lists(
    soup: BeautifulSoup, max_lists: int = 3, max_items: int = 6
) -> List[List[str]]:
    lists: List[List[str]] = []
    for ul in soup.find_all(["ul", "ol"]):
        items = []
        for li in ul.find_all("li")[:max_items]:
            text = normalize_text(li.get_text(" "))
            if text:
                items.append(text)
        if items:
            lists.append(items)
            if len(lists) >= max_lists:
                break
    return lists


def extract_images(soup: BeautifulSoup, max_items: int = 5) -> List[ImageSummary]:
    images: List[ImageSummary] = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if not src:
            continue
        alt = normalize_text(img.get("alt") or "")
        images.append(ImageSummary(alt=alt, src=src))
        if len(images) >= max_items:
            break
    return images


def extract_links(soup: BeautifulSoup, max_items: int = 10) -> List[str]:
    links: List[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href and not href.startswith("#"):
            links.append(href)
            if len(links) >= max_items:
                break
    return links


def extract_ctas(soup: BeautifulSoup, max_items: int = 6) -> List[str]:
    texts: List[str] = []
    button_candidates = list(soup.find_all(["button"]))
    button_candidates.extend(soup.find_all("a", attrs={"role": "button"}))
    for link in soup.find_all("a"):
        classes = " ".join(link.get("class", []))
        if "button" in classes.lower() or "btn" in classes.lower():
            button_candidates.append(link)
    for element in button_candidates:
        text = normalize_text(element.get_text(" "))
        if text and text not in texts:
            texts.append(text)
        if len(texts) >= max_items:
            break
    return texts


def summarize_url(url: str, timeout: int) -> PageSummary:
    html = fetch_html(url, timeout)
    soup = BeautifulSoup(html, "html.parser")
    title = normalize_text(soup.title.get_text(" ")) if soup.title else "(no title)"
    meta_desc_tag = soup.find("meta", attrs={"name": "description"})
    meta_description = None
    if meta_desc_tag and meta_desc_tag.get("content"):
        meta_description = normalize_text(meta_desc_tag["content"])
    return PageSummary(
        url=url,
        fetched_at=datetime.utcnow().isoformat(timespec="seconds") + "Z",
        title=title,
        meta_description=meta_description,
        layout_hint=extract_layout_hint(soup),
        headings=extract_headings(soup),
        paragraphs=extract_paragraphs(soup),
        key_values=extract_key_values(soup),
        lists=extract_lists(soup),
        images=extract_images(soup),
        links=extract_links(soup),
        ctas=extract_ctas(soup),
    )


def page_summary_to_markdown(summary: PageSummary) -> str:
    lines = [f"## {summary.url}"]
    lines.append(f"- Title: {summary.title}")
    if summary.meta_description:
        lines.append(f"- Meta: {summary.meta_description}")
    lines.append(f"- Layout hint: {summary.layout_hint}")
    lines.append(f"- Fetched at: {summary.fetched_at}")

    if summary.headings:
        lines.append("\n### Headings & nearby context")
        for item in summary.headings:
            lines.append(f"- {item.level}: {item.text}")
            if item.context:
                lines.append(f"  - Context: {textwrap.shorten(item.context, width=200)}")

    if summary.paragraphs:
        lines.append("\n### Paragraph snippets")
        for para in summary.paragraphs:
            lines.append(f"- {textwrap.shorten(para.text, width=220)}")

    if summary.key_values:
        lines.append("\n### Key facts")
        for pair in summary.key_values:
            lines.append(f"- {pair.label}: {pair.value}")

    if summary.lists:
        lines.append("\n### Lists")
        for idx, items in enumerate(summary.lists, start=1):
            lines.append(f"- List {idx}:")
            for item in items:
                lines.append(f"  - {item}")

    if summary.images:
        lines.append("\n### Images")
        for img in summary.images:
            display_alt = img.alt or "(no alt)"
            lines.append(f"- {display_alt}: {img.src}")

    if summary.links:
        lines.append("\n### Sample links")
        for link in summary.links:
            lines.append(f"- {link}")

    if summary.ctas:
        lines.append("\n### CTA / button text")
        for text in summary.ctas:
            lines.append(f"- {text}")

    return "\n".join(lines)


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Scrape rescue dog profile pages into structured text"
    )
    parser.add_argument("urls", nargs="+", help="URLs to fetch")
    parser.add_argument(
        "--timeout", type=int, default=DEFAULT_TIMEOUT, help="Request timeout in seconds"
    )
    parser.add_argument(
        "--format",
        choices=["markdown", "json"],
        default="markdown",
        help="Output format",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    summaries: List[PageSummary] = []
    for url in args.urls:
        try:
            summaries.append(summarize_url(url, args.timeout))
        except Exception as exc:  # noqa: BLE001
            print(f"Error fetching {url}: {exc}", file=sys.stderr)
    if not summaries:
        return 1

    if args.format == "json":
        json.dump([dataclasses.asdict(summary) for summary in summaries], sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        for summary in summaries:
            print(page_summary_to_markdown(summary))
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
