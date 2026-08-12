"""Vérifie etl/mappings/bis_cbpol.yaml : les 17 pays du pool sont couverts,
la Finlande n'a pas de série nationale (vérifié empiriquement contre l'API
BIS le 2026-08-12, voir le commentaire du fichier de mapping)."""

from pathlib import Path

import yaml

from macrolens.etl.sources.bis_cbpol import load_mapping

DATA_DIR = Path(__file__).resolve().parents[3] / "data"


def test_all_17_pool_countries_are_mapped() -> None:
    countries = yaml.safe_load((DATA_DIR / "reference" / "countries.yaml").read_text())
    known = {c["iso3"] for c in countries}
    mapping = load_mapping()
    assert set(mapping["countries"]) == known


def test_finland_has_no_national_area_but_is_a_euro_adopter() -> None:
    mapping = load_mapping()
    fin = mapping["countries"]["FIN"]
    assert fin["national_area"] is None
    assert fin["euro_adopter"] is True


def test_non_euro_countries_have_a_national_area_and_no_euro_flag() -> None:
    mapping = load_mapping()
    for iso3 in ("SWE", "NOR", "USA", "GBR", "JPN", "CHE", "DNK", "AUS", "CAN"):
        spec = mapping["countries"][iso3]
        assert spec["national_area"] is not None
        assert spec["euro_adopter"] is False
