"""Consigne de déploiement : aucun contrat de réponse déjà déployé ne change (ADR 0024).

`tests/snapshots/openapi_existing_contracts.json` a été généré depuis `main` (avant
cette fonctionnalité) : tous les chemins et schémas publics qu'il contient doivent
rester strictement identiques. Les chemins et schémas nouveaux sont libres.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from macrolens.api.main import app

SNAPSHOT = Path(__file__).resolve().parents[1] / "snapshots" / "openapi_existing_contracts.json"


@pytest.fixture(scope="module")
def snapshot() -> dict[str, Any]:
    return json.loads(SNAPSHOT.read_text())  # type: ignore[no-any-return]


@pytest.fixture(scope="module")
def current() -> dict[str, Any]:
    return app.openapi()


def test_snapshot_covers_the_existing_public_surface(snapshot: dict[str, Any]) -> None:
    assert len(snapshot["paths"]) == 21
    assert "/api/v1/analogs/search" in snapshot["paths"]
    assert "/api/v1/series" in snapshot["paths"]


def test_every_existing_path_is_unchanged(
    snapshot: dict[str, Any], current: dict[str, Any]
) -> None:
    for path, operations in snapshot["paths"].items():
        assert path in current["paths"], f"route supprimée : {path}"
        assert current["paths"][path] == operations, f"contrat modifié : {path}"


def test_every_existing_schema_is_unchanged(
    snapshot: dict[str, Any], current: dict[str, Any]
) -> None:
    schemas = current["components"]["schemas"]
    for name, schema in snapshot["schemas"].items():
        assert name in schemas, f"schéma supprimé : {name}"
        assert schemas[name] == schema, f"schéma modifié : {name}"


def test_new_routes_are_additive_and_all_under_the_expected_paths(
    snapshot: dict[str, Any], current: dict[str, Any]
) -> None:
    added = sorted(set(current["paths"]) - set(snapshot["paths"]))
    assert added == [
        "/api/v1/admin/activity",  # ADR 0028, journal d'usage de l'admin
        "/api/v1/admin/rankings",
        "/api/v1/analytics/event",
        "/api/v1/scenario/asset-returns",
        "/api/v1/scenario/asset-returns/detail",
        "/api/v1/series/{country}/asset-classes",
    ]
