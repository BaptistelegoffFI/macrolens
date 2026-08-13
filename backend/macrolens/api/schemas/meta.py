from __future__ import annotations

import datetime as dt

from macrolens.api.schemas.base import APIModel


class CountryOut(APIModel):
    iso3: str
    name_fr: str
    name_en: str
    is_core: bool
    in_analog_pool: bool
    year_min: int | None
    year_max: int | None
    n_observations: int


class IndicatorOut(APIModel):
    code: str
    label_fr: str
    label_en: str
    family: str
    unit: str
    is_derived: bool
    derivation: str | None
    higher_is_worse: bool | None
    definition_fr: str


class SourceOut(APIModel):
    id: str
    full_name: str
    url: str
    citation: str
    licence: str
    priority: int
    retrieved_at: dt.date
    file_sha256: str | None
    notes: str | None


class CoverageCellOut(APIModel):
    country_iso3: str
    indicator_code: str
    decade: int
    n_observed: int
    n_possible: int
    pct: float
