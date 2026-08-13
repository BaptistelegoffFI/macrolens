from __future__ import annotations

import datetime as dt

from macrolens.api.schemas.base import APIModel
from macrolens.api.schemas.provenance import SourceRefOut


class ObservationOut(APIModel):
    country_iso3: str
    indicator_code: str
    period_start: dt.date
    freq: str
    value: float | None
    source_id: str
    is_interpolated: bool
    is_spliced: bool
    is_break: bool
    conflict: bool
    coverage_partial: bool


class StateVectorFeatureOut(APIModel):
    feature_code: str
    raw_value: float | None
    pct_rank: float | None


class StateVectorOut(APIModel):
    country_iso3: str
    year: int
    reference_frame: str
    is_complete: bool
    is_break: bool
    coverage_partial: bool
    features: list[StateVectorFeatureOut]
    sources: list[SourceRefOut]
