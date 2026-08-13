from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from macrolens.api.schemas.events import EventOut
from macrolens.api.schemas.provenance import SourceRefOut
from macrolens.api.schemas.series import ObservationOut, StateVectorOut


class EpisodeOut(BaseModel):
    country: str
    year: int
    state: StateVectorOut | None
    series: dict[str, list[ObservationOut]]
    events: list[EventOut]
    sources: list[SourceRefOut]


class EpisodePair(BaseModel):
    country: str
    year: int


class CompareRequest(BaseModel):
    pairs: list[EpisodePair] = Field(..., min_length=2, max_length=6)
    reference_frame: str = "rolling30"

    @field_validator("pairs")
    @classmethod
    def _normalize_countries(cls, pairs: list[EpisodePair]) -> list[EpisodePair]:
        for p in pairs:
            p.country = p.country.upper()
        return pairs


class CompareResponse(BaseModel):
    episodes: list[EpisodeOut]
