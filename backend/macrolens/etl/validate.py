"""Contrôles bloquants à l'ingestion (§12.1)."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd
import pandera.pandas as pa
import yaml
from pandera.pandas import Column, DataFrameSchema

CANONICAL_SCHEMA = DataFrameSchema(
    {
        "country_iso3": Column(str, pa.Check.str_length(3, 3)),
        "indicator_code": Column(str),
        "period_start": Column("datetime64[ns]"),
        "freq": Column(str, pa.Check.isin(["A", "Q", "M"])),
        "value": Column(float, nullable=True),
        "source_id": Column(str),
        "is_interpolated": Column(bool),
        "is_break": Column(bool),
    },
    strict=False,
)


@dataclass
class ValidationReport:
    n_rows: int
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def _load_yaml_keys(path: Path, key: str = "iso3") -> set[str]:
    raw = yaml.safe_load(path.read_text()) or []
    return {row[key] for row in raw}


def validate_canonical(
    df: pd.DataFrame,
    *,
    bounds_path: Path,
    countries_path: Path,
    indicators_path: Path,
    min_year: int = 1800,
) -> ValidationReport:
    errors: list[str] = []

    try:
        CANONICAL_SCHEMA.validate(df, lazy=True)
    except pa.errors.SchemaErrors as exc:
        errors.append(f"schéma canonique : {exc}")

    known_countries = _load_yaml_keys(countries_path, "iso3")
    unknown_countries = set(df["country_iso3"].unique()) - known_countries
    if unknown_countries:
        errors.append(f"country_iso3 absent de countries.yaml : {sorted(unknown_countries)}")

    known_indicators = _load_yaml_keys(indicators_path, "code")
    unknown_indicators = set(df["indicator_code"].unique()) - known_indicators
    if unknown_indicators:
        errors.append(f"indicator_code absent de indicators.yaml : {sorted(unknown_indicators)}")

    current_year = dt.date.today().year
    years = df["period_start"].dt.year
    out_of_range = (years < min_year) | (years > current_year)
    if out_of_range.any():
        errors.append(f"{int(out_of_range.sum())} date(s) hors de [{min_year}, {current_year}]")

    if df.duplicated(subset=["country_iso3", "indicator_code", "period_start", "freq"]).any():
        errors.append("clé primaire (country, indicator, period, freq) dupliquée")

    bounds = yaml.safe_load(bounds_path.read_text()) or {}
    for code, limits in bounds.items():
        sub = df.loc[df["indicator_code"] == code, "value"].dropna()
        if sub.empty:
            continue
        lo, hi = limits.get("min"), limits.get("max")
        if lo is not None and (sub < lo).any():
            errors.append(f"{code} : {int((sub < lo).sum())} valeur(s) sous le minimum {lo}")
        if hi is not None and (sub > hi).any():
            errors.append(f"{code} : {int((sub > hi).sum())} valeur(s) au-dessus du maximum {hi}")

    return ValidationReport(n_rows=len(df), errors=errors)
