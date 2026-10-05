"""Journal d'usage et classements du panneau admin (ADR 0028)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.api.main import app
from macrolens.db.models import UsageEvent
from macrolens.db.session import make_engine

client = TestClient(app)
TOKEN = "test-admin-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
PREFIX = "usage-test-"


@pytest.fixture(autouse=True)
def _env_and_cleanup(monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        engine.connect().close()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    monkeypatch.setenv("ADMIN_TOKEN", TOKEN)

    def wipe() -> None:
        with Session(engine) as s:
            s.execute(delete(UsageEvent).where(UsageEvent.client_id.like(f"{PREFIX}%")))
            s.commit()

    wipe()
    yield
    wipe()


def _ping(client_id: str, kind: str, name: str, detail: str | None = None) -> int:
    return client.post(
        "/api/v1/analytics/event",
        json={"client_id": client_id, "kind": kind, "name": name, "detail": detail},
    ).status_code


def test_event_endpoint_is_public_and_validates_input() -> None:
    cid = f"{PREFIX}{uuid.uuid4()}"
    assert _ping(cid, "page", "episode") == 204
    assert _ping(cid, "click", "x") == 422  # type d'événement inconnu
    assert _ping(cid, "page", "") == 422
    assert _ping(cid, "page", "x" * 81) == 422
    assert _ping(cid, "search", "SWE 1991", "d" * 201) == 422
    assert _ping("", "page", "episode") == 422


@pytest.mark.parametrize("path", ["/api/v1/admin/activity", "/api/v1/admin/rankings"])
def test_admin_reads_require_the_token(path: str) -> None:
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer nope"}).status_code == 401


def test_activity_lists_events_newest_first_with_opaque_device() -> None:
    cid = f"{PREFIX}{uuid.uuid4()}"
    _ping(cid, "page", "series")
    _ping(cid, "search", "SWE 1991", "mode=anchor · k=20")
    body = client.get("/api/v1/admin/activity?limit=50", headers=AUTH).json()
    mine = [e for e in body["events"] if e["name"] in ("series", "SWE 1991")]
    assert [e["kind"] for e in mine][:2] == ["search", "page"]
    assert mine[0]["detail"] == "mode=anchor · k=20"
    assert len(mine[0]["device"]) == 6 and cid not in str(body)
    assert mine[0]["device"] == mine[1]["device"]
    times = [e["at"] for e in body["events"]]
    assert times == sorted(times, reverse=True)


def test_activity_includes_visits_and_honours_limit() -> None:
    cid = f"{PREFIX}{uuid.uuid4()}"
    client.post("/api/v1/analytics/view", json={"client_id": cid})
    for _ in range(3):
        _ping(cid, "page", "coverage")
    body = client.get("/api/v1/admin/activity?limit=2", headers=AUTH).json()
    assert len(body["events"]) == 2
    assert client.get("/api/v1/admin/activity?limit=0", headers=AUTH).status_code == 422
    assert client.get("/api/v1/admin/activity?limit=501", headers=AUTH).status_code == 422
    kinds = {
        e["kind"]
        for e in client.get("/api/v1/admin/activity?limit=500", headers=AUTH).json()["events"]
    }
    assert "visit" in kinds


def test_rankings_count_events_and_distinct_devices() -> None:
    a, b = f"{PREFIX}{uuid.uuid4()}", f"{PREFIX}{uuid.uuid4()}"
    tag = uuid.uuid4().hex[:4].upper()
    label = f"ZZ{tag[:1]} 1991"  # reste un « pays » de trois lettres majuscules
    label = "QQQ 1991"
    for _ in range(3):
        _ping(a, "search", label)
    _ping(b, "search", label)
    _ping(a, "search", "QQQ 2008")
    _ping(a, "search", "manual")
    for _ in range(2):
        _ping(b, "page", "zz_page")
    body = client.get("/api/v1/admin/rankings?days=30", headers=AUTH).json()
    searches = {r["name"]: r for r in body["searches"]}
    assert searches[label] == {"name": label, "count": 4, "devices": 2}
    names = [r["name"] for r in body["searches"]]
    assert names.index(label) < names.index("QQQ 2008")  # classement par nombre décroissant
    countries = {r["name"]: r for r in body["countries"]}
    assert countries["QQQ"] == {"name": "QQQ", "count": 5, "devices": 2}
    assert "manual" not in countries  # sans pays : hors du classement des pays
    assert {r["name"]: r["count"] for r in body["pages"]}["zz_page"] == 2
    assert body["days"] == 30


def test_rankings_window_excludes_older_events_and_zero_means_all_time() -> None:
    cid = f"{PREFIX}{uuid.uuid4()}"
    old = datetime.now(UTC) - timedelta(days=100)
    with Session(make_engine()) as s:
        s.add(UsageEvent(client_id=cid, occurred_at=old, kind="search", name="OLD 1900"))
        s.commit()
    recent = client.get("/api/v1/admin/rankings?days=30", headers=AUTH).json()
    assert "OLD 1900" not in [r["name"] for r in recent["searches"]]
    everything = client.get("/api/v1/admin/rankings?days=0", headers=AUTH).json()
    assert "OLD 1900" in [r["name"] for r in everything["searches"]]
    assert client.get("/api/v1/admin/rankings?days=-1", headers=AUTH).status_code == 422
