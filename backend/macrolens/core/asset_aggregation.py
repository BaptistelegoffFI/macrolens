"""Agrégation des rendements d'actifs sur l'ensemble d'analogues (ADR 0019, 0020).
Code métier pur. Réutilise `aggregate_continuous` : médiane, Q1 et Q3 ont donc
exactement la même définition que pour les réalisations de PIB (§9.2).

Interdits appliqués : aucune moyenne, aucun écrêtage, aucune fenêtre incomplète.
Le N figure à côté de chaque statistique.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from macrolens.core.asset_returns import cumulative_and_annualised, cumulative_path, max_drawdown
from macrolens.core.outcomes import aggregate_continuous


@dataclass(frozen=True)
class AssetWindow:
    """Fenêtre prospective complète d'un analogue : rendements réels annuels."""

    real_returns: tuple[float, ...]
    extreme: bool = False


@dataclass(frozen=True)
class Quantiles:
    median: float | None
    q1: float | None
    q3: float | None
    min: float | None
    max: float | None


@dataclass(frozen=True)
class AssetCell:
    """Une classe d'actifs pour un horizon. `n` = analogues dont la fenêtre est complète."""

    n: int
    n_extreme: int
    hit_rate: float | None
    cumulative: Quantiles
    annualised: Quantiles
    max_drawdown: Quantiles


@dataclass(frozen=True)
class PathPoint:
    step: int
    n: int
    median: float | None
    q1: float | None
    q3: float | None


def _quantiles(values: list[float]) -> Quantiles:
    agg = aggregate_continuous(values)
    return Quantiles(median=agg.median, q1=agg.q1, q3=agg.q3, min=agg.min, max=agg.max)


def aggregate_cell(windows: Sequence[AssetWindow | None]) -> AssetCell:
    """`None` = analogue sans fenêtre complète pour cette classe et cet horizon :
    exclu, et `n` baisse (jamais compté comme zéro). Le taux de réussite est la part
    des fenêtres à rendement réel strictement positif."""
    present = [w for w in windows if w is not None]
    if not present:
        empty = _quantiles([])
        return AssetCell(
            n=0, n_extreme=0, hit_rate=None, cumulative=empty, annualised=empty, max_drawdown=empty
        )
    cumulative: list[float] = []
    annualised: list[float] = []
    drawdowns: list[float] = []
    for window in present:
        cum, ann = cumulative_and_annualised(window.real_returns)
        cumulative.append(cum)
        annualised.append(ann)
        drawdowns.append(max_drawdown(window.real_returns))
    return AssetCell(
        n=len(present),
        n_extreme=sum(1 for w in present if w.extreme),
        hit_rate=sum(1 for c in cumulative if c > 0.0) / len(present),
        cumulative=_quantiles(cumulative),
        annualised=_quantiles(annualised),
        max_drawdown=_quantiles(drawdowns),
    )


def aggregate_paths(windows: Sequence[AssetWindow | None], horizon: int) -> list[PathPoint]:
    """Trajectoire médiane et interquartile du rendement réel cumulé, de l'année 0 à
    `horizon`. Seules les fenêtres complètes sur tout l'horizon comptent."""
    complete = [w for w in windows if w is not None and len(w.real_returns) == horizon]
    paths = [cumulative_path(w.real_returns) for w in complete]
    points: list[PathPoint] = []
    for step in range(horizon + 1):
        agg = aggregate_continuous([p[step] - 1.0 for p in paths])
        points.append(PathPoint(step=step, n=agg.n, median=agg.median, q1=agg.q1, q3=agg.q3))
    return points
