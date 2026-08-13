from fastapi.testclient import TestClient

from macrolens.api.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_version_reports_pool_build_id() -> None:
    # Phase 5 : /version reflète désormais le build_id réel du pool en mémoire
    # (§8.2.2 : reference_frame fait partie du build_id). Avec des données
    # ingérées (JST/BIS/Maddison, phases 2-3), le pool se construit et
    # build_id est une chaîne non vide ; sans données, get_pool échoue et
    # main.py retombe sur {"build_id": None} (voir lifespan/version dans
    # macrolens/api/main.py).
    response = client.get("/version")
    assert response.status_code == 200
    build_id = response.json()["build_id"]
    assert build_id is None or (isinstance(build_id, str) and len(build_id) > 0)
