"""Vecteur d'état — les 14 features de §8.1. Code métier pur : numpy et
dataclasses seulement, aucune I/O, aucune base de données, pandas absent de
toute signature publique (règle d'architecture, CLAUDE.md).

Toutes les fenêtres sont strictement rétrospectives : la valeur au rang t ne
dépend jamais d'un indice > t. C'est la propriété vérifiée par le test
anti-look-ahead (§12.3 n°1) — tronquer un panel à l'année t ne doit rien
changer aux features déjà calculées jusqu'à t.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

FEATURE_NAMES: tuple[str, ...] = (
    "infl_level",
    "infl_accel",
    "growth_level",
    "growth_gap",
    "rate_short_real",
    "rate_short_delta",
    "curve_slope",
    "debt_level",
    "debt_delta5",
    "credit_gap5",
    "equity_real_3y",
    "house_real_3y",
    "unemp_gap",
    "ca_level",
)

# (a) niveau -> rang percentile glissant (§8.2.1a) ; (b) variation -> échelle
# de volatilité locale puis rang (§8.2.1b).
FEATURE_KIND: dict[str, str] = {
    "infl_level": "level",
    "infl_accel": "variation",
    "growth_level": "level",
    "growth_gap": "variation",
    "rate_short_real": "level",
    "rate_short_delta": "variation",
    "curve_slope": "level",
    "debt_level": "level",
    "debt_delta5": "variation",
    "credit_gap5": "variation",
    "equity_real_3y": "variation",
    "house_real_3y": "variation",
    "unemp_gap": "variation",
    "ca_level": "level",
}

# Familles de pondération du moteur de similarité (§8.3, sliders UI).
FEATURE_FAMILY: dict[str, str] = {
    "infl_level": "prices",
    "infl_accel": "prices",
    "growth_level": "activity",
    "growth_gap": "activity",
    "rate_short_real": "rates",
    "rate_short_delta": "rates",
    "curve_slope": "rates",
    "debt_level": "debt",
    "debt_delta5": "debt",
    "credit_gap5": "credit",
    "equity_real_3y": "markets",
    "house_real_3y": "markets",
    "unemp_gap": "activity",
    "ca_level": "external",
}

MA_WINDOW = 10
MA_MIN_PERIODS = 7  # cohérent avec le minimum ~2/3 du §8.2.4 (20 sur 30)


@dataclass(frozen=True)
class RawPanel:
    """Séries brutes d'un seul pays, une ligne par année, triées par année
    croissante, sans trou d'index (une année manquante = NaN à sa place,
    pas une ligne absente)."""

    years: np.ndarray
    gdp_real_pc: np.ndarray
    cpi: np.ndarray
    rate_short: np.ndarray
    rate_long: np.ndarray
    debt_public_gdp: np.ndarray
    credit_private_gdp: np.ndarray
    equity_index_nominal: np.ndarray
    house_price_index: np.ndarray
    unemployment_rate: np.ndarray
    current_account_gdp: np.ndarray

    def __post_init__(self) -> None:
        n = len(self.years)
        for name in (
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
        ):
            if len(getattr(self, name)) != n:
                raise ValueError(f"{name} doit avoir la même longueur que years ({n})")
        if n > 1 and np.any(np.diff(self.years) != 1):
            raise ValueError("years doit être une suite d'années consécutives sans trou d'index")


@dataclass(frozen=True)
class FeaturePanel:
    years: np.ndarray
    features: dict[str, np.ndarray]  # feature_name -> array alignée sur years


def _pct_change(x: np.ndarray, lag: int) -> np.ndarray:
    """100 * (x[t] / x[t-lag] - 1), NaN si l'un des deux points manque."""
    out = np.full_like(x, np.nan, dtype=float)
    if lag < len(x):
        out[lag:] = 100.0 * (x[lag:] / x[:-lag] - 1.0)
    return out


def _diff(x: np.ndarray, lag: int) -> np.ndarray:
    """x[t] - x[t-lag], NaN si l'un des deux points manque."""
    out = np.full_like(x, np.nan, dtype=float)
    if lag < len(x):
        out[lag:] = x[lag:] - x[:-lag]
    return out


def _trailing_mean(x: np.ndarray, window: int, min_periods: int) -> np.ndarray:
    """Moyenne mobile sur [t-window, t-1], strictement avant t (exclut t,
    même convention que le rang percentile glissant §8.2.1a). NaN si moins de
    `min_periods` observations valides dans la fenêtre."""
    out = np.full_like(x, np.nan, dtype=float)
    for t in range(window, len(x)):
        segment = x[t - window : t]
        valid = segment[~np.isnan(segment)]
        if len(valid) >= min_periods:
            out[t] = float(np.mean(valid))
    return out


def _real_cumulative_return(
    nominal_index: np.ndarray, cpi: np.ndarray, years: int, *, chained: bool = False
) -> np.ndarray:
    """Rendement réel cumulé sur `years` ans : déflate le rendement nominal
    cumulé par l'inflation cumulée sur la même fenêtre.

    `chained=True` pour un indice construit en chaînant des rendements annuels
    (actions) : une année manquante à l'intérieur de la fenêtre y est sautée sans
    changer le niveau, ce qui revient à lui attribuer un rendement nul ; le rapport
    des deux extrémités serait alors faux. Le résultat est donc manquant (jamais
    imputé, ADR 0019). Un indice de niveau observé (prix immobiliers) n'a pas ce
    défaut : ses deux extrémités suffisent."""
    out = np.full_like(nominal_index, np.nan, dtype=float)
    if years < len(nominal_index):
        real_index = nominal_index / cpi
        out[years:] = 100.0 * (real_index[years:] / real_index[:-years] - 1.0)
        if chained:
            for t in range(years, len(nominal_index)):
                if np.isnan(nominal_index[t - years + 1 : t]).any():
                    out[t] = np.nan
    return out


def compute_features(panel: RawPanel) -> FeaturePanel:
    infl_level = _pct_change(panel.cpi, 1)
    infl_accel = _diff(infl_level, 2)

    growth_level = _pct_change(panel.gdp_real_pc, 1)
    growth_gap = growth_level - _trailing_mean(growth_level, MA_WINDOW, MA_MIN_PERIODS)

    rate_short_real = panel.rate_short - infl_level
    rate_short_delta = _diff(panel.rate_short, 2)
    curve_slope = panel.rate_long - panel.rate_short

    debt_level = panel.debt_public_gdp.astype(float)
    debt_delta5 = _diff(panel.debt_public_gdp, 5)

    credit_gap5 = _diff(panel.credit_private_gdp, 5)

    equity_real_3y = _real_cumulative_return(
        panel.equity_index_nominal, panel.cpi, 3, chained=True
    )
    house_real_3y = _real_cumulative_return(panel.house_price_index, panel.cpi, 3)

    unemp_gap = panel.unemployment_rate - _trailing_mean(
        panel.unemployment_rate, MA_WINDOW, MA_MIN_PERIODS
    )

    ca_level = panel.current_account_gdp.astype(float)

    features = {
        "infl_level": infl_level,
        "infl_accel": infl_accel,
        "growth_level": growth_level,
        "growth_gap": growth_gap,
        "rate_short_real": rate_short_real,
        "rate_short_delta": rate_short_delta,
        "curve_slope": curve_slope,
        "debt_level": debt_level,
        "debt_delta5": debt_delta5,
        "credit_gap5": credit_gap5,
        "equity_real_3y": equity_real_3y,
        "house_real_3y": house_real_3y,
        "unemp_gap": unemp_gap,
        "ca_level": ca_level,
    }
    return FeaturePanel(years=panel.years, features=features)
