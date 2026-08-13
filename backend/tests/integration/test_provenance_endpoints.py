"""Phase 5 : les 4 endpoints /provenance/* (§18.4, §18.9 phase 5) — le
bordereau ne doit jamais inventer une ligne pour une clé introuvable, et
doit être reproductible bit-à-bit (règle 1, CLAUDE.md)."""

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


def test_observation_provenance_traces_to_raw_file_and_locator() -> None:
    response = client.get(
        "/api/v1/provenance/observation",
        params={"country": "FRA", "indicator": "cpi", "period": "2019-01-01", "freq": "A"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"]["id"] == "jst"
    assert body["raw_file"]["filename"] == "JSTdatasetR6.dta"
    assert body["locator"]["kind"] == "dta"
    # règle 7 (CLAUDE.md) : aucune valeur sans raw_file_id ni locator.
    assert body["raw_file"] is not None
    assert body["locator"]


def test_observation_provenance_404_for_unknown_key() -> None:
    response = client.get(
        "/api/v1/provenance/observation",
        params={"country": "FRA", "indicator": "cpi", "period": "1500-01-01", "freq": "A"},
    )
    assert response.status_code == 404


def test_receipt_skips_unknown_keys_without_fabricating_rows() -> None:
    response = client.post(
        "/api/v1/provenance/receipt",
        json={
            "build_id": "abc123",
            "keys": [
                {"country": "FRA", "indicator": "cpi", "period": "2019-01-01", "freq": "A"},
                {"country": "ZZZ", "indicator": "cpi", "period": "1500-01-01", "freq": "A"},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["rows"]) == 1
    assert body["rows"][0]["country"] == "FRA"


def test_receipt_checksum_is_deterministic() -> None:
    payload = {
        "build_id": "abc123",
        "keys": [{"country": "FRA", "indicator": "cpi", "period": "2019-01-01", "freq": "A"}],
    }
    r1 = client.post("/api/v1/provenance/receipt", json=payload)
    r2 = client.post("/api/v1/provenance/receipt", json=payload)
    assert r1.json()["checksum"] == r2.json()["checksum"]


def test_raw_files_inventory_lists_ingested_sources() -> None:
    response = client.get("/api/v1/provenance/raw-files")
    assert response.status_code == 200
    body = response.json()
    assert len(body) > 0
    assert {"jst", "bis_cbpol", "maddison"} <= {r["source_id"] for r in body}


def test_source_page_404_when_no_page_rendered_yet() -> None:
    # docs/limitations.md : le rendu de page PDF n'est pas encore branché.
    response = client.get("/api/v1/provenance/page/1/412")
    assert response.status_code == 404
