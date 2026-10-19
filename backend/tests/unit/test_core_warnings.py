"""§8.2.6, §9.4 : règles d'avertissement déterministes."""


from macrolens.core.similarity import AnalogResult, ConcentrationStats
from macrolens.core.warnings import concentration_warning, epoch_gap_warning, small_n_warning

LEVEL_FEATURES = frozenset({"debt_level", "ca_level"})


def test_epoch_gap_warning_fires_when_far_and_level_dominated() -> None:
    analog = AnalogResult(
        country="SWE",
        year=1900,
        distance=0.3,
        similarity=70.0,
        feature_contributions={"debt_level": 0.09, "credit_gap5": 0.01},  # 90% niveau
    )
    warning = epoch_gap_warning(2025, analog, LEVEL_FEATURES)
    assert warning is not None
    assert warning.years_apart == 125
    assert "125 ans" in warning.message_fr


def test_epoch_gap_warning_silent_when_close_in_time() -> None:
    analog = AnalogResult(
        country="SWE", year=2000, distance=0.3, similarity=70.0,
        feature_contributions={"debt_level": 0.09},
    )
    assert epoch_gap_warning(2025, analog, LEVEL_FEATURES) is None  # 25 ans < 50


def test_epoch_gap_warning_silent_when_not_level_dominated() -> None:
    analog = AnalogResult(
        country="SWE", year=1900, distance=0.3, similarity=70.0,
        feature_contributions={"debt_level": 0.01, "credit_gap5": 0.09},  # 10% niveau
    )
    assert epoch_gap_warning(2025, analog, LEVEL_FEATURES) is None


def test_small_n_warning_below_threshold() -> None:
    msg = small_n_warning(3)
    assert msg is not None
    assert "3 analogue" in msg


def test_small_n_warning_silent_at_or_above_threshold() -> None:
    assert small_n_warning(5) is None
    assert small_n_warning(20) is None


def test_concentration_warning_fires_for_few_countries() -> None:
    stats = ConcentrationStats(hhi_country=0.4, hhi_decade=0.4, n_countries=2, n_decades=3)
    msg = concentration_warning(stats)
    assert msg is not None
    assert "2 pays" in msg


def test_concentration_warning_silent_for_diverse_pool() -> None:
    stats = ConcentrationStats(hhi_country=0.2, hhi_decade=0.2, n_countries=9, n_decades=8)
    assert concentration_warning(stats) is None


# Le frontend (frontend/src/lib/searchWarnings.ts) reconnaît ces phrases par leur forme pour les
# afficher dans la langue choisie. frontend/tests/searchWarnings.test.ts fige les mêmes phrases :
# changer la formulation ici sans adapter le décodeur doit faire échouer un test des deux côtés.
EPOCH_SENTENCE = (
    "Analogue distant de 67 ans. Le rapprochement porte sur des positions relatives, pas sur des "
    "niveaux comparables. Structures économiques très différentes."
)
SMALL_N_SENTENCE = (
    "Seulement 3 analogue(s) trouvé(s) : la distribution est affichée, "
    "les agrégats sont peu fiables."
)
CONCENTRATED_SENTENCE = (
    "Analogues concentrés sur 2 pays et 3 décennie(s) : plusieurs analogues peuvent correspondre à "
    "un même épisode historique plutôt qu'à des précédents indépendants."
)
HHI_SENTENCE = (
    "Indice de concentration élevé (HHI pays=0.13, HHI décennie=0.51) : plusieurs analogues "
    "peuvent appartenir au même épisode historique."
)


def test_warning_sentences_are_the_ones_the_frontend_decoder_expects() -> None:
    analog = AnalogResult(
        country="SWE", year=1958, distance=0.3, similarity=70.0,
        feature_contributions={"debt_level": 0.09, "credit_gap5": 0.01},
    )
    epoch = epoch_gap_warning(2025, analog, LEVEL_FEATURES)
    assert epoch is not None and epoch.message_fr == EPOCH_SENTENCE
    assert small_n_warning(3) == SMALL_N_SENTENCE
    few = ConcentrationStats(hhi_country=0.4, hhi_decade=0.4, n_countries=2, n_decades=3)
    assert concentration_warning(few) == CONCENTRATED_SENTENCE
    hhi = ConcentrationStats(hhi_country=0.13, hhi_decade=0.51, n_countries=9, n_decades=8)
    assert concentration_warning(hhi) == HHI_SENTENCE
