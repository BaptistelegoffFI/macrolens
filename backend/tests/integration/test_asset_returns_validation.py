"""Phase 5 : trois scénarios dont la littérature connaît la réponse. Si les sorties ne
racontent pas la même histoire, quelque chose est faux en amont.

Enregistrements publiés utilisés (vérifiés pendant la recherche de sources) :
- S&P 500 dividendes inclus, Damodaran (histretSP, janvier 2026) : 1930 -25,12 %,
  1931 -43,84 %, 1932 -8,64 % ;
- Nikkei 225 en prix (Wikipedia, table annuelle) : fin 1989 38 915,87 ; fin 1995 19 868,15 ;
  1990 -38,72 %.
Aucun chiffre publié et vérifiable n'a été trouvé pour la France 1973-1978 : cet épisode
est validé en interne (docs/research/asset-validation.md).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.api.main import app
from macrolens.db.models import AssetObservation
from macrolens.db.session import make_engine

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def _require_ingested_db():  # type: ignore[no-untyped-def]
    try:
        with Session(make_engine()) as session:
            n = session.scalar(select(func.count()).select_from(AssetObservation))
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    if not n:
        pytest.skip("asset_observations vide : lancer `macrolens etl run-all`")


def _scenario(country: str, year: int) -> dict[str, dict[int, dict]]:  # type: ignore[type-arg]
    body = {"analogs": [{"country": country, "year": year}]}
    data = client.post("/api/v1/scenario/asset-returns", json=body).json()
    return {c["class_id"]: {x["horizon"]: x for x in c["cells"]} for c in data["classes"]}


def _median(cells: dict[str, dict[int, dict]], class_id: str, horizon: int) -> float:  # type: ignore[type-arg]
    value = cells[class_id][horizon]["cumulative"]["median"]
    assert value is not None
    return float(value)


def test_us_1929_the_depression_story() -> None:
    """Actions -50 % réel en trois ans ; la déflation (-20 % des prix) fait des
    obligations et des liquidités les gagnantes en termes réels ; l'immobilier recule."""
    s = _scenario("USA", 1929)
    assert -0.55 < _median(s, "equities", 3) < -0.45
    assert s["equities"][3]["max_drawdown"]["median"] < -0.45
    assert _median(s, "govt_bonds", 3) > 0.30
    assert _median(s, "cash", 3) > 0.30
    assert _median(s, "inflation", 3) < -0.15
    assert _median(s, "housing", 3) < 0
    assert _median(s, "equities", 10) > 0  # le marché s'est redressé sur dix ans


def test_us_1929_nominal_returns_agree_with_the_published_sp500_record() -> None:
    points = client.get("/api/v1/series/USA/asset-classes?from=1930&to=1932").json()["series"][0]
    nominal = {p["year"]: p["nominal"] for p in points["points"]}
    cumulative = (1 + nominal[1930]) * (1 + nominal[1931]) * (1 + nominal[1932]) - 1
    published = (1 - 0.2512) * (1 - 0.4384) * (1 - 0.0864) - 1
    assert abs(cumulative - published) < 0.03


def test_japan_after_the_1989_peak_the_lost_decade_story() -> None:
    """Actions -50 % réel en trois ans et toujours -48 % dix ans plus tard ; obligations d'État
    fortement positives en réel ; liquidités faiblement positives."""
    s = _scenario("JPN", 1989)
    assert -0.55 < _median(s, "equities", 3) < -0.45
    assert _median(s, "equities", 10) < -0.40
    assert _median(s, "govt_bonds", 10) > 0.50
    assert 0 < _median(s, "cash", 10) < 0.30


def test_japan_cumulative_return_matches_the_nikkei_but_single_years_do_not() -> None:
    """LIMITE CONNUE, détecteur volontaire. Cumul 1989-1995 : JST nominal proche du Nikkei en
    prix (écart inférieur à 8 points, les dividendes expliquent le reste). Mais JST donne -13,2 %
    pour 1990 là où le Nikkei donne -38,72 % : l'écart est dans la colonne brute `eq_tr` de JST,
    avant tout code du projet (docs/research/asset-sources.md). Si ce test échoue après une
    mise à jour de JST, l'écart a été corrigé : mettre à jour la documentation."""
    points = client.get("/api/v1/series/JPN/asset-classes?from=1990&to=1995").json()["series"][0]
    nominal = {p["year"]: p["nominal"] for p in points["points"]}
    cumulative = 1.0
    for year in range(1990, 1996):
        cumulative *= 1 + nominal[year]
    nikkei = 19868.15 / 38915.87
    assert abs((cumulative - 1) - (nikkei - 1)) < 0.08
    assert abs(nominal[1990] - (-0.3872)) > 0.20


def test_germany_1922_hyperinflation_story_and_nothing_invented() -> None:
    s = _scenario("DEU", 1922)
    # Les obligations d'État sont anéanties en réel.
    assert _median(s, "govt_bonds", 3) == pytest.approx(-1.0, abs=1e-6)
    assert _median(s, "fx", 3) == pytest.approx(-1.0, abs=1e-6)
    # Les actions montent en 1923 puis s'effondrent après la stabilisation.
    assert _median(s, "equities", 1) == pytest.approx(1.49653, abs=1e-4)
    assert _median(s, "equities", 3) < -0.7
    for class_id in ("equities", "govt_bonds", "fx", "inflation"):
        assert s[class_id][1]["n_extreme"] == 1
    # Pas de bill_rate en 1923 ni d'immobilier avant 1925 : vide, jamais zéro.
    for class_id in ("cash", "housing"):
        for horizon in (1, 3, 5, 10):
            assert s[class_id][horizon]["n"] == 0
            assert s[class_id][horizon]["cumulative"]["median"] is None


def test_france_1973_equities_are_deeply_negative_in_real_terms() -> None:
    """Pas de chiffre publié vérifiable : contrôle de signe et d'ordre de grandeur, et recoupement
    exact avec la réalisation déjà déployée (tests/integration/
    test_asset_returns_vs_existing_outcomes.py)."""
    s = _scenario("FRA", 1973)
    assert -0.40 < _median(s, "equities", 5) < -0.20
    assert _median(s, "inflation", 5) > 0.5
