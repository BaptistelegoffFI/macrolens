from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from macrolens.api.schemas.provenance import SourceRefOut
from macrolens.core.similarity import FEATURE_FAMILIES


class AnchorSpec(BaseModel):
    country: str
    year: int


class ShockSpec(BaseModel):
    base: AnchorSpec
    deltas: dict[str, float]


class FiltersSpec(BaseModel):
    countries: list[str] | None = None
    year_min: int = 1870
    year_max: int | None = None
    include_breaks: bool = False
    include_partial_coverage: bool = False
    exclude_wartime: bool = False


class AnalogsSearchRequest(BaseModel):
    mode: Literal["anchor", "manual", "shock"] = "anchor"
    anchor: AnchorSpec | None = None
    state: dict[str, float] | None = None
    shock: ShockSpec | None = None
    k: int = Field(20, ge=1, le=100)
    horizons: list[int] = Field(default_factory=lambda: [1, 3, 5, 10])
    weights: dict[str, float] | None = None  # par famille (§8.3) : prices/activity/rates/...
    filters: FiltersSpec = Field(default_factory=FiltersSpec)
    weighting: Literal["equal", "similarity"] = "equal"
    metric: Literal["euclidean"] = "euclidean"
    reference_frame: Literal["rolling30", "era", "cross_section", "pool"] = "rolling30"

    @model_validator(mode="after")
    def _check_mode_payload(self) -> AnalogsSearchRequest:
        if self.mode == "anchor" and self.anchor is None:
            raise ValueError("mode='anchor' nécessite le champ 'anchor'")
        if self.mode == "manual" and not self.state:
            raise ValueError("mode='manual' nécessite le champ 'state'")
        if self.mode == "shock" and self.shock is None:
            raise ValueError("mode='shock' nécessite le champ 'shock'")
        if self.weights is not None:
            unknown = set(self.weights) - set(FEATURE_FAMILIES)
            if unknown:
                raise ValueError(f"familles de poids inconnues : {sorted(unknown)}")
        return self


class OutcomeAggregateOut(BaseModel):
    n: int
    median: float | None = None
    q1: float | None = None
    q3: float | None = None
    min: float | None = None
    max: float | None = None
    share_negative: float | None = None
    count_true: int | None = None


class StateFeatureOut(BaseModel):
    feature_code: str
    raw_value: float | None
    pct_rank: float | None


class ContextEventOut(BaseModel):
    kind: str
    label_fr: str
    date_start: str
    date_end: str | None


class AnalogOut(BaseModel):
    country: str
    year: int
    distance: float
    similarity: float
    feature_contributions: dict[str, float]
    state: list[StateFeatureOut]
    context_events: list[ContextEventOut]
    outcomes: dict[str, dict[str, float | bool | int | None]]


class ExcludedOut(BaseModel):
    incomplete: int
    self_adjacent: int
    too_recent: int
    breaks: int
    partial_coverage: int
    user_excluded: int


class ConcentrationOut(BaseModel):
    hhi_country: float
    hhi_decade: float
    n_countries: int
    n_decades: int


class AnalogsSearchResponse(BaseModel):
    build_id: str
    query_echo: AnalogsSearchRequest
    pool_size: int
    excluded: ExcludedOut
    analogs: list[AnalogOut]
    aggregates: dict[str, dict[str, OutcomeAggregateOut]]
    concentration: ConcentrationOut
    warnings: list[str]
    sources_summary: list[SourceRefOut]
