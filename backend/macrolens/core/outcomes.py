"""Agrégation des réalisations historiques (§9.2, §9.3). Code métier pur :
numpy/dataclasses seulement.

Interdits (§9.2), appliqués à la lettre :
- pas de moyenne seule affichée — median/Q1/Q3/min/max seulement ;
- pas d'intervalle de confiance paramétrique (observations autocorrélées,
  fenêtres qui se chevauchent) ;
- pour un booléen, la fréquence brute "m épisodes sur n", jamais une
  formulation de probabilité — cette formulation vit dans la couche API,
  pas ici : ce module ne renvoie que les nombres bruts (n, count_true).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

Weighting = str  # "equal" | "similarity"


@dataclass(frozen=True)
class ContinuousAggregate:
    n: int
    median: float | None
    q1: float | None
    q3: float | None
    min: float | None
    max: float | None
    share_negative: float | None


@dataclass(frozen=True)
class BooleanAggregate:
    n: int
    count_true: int


def _weighted_quantile(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    """Quantile pondéré par interpolation linéaire sur la fonction de
    répartition pondérée cumulée (méthode standard, pas de dépendance
    externe à numpy)."""
    order = np.argsort(values)
    v = values[order]
    w = weights[order]
    cum_w = np.cumsum(w) - 0.5 * w
    cum_w /= np.sum(w)
    return float(np.interp(q, cum_w, v))


def aggregate_continuous(
    values: list[float], *, weights: list[float] | None = None
) -> ContinuousAggregate:
    """§9.2 : n, médiane, Q1, Q3, min, max, part des cas < 0. `values` peut
    contenir des NaN (analogue sans réalisation connue pour cet horizon) —
    ignorés, pas comblés (§7.5)."""
    arr = np.array(values, dtype=float)
    valid_mask = ~np.isnan(arr)
    valid = arr[valid_mask]
    n = len(valid)
    if n == 0:
        return ContinuousAggregate(
            n=0, median=None, q1=None, q3=None, min=None, max=None, share_negative=None
        )

    if weights is None:
        w = np.ones(n)
    else:
        w = np.array(weights, dtype=float)[valid_mask]
        if np.sum(w) <= 0:
            w = np.ones(n)

    return ContinuousAggregate(
        n=n,
        median=_weighted_quantile(valid, w, 0.5),
        q1=_weighted_quantile(valid, w, 0.25),
        q3=_weighted_quantile(valid, w, 0.75),
        min=float(np.min(valid)),
        max=float(np.max(valid)),
        share_negative=float(np.sum((valid < 0) * w) / np.sum(w)),
    )


def aggregate_boolean(values: list[bool | None]) -> BooleanAggregate:
    """§9.2 : fréquence brute, "m épisodes sur n" — n exclut les analogues
    sans réalisation connue (None), jamais compté comme faux par défaut."""
    known = [v for v in values if v is not None]
    return BooleanAggregate(n=len(known), count_true=sum(1 for v in known if v))


def similarity_weights(distances: list[float]) -> list[float]:
    """§9.3 : poids (1 - d_norm)² normalisés, pour weighting="similarity"."""
    arr = np.array(distances, dtype=float)
    raw = (1.0 - arr) ** 2
    total = np.sum(raw)
    if total <= 0:
        return [1.0 / len(arr)] * len(arr) if len(arr) else []
    return list(raw / total)
