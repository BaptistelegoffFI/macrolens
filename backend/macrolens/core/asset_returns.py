"""Rendements d'actifs sur fenêtre prospective (ADR 0015 à 0020). Code métier
pur : bibliothèque standard seulement, aucune I/O, aucune base de données.

Une série est un dictionnaire `{année: valeur}` ; une année absente est un
trou et le reste (jamais comblé, interpolé ni reporté : ADR 0019). Les
rendements sont des fractions annuelles (0,05 = 5 %), calculés de fin d'année
t-1 à fin d'année t. Une fenêtre prospective de l'analogue (pays, t) sur h ans
couvre les rendements des années t+1 à t+h : l'année t est déjà dans l'état qui
a servi à trouver l'analogue.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

YearSeries = Mapping[int, float]

# Épisode extrême (ADR 0020) : repère affiché, jamais un filtre. Une fenêtre est
# marquée si une de ses années a un rendement réel <= -50 % ou >= +100 %, ou une
# inflation >= 100 % par an.
EXTREME_REAL_RETURN_FLOOR = -0.5
EXTREME_REAL_RETURN_CEIL = 1.0
HYPERINFLATION_ANNUAL = 1.0


def _is_valid(value: float) -> bool:
    return math.isfinite(value)


def inflation_from_cpi(cpi: YearSeries) -> dict[int, float]:
    """pi[t] = cpi[t] / cpi[t-1] - 1. Absente si l'une des deux années manque."""
    out: dict[int, float] = {}
    for year, level in cpi.items():
        previous = cpi.get(year - 1)
        if previous is None or not (_is_valid(level) and _is_valid(previous)):
            continue
        if level <= 0.0 or previous <= 0.0:
            continue
        out[year] = level / previous - 1.0
    return out


def real_return(nominal: YearSeries, inflation: YearSeries) -> dict[int, float]:
    """Rendement réel par la relation de Fisher exacte, (1 + r) / (1 + pi) - 1
    (ADR 0015). Jamais la soustraction r - pi, qui s'écarte beaucoup dès que
    l'inflation dépasse quelques pourcents. Absent si l'inflation de l'année manque."""
    out: dict[int, float] = {}
    for year, r in nominal.items():
        pi = inflation.get(year)
        if pi is None or not (_is_valid(r) and _is_valid(pi)) or 1.0 + pi <= 0.0:
            continue
        out[year] = (1.0 + r) / (1.0 + pi) - 1.0
    return out


def fx_return_vs_usd(xrusd: YearSeries) -> dict[int, float]:
    """Variation de la valeur en USD d'une unité de monnaie locale, x[t-1] / x[t] - 1,
    où x est en monnaie locale par USD (ADR 0017). Positif si la monnaie locale
    s'apprécie. Nominal par construction : le change n'est jamais déflaté."""
    out: dict[int, float] = {}
    for year, level in xrusd.items():
        previous = xrusd.get(year - 1)
        if previous is None or not (_is_valid(level) and _is_valid(previous)):
            continue
        if level <= 0.0 or previous <= 0.0:
            continue
        out[year] = previous / level - 1.0
    return out


def forward_window(series: YearSeries, year: int, horizon: int) -> tuple[float, ...] | None:
    """Valeurs des années year+1 à year+horizon. `None` si une seule manque :
    une fenêtre tronquée ou trouée est exclue, jamais affichée partielle (ADR 0019)."""
    if horizon < 1:
        raise ValueError("horizon doit valoir au moins 1")
    values: list[float] = []
    for y in range(year + 1, year + horizon + 1):
        value = series.get(y)
        if value is None or not _is_valid(value):
            return None
        values.append(value)
    return tuple(values)


def cumulative_and_annualised(returns: Sequence[float]) -> tuple[float, float]:
    """Rendement cumulé prod(1 + r) - 1 et rendement annualisé géométrique
    (1 + cumulé)^(1/n) - 1 (ADR 0018)."""
    if not returns:
        raise ValueError("au moins un rendement est nécessaire")
    growth = 1.0
    for r in returns:
        if r < -1.0:
            raise ValueError(f"rendement inférieur à -100 % : {r}")
        growth *= 1.0 + r
    return growth - 1.0, growth ** (1.0 / len(returns)) - 1.0


def cumulative_path(returns: Sequence[float]) -> tuple[float, ...]:
    """Indice de valeur cumulée, 1,0 à la fin de l'année t puis une valeur par année."""
    path = [1.0]
    for r in returns:
        path.append(path[-1] * (1.0 + r))
    return tuple(path)


def max_drawdown(returns: Sequence[float]) -> float:
    """Pire repli (<= 0) du pic précédent au creux sur la fenêtre. Le point de
    départ (1,0) compte comme un pic. Mesuré en fin d'année : un repli à
    l'intérieur d'une année est invisible, donc c'est un minorant du repli réel."""
    value = 1.0
    peak = 1.0
    worst = 0.0
    for r in returns:
        value *= 1.0 + r
        peak = max(peak, value)
        worst = min(worst, value / peak - 1.0)
    return worst


def is_extreme_window(
    real_returns: Sequence[float], inflation: Sequence[float] | None = None
) -> bool:
    """Marqueur d'épisode extrême (ADR 0020). Ne retire rien, signale seulement."""
    if any(
        r <= EXTREME_REAL_RETURN_FLOOR or r >= EXTREME_REAL_RETURN_CEIL for r in real_returns
    ):
        return True
    return bool(inflation) and any(p >= HYPERINFLATION_ANNUAL for p in (inflation or ()))
