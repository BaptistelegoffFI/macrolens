"""Phase 5 (critère d'acceptation §10) : tests d'intégration HTTP sur les
endpoints meta/series/state/events/analogs — jusqu'ici seulement vérifiés
manuellement pendant le développement. Complète test_episodes_endpoints.py
et test_provenance_endpoints.py, qui couvrent déjà /episodes, /compare et
/provenance/*."""

from typing import Any

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


def test_health_and_version() -> None:
    assert client.get("/health").status_code == 200
    version = client.get("/version").json()
    assert version["build_id"] is None or isinstance(version["build_id"], str)


class TestMeta:
    def test_countries(self) -> None:
        response = client.get("/api/v1/meta/countries")
        assert response.status_code == 200
        body = response.json()
        assert any(c["iso3"] == "FRA" for c in body)

    def test_indicators(self) -> None:
        response = client.get("/api/v1/meta/indicators")
        assert response.status_code == 200
        assert len(response.json()) == 26

    def test_sources(self) -> None:
        response = client.get("/api/v1/meta/sources")
        assert response.status_code == 200
        assert any(s["id"] == "jst" for s in response.json())

    def test_coverage(self) -> None:
        response = client.get("/api/v1/meta/coverage")
        assert response.status_code == 200
        assert len(response.json()) > 0


class TestSeries:
    def test_series_returns_observations_with_source(self) -> None:
        response = client.get(
            "/api/v1/series", params={"country": "FRA", "indicator": "cpi", "freq": "A"}
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) > 0
        assert all(row["source_id"] for row in body)

    def test_state_vector_has_14_features_and_sources(self) -> None:
        response = client.get("/api/v1/state/FRA/2019")
        assert response.status_code == 200
        body = response.json()
        assert len(body["features"]) == 14
        assert body["sources"]

    def test_state_vector_404_for_unknown_year(self) -> None:
        response = client.get("/api/v1/state/FRA/1500")
        assert response.status_code == 404


class TestEvents:
    def test_events_filtered_by_country_include_global_events(self) -> None:
        response = client.get("/api/v1/events", params={"country": "FRA", "kind": "war"})
        assert response.status_code == 200
        labels = {e["label_en"] for e in response.json()}
        assert "World War I" in labels
        assert "World War II" in labels


class TestAnalogsSearch:
    def test_anchor_mode_returns_ranked_analogs(self) -> None:
        response = client.post(
            "/api/v1/analogs/search",
            json={
                "mode": "anchor",
                "anchor": {"country": "FRA", "year": 2019},
                "k": 5,
                "horizons": [1, 3],
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["analogs"]) == 5
        distances = [a["distance"] for a in body["analogs"]]
        assert distances == sorted(distances)
        assert body["sources_summary"]
        assert len(body["analogs"][0]["state"]) == 14

    def test_manual_mode(self) -> None:
        response = client.post(
            "/api/v1/analogs/search",
            json={
                "mode": "manual",
                "state": {"infl_level": 8.0, "debt_level": 95.0},
                "k": 5,
                "horizons": [1],
            },
        )
        assert response.status_code == 200
        assert len(response.json()["analogs"]) == 5

    def test_shock_mode(self) -> None:
        response = client.post(
            "/api/v1/analogs/search",
            json={
                "mode": "shock",
                "shock": {
                    "base": {"country": "DEU", "year": 2008},
                    "deltas": {"infl_level": 5.0},
                },
                "k": 5,
                "horizons": [1],
            },
        )
        assert response.status_code == 200
        assert len(response.json()["analogs"]) == 5

    def test_anchor_missing_field_is_422(self) -> None:
        response = client.post(
            "/api/v1/analogs/search", json={"mode": "anchor", "k": 5, "horizons": [1]}
        )
        assert response.status_code == 422

    def test_unknown_anchor_is_404(self) -> None:
        response = client.post(
            "/api/v1/analogs/search",
            json={
                "mode": "anchor",
                "anchor": {"country": "XXX", "year": 2019},
                "k": 5,
                "horizons": [1],
            },
        )
        assert response.status_code == 404

    def test_exclude_wartime_reduces_pool_for_a_wartime_window(self) -> None:
        payload: dict[str, Any] = {
            "mode": "anchor",
            "anchor": {"country": "FRA", "year": 2019},
            "k": 100,
            "horizons": [1],
            "filters": {"countries": ["NOR"], "year_min": 1938, "year_max": 1946},
        }
        kept = client.post("/api/v1/analogs/search", json=payload).json()
        payload["filters"]["exclude_wartime"] = True
        excluded = client.post("/api/v1/analogs/search", json=payload).json()
        assert excluded["pool_size"] < kept["pool_size"]
