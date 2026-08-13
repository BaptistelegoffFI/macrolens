"""§8.2 : comparabilité entre époques. Valeurs attendues calculées à la main
(ou par un calcul numpy indépendant du code testé) — règle 6, CLAUDE.md."""

import numpy as np
import pytest

from macrolens.core.normalize import Pool, rank_level, rank_variation


def _year_index(years: np.ndarray, year: int) -> int:
    return int(np.where(years == year)[0][0])


def _rolling30_level_pool() -> Pool:
    # FRA, 1971-2001 (31 années). Valeurs 0..30 strictement croissantes :
    # la fenêtre [1971,2000] (30 ans) pour l'année 2001 contient exactement
    # les valeurs 0..29 (30 valeurs), et f(2001)=30.
    years = np.arange(1971, 2002)
    values = np.arange(31, dtype=float)
    countries = np.array(["FRA"] * len(years))
    return Pool(countries=countries, years=years, values=values)


def test_rolling30_level_rank_excludes_current_year() -> None:
    pool = _rolling30_level_pool()
    ranks = rank_level(pool, reference_frame="rolling30")
    idx_2001 = _year_index(pool.years, 2001)
    # 30 valeurs dans la fenêtre (0..29), toutes < 30 -> rang 1.0.
    assert ranks[idx_2001] == pytest.approx(1.0)


def test_rolling30_level_rank_interior_value() -> None:
    years = np.arange(1971, 2002)
    values = np.arange(31, dtype=float)
    values[-1] = 15.5  # remplace f(2001) par une valeur intérieure à la fenêtre
    pool = Pool(countries=np.array(["FRA"] * len(years)), years=years, values=values)
    ranks = rank_level(pool, reference_frame="rolling30")
    idx_2001 = _year_index(pool.years, 2001)
    # Fenêtre = {0,...,29}. 16 valeurs (0..15) sont < 15.5 -> rang 16/30.
    assert ranks[idx_2001] == pytest.approx(16.0 / 30.0)


def test_rolling30_insufficient_history_gives_nan() -> None:
    # Seulement 10 années avant l'année cible : sous le minimum de 20 (§8.2.4).
    years = np.arange(1990, 2001)  # 1990..2000, 11 points
    values = np.arange(11, dtype=float)
    pool = Pool(countries=np.array(["FRA"] * len(years)), years=years, values=values)
    ranks = rank_level(pool, reference_frame="rolling30")
    idx_2000 = _year_index(pool.years, 2000)
    assert np.isnan(ranks[idx_2000])


def test_rolling30_is_retrospective_only_adding_future_does_not_change_past_rank() -> None:
    """§12.3 dans l'esprit du test anti-look-ahead, appliqué à rolling30 :
    ajouter des années futures au pool ne doit rien changer au rang déjà
    calculé pour une année antérieure."""
    years_short = np.arange(1971, 2002)
    values_short = np.arange(31, dtype=float)
    countries_short = np.array(["FRA"] * len(years_short))
    pool_short = Pool(countries=countries_short, years=years_short, values=values_short)
    rank_short = rank_level(pool_short, reference_frame="rolling30")[_year_index(years_short, 2001)]

    years_long = np.arange(1971, 2010)  # 8 années de plus, après 2001
    values_long = np.arange(len(years_long), dtype=float)
    countries_long = np.array(["FRA"] * len(years_long))
    pool_long = Pool(countries=countries_long, years=years_long, values=values_long)
    rank_long = rank_level(pool_long, reference_frame="rolling30")[_year_index(years_long, 2001)]

    assert rank_short == pytest.approx(rank_long)


def test_rank_variation_scales_by_mad_then_ranks() -> None:
    rng = np.random.default_rng(42)
    years = np.arange(1971, 2002)
    deltas = rng.normal(loc=0.0, scale=1.0, size=len(years))
    pool = Pool(countries=np.array(["FRA"] * len(years)), years=years, values=deltas)
    ranks = rank_variation(pool, reference_frame="rolling30", floor=0.0)

    idx_2001 = _year_index(years, 2001)
    window = deltas[years < 2001][-30:]
    med = np.median(window)
    mad = np.median(np.abs(window - med)) * 1.4826
    z = deltas[idx_2001] / mad
    expected_rank = float(np.sum(window / mad < z)) / len(window)
    assert ranks[idx_2001] == pytest.approx(expected_rank)


