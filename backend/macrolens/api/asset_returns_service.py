"""Rendements d'actifs sur l'ensemble d'analogues et par pays (ADR 0015 à 0024).
Orchestration base de données -> couche de calcul pure (core/asset_returns.py,
core/asset_aggregation.py). Aucune règle de calcul ici : seulement le chargement,
l'assemblage des fenêtres et la mise en forme des contrats.

Même entrée, même sortie, à l'octet près : ordres fixes (classes, pays triés),
aucun aléa, aucune horloge dans les résultats.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal, cast

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from macrolens.api.schemas.asset_returns import (
    AnalogRef,
    AssetClassOut,
    AssetDetailResponse,
    AssetReturnsRequest,
    AssetReturnsResponse,
    CountryAssetClassesResponse,
    CountryCoverageOut,
    CountrySeriesOut,
    DetailEntryOut,
    ExclusionsOut,
    ForwardPathOut,
    GapOut,
    HorizonCellOut,
    PathPointOut,
    QuantilesOut,
    RangeSummaryOut,
    ReturnBasis,
    Section,
    SeriesMetaOut,
    SeriesPointOut,
    TreeNodeOut,
)
from macrolens.api.schemas.provenance import SourceRefOut
from macrolens.asset_catalogue import (
    Catalogue,
    SeriesDef,
    TreeNode,
    load_catalogue,
)
from macrolens.core.asset_aggregation import (
    AssetCell,
    AssetWindow,
    Quantiles,
    aggregate_cell,
    aggregate_paths,
)
from macrolens.core.asset_returns import (
    cumulative_and_annualised,
    forward_window,
    fx_return_vs_usd,
    inflation_from_cpi,
    is_extreme_window,
    max_drawdown,
    real_return,
)
from macrolens.db.models import AssetObservation, AssetSeries, Country, Observation, Source
from macrolens.panel import RegimeTable, load_regime_table

# Régimes sous lesquels le change est fixé ou presque : série plate puis discontinue
# aux dévaluations (pictogramme du bloc Scénario). Classification minimale,
# reprise de data/reference/monetary_regimes.yaml.
PEGGED_REGIMES = frozenset({"Étalon-or classique", "Bretton Woods"})

# (class_id, series_id, section, return_basis), dans l'ordre d'affichage.
CLASS_LAYOUT: tuple[tuple[str, str, Section, ReturnBasis], ...] = (
    ("equities", "jst.equity_tr", "core", "real_total_return"),
    ("govt_bonds", "jst.govt_bond_tr", "core", "real_total_return"),
    ("cash", "jst.bill_return", "core", "real_total_return"),
    ("housing", "jst.housing_tr", "housing", "real_total_return"),
    ("fx", "jst.fx_usd", "fx", "nominal_fx_return"),
    ("inflation", "jst.cpi", "inflation", "cpi_change"),
)
PATH_CLASSES = ("equities", "govt_bonds")


class AssetDataUnavailable(Exception):
    """Tables absentes ou vides : le reste de l'application n'est pas concerné."""


@dataclass
class CountryData:
    nominal: dict[str, dict[int, float]] = field(default_factory=dict)
    interpolated: dict[str, set[int]] = field(default_factory=dict)
    cpi: dict[int, float] = field(default_factory=dict)
    xrusd: dict[int, float] = field(default_factory=dict)


@lru_cache(maxsize=1)
def _regimes() -> RegimeTable:
    return load_regime_table()


def load_country_data(session: Session, countries: Sequence[str]) -> dict[str, CountryData]:
    data = {c: CountryData() for c in countries}
    if not countries:
        return data
    for series_id, country, period_start, value, interpolated in session.execute(
        select(
            AssetObservation.series_id,
            AssetObservation.country_iso3,
            AssetObservation.period_start,
            AssetObservation.value,
            AssetObservation.is_interpolated,
        ).where(AssetObservation.country_iso3.in_(countries), AssetObservation.freq == "A")
    ):
        cd = data[country]
        cd.nominal.setdefault(series_id, {})[period_start.year] = float(value)
        if interpolated:
            cd.interpolated.setdefault(series_id, set()).add(period_start.year)
    for country, indicator, period_start, value in session.execute(
        select(
            Observation.country_iso3,
            Observation.indicator_code,
            Observation.period_start,
            Observation.value,
        ).where(
            Observation.country_iso3.in_(countries),
            Observation.indicator_code.in_(("cpi", "exchange_rate_usd")),
            Observation.freq == "A",
            Observation.value.is_not(None),
        )
    ):
        target = data[country].cpi if indicator == "cpi" else data[country].xrusd
        target[period_start.year] = float(cast("float", value))
    return data


def load_series_meta(session: Session, catalogue: Catalogue) -> dict[str, SeriesMetaOut]:
    rows = {s.id: s for s in session.scalars(select(AssetSeries))}
    if not rows:
        raise AssetDataUnavailable("aucune série de rendements d'actifs en base")
    missing = [sid for sid in catalogue.series if sid not in rows]
    if missing:
        raise AssetDataUnavailable(f"séries absentes de la base : {sorted(missing)}")

    years: dict[str, tuple[int, int]] = {}
    for series_id, first, last in session.execute(
        select(
            AssetObservation.series_id,
            func.min(AssetObservation.period_start),
            func.max(AssetObservation.period_start),
        ).group_by(AssetObservation.series_id)
    ):
        years[series_id] = (first.year, last.year)
    for sdef in catalogue.series.values():
        if sdef.indicator_code is None:
            continue
        first, last = session.execute(
            select(func.min(Observation.period_start), func.max(Observation.period_start)).where(
                Observation.indicator_code == sdef.indicator_code, Observation.freq == "A"
            )
        ).one()
        if first is not None:
            years[sdef.id] = (first.year, last.year)

    sources = {s.id: s for s in session.scalars(select(Source))}
    out: dict[str, SeriesMetaOut] = {}
    for series_id, row in rows.items():
        src = sources[row.source_id]
        first_last = years.get(series_id)
        out[series_id] = SeriesMetaOut(
            series_id=row.id,
            asset_class=row.asset_class,
            tier=row.tier,
            measure=row.measure,
            label_fr=row.label_fr,
            label_en=row.label_en,
            caveat_fr=row.caveat_fr,
            caveat_en=row.caveat_en,
            citation=row.citation,
            source=SourceRefOut(
                id=src.id, citation=src.citation, url=src.url, licence=src.licence
            ),
            first_year=first_last[0] if first_last else None,
            last_year=first_last[1] if first_last else None,
        )
    return out


# ---- séries annuelles dérivées, calculées une fois par (pays, série) -------------


@dataclass
class _Derived:
    """Rendements annuels exploités pour les fenêtres : réels (classes d'actifs),
    nominaux (change) ou variation des prix (inflation)."""

    values: dict[int, float]
    inflation: dict[int, float]
    interpolated: set[int]


def _derive(sdef: SeriesDef, cd: CountryData, basis: ReturnBasis) -> _Derived:
    inflation = inflation_from_cpi(cd.cpi)
    if basis == "nominal_fx_return":
        return _Derived(fx_return_vs_usd(cd.xrusd), inflation, set())
    if basis == "cpi_change":
        return _Derived(inflation, inflation, set())
    nominal = cd.nominal.get(sdef.id, {})
    return _Derived(
        real_return(nominal, inflation), inflation, cd.interpolated.get(sdef.id, set())
    )


def _missing_reason(values: dict[int, float], year: int, horizon: int) -> str:
    if not values:
        return "no_series"
    first, last = min(values), max(values)
    if year + 1 < first:
        return "before_start"
    if year + horizon > last:
        return "truncated_end"
    return "gap"


@dataclass
class _WindowSet:
    windows: list[AssetWindow | None]
    exclusions: dict[str, int]
    n_interpolated: int
    n_pegged: int


def _build_windows(
    sdef: SeriesDef,
    basis: ReturnBasis,
    analogs: Sequence[AnalogRef],
    derived_by_country: dict[str, _Derived],
    horizon: int,
) -> _WindowSet:
    regimes = _regimes()
    windows: list[AssetWindow | None] = []
    exclusions = {"before_start": 0, "truncated_end": 0, "gap": 0, "no_series": 0}
    n_interpolated = 0
    n_pegged = 0
    for analog in analogs:
        derived = derived_by_country.get(analog.country)
        if derived is None:
            exclusions["no_series"] += 1
            windows.append(None)
            continue
        window = forward_window(derived.values, analog.year, horizon)
        if window is None:
            exclusions[_missing_reason(derived.values, analog.year, horizon)] += 1
            windows.append(None)
            continue
        if basis == "cpi_change":
            extreme = is_extreme_window((), window)
        elif basis == "nominal_fx_return":
            extreme = is_extreme_window(window)
        else:
            extreme = is_extreme_window(
                window, forward_window(derived.inflation, analog.year, horizon)
            )
        windows.append(AssetWindow(returns=window, extreme=extreme))
        years = range(analog.year + 1, analog.year + horizon + 1)
        if any(y in derived.interpolated for y in years):
            n_interpolated += 1
        if basis == "nominal_fx_return" and any(
            regimes.label_for(analog.country, y) in PEGGED_REGIMES for y in years
        ):
            n_pegged += 1
    return _WindowSet(windows, exclusions, n_interpolated, n_pegged)


def _quantiles_out(q: Quantiles) -> QuantilesOut:
    return QuantilesOut(median=q.median, q1=q.q1, q3=q.q3, min=q.min, max=q.max)


def _cell_out(
    horizon: int,
    cell: AssetCell,
    ws: _WindowSet,
    sdef: SeriesDef,
    basis: ReturnBasis,
    n_requested: int,
) -> HorizonCellOut:
    is_inflation = basis == "cpi_change"
    return HorizonCellOut(
        horizon=horizon,
        n_requested=n_requested,
        n=cell.n,
        n_extreme=cell.n_extreme,
        n_interpolated=ws.n_interpolated if sdef.interp_columns else None,
        n_pegged=ws.n_pegged if basis == "nominal_fx_return" else None,
        hit_rate=None if is_inflation else cell.hit_rate,
        cumulative=_quantiles_out(cell.cumulative),
        annualised=_quantiles_out(cell.annualised),
        max_drawdown=None if is_inflation else _quantiles_out(cell.max_drawdown),
        exclusions=ExclusionsOut(**ws.exclusions),
    )


def _coverage(values: dict[int, float]) -> tuple[int, int, int] | None:
    return (min(values), max(values), len(values)) if values else None


def _dedupe(analogs: Sequence[AnalogRef]) -> list[AnalogRef]:
    seen: set[tuple[str, int]] = set()
    out: list[AnalogRef] = []
    for a in analogs:
        key = (a.country.upper(), a.year)
        if key not in seen:
            seen.add(key)
            out.append(AnalogRef(country=key[0], year=key[1]))
    return out


def asset_returns_for_analogs(
    session: Session, request: AssetReturnsRequest
) -> AssetReturnsResponse:
    catalogue = load_catalogue()
    meta = load_series_meta(session, catalogue)
    analogs = _dedupe(request.analogs)
    countries = sorted({a.country for a in analogs})
    data = load_country_data(session, countries)
    max_horizon = max(request.horizons)

    classes: list[AssetClassOut] = []
    paths: list[ForwardPathOut] = []
    for class_id, series_id, section, basis in CLASS_LAYOUT:
        sdef = catalogue.series[series_id]
        derived = {c: _derive(sdef, data[c], basis) for c in countries}
        coverage_source = (
            {c: data[c].xrusd for c in countries}
            if basis == "nominal_fx_return"
            else {c: data[c].cpi for c in countries}
            if basis == "cpi_change"
            else {c: data[c].nominal.get(series_id, {}) for c in countries}
        )
        coverage = []
        for country in countries:
            span = _coverage(coverage_source[country])
            if span is not None:
                coverage.append(
                    CountryCoverageOut(
                        country=country, first_year=span[0], last_year=span[1], n_obs=span[2]
                    )
                )
        cells: list[HorizonCellOut] = []
        for horizon in request.horizons:
            ws = _build_windows(sdef, basis, analogs, derived, horizon)
            cell = aggregate_cell(ws.windows)
            cells.append(_cell_out(horizon, cell, ws, sdef, basis, len(analogs)))
            if class_id in PATH_CLASSES and horizon == max_horizon:
                paths.append(
                    ForwardPathOut(
                        class_id=class_id,
                        horizon=horizon,
                        points=[
                            PathPointOut(step=p.step, n=p.n, median=p.median, q1=p.q1, q3=p.q3)
                            for p in aggregate_paths(ws.windows, horizon)
                        ],
                    )
                )
        classes.append(
            AssetClassOut(
                class_id=class_id,
                section=section,
                return_basis=basis,
                series=meta[series_id],
                countries=coverage,
                cells=cells,
            )
        )
    return AssetReturnsResponse(
        n_analogs=len(analogs),
        horizons=list(request.horizons),
        classes=classes,
        forward_paths=paths,
    )


# ---- Tiers 2 et 3 : lignes attendues, jamais de valeur ---------------------------


def _walk(
    nodes: Sequence[TreeNode], path: tuple[TreeNode, ...] = ()
) -> list[tuple[TreeNode, tuple[TreeNode, ...]]]:
    out: list[tuple[TreeNode, tuple[TreeNode, ...]]] = []
    for node in nodes:
        out.append((node, path))
        out.extend(_walk(node.children, (*path, node)))
    return out


def asset_detail_for_analogs(request: AssetReturnsRequest) -> AssetDetailResponse:
    catalogue = load_catalogue()
    entries: list[DetailEntryOut] = []
    for node, parents in _walk(catalogue.tree):
        key = node.reason or node.excluded
        if key is None:
            continue
        reason = catalogue.reasons[key]
        chain = (*parents, node)
        entries.append(
            DetailEntryOut(
                node_id=node.id,
                path_fr=[n.label_fr for n in chain],
                path_en=[n.label_en for n in chain],
                tier=node.unavailable_tier,
                status="excluded" if node.excluded else "not_ingested",
                reason_fr=reason["fr"],
                reason_en=reason["en"],
            )
        )
    return AssetDetailResponse(n_analogs=len(_dedupe(request.analogs)), entries=entries)


# ---- Série par pays (page Classes d'actifs, Explorateur de séries) ---------------


def _gaps(years: list[int]) -> list[GapOut]:
    gaps: list[GapOut] = []
    for previous, current in zip(years, years[1:], strict=False):
        if current - previous > 1:
            gaps.append(GapOut(start_year=previous + 1, end_year=current - 1))
    return gaps


def _in_range(year: int, from_year: int | None, to_year: int | None) -> bool:
    return (from_year is None or year >= from_year) and (to_year is None or year <= to_year)


def _summary(
    basis: ReturnBasis,
    primary: dict[int, float],
    nominal: dict[int, float],
    cd: CountryData,
    from_year: int | None,
    to_year: int | None,
) -> RangeSummaryOut:
    level_kinds: dict[ReturnBasis, Literal["real_index", "local_per_usd", "cpi_index"]] = {
        "real_total_return": "real_index",
        "nominal_fx_return": "local_per_usd",
        "cpi_change": "cpi_index",
    }
    years = sorted(y for y in primary if _in_range(y, from_year, to_year))
    empty = RangeSummaryOut(
        available=False, start_year=None, end_year=None, partial_coverage=False, gaps=[],
        n_obs=0, level_kind=level_kinds[basis],
        level_start=None, level_end=None, change=None, annualised=None,
        nominal_level_end=None, nominal_change=None, nominal_annualised=None, max_drawdown=None,
    )
    if not years:
        return empty
    start, end = years[0], years[-1]
    gaps = _gaps(years)
    partial = (from_year is not None and start > from_year) or (
        to_year is not None and end < to_year
    )
    summary = empty.model_copy(
        update={
            "available": True,
            "start_year": start,
            "end_year": end,
            "partial_coverage": partial,
            "gaps": gaps,
            "n_obs": len(years),
        }
    )
    if gaps:
        return summary
    returns = [primary[y] for y in years]
    cum, ann = cumulative_and_annualised(returns)
    update: dict[str, float | None] = {"change": cum, "annualised": ann}
    if basis == "real_total_return":
        nominal_cum, nominal_ann = cumulative_and_annualised([nominal[y] for y in years])
        update.update(
            level_start=100.0,
            level_end=100.0 * (1.0 + cum),
            nominal_level_end=100.0 * (1.0 + nominal_cum),
            nominal_change=nominal_cum,
            nominal_annualised=nominal_ann,
            max_drawdown=max_drawdown(returns),
        )
    elif basis == "nominal_fx_return":
        update.update(
            level_start=cd.xrusd[start - 1],
            level_end=cd.xrusd[end],
            max_drawdown=max_drawdown(returns),
        )
    else:
        update.update(level_start=cd.cpi[start - 1], level_end=cd.cpi[end])
    return summary.model_copy(update=update)


def _country_series(
    sdef: SeriesDef,
    basis: ReturnBasis,
    meta: SeriesMetaOut,
    cd: CountryData,
    from_year: int | None,
    to_year: int | None,
) -> CountrySeriesOut:
    derived = _derive(sdef, cd, basis)
    headline: Literal["real_return", "nominal_fx_return", "inflation"]
    points: list[SeriesPointOut] = []
    if basis == "real_total_return":
        nominal = cd.nominal.get(sdef.id, {})
        for year in sorted(nominal):
            if _in_range(year, from_year, to_year):
                real = derived.values.get(year)
                points.append(
                    SeriesPointOut(
                        year=year, value=real, nominal=nominal[year], real=real, level=None,
                        interpolated=year in derived.interpolated,
                    )
                )
        headline = "real_return"
        summary = _summary(basis, derived.values, nominal, cd, from_year, to_year)
        span = _coverage(nominal)
    elif basis == "nominal_fx_return":
        for year in sorted(cd.xrusd):
            if _in_range(year, from_year, to_year):
                ret = derived.values.get(year)
                points.append(
                    SeriesPointOut(
                        year=year, value=ret, nominal=ret, real=None, level=cd.xrusd[year],
                        interpolated=False,
                    )
                )
        headline = "nominal_fx_return"
        summary = _summary(basis, derived.values, {}, cd, from_year, to_year)
        span = _coverage(cd.xrusd)
    else:
        for year in sorted(cd.cpi):
            if _in_range(year, from_year, to_year):
                infl = derived.values.get(year)
                points.append(
                    SeriesPointOut(
                        year=year, value=infl, nominal=infl, real=None, level=cd.cpi[year],
                        interpolated=False,
                    )
                )
        headline = "inflation"
        summary = _summary(basis, derived.values, {}, cd, from_year, to_year)
        span = _coverage(cd.cpi)
    country_meta = meta.model_copy(
        update={
            "first_year": span[0] if span else None,
            "last_year": span[1] if span else None,
        }
    )
    return CountrySeriesOut(
        series=country_meta,
        headline=headline,
        points=points,
        summary=summary,
    )


def _tree_out(
    nodes: Sequence[TreeNode], catalogue: Catalogue, available: set[str]
) -> list[TreeNodeOut]:
    out: list[TreeNodeOut] = []
    for node in nodes:
        reason_key = node.reason or node.excluded
        reason = catalogue.reasons[reason_key] if reason_key else None
        status: Literal["group", "available", "no_country_data", "not_ingested", "excluded"]
        if node.excluded:
            status = "excluded"
        elif node.reason:
            status = "not_ingested"
        elif node.series_id is not None:
            status = "available" if node.series_id in available else "no_country_data"
        else:
            status = "group"
        tier = node.unavailable_tier
        if node.series_id is not None:
            tier = catalogue.series[node.series_id].tier
        out.append(
            TreeNodeOut(
                id=node.id,
                label_fr=node.label_fr,
                label_en=node.label_en,
                series_id=node.series_id,
                status=status,
                tier=tier,
                reason_fr=reason["fr"] if reason else None,
                reason_en=reason["en"] if reason else None,
                children=_tree_out(node.children, catalogue, available),
            )
        )
    return out


def country_asset_classes(
    session: Session, country: str, from_year: int | None, to_year: int | None
) -> CountryAssetClassesResponse:
    country = country.upper()
    if session.get(Country, country) is None:
        raise LookupError(f"pays inconnu : {country}")
    catalogue = load_catalogue()
    meta = load_series_meta(session, catalogue)
    cd = load_country_data(session, [country])[country]
    series: list[CountrySeriesOut] = []
    for _class_id, series_id, _section, basis in CLASS_LAYOUT:
        sdef = catalogue.series[series_id]
        series.append(_country_series(sdef, basis, meta[series_id], cd, from_year, to_year))
    available = {s.series.series_id for s in series if s.points}
    return CountryAssetClassesResponse(
        country=country,
        from_year=from_year,
        to_year=to_year,
        series=series,
        tree=_tree_out(catalogue.tree, catalogue, available),
    )
