"""Vérifie les fichiers YAML de référence eux-mêmes (§13 Phase 1), sans base de
données : ces contraintes doivent tenir même si personne ne lance `make dev`.
"""

from pathlib import Path

import yaml

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
CORE_COUNTRIES = {"FRA", "DEU", "ITA", "SWE", "FIN", "NOR"}


def _load(relpath: str) -> list[dict[str, object]]:
    return yaml.safe_load((DATA_DIR / relpath).read_text()) or []


def test_countries_cover_the_17_country_pool() -> None:
    countries = _load("reference/countries.yaml")
    assert len(countries) == 17
    core = {c["iso3"] for c in countries if c["is_core"]}
    assert core == CORE_COUNTRIES
    assert all(c["in_analog_pool"] for c in countries)


def test_indicators_are_26_unique_with_french_definitions() -> None:
    indicators = _load("reference/indicators.yaml")
    assert len(indicators) == 26
    codes = [i["code"] for i in indicators]
    assert len(set(codes)) == 26
    for indicator in indicators:
        assert str(indicator["definition_fr"]).strip()


def test_sources_have_real_urls_and_citations() -> None:
    sources = _load("reference/sources.yaml")
    assert len(sources) == 16
    ids = [s["id"] for s in sources]
    assert len(set(ids)) == len(ids)
    for source in sources:
        assert str(source["url"]).startswith("http")
        assert str(source["citation"]).strip()
        assert isinstance(source["priority"], int)


def test_every_event_has_a_source_url() -> None:
    total = 0
    for path in sorted((DATA_DIR / "events").glob("*.yaml")):
        events = yaml.safe_load(path.read_text()) or []
        for event in events:
            assert str(event["source_url"]).startswith("http"), (path.name, event["label_fr"])
            assert event["source_id"]
            assert event["date_start"]
        total += len(events)
    assert total > 0
