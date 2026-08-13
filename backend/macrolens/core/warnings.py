"""Règles d'avertissement déterministes sur un résultat de recherche
d'analogues (§8.2.6, §9.4, §10.1 champ `warnings`). Code métier pur.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from macrolens.core.similarity import AnalogResult, ConcentrationStats

EPOCH_GAP_YEARS = 50
LEVEL_SHARE_THRESHOLD = 0.4
CORRELATED_EPISODE_MIN_SHARE = 0.25  # §15 piège 3 : plusieurs analogues, une seule crise


@dataclass(frozen=True)
class EpochWarning:
    analog_country: str
    analog_year: int
    years_apart: int
    level_share: float
    message_fr: str = field(default="")


def epoch_gap_warning(
    query_year: int, analog: AnalogResult, level_feature_names: frozenset[str]
) -> EpochWarning | None:
    """§8.2.6 : avertissement si l'analogue est distant de plus de 50 ans et
    que sa distance repose à plus de 40% sur des features de niveau."""
    years_apart = abs(analog.year - query_year)
    if years_apart <= EPOCH_GAP_YEARS:
        return None
    total = sum(analog.feature_contributions.values())
    if total <= 0:
        return None
    level_contrib = sum(
        v for f, v in analog.feature_contributions.items() if f in level_feature_names
    )
    level_share = level_contrib / total
    if level_share <= LEVEL_SHARE_THRESHOLD:
        return None
    message = (
        f"Analogue distant de {years_apart} ans. Le rapprochement porte sur des "
        "positions relatives, pas sur des niveaux comparables. Structures "
        "économiques très différentes."
    )
    return EpochWarning(
        analog_country=analog.country,
        analog_year=analog.year,
        years_apart=years_apart,
        level_share=level_share,
        message_fr=message,
    )


def small_n_warning(n: int, min_n: int = 5) -> str | None:
    """§9.4 : n < 5 -> bandeau d'avertissement, agrégats grisés."""
    if n >= min_n:
        return None
    return (
        f"Seulement {n} analogue(s) trouvé(s) : la distribution est affichée, "
        "les agrégats sont peu fiables."
    )


def concentration_warning(stats: ConcentrationStats, threshold: float = 0.5) -> str | None:
    """§9.4 : analogues concentrés sur peu de pays ou de décennies —
    signale des épisodes corrélés (§15 piège 3), pas des observations
    indépendantes."""
    if stats.n_countries <= 2 or stats.n_decades <= 2:
        return (
            f"Analogues concentrés sur {stats.n_countries} pays et {stats.n_decades} "
            "décennie(s) : plusieurs analogues peuvent correspondre à un même épisode "
            "historique plutôt qu'à des précédents indépendants."
        )
    if stats.hhi_country > threshold or stats.hhi_decade > threshold:
        return (
            f"Indice de concentration élevé (HHI pays={stats.hhi_country:.2f}, "
            f"HHI décennie={stats.hhi_decade:.2f}) : plusieurs analogues peuvent "
            "appartenir au même épisode historique."
        )
    return None
