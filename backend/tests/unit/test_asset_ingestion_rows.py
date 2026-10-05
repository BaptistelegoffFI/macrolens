"""ADR 0019, 0021 : construction des lignes d'ingestion, sans base de données."""

import math
from typing import Any

import pandas as pd
import pytest

from macrolens.asset_catalogue import load_catalogue
from macrolens.etl.asset_returns import build_asset_rows

CATALOGUE = load_catalogue()
NAN = float("nan")


def _df(rows: list[dict[str, Any]]) -> pd.DataFrame:
    base = {
        "eq_tr": NAN,
        "bond_tr": NAN,
        "bill_rate": NAN,
        "housing_tr": NAN,
        "eq_tr_interp": NAN,
        "rent_ipolated": NAN,
        "housing_capgain_ipolated": NAN,
    }
    return pd.DataFrame([{**base, **r} for r in rows])


def _build(rows: list[dict[str, Any]], breaks: list[dict[str, Any]] | None = None) -> list[dict]:  # type: ignore[type-arg]
    return build_asset_rows(
        _df(rows), CATALOGUE, known_countries={"FRA", "USA"}, breaks=breaks or []
    )


def test_values_are_copied_as_published_fractions() -> None:
    rows = _build([{"iso": "FRA", "year": 1929, "eq_tr": 0.0719, "bond_tr": 0.04}])
    by_series = {r["series_id"]: r["value"] for r in rows}
    assert by_series == {"jst.equity_tr": 0.0719, "jst.govt_bond_tr": 0.04}


def test_missing_values_produce_no_row_never_zero() -> None:
    rows = _build([{"iso": "FRA", "year": 1929, "eq_tr": NAN, "bond_tr": NAN}])
    assert rows == []


def test_unknown_country_is_filtered_out() -> None:
    rows = _build([{"iso": "IRL", "year": 1929, "eq_tr": 0.1}])
    assert rows == []


def test_interpolation_flag_is_kept() -> None:
    rows = _build(
        [
            {"iso": "FRA", "year": 1914, "eq_tr": 0.1, "eq_tr_interp": 1.0},
            {"iso": "FRA", "year": 1915, "eq_tr": 0.2, "eq_tr_interp": NAN},
        ]
    )
    flags = {r["period_start"].year: r["is_interpolated"] for r in rows}
    assert flags == {1914: True, 1915: False}


def test_housing_is_interpolated_when_either_jst_flag_is_set() -> None:
    rows = _build(
        [
            {"iso": "FRA", "year": 1940, "housing_tr": 0.1, "rent_ipolated": 1.0},
            {"iso": "FRA", "year": 1941, "housing_tr": 0.1, "housing_capgain_ipolated": 1.0},
            {"iso": "FRA", "year": 1942, "housing_tr": 0.1},
        ]
    )
    flags = {r["period_start"].year: r["is_interpolated"] for r in rows}
    assert flags == {1940: True, 1941: True, 1942: False}


def test_break_flag_follows_country_breaks() -> None:
    breaks = [{"country": "FRA", "year_start": 1940, "year_end": 1945}]
    rows = _build(
        [
            {"iso": "FRA", "year": 1944, "eq_tr": 0.1},
            {"iso": "FRA", "year": 1950, "eq_tr": 0.1},
            {"iso": "USA", "year": 1944, "eq_tr": 0.1},
        ],
        breaks,
    )
    flags = {(r["country_iso3"], r["period_start"].year): r["is_break"] for r in rows}
    assert flags == {("FRA", 1944): True, ("FRA", 1950): False, ("USA", 1944): False}


def test_provenance_fields_are_filled() -> None:
    (row,) = _build([{"iso": "USA", "year": 1929, "eq_tr": -0.03369330242276192}])
    assert row["locator"]["kind"] == "dta"
    assert row["locator"]["variables"][0] == "eq_tr"
    assert row["raw_value_text"] == "eq_tr=-0.03369330242276192"
    assert row["transform_chain"] == ["parse_dta_float"]
    assert row["freq"] == "A"


def test_extreme_values_are_kept_not_trimmed() -> None:
    """ADR 0020 : Allemagne 1923, +2,6 milliards, doit être ingérée telle quelle."""
    rows = _build([{"iso": "FRA", "year": 1923, "eq_tr": 2639074816.0}])
    assert rows[0]["value"] == 2639074816.0
    assert math.isfinite(rows[0]["value"])


def test_impossible_return_below_minus_100_percent_is_rejected() -> None:
    with pytest.raises(ValueError, match="inférieur à -100"):
        _build([{"iso": "FRA", "year": 1929, "eq_tr": -1.5}])


def test_derived_series_are_not_ingested_from_the_dta() -> None:
    """Change et inflation restent lus dans `observations`, jamais dupliqués."""
    rows = _build([{"iso": "FRA", "year": 1929, "eq_tr": 0.1, "bill_rate": 0.03}])
    assert {r["series_id"] for r in rows} == {"jst.equity_tr", "jst.bill_return"}
