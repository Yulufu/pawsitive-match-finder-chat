from __future__ import annotations

import sys
from pathlib import Path
from typing import List

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend/src is on the import path for zestie_matcher
BACKEND_ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = BACKEND_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.append(str(SRC_PATH))

from zestie_matcher.matcher.match import Preference, load_normalized_feed, rank_dogs

from .models import DogResponse, FilterRequest, RecommendationResponse, ResponseMeta
from .services.view_manager import view_manager
from .services.analytics_manager import analytics_manager


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust to specific origins if desired
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOGS_DATA: List[dict] = []


@app.on_event("startup")
def startup_event() -> None:
    global DOGS_DATA
    try:
        DOGS_DATA = load_normalized_feed()
    except Exception as exc:  # pragma: no cover - fatal startup
        raise RuntimeError("Failed to load dogs data") from exc
    view_manager.load()
    analytics_manager.load()


def to_preferences(items: List) -> List[Preference]:
    prefs: List[Preference] = []
    for item in items:
        prefs.append(
            Preference(
                field=item.field,
                hardness=item.hardness,
                value=item.value,
                weight=item.weight,
                must_be_known=not item.allow_unknown,
            )
        )
    return prefs


@app.post("/api/recommend", response_model=RecommendationResponse)
def recommend(payload: FilterRequest = Body(...)) -> RecommendationResponse:
    if not DOGS_DATA:
        raise HTTPException(status_code=503, detail="Dogs data not loaded")
    analytics_manager.increment("recommend_calls")
    prefs = to_preferences(payload.preferences)
    for field, value in payload.hard_filters.items():
        if value not in (None, ""):
            analytics_manager.track_filter(field, str(value))
    ranked = rank_dogs(
        DOGS_DATA,
        prefs,
        desired=payload.hard_filters,
        views=view_manager.get_views(),
        top_n=14,
        source_cap=6,
        exploration_slots=6,
    )
    filtered = [item for item in ranked if item["dog"]["id"] not in payload.seen_dog_ids]
    final = filtered[:14]

    dog_responses: List[DogResponse] = []
    for item in final:
        dog = item["dog"]
        dog_responses.append(
            DogResponse(
                dog_id=dog["id"],
                name=dog.get("name"),
                section=item.get("section", "best"),
                score=float(item.get("final_score", item.get("core_score", 0.0))),
                completeness=float(item.get("completeness", 0.0)),
                reasons=item.get("reasons", []),
                dog_data=dog,
            )
        )

    prompt_trigger = None
    if len(dog_responses) < 5 and any(not pref.allow_unknown for pref in payload.preferences):
        prompt_trigger = "low_results"
    explore_count = sum(1 for r in dog_responses if r.section == "explore")
    if explore_count:
        analytics_manager.increment("explore_slots_served", explore_count)

    return RecommendationResponse(
        results=dog_responses,
        meta=ResponseMeta(total_found=len(dog_responses), prompt_trigger=prompt_trigger),
    )


@app.post("/api/view/{dog_id}")
def view_increment(dog_id: str):
    analytics_manager.increment("dog_views")
    count = view_manager.increment(dog_id)
    return {"status": "ok", "dog_id": dog_id, "new_count": count}


@app.post("/api/session/start")
def start_session():
    analytics_manager.increment("total_sessions")
    return {"status": "ok"}


@app.get("/api/stats")
def get_stats():
    return analytics_manager.get_stats()