def test_floor_prevents_explosion_when_mad_is_near_zero() -> None:
    years = np.arange(1971, 2002)
    deltas = np.zeros(len(years))  # MAD = 0 partout : sans plancher, division par zéro
    deltas[-1] = 0.05
    pool = Pool(countries=np.array(["FRA"] * len(years)), years=years, values=deltas)
    ranks = rank_variation(pool, reference_frame="rolling30", floor=0.1)
    idx = _year_index(years, 2001)
    assert not np.isnan(ranks[idx])  # ne doit pas planter ni renvoyer NaN/inf


def test_cross_section_ranks_against_other_countries_same_year() -> None:
    # 30 pays synthétiques, tous en l'an 2000, valeurs 0..29 (>= 20 requis, §8.2.4).
    n_countries = 30
    countries = np.array([f"C{i:02d}" for i in range(n_countries)])
    years = np.full(n_countries, 2000)
    values = np.arange(n_countries, dtype=float)
    pool = Pool(countries=countries, years=years, values=values)
    ranks = rank_level(pool, reference_frame="cross_section")

    assert ranks[0] == pytest.approx(0.0)  # valeur minimale -> rang 0
    assert ranks[-1] == pytest.approx(29.0 / 30.0)  # valeur maximale


def test_era_pools_across_countries_sharing_the_same_regime_label() -> None:
    countries = np.array(["FRA"] * 20 + ["DEU"] * 20)
    years = np.tile(np.arange(2000, 2020), 2)
    values = np.concatenate([np.arange(20, dtype=float), np.arange(20, 40, dtype=float)])
    regime = np.array(["era_A"] * 40)  # un seul régime partagé : le pool est FRA+DEU
    pool = Pool(countries=countries, years=years, values=values, regime=regime)
    ranks = rank_level(pool, reference_frame="era")

    # FRA[0]=0.0 est la plus petite valeur de tout le pool (0..39) -> rang 0.
    fra_first = 0
    assert ranks[fra_first] == pytest.approx(0.0)


def test_era_without_regime_array_raises() -> None:
    years = np.arange(1990, 2020)
    values = np.arange(len(years), dtype=float)
    pool = Pool(countries=np.array(["FRA"] * len(years)), years=years, values=values)
    with pytest.raises(ValueError, match="era"):
        rank_level(pool, reference_frame="era")


def test_pool_frame_ranks_against_the_entire_panel() -> None:
    countries = np.array(["FRA"] * 20 + ["DEU"] * 20)
    years = np.tile(np.arange(2000, 2020), 2)
    values = np.concatenate([np.arange(20, dtype=float), np.arange(20, 40, dtype=float)])
    pool = Pool(countries=countries, years=years, values=values)
    ranks = rank_level(pool, reference_frame="pool")

    max_idx = int(np.argmax(values))
    assert ranks[max_idx] == pytest.approx(39.0 / 40.0)


def test_reference_frames_produce_different_results_on_the_same_query() -> None:
    """§12.3 test n°11 : les 4 reference_frame doivent donner des résultats
    différents sur au moins une requête, sinon l'un d'eux n'est pas implémenté."""
    rng = np.random.default_rng(7)
    countries = np.array(["FRA"] * 40 + ["DEU"] * 40)
    years = np.tile(np.arange(1980, 2020), 2)
    values = rng.normal(size=80)
    regime = np.where(years < 2000, "before", "after")
    pool = Pool(countries=countries, years=years, values=values, regime=regime)

    r_roll = rank_level(pool, reference_frame="rolling30")
    r_era = rank_level(pool, reference_frame="era")
    r_cross = rank_level(pool, reference_frame="cross_section")
    r_pool = rank_level(pool, reference_frame="pool")

    stacked = np.vstack([r_roll, r_era, r_cross, r_pool])
    # Au moins un point où les 4 vecteurs ne sont pas tous identiques.
    assert not np.all(np.nanstd(stacked, axis=0) < 1e-9)
