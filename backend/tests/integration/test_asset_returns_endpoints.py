"""ADR 0015 à 0024 : endpoints de rendements d'actifs sur la base locale ingérée.
Valeurs attendues calculées à part, en Decimal, depuis les lignes brutes JST."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.api.main import app
from macrolens.db.models import AssetObservation
from macrolens.db.session import make_engine

client = TestClient(app)
TOKEN = "test-admin-token"
CLASS_ORDER = ["equities", "govt_bonds", "cash", "housing", "fx", "inflation"]


@pytest.fixture(scope="module", autouse=True)
def _require_ingested_db():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        with Session(engine) as session:
            n = session.scalar(select(func.count()).select_from(AssetObservation))
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    if not n:
        pytest.skip("asset_observations vide : lancer `macrolens etl run-all`")


def _post(analogs: list[tuple[str, int]], horizons: list[int] | None = None) -> dict:  # type: ignore[type-arg]
    body: dict = {"analogs": [{"country": c, "year": y} for c, y in analogs]}  # type: ignore[type-arg]
    if horizons is not None:
        body["horizons"] = horizons
    response = client.post("/api/v1/scenario/asset-returns", json=body)
    assert response.status_code == 200, response.text
    return response.json()  # type: ignore[no-any-return]


def _cell(data: dict, class_id: str, horizon: int) -> dict:  # type: ignore[type-arg]
    klass = next(c for c in data["classes"] if c["class_id"] == class_id)
    return next(c for c in klass["cells"] if c["horizon"] == horizon)  # type: ignore[no-any-return]


# ---- structure et provenance -------------------------------------------------


def test_response_is_versioned_ordered_and_carries_provenance_for_every_series() -> None:
    data = _post([("USA", 1929), ("FRA", 1973)])
    assert data["schema_version"] == "asset-returns/1"
    assert data["tier"] == 1
    assert [c["class_id"] for c in data["classes"]] == CLASS_ORDER
    assert data["horizons"] == [1, 3, 5, 10]
    for klass in data["classes"]:
        series = klass["series"]
        assert series["tier"] == 1
        assert series["source"]["id"] == "jst"
        assert "CC BY-NC-SA" in series["source"]["licence"]
        assert "The Rate of Return on Everything" in series["citation"]
        # Années de début vérifiées dans le fichier JST (immobilier : 1871).
        first = 1871 if klass["class_id"] == "housing" else 1870
        assert (series["first_year"], series["last_year"]) == (first, 2020)
        assert len(klass["cells"]) == 4
        for cell in klass["cells"]:
            assert cell["n_requested"] == 2


def test_sections_and_return_bases_follow_the_brief() -> None:
    data = _post([("USA", 1929)])
    layout = {c["class_id"]: (c["section"], c["return_basis"]) for c in data["classes"]}
    assert layout == {
        "equities": ("core", "real_total_return"),
        "govt_bonds": ("core", "real_total_return"),
        "cash": ("core", "real_total_return"),
        "housing": ("housing", "real_total_return"),
        "fx": ("fx", "nominal_fx_return"),
        "inflation": ("inflation", "cpi_change"),
    }


# ---- épisodes de référence, valeurs calculées à part ------------------------


def test_us_1929_equities_three_years_matches_hand_computed_real_return() -> None:
    cell = _cell(_post([("USA", 1929)]), "equities", 3)
    assert cell["n"] == 1
    assert cell["cumulative"]["median"] == pytest.approx(-0.501976, abs=1e-6)
    assert cell["annualised"]["median"] == pytest.approx(-0.207346, abs=1e-6)
    assert cell["hit_rate"] == 0.0


def test_japan_1989_and_france_1973_equities() -> None:
    data = _post([("JPN", 1989)], [3])
    assert _cell(data, "equities", 3)["cumulative"]["median"] == pytest.approx(-0.499318, abs=1e-6)
    data = _post([("FRA", 1973)], [5])
    assert _cell(data, "equities", 5)["cumulative"]["median"] == pytest.approx(-0.309010, abs=1e-6)


def test_germany_1922_keeps_the_hyperinflation_return_and_flags_it() -> None:
    """ADR 0020 : aucune valeur écrêtée. Rendement réel 1923 = +149,65 % (Fisher)."""
    cell = _cell(_post([("DEU", 1922)], [1]), "equities", 1)
    assert cell["cumulative"]["median"] == pytest.approx(1.49653, abs=1e-4)
    assert cell["n_extreme"] == 1
    inflation = _cell(_post([("DEU", 1922)], [1]), "inflation", 1)
    assert inflation["cumulative"]["median"] == pytest.approx(1.0570967e9, rel=1e-6)
    assert inflation["n_extreme"] == 1


def test_extreme_episode_does_not_move_the_median() -> None:
    normal = [("USA", 1929), ("JPN", 1989), ("FRA", 1973)]
    base = _cell(_post(normal, [1]), "equities", 1)["cumulative"]["median"]
    with_germany = _cell(_post([*normal, ("DEU", 1922)], [1]), "equities", 1)
    assert with_germany["n"] == 4
    assert with_germany["cumulative"]["max"] == pytest.approx(1.49653, abs=1e-4)
    # La médiane de 4 valeurs reste entre les deux valeurs centrales, jamais attirée par le maximum.
    assert with_germany["cumulative"]["median"] < 0.1
    assert base < 0


# ---- N, fenêtres tronquées et exclusions motivées (ADR 0019) -------------------


def test_truncated_forward_windows_are_excluded_not_shown_partial() -> None:
    """JST s'arrête en 2020 : un analogue de 2018 n'a pas de fenêtre à 3 ans."""
    data = _post([("ITA", 2018)], [1, 3])
    one = _cell(data, "equities", 1)
    three = _cell(data, "equities", 3)
    assert one["n"] == 1
    assert three["n"] == 0
    assert three["cumulative"]["median"] is None
    assert three["hit_rate"] is None
    assert three["exclusions"]["truncated_end"] == 1


def test_n_drops_and_reason_is_given_for_a_gap_in_the_series() -> None:
    """Allemagne : pas de rendement immobilier de 1919 à 1924, ni de bill_rate en 1923."""
    data = _post([("DEU", 1922)], [1])
    assert _cell(data, "housing", 1)["n"] == 0
    assert _cell(data, "housing", 1)["exclusions"]["gap"] == 1
    assert _cell(data, "cash", 1)["exclusions"]["gap"] == 1


def test_window_before_the_start_of_a_series_is_classified() -> None:
    cell = _cell(_post([("USA", 1860)], [3]), "equities", 3)
    assert cell["n"] == 0
    assert cell["exclusions"]["before_start"] == 1


def test_canada_has_no_return_series_in_jst_and_is_excluded_not_zeroed() -> None:
    data = _post([("CAN", 1980)], [3])
    for class_id in ("equities", "govt_bonds", "cash", "housing"):
        cell = _cell(data, class_id, 3)
        assert cell["n"] == 0
        assert cell["exclusions"]["no_series"] == 1
    assert _cell(data, "fx", 3)["n"] == 1
    assert _cell(data, "inflation", 3)["n"] == 1


def test_unknown_country_is_excluded_for_every_class() -> None:
    data = _post([("XXX", 1980), ("USA", 1980)], [1])
    assert _cell(data, "equities", 1)["n"] == 1
    assert _cell(data, "equities", 1)["exclusions"]["no_series"] == 1
    assert _cell(data, "equities", 1)["n_requested"] == 2


def test_duplicate_analogs_are_counted_once() -> None:
    data = _post([("USA", 1929), ("usa", 1929)], [1])
    assert data["n_analogs"] == 1
    assert _cell(data, "equities", 1)["n"] == 1


def test_forward_paths_use_only_complete_windows() -> None:
    data = _post([("USA", 1929), ("ITA", 2012)], [10])
    paths = {p["class_id"]: p for p in data["forward_paths"]}
    assert set(paths) == {"equities", "govt_bonds"}
    equities = paths["equities"]
    assert equities["horizon"] == 10
    assert [p["step"] for p in equities["points"]] == list(range(11))
    # ITA 2012 + 10 ans dépasse 2020 : une seule fenêtre complète.
    assert all(p["n"] == 1 for p in equities["points"])
    assert equities["points"][0]["median"] == 0.0


# ---- change, inflation, immobilier -------------------------------------------


def test_fx_is_a_separate_nominal_row_with_regime_flag() -> None:
    data = _post([("GBR", 1950), ("USA", 1990)], [3])
    fx = _cell(data, "fx", 3)
    assert fx["n"] == 2
    assert fx["n_pegged"] == 1  # GBR 1951-1953 : Bretton Woods ; USA 1991-1993 : flottement
    assert fx["max_drawdown"] is not None
    assert _cell(data, "equities", 3)["n_pegged"] is None


def test_us_fx_is_flat_because_it_is_the_base_currency() -> None:
    fx = _cell(_post([("USA", 1990)], [5]), "fx", 5)
    assert fx["cumulative"]["median"] == 0.0


def test_inflation_row_has_no_hit_rate_or_drawdown() -> None:
    cell = _cell(_post([("FRA", 1973)], [5]), "inflation", 5)
    assert cell["hit_rate"] is None
    assert cell["max_drawdown"] is None
    assert cell["cumulative"]["median"] == pytest.approx(0.6645, abs=1e-3)


def test_interpolation_is_tracked_only_for_series_that_carry_a_flag() -> None:
    data = _post([("FRA", 1973)], [1])
    assert _cell(data, "equities", 1)["n_interpolated"] == 0
    assert _cell(data, "housing", 1)["n_interpolated"] == 0
    assert _cell(data, "govt_bonds", 1)["n_interpolated"] is None
    assert _cell(data, "cash", 1)["n_interpolated"] is None


# ---- déterminisme --------------------------------------------------------------


def test_same_request_gives_identical_response_and_is_order_independent() -> None:
    analogs = [("USA", 1929), ("JPN", 1989), ("FRA", 1973), ("DEU", 1922), ("ITA", 1992)]
    first = _post(analogs)
    assert _post(analogs) == first
    assert _post(list(reversed(analogs))) == first


# ---- validation et dégradation --------------------------------------------------


@pytest.mark.parametrize(
    "body",
    [
        {"analogs": []},
        {"analogs": [{"country": "USA", "year": 1929}], "horizons": [0]},
        {"analogs": [{"country": "USA", "year": 1929}], "horizons": [31]},
        {"analogs": [{"country": "USA", "year": 1929}], "horizons": []},
        {"analogs": [{"country": "US", "year": 1929}]},
        {"analogs": [{"country": "USA", "year": 1929}] * 201},
    ],
)
def test_invalid_requests_are_rejected(body: dict) -> None:  # type: ignore[type-arg]
    assert client.post("/api/v1/scenario/asset-returns", json=body).status_code == 422


def test_scenario_endpoints_are_blocked_in_maintenance_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ADMIN_TOKEN", TOKEN)
    headers = {"Authorization": f"Bearer {TOKEN}"}
    off = {"maintenance_mode": False, "maintenance_message": None, "announcement": None}
    on = {"maintenance_mode": True, "maintenance_message": "Fermé.", "announcement": None}
    client.put("/api/v1/admin/status", headers=headers, json=on)
    try:
        body = {"analogs": [{"country": "USA", "year": 1929}]}
        assert client.post("/api/v1/scenario/asset-returns", json=body).status_code == 503
        assert client.post("/api/v1/scenario/asset-returns/detail", json=body).status_code == 503
        assert client.get("/api/v1/series/USA/asset-classes").status_code == 200
    finally:
        client.put("/api/v1/admin/status", headers=headers, json=off)


# ---- Tiers 2 et 3 -----------------------------------------------------------------


def test_detail_lists_expected_tier_2_and_3_rows_with_reasons_and_no_values() -> None:
    body = {"analogs": [{"country": "USA", "year": 1929}]}
    response = client.post("/api/v1/scenario/asset-returns/detail", json=body)
    assert response.status_code == 200
    data = response.json()
    assert data["tiers"] == [2, 3]
    entries = {e["node_id"]: e for e in data["entries"]}
    assert len(entries) == 8 + 2 + 4 + 1
    assert all("median" not in e and "cells" not in e for e in entries.values())
    assert entries["sector_technology"]["tier"] == 3
    assert entries["sector_technology"]["status"] == "not_ingested"
    assert entries["commodities_energy"]["tier"] == 2
    assert entries["private_markets"]["status"] == "excluded"
    assert entries["private_markets"]["tier"] is None
    assert "Cambridge Associates" in entries["private_markets"]["reason_en"]
    assert all(e["reason_fr"] and e["reason_en"] for e in entries.values())


# ---- série par pays ----------------------------------------------------------------


def test_country_series_exposes_every_series_with_tier_and_coverage() -> None:
    response = client.get("/api/v1/series/USA/asset-classes")
    assert response.status_code == 200
    data = response.json()
    assert data["country"] == "USA"
    assert [s["series"]["series_id"] for s in data["series"]] == [
        "jst.equity_tr", "jst.govt_bond_tr", "jst.bill_return", "jst.housing_tr",
        "jst.fx_usd", "jst.cpi",
    ]
    equities = data["series"][0]
    assert equities["series"]["tier"] == 1
    assert (equities["series"]["first_year"], equities["series"]["last_year"]) == (1872, 2020)
    assert len(equities["points"]) == 149
    assert equities["headline"] == "real_return"


def test_country_series_range_summary_matches_hand_computed_values() -> None:
    data = client.get("/api/v1/series/USA/asset-classes?from=1929&to=1932").json()
    equities = data["series"][0]["summary"]
    assert equities["available"] and not equities["partial_coverage"]
    assert (equities["start_year"], equities["end_year"], equities["n_obs"]) == (1929, 1932, 4)
    assert equities["gaps"] == []
    assert equities["level_kind"] == "real_index"
    assert equities["level_start"] == 100.0
    assert equities["change"] == pytest.approx(-0.518756, abs=1e-6)
    assert equities["level_end"] == pytest.approx(48.124391, abs=1e-5)
    assert equities["annualised"] == pytest.approx(-0.167103, abs=1e-6)
    assert equities["nominal_change"] == pytest.approx(-0.614442, abs=1e-6)
    assert equities["nominal_level_end"] == pytest.approx(38.555798, abs=1e-5)
    assert equities["max_drawdown"] == pytest.approx(-0.518756, abs=1e-6)
    cpi = data["series"][5]["summary"]
    assert cpi["level_kind"] == "cpi_index"
    assert cpi["level_start"] == pytest.approx(13.846565, abs=1e-6)
    assert cpi["level_end"] == pytest.approx(11.093447, abs=1e-6)
    assert cpi["change"] == pytest.approx(-0.198830, abs=1e-6)


def test_country_series_gap_inside_range_blocks_the_summary_and_lists_the_gap() -> None:
    data = client.get("/api/v1/series/DEU/asset-classes?from=1920&to=1925").json()
    cash = data["series"][2]["summary"]
    assert cash["available"]
    assert cash["gaps"] == [{"start_year": 1923, "end_year": 1923}]
    assert cash["change"] is None and cash["annualised"] is None
    points = {p["year"]: p for p in data["series"][2]["points"]}
    assert 1923 not in points  # jamais une ligne inventée


def test_country_series_outside_coverage_is_not_available_not_zero() -> None:
    data = client.get("/api/v1/series/ITA/asset-classes?from=1900&to=1910").json()
    housing = data["series"][3]
    assert housing["points"] == []
    assert housing["summary"]["available"] is False
    assert housing["summary"]["change"] is None


def test_country_series_partial_coverage_is_flagged() -> None:
    data = client.get("/api/v1/series/ITA/asset-classes?from=1920&to=1950").json()
    summary = data["series"][3]["summary"]
    assert summary["available"]
    assert summary["partial_coverage"] is True
    assert summary["start_year"] >= 1928


def test_country_series_fx_for_the_base_currency() -> None:
    data = client.get("/api/v1/series/USA/asset-classes?from=1990&to=1995").json()
    fx = data["series"][4]
    assert fx["headline"] == "nominal_fx_return"
    assert fx["summary"]["level_kind"] == "local_per_usd"
    assert fx["summary"]["level_start"] == 1.0 and fx["summary"]["level_end"] == 1.0
    assert fx["summary"]["change"] == 0.0


def test_country_tree_statuses() -> None:
    def flatten(nodes: list[dict]) -> dict[str, dict]:  # type: ignore[type-arg]
        out: dict[str, dict] = {}  # type: ignore[type-arg]
        for n in nodes:
            out[n["id"]] = n
            out.update(flatten(n["children"]))
        return out

    nodes = flatten(client.get("/api/v1/series/USA/asset-classes").json()["tree"])
    assert nodes["equities"]["status"] == "available" and nodes["equities"]["tier"] == 1
    assert nodes["fixed_income"]["status"] == "group"
    assert nodes["sector_energy"]["status"] == "not_ingested"
    assert nodes["sector_energy"]["tier"] == 3
    assert nodes["credit_hy"]["status"] == "not_ingested"
    assert nodes["private_markets"]["status"] == "excluded"
    canada = flatten(client.get("/api/v1/series/CAN/asset-classes").json()["tree"])
    assert canada["equities"]["status"] == "no_country_data"
    assert canada["fx"]["status"] == "available"


def test_country_series_lowercase_and_unknown_country() -> None:
    assert client.get("/api/v1/series/usa/asset-classes").json()["country"] == "USA"
    assert client.get("/api/v1/series/ZZZ/asset-classes").status_code == 404
    assert client.get("/api/v1/series/USA/asset-classes?from=1700").status_code == 422
