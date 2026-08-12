"""Fonctions de transformation nommées et testées (§18.3). Chaque fonction
correspond à une entrée de `transform_chain` sur une observation : le
bordereau (§18.4) affiche cette chaîne en clair, donc chaque nom doit être
lisible tel quel.
"""


def parse_dta_float(value: float | None) -> float | None:
    """Passage d'une cellule Stata à un flottant Python (identité typée)."""
    if value is None:
        return None
    return float(value)


def multiply_1000(value: float | None) -> float | None:
    """JST exprime `pop` en milliers d'habitants."""
    if value is None:
        return None
    return value * 1000.0


def fraction_to_percent(value: float | None) -> float | None:
    """JST exprime certains ratios en fraction (0-1) plutôt qu'en pourcentage."""
    if value is None:
        return None
    return value * 100.0


def ratio_to_gdp_pct(numerator: float | None, gdp: float | None) -> float | None:
    """Ratio à un agrégat nominal (§7.2) : toujours au PIB nominal de la même
    année, même monnaie — ici les deux séries JST partagent la même base."""
    if numerator is None or gdp is None or gdp == 0:
        return None
    return numerator / gdp * 100.0


def gdp_real_from_percapita_and_pop(
    rgdpmad: float | None, pop_thousands: float | None
) -> float | None:
    """PIB réel agrégé = PIB réel par habitant (Int$ PPA) × population."""
    if rgdpmad is None or pop_thousands is None:
        return None
    return rgdpmad * pop_thousands * 1000.0


def chain_link_returns(returns: list[float | None], base: float = 100.0) -> list[float | None]:
    """Convertit une série de rendements période-à-période en indice chaîné,
    base 100 à la première observation disponible. Rétrospectif uniquement :
    index[t] ne dépend que de returns[0..t], jamais du futur (§8.1).
    """
    index: list[float | None] = []
    level: float | None = None
    for r in returns:
        if r is None:
            index.append(None)
            continue
        level = base if level is None else level * (1.0 + r)
        index.append(level)
    return index
