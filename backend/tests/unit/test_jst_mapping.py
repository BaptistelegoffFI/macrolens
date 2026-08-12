"""Vérifie que etl/mappings/jst.yaml est cohérent avec le référentiel
indicateurs et avec les fonctions de transformation réellement disponibles —
un mapping qui pointe vers un indicateur ou une transform inexistants doit
être détecté avant l'exécution du pipeline, pas pendant."""

from pathlib import Path

import yaml

from macrolens.etl.sources.jst import TRANSFORMS, load_mapping

DATA_DIR = Path(__file__).resolve().parents[3] / "data"


def _known_indicator_codes() -> set[str]:
    raw = yaml.safe_load((DATA_DIR / "reference" / "indicators.yaml").read_text())
    return {i["code"] for i in raw}


def test_mapped_indicators_exist_in_the_26_indicator_socle() -> None:
    mapping = load_mapping()
    known = _known_indicator_codes()
    mapped_codes = set(mapping["indicators"]) | set(mapping["chained_indicators"])
    assert mapped_codes <= known, mapped_codes - known


def test_not_mapped_indicators_are_also_real_codes() -> None:
    mapping = load_mapping()
    known = _known_indicator_codes()
    assert set(mapping["not_mapped"]) <= known


def test_every_socle_indicator_is_accounted_for() -> None:
    """Chaque indicateur du socle est soit mappé, soit explicitement listé
    comme non disponible dans JST (§13 Phase 2) — jamais silencieusement
    absent des deux listes."""
    mapping = load_mapping()
    known = _known_indicator_codes()
    accounted = (
        set(mapping["indicators"]) | set(mapping["chained_indicators"]) | set(mapping["not_mapped"])
    )
    assert accounted == known


def test_transforms_referenced_in_mapping_all_exist() -> None:
    mapping = load_mapping()
    for code, spec in mapping["indicators"].items():
        assert spec["transform"] in TRANSFORMS, f"{code}: transform inconnue {spec['transform']!r}"
