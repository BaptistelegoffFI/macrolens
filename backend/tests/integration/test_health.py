from fastapi.testclient import TestClient

from macrolens.api.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_version_returns_no_build_before_any_ingestion() -> None:
    response = client.get("/version")
    assert response.status_code == 200
    assert response.json() == {"build_id": None}
