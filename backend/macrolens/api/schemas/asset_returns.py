"""Contrats des endpoints de rendements d'actifs (ADR 0021, 0022, 0024). Versionnés
(`schema_version`) et strictement additifs : aucun schéma existant n'est modifié.

Tous les rendements sont des fractions (0,05 = 5 %). Chaque série porte son tier, sa
source et ses années de début et de fin (ADR 0021) ; chaque cellule agrégée porte son N
et la raison des exclusions (ADR 0019).
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field, field_validator

from macrolens.api.schemas.base import APIModel
from macrolens.api.schemas.provenance import SourceRefOut

SCHEMA_VERSION = "asset-returns/1"
DEFAULT_HORIZONS = [1, 3, 5, 10]
MAX_ANALOGS = 200

ReturnBasis = Literal["real_total_return", "nominal_fx_return", "cpi_change"]
Section = Literal["core", "housing", "fx", "inflation"]


class AnalogRef(APIModel):
    country: str = Field(min_length=3, max_length=3)
    year: int = Field(ge=1800, le=2100)


class AssetReturnsRequest(APIModel):
    analogs: list[AnalogRef] = Field(min_length=1, max_length=MAX_ANALOGS)
    horizons: list[int] = Field(default_factory=lambda: list(DEFAULT_HORIZONS), min_length=1)

    @field_validator("horizons")
    @classmethod
    def _valid_horizons(cls, value: list[int]) -> list[int]:
        if any(h < 1 or h > 30 for h in value):
            raise ValueError("chaque horizon doit être compris entre 1 et 30 ans")
        unique = sorted(set(value))
        if len(unique) > 6:
            raise ValueError("six horizons au plus")
        return unique


class SeriesMetaOut(APIModel):
    series_id: str
    asset_class: str
    tier: int
    measure: str
    label_fr: str
    label_en: str
    caveat_fr: str | None
    caveat_en: str | None
    citation: str
    source: SourceRefOut
    first_year: int | None
    last_year: int | None


class CountryCoverageOut(APIModel):
    country: str
    first_year: int
    last_year: int
    n_obs: int


class QuantilesOut(APIModel):
    median: float | None
    q1: float | None
    q3: float | None
    min: float | None
    max: float | None


class ExclusionsOut(APIModel):
    """Pourquoi N baisse : fenêtres écartées, jamais complétées (ADR 0019)."""

    before_start: int
    truncated_end: int
    gap: int
    no_series: int


class HorizonCellOut(APIModel):
    horizon: int
    n_requested: int
    n: int
    n_extreme: int
    n_interpolated: int | None
    n_pegged: int | None
    hit_rate: float | None
    cumulative: QuantilesOut
    annualised: QuantilesOut
    max_drawdown: QuantilesOut | None
    exclusions: ExclusionsOut


class AssetClassOut(APIModel):
    class_id: str
    section: Section
    return_basis: ReturnBasis
    series: SeriesMetaOut
    countries: list[CountryCoverageOut]
    cells: list[HorizonCellOut]


class PathPointOut(APIModel):
    step: int
    n: int
    median: float | None
    q1: float | None
    q3: float | None


class ForwardPathOut(APIModel):
    class_id: str
    horizon: int
    points: list[PathPointOut]


class AssetReturnsResponse(APIModel):
    schema_version: str = SCHEMA_VERSION
    tier: int = 1
    n_analogs: int
    horizons: list[int]
    classes: list[AssetClassOut]
    forward_paths: list[ForwardPathOut]


class DetailEntryOut(APIModel):
    node_id: str
    path_fr: list[str]
    path_en: list[str]
    tier: int | None
    status: Literal["not_ingested", "excluded"]
    reason_fr: str
    reason_en: str


class AssetDetailResponse(APIModel):
    """Tiers 2 et 3. Aucune série de ces tiers n'est ingérée à ce jour : l'endpoint
    liste les lignes attendues avec la raison de leur absence, jamais une valeur."""

    schema_version: str = SCHEMA_VERSION
    tiers: list[int] = Field(default_factory=lambda: [2, 3])
    n_analogs: int
    entries: list[DetailEntryOut]


class SeriesPointOut(APIModel):
    year: int
    value: float | None
    nominal: float | None
    real: float | None
    level: float | None
    interpolated: bool


class GapOut(APIModel):
    start_year: int
    end_year: int


class RangeSummaryOut(APIModel):
    available: bool
    start_year: int | None
    end_year: int | None
    partial_coverage: bool
    gaps: list[GapOut]
    n_obs: int
    level_kind: Literal["real_index", "local_per_usd", "cpi_index"]
    level_start: float | None
    level_end: float | None
    change: float | None
    annualised: float | None
    nominal_level_end: float | None
    nominal_change: float | None
    nominal_annualised: float | None
    max_drawdown: float | None


class CountrySeriesOut(APIModel):
    series: SeriesMetaOut
    headline: Literal["real_return", "nominal_fx_return", "inflation"]
    points: list[SeriesPointOut]
    summary: RangeSummaryOut


class TreeNodeOut(APIModel):
    id: str
    label_fr: str
    label_en: str
    series_id: str | None
    status: Literal["group", "available", "no_country_data", "not_ingested", "excluded"]
    tier: int | None
    reason_fr: str | None
    reason_en: str | None
    children: list[TreeNodeOut]


class CountryAssetClassesResponse(APIModel):
    schema_version: str = SCHEMA_VERSION
    country: str
    from_year: int | None
    to_year: int | None
    series: list[CountrySeriesOut]
    tree: list[TreeNodeOut]
