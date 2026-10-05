"""Passerelle DB -> réalisations historiques (§9.1). Calcule, pour un
analogue (pays, année) et un horizon donnés, ce qui s'est réellement produit
— jamais une prédiction (règle 4, CLAUDE.md). Hors core/ (règle
d'architecture) : ce module touche la base, core/outcomes.py agrège.

`out_bond_real_cum` (§9.1) n'est PAS calculé : le socle d'indicateurs (§2.4)
ne comporte pas d'indice de rendement obligataire (seulement `rate_long`, un
taux, pas un indice de prix/rendement total). Approximer un rendement total
depuis le seul taux nécessiterait une hypothèse de duration non spécifiée
par le plan — laissé absent plutôt que fabriqué (règle 2).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from macrolens.db.models import Event, Observation

HORIZONS: tuple[int, ...] = (1, 3, 5, 10)

OUTCOME_INDICATORS: tuple[str, ...] = (
    "gdp_real_pc",
    "cpi",
    "equity_index_nominal",
    "house_price_index",
    "unemployment_rate",
    "rate_short",
    "debt_public_gdp",
)


@dataclass(frozen=True)
class RealizedOutcomes:
    out_growth_cum: float | None
    out_growth_ann: float | None
    out_inflation_ann: float | None
    out_equity_real_cum: float | None
    out_house_real_cum: float | None
    out_unemp_change: float | None
    out_rate_short_change: float | None
    out_debt_change: float | None
    out_banking_crisis: bool | None
    out_recession_years: int | None
    out_max_drawdown_equity: float | None


CountrySeries = dict[str, dict[str, dict[int, float]]]  # country -> indicator -> {year: value}
CrisisYears = dict[str, set[int]]  # country -> {années de début de crise bancaire}


def load_series_bulk(session: Session, countries: list[str]) -> CountrySeries:
    if not countries:
        return {}
    rows = session.execute(
        select(
            Observation.country_iso3,
            Observation.indicator_code,
            Observation.period_start,
            Observation.value,
        ).where(
            Observation.country_iso3.in_(countries),
            Observation.indicator_code.in_(OUTCOME_INDICATORS),
            Observation.freq == "A",
        )
    ).all()
    out: CountrySeries = {}
    for country, indicator, period_start, value in rows:
        if value is None:
            continue
        out.setdefault(country, {}).setdefault(indicator, {})[period_start.year] = float(value)
    return out


def load_banking_crisis_years(session: Session, countries: list[str]) -> CrisisYears:
    if not countries:
        return {}
    rows = session.execute(
        select(Event.country_iso3, Event.date_start).where(
            Event.kind == "banking_crisis", Event.country_iso3.in_(countries)
        )
    ).all()
    out: CrisisYears = {}
    for country, date_start in rows:
        if country is not None:
            out.setdefault(country, set()).add(date_start.year)
    return out


def _get(series: dict[str, dict[int, float]], indicator: str, year: int) -> float | None:
    return series.get(indicator, {}).get(year)


def _chain_has_gap(
    series: dict[str, dict[int, float]], indicator: str, first: int, last: int
) -> bool:
    """Vrai si un indice chaîné saute une année à l'intérieur de [first, last]. Le chaînage
    ignore un rendement manquant sans changer le niveau (rendement nul implicite) : tout rapport
    ou repli calculé par-dessus est faux et doit rester manquant (ADR 0019). Les années
    manquantes en bord de fenêtre (série pas encore commencée) ne sont pas un saut."""
    present = [y for y in range(first, last + 1) if _get(series, indicator, y) is not None]
    if not present:
        return False
    return any(_get(series, indicator, y) is None for y in range(present[0], present[-1] + 1))


def compute_outcomes(
    country_series: dict[str, dict[int, float]],
    crisis_years: set[int],
    year: int,
    horizon: int,
) -> RealizedOutcomes:
    gdp0 = _get(country_series, "gdp_real_pc", year)
    gdp1 = _get(country_series, "gdp_real_pc", year + horizon)
    growth_cum = 100.0 * (gdp1 / gdp0 - 1.0) if gdp0 and gdp1 else None
    growth_ann = (
        100.0 * ((1.0 + growth_cum / 100.0) ** (1.0 / horizon) - 1.0)
        if growth_cum is not None
        else None
    )

    cpi0 = _get(country_series, "cpi", year)
    cpi1 = _get(country_series, "cpi", year + horizon)
    inflation_ann = 100.0 * ((cpi1 / cpi0) ** (1.0 / horizon) - 1.0) if cpi0 and cpi1 else None

    eq0 = _get(country_series, "equity_index_nominal", year)
    eq1 = _get(country_series, "equity_index_nominal", year + horizon)
    equity_gap = _chain_has_gap(country_series, "equity_index_nominal", year, year + horizon)
    equity_real_cum = None
    if eq0 and eq1 and cpi0 and cpi1 and not equity_gap:
        equity_real_cum = 100.0 * ((eq1 / cpi1) / (eq0 / cpi0) - 1.0)

    house0 = _get(country_series, "house_price_index", year)
    house1 = _get(country_series, "house_price_index", year + horizon)
    house_real_cum = None
    if house0 and house1 and cpi0 and cpi1:
        house_real_cum = 100.0 * ((house1 / cpi1) / (house0 / cpi0) - 1.0)

    unemp0 = _get(country_series, "unemployment_rate", year)
    unemp1 = _get(country_series, "unemployment_rate", year + horizon)
    unemp_change = unemp1 - unemp0 if unemp0 is not None and unemp1 is not None else None

    rate0 = _get(country_series, "rate_short", year)
    rate1 = _get(country_series, "rate_short", year + horizon)
    rate_change = rate1 - rate0 if rate0 is not None and rate1 is not None else None

    debt0 = _get(country_series, "debt_public_gdp", year)
    debt1 = _get(country_series, "debt_public_gdp", year + horizon)
    debt_change = debt1 - debt0 if debt0 is not None and debt1 is not None else None

    banking_crisis = any(y in crisis_years for y in range(year + 1, year + horizon + 1))

    recession_years = 0
    have_any_comparison = False
    for y in range(year + 1, year + horizon + 1):
        g0 = _get(country_series, "gdp_real_pc", y - 1)
        g1 = _get(country_series, "gdp_real_pc", y)
        if g0 is None or g1 is None:
            continue
        have_any_comparison = True
        if g1 < g0:
            recession_years += 1

    max_drawdown: float | None = None
    real_eq_series: list[float] = []
    for y in range(year, year + horizon + 1):
        e = _get(country_series, "equity_index_nominal", y)
        c = _get(country_series, "cpi", y)
        if e is not None and c is not None:
            real_eq_series.append(e / c)
    if len(real_eq_series) >= 2 and not equity_gap:
        peak = real_eq_series[0]
        worst = 0.0
        for v in real_eq_series[1:]:
            peak = max(peak, v)
            drawdown = (v / peak - 1.0) * 100.0
            worst = min(worst, drawdown)
        max_drawdown = worst

    return RealizedOutcomes(
        out_growth_cum=growth_cum,
        out_growth_ann=growth_ann,
        out_inflation_ann=inflation_ann,
        out_equity_real_cum=equity_real_cum,
        out_house_real_cum=house_real_cum,
        out_unemp_change=unemp_change,
        out_rate_short_change=rate_change,
        out_debt_change=debt_change,
        out_banking_crisis=banking_crisis,
        out_recession_years=recession_years if have_any_comparison else None,
        out_max_drawdown_equity=max_drawdown,
    )


def outcomes_for_analogs(
    session: Session, analogs: list[tuple[str, int]], horizons: tuple[int, ...] = HORIZONS
) -> dict[tuple[str, int], dict[int, RealizedOutcomes]]:
    """analogs : liste de (pays, année). Retourne {(pays,année): {horizon: RealizedOutcomes}}."""
    countries = sorted({c for c, _ in analogs})
    series = load_series_bulk(session, countries)
    crisis = load_banking_crisis_years(session, countries)

    out: dict[tuple[str, int], dict[int, RealizedOutcomes]] = {}
    for country, year in analogs:
        country_series = series.get(country, {})
        country_crisis = crisis.get(country, set())
        out[(country, year)] = {
            h: compute_outcomes(country_series, country_crisis, year, h) for h in horizons
        }
    return out
