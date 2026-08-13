"""Passerelle entre la base (observations) et le moteur pur core/. Ce module
CONNAÎT la base — il n'est délibérément pas dans core/ (règle d'architecture,
CLAUDE.md). Construit les RawPanel (§8.1) et les Pool (§8.2) à partir des
observations réellement ingérées, puis appelle core/features.py et
core/normalize.py pour produire les vecteurs d'état.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

import numpy as np
import yaml
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from macrolens.core.features import FEATURE_KIND, FEATURE_NAMES, RawPanel, compute_features
from macrolens.core.normalize import Pool, rank_level, rank_variation
from macrolens.core.similarity import PoolEntry, StateVector
from macrolens.db.models import Country, Observation
from macrolens.db.models import StateVector as StateVectorRow
from macrolens.etl.load import BATCH_SIZE
from macrolens.paths import DATA_DIR

# Indicateurs bruts nécessaires pour calculer les 14 features (§8.1).
RAW_INDICATORS: tuple[str, ...] = (
    "gdp_real_pc",
    "cpi",
    "rate_short",
    "rate_long",
    "debt_public_gdp",
    "credit_private_gdp",
    "equity_index_nominal",
    "house_price_index",
    "unemployment_rate",
    "current_account_gdp",
)

MONETARY_REGIMES_PATH = DATA_DIR / "reference" / "monetary_regimes.yaml"


def load_pool_countries(session: Session) -> list[str]:
    return sorted(session.scalars(select(Country.iso3).where(Country.in_analog_pool)).all())


@dataclass(frozen=True)
class CountryData:
    panel: RawPanel
    is_break: dict[int, bool]  # year -> au moins une observation is_break=true cette année
    coverage_partial: dict[int, bool]  # idem pour coverage_partial


def _load_country_data(session: Session, country: str) -> CountryData | None:
    rows = session.execute(
        select(
            Observation.indicator_code,
            Observation.period_start,
            Observation.value,
            Observation.is_break,
            Observation.coverage_partial,
        ).where(
            Observation.country_iso3 == country,
            Observation.indicator_code.in_(RAW_INDICATORS),
            Observation.freq == "A",
        )
    ).all()
    if not rows:
        return None

    series: dict[str, dict[int, float]] = {code: {} for code in RAW_INDICATORS}
    is_break: dict[int, bool] = {}
    coverage_partial: dict[int, bool] = {}
    for code, period_start, value, break_flag, partial_flag in rows:
        year = period_start.year
        if value is not None:
            series[code][year] = float(value)
        is_break[year] = is_break.get(year, False) or bool(break_flag)
        coverage_partial[year] = coverage_partial.get(year, False) or bool(partial_flag)

    all_years = {y for s in series.values() for y in s}
    if not all_years:
        return None
    year_min, year_max = min(all_years), max(all_years)
    years = list(range(year_min, year_max + 1))

    def col(code: str) -> np.ndarray:
        s = series[code]
        return np.array([s.get(y, float("nan")) for y in years])

    panel = RawPanel(
        years=np.array(years),
        gdp_real_pc=col("gdp_real_pc"),
        cpi=col("cpi"),
        rate_short=col("rate_short"),
        rate_long=col("rate_long"),
        debt_public_gdp=col("debt_public_gdp"),
        credit_private_gdp=col("credit_private_gdp"),
        equity_index_nominal=col("equity_index_nominal"),
        house_price_index=col("house_price_index"),
        unemployment_rate=col("unemployment_rate"),
        current_account_gdp=col("current_account_gdp"),
    )
    return CountryData(panel=panel, is_break=is_break, coverage_partial=coverage_partial)


def _as_optional_int(value: object) -> int | None:
    return None if value is None else int(value)  # type: ignore[call-overload]


@dataclass(frozen=True)
class RegimeTable:
    default_regimes: list[dict[str, object]]
    country_overrides: dict[str, dict[str, object]]

    def label_for(self, country: str, year: int) -> str:
        override = self.country_overrides.get(country, {})
        gold_exit_raw = override.get("gold_exit_year")
        gold_exit = _as_optional_int(gold_exit_raw)
        for regime in self.default_regimes:
            start = _as_optional_int(regime["start"])
            end = _as_optional_int(regime["end"])
            label = str(regime["label"])
            assert start is not None
            if label == "Étalon-or classique" and gold_exit is not None:
                if start <= year <= gold_exit:
                    return label
                continue
            if label == "Entre-deux-guerres / retour à l'or" and gold_exit is not None:
                if end is not None and gold_exit < year <= end:
                    return label
                continue
            if start <= year and (end is None or year <= end):
                return label
        return "hors-régime"


def load_regime_table() -> RegimeTable:
    raw = yaml.safe_load(MONETARY_REGIMES_PATH.read_text())
    return RegimeTable(
        default_regimes=raw["default_regimes"], country_overrides=raw["country_overrides"]
    )


def build_id_for(panels: dict[str, RawPanel], reference_frame: str) -> str:
    """Hash déterministe des entrées du build (§8.2.2 : reference_frame fait
    partie du build_id). Même entrée -> même build_id (§12.3 test n°6)."""
    digest = hashlib.sha256()
    digest.update(reference_frame.encode())
    for country in sorted(panels):
        panel = panels[country]
        digest.update(country.encode())
        digest.update(panel.years.tobytes())
        for name in RAW_INDICATORS:
            digest.update(getattr(panel, name).tobytes())
    return digest.hexdigest()[:16]


@dataclass(frozen=True)
class BuiltPool:
    build_id: str
    state_vectors: list[StateVector]
    pool_entries: list[PoolEntry]
    raw_values: list[dict[str, float]]  # une entrée par point, alignée sur state_vectors


def _isnan(x: float) -> bool:
    return x != x


def build_pool(
    session: Session, *, reference_frame: str = "rolling30", countries: list[str] | None = None
) -> BuiltPool:
    country_list = countries or load_pool_countries(session)
    data: dict[str, CountryData] = {}
    for c in country_list:
        cd = _load_country_data(session, c)
        if cd is not None:
            data[c] = cd
    panels = {c: cd.panel for c, cd in data.items()}

    regime_table = load_regime_table() if reference_frame == "era" else None

    country_col: list[str] = []
    year_col: list[int] = []
    break_col: list[bool] = []
    partial_col: list[bool] = []
    raw_by_feature: dict[str, list[float]] = {name: [] for name in FEATURE_NAMES}
    regime_labels: list[str] = []

    for country, cd in data.items():
        fp = compute_features(cd.panel)
        for i, year in enumerate(fp.years):
            year_i = int(year)
            country_col.append(country)
            year_col.append(year_i)
            break_col.append(cd.is_break.get(year_i, False))
            partial_col.append(cd.coverage_partial.get(year_i, False))
            for name in FEATURE_NAMES:
                raw_by_feature[name].append(fp.features[name][i])
            if regime_table is not None:
                regime_labels.append(regime_table.label_for(country, year_i))

    countries_arr = np.array(country_col)
    years_arr = np.array(year_col)
    regime_arr = np.array(regime_labels) if regime_table is not None else None

    ranks_by_feature: dict[str, np.ndarray] = {}
    for name in FEATURE_NAMES:
        values = np.array(raw_by_feature[name])
        pool = Pool(countries=countries_arr, years=years_arr, values=values, regime=regime_arr)
        if FEATURE_KIND[name] == "level":
            ranks_by_feature[name] = rank_level(pool, reference_frame=reference_frame)
        else:
            ranks_by_feature[name] = rank_variation(pool, reference_frame=reference_frame)

    last_year_available = {c: int(panels[c].years.max()) for c in panels}

    state_vectors: list[StateVector] = []
    pool_entries: list[PoolEntry] = []
    raw_values: list[dict[str, float]] = []
    for i, (country, year) in enumerate(zip(country_col, year_col, strict=True)):
        ranks = {name: float(ranks_by_feature[name][i]) for name in FEATURE_NAMES}
        raws = {name: float(raw_by_feature[name][i]) for name in FEATURE_NAMES}
        is_complete = all(not _isnan(v) for v in ranks.values())
        state_vectors.append(
            StateVector(
                country=country,
                year=year,
                ranks=ranks,
                is_complete=is_complete,
                is_break=break_col[i],
                coverage_partial=partial_col[i],
            )
        )
        pool_entries.append(
            PoolEntry(
                country=country,
                year=year,
                is_complete=is_complete,
                is_break=break_col[i],
                coverage_partial=partial_col[i],
                last_year_available=last_year_available[country],
            )
        )
        raw_values.append(raws)

    return BuiltPool(
        build_id=build_id_for(panels, reference_frame),
        state_vectors=state_vectors,
        pool_entries=pool_entries,
        raw_values=raw_values,
    )


def persist_state_vectors(session: Session, built: BuiltPool) -> int:
    """Écrit le panel construit dans la table state_vectors (§3, feature
    store). Upsert par lot sur la clé (pays, année, feature, build_id)."""
    records: list[dict[str, object]] = []
    for sv, raws in zip(built.state_vectors, built.raw_values, strict=True):
        for feature in FEATURE_NAMES:
            records.append(
                {
                    "country_iso3": sv.country,
                    "year": sv.year,
                    "feature_code": feature,
                    "build_id": built.build_id,
                    "raw_value": raws[feature] if not _isnan(raws[feature]) else None,
                    "pct_rank": sv.ranks[feature] if not _isnan(sv.ranks[feature]) else None,
                    "is_complete": sv.is_complete,
                }
            )

    pk_cols = ["country_iso3", "year", "feature_code", "build_id"]
    for start in range(0, len(records), BATCH_SIZE):
        batch = records[start : start + BATCH_SIZE]
        stmt = insert(StateVectorRow).values(batch)
        update_cols = {c.name: c for c in stmt.excluded if c.name not in pk_cols}
        stmt = stmt.on_conflict_do_update(index_elements=pk_cols, set_=update_cols)
        session.execute(stmt)
    return len(records)
