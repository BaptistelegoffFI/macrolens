"""Phase 5 : GET /episodes/{country}/{year} et POST /compare (ADR 0004
§4/§5) — fiche d'épisode = vecteur d'état + séries brutes ±10 ans +
événements chevauchant la même fenêtre."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from macrolens.api.main import app
from macrolens.db.session import make_engine

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def _require_db():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    connection.close()


def test_episode_returns_state_series_and_events() -> None:
    response = client.get("/api/v1/episodes/SWE/1991")
    assert response.status_code == 200
    body = response.json()
    assert body["country"] == "SWE"
    assert body["year"] == 1991
    assert body["state"] is not None
    assert len(body["state"]["features"]) == 14
    assert len(body["series"]["cpi"]) > 0
    assert any(e["kind"] == "banking_crisis" for e in body["events"])
    assert body["sources"]  # critère d'acceptation Phase 5 : bloc de sources (ADR 0004 §6)


def test_episode_unknown_country_returns_no_state_but_200() -> None:
    # Un pays/année sans vecteur d'état (ex. hors pool) n'est pas une erreur
    # HTTP : la fiche reste consultable (série/événements peuvent exister),
    # seul `state` est null (voir ADR 0004 §4).
    response = client.get("/api/v1/episodes/ZZZ/2019")
    assert response.status_code == 200
    assert response.json()["state"] is None


def test_compare_returns_one_episode_per_pair() -> None:
    response = client.post(
        "/api/v1/compare",
        json={
            "pairs": [
                {"country": "SWE", "year": 1991},
                {"country": "FIN", "year": 1990},
            ]
        },
    )
    assert response.status_code == 200
    episodes = response.json()["episodes"]
    assert len(episodes) == 2
    assert {(e["country"], e["year"]) for e in episodes} == {("SWE", 1991), ("FIN", 1990)}


def test_compare_rejects_fewer_than_two_pairs() -> None:
    response = client.post("/api/v1/compare", json={"pairs": [{"country": "SWE", "year": 1991}]})
    assert response.status_code == 422


def test_compare_rejects_more_than_six_pairs() -> None:
    pairs = [{"country": "FRA", "year": 2000 + i} for i in range(7)]
    response = client.post("/api/v1/compare", json={"pairs": pairs})
    assert response.status_code == 422
