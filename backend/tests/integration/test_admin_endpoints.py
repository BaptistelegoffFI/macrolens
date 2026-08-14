"""Panneau d'administration hors périmètre du plan (ADR 0008) : mode
maintenance et annonce pour un déploiement public à un seul administrateur.
Refus par défaut si ADMIN_TOKEN n'est pas configuré — jamais de mot de passe
implicite en production."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from macrolens.api.main import app
from macrolens.db.session import make_engine

client = TestClient(app)

TOKEN = "test-admin-token"


@pytest.fixture(scope="module", autouse=True)
def _require_db():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    connection.close()


@pytest.fixture(autouse=True)
def _reset_status(monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    monkeypatch.setenv("ADMIN_TOKEN", TOKEN)
    client.put(
        "/api/v1/admin/status",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"maintenance_mode": False, "maintenance_message": None, "announcement": None},
    )
    yield
    client.put(
        "/api/v1/admin/status",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"maintenance_mode": False, "maintenance_message": None, "announcement": None},
    )


def test_public_status_readable_without_auth() -> None:
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    body = response.json()
    assert body["maintenance_mode"] is False


def test_admin_status_update_rejected_without_token() -> None:
    response = client.put("/api/v1/admin/status", json={"maintenance_mode": True})
    assert response.status_code == 401


def test_admin_status_update_rejected_with_wrong_token() -> None:
    response = client.put(
        "/api/v1/admin/status",
        headers={"Authorization": "Bearer wrong-token"},
        json={"maintenance_mode": True},
    )
    assert response.status_code == 401


def test_admin_status_update_accepted_with_correct_token() -> None:
    response = client.put(
        "/api/v1/admin/status",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={
            "maintenance_mode": True,
            "maintenance_message": "Fermé pour maintenance.",
            "announcement": None,
        },
    )
    assert response.status_code == 200
    assert response.json()["maintenance_mode"] is True
    assert response.json()["maintenance_message"] == "Fermé pour maintenance."

    # Le changement doit être visible immédiatement sur l'endpoint public.
    public = client.get("/api/v1/status")
    assert public.json()["maintenance_mode"] is True


def test_login_ok_with_correct_token() -> None:
    response = client.post("/api/v1/admin/login", json={"token": TOKEN})
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_login_401_with_wrong_token() -> None:
    response = client.post("/api/v1/admin/login", json={"token": "nope"})
    assert response.status_code == 401


def test_admin_disabled_returns_503_when_no_token_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ADMIN_TOKEN", raising=False)
    response = client.put(
        "/api/v1/admin/status",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"maintenance_mode": True},
    )
    assert response.status_code == 503


def test_maintenance_mode_blocks_analogs_search() -> None:
    client.put(
        "/api/v1/admin/status",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"maintenance_mode": True, "maintenance_message": "Site fermé.", "announcement": None},
    )
    response = client.post(
        "/api/v1/analogs/search",
        json={
            "mode": "anchor",
            "anchor": {"country": "FRA", "year": 2019},
            "k": 5,
            "horizons": [1],
        },
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Site fermé."
