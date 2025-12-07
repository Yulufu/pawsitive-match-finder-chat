from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class PreferenceItem(BaseModel):
    field: str
    hardness: Literal["must", "strong", "nice"] = "nice"
    value: Any = True
    weight: float = 1.0
    allow_unknown: bool = True


class FilterRequest(BaseModel):
    hard_filters: Dict[str, Any] = Field(default_factory=dict)
    preferences: List[PreferenceItem] = Field(default_factory=list)
    seen_dog_ids: List[str] = Field(default_factory=list)


class DogResponse(BaseModel):
    dog_id: str
    name: str
    section: Literal["best", "explore"]
    score: float
    completeness: float
    reasons: List[Dict[str, Any]]
    dog_data: Dict[str, Any]


class ResponseMeta(BaseModel):
    total_found: int
    prompt_trigger: Optional[str] = None


class RecommendationResponse(BaseModel):
    results: List[DogResponse]
    meta: ResponseMeta
