"""Comparabilité entre époques (§8.2) — le cœur du problème du projet.

Deux traitements selon la nature de la feature (§8.2.1) :
  (a) niveau     -> rang percentile dans un groupe de comparaison.
  (b) variation  -> mise à l'échelle par la volatilité robuste (MAD) du même
                     groupe, puis le score obtenu est lui-même classé en
                     rang percentile dans ce groupe.

Le `reference_frame` (§8.2.2) ne change qu'une chose : la définition du
groupe de comparaison. Quatre définitions :
  rolling30     -> même pays, 30 années strictement précédentes (exclut t).
                   Seul mode strictement rétrospectif (§8.2.2 : "le seul
                   immunisé contre la dérive séculaire ET contre le
                   look-ahead"). Défaut.
  era           -> tous pays confondus, même étiquette de régime monétaire
                    que le point courant (§8.2.3), point courant inclus.
  cross_section -> tous les autres pays de la même année, point courant inclus.
  pool          -> tout le panel, point courant inclus.
Cette symétrie (une seule notion de "groupe", appliquée uniformément aux
features de niveau et de variation) n'est pas explicitée littéralement pour
era/cross_section/pool dans le plan — c'est l'interprétation la plus stricte
qui généralise la formule donnée pour rolling30 (§8.2.1) sans introduire une
méthode différente par mode. Voir docs/decisions pour la Phase 4.

Aucune I/O, aucune base de données, pandas absent des signatures publiques
(règle d'architecture, CLAUDE.md).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

import numpy as np

ReferenceFrame = str  # "rolling30" | "era" | "cross_section" | "pool"
ROLLING_WINDOW = 30
MIN_VALID_OBS = 20  # §8.2.4


@dataclass(frozen=True)
class Pool:
    """Un panel complet : une entrée par (pays, année). `values` porte les
    valeurs BRUTES d'UNE SEULE feature (niveau ou delta déjà calculé par
    features.py), alignées sur `countries`/`years`. `regime` est requis
    seulement pour reference_frame="era"."""

    countries: np.ndarray  # dtype str/object, shape (N,)
    years: np.ndarray  # dtype int, shape (N,)
    values: np.ndarray  # dtype float, shape (N,), NaN = trou
    regime: np.ndarray | None = None  # dtype str/object, shape (N,)

    def __post_init__(self) -> None:
        n = len(self.countries)
        if len(self.years) != n or len(self.values) != n:
            raise ValueError("countries, years, values doivent avoir la même longueur")
        if self.regime is not None and len(self.regime) != n:
            raise ValueError("regime doit avoir la même longueur que countries")


def _robust_mad(values: np.ndarray) -> float:
    """Écart-type robuste : MAD (médiane des écarts absolus à la médiane) x
    1.4826 (facteur de cohérence pour une loi normale). Ignore les NaN."""
    valid = values[~np.isnan(values)]
    if len(valid) == 0:
        return float("nan")
    med = float(np.median(valid))
    mad = float(np.median(np.abs(valid - med)))
    return mad * 1.4826


def _percentile_rank(value: float, group: np.ndarray) -> float:
    """Fraction du groupe strictement inférieure à `value` (§8.2.1a)."""
    valid = group[~np.isnan(group)]
    if len(valid) < MIN_VALID_OBS or np.isnan(value):
        return float("nan")
    return float(np.sum(valid < value)) / float(len(valid))


def _group_indices_rolling30(countries: np.ndarray, years: np.ndarray) -> list[np.ndarray]:
    """Pour chaque point i, les indices j du même pays avec
    years[i]-30 <= years[j] <= years[i]-1 (exclut i lui-même)."""
    by_country: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for i, (c, y) in enumerate(zip(countries, years, strict=True)):
        by_country[c].append((int(y), i))
    for c in by_country:
        by_country[c].sort()

    groups: list[np.ndarray] = []
    for c, y in zip(countries, years, strict=True):
        lo, hi = int(y) - ROLLING_WINDOW, int(y) - 1
        candidates = by_country[c]
        idx = np.array([j for (yy, j) in candidates if lo <= yy <= hi], dtype=int)
        groups.append(idx)
    return groups


def _group_indices_era(countries: np.ndarray, regime: np.ndarray) -> list[np.ndarray]:
    """Pour chaque point i, tous les indices j (tous pays) partageant la même
    étiquette de régime, i inclus."""
    by_regime: dict[str, list[int]] = defaultdict(list)
    for i, r in enumerate(regime):
        by_regime[r].append(i)
    return [np.array(by_regime[r], dtype=int) for r in regime]


def _group_indices_cross_section(years: np.ndarray) -> list[np.ndarray]:
    """Pour chaque point i, tous les indices j (tous pays) de la même année,
    i inclus."""
    by_year: dict[int, list[int]] = defaultdict(list)
    for i, y in enumerate(years):
        by_year[int(y)].append(i)
    return [np.array(by_year[int(y)], dtype=int) for y in years]


def _group_indices_pool(n: int) -> list[np.ndarray]:
    all_idx = np.arange(n)
    return [all_idx for _ in range(n)]


def _resolve_groups(pool: Pool, reference_frame: ReferenceFrame) -> list[np.ndarray]:
    if reference_frame == "rolling30":
        return _group_indices_rolling30(pool.countries, pool.years)
    if reference_frame == "era":
        if pool.regime is None:
            raise ValueError("reference_frame='era' nécessite Pool.regime")
        return _group_indices_era(pool.countries, pool.regime)
    if reference_frame == "cross_section":
        return _group_indices_cross_section(pool.years)
    if reference_frame == "pool":
        return _group_indices_pool(len(pool.countries))
    raise ValueError(f"reference_frame inconnu : {reference_frame!r}")


def rank_level(pool: Pool, *, reference_frame: ReferenceFrame = "rolling30") -> np.ndarray:
    """(a) Features de niveau (§8.2.1a) : rang percentile dans le groupe."""
    groups = _resolve_groups(pool, reference_frame)
    out = np.full(len(pool.values), np.nan)
    for i, idx in enumerate(groups):
        if len(idx) == 0:
            continue
        out[i] = _percentile_rank(pool.values[i], pool.values[idx])
    return out


def rank_variation(
    pool: Pool, *, reference_frame: ReferenceFrame = "rolling30", floor: float = 0.0
) -> np.ndarray:
    """(b) Features de variation (§8.2.1b) : mise à l'échelle MAD dans le
    groupe puis rang percentile du score obtenu, dans ce même groupe."""
    groups = _resolve_groups(pool, reference_frame)
    out = np.full(len(pool.values), np.nan)
    for i, idx in enumerate(groups):
        if len(idx) == 0 or np.isnan(pool.values[i]):
            continue
        mad = _robust_mad(pool.values[idx])
        scale = max(mad, floor) if not np.isnan(mad) else float("nan")
        if not scale or np.isnan(scale):
            continue
        z_i = pool.values[i] / scale
        z_group = pool.values[idx] / scale
        out[i] = _percentile_rank(z_i, z_group)
    return out
