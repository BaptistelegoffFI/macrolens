"""ADR 0021 à 0023 : catalogue des rendements d'actifs. Sans base de données."""

import copy
from typing import Any

import pytest
import yaml

from macrolens.asset_catalogue import CATALOGUE_PATH, load_catalogue, parse_catalogue


def _raw() -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load(CATALOGUE_PATH.read_text())
    return copy.deepcopy(data)


def _walk(nodes: Any) -> list[Any]:
    out = []
    for node in nodes:
        out.append(node)
        out.extend(_walk(node.children))
    return out


def test_real_catalogue_loads_and_every_series_is_tier_1() -> None:
    """Aucune série Tier 2 ou 3 n'est ingérée (rapport de sources non validé)."""
    catalogue = load_catalogue()
    assert set(catalogue.series) == {
        "jst.equity_tr",
        "jst.govt_bond_tr",
        "jst.bill_return",
        "jst.housing_tr",
        "jst.fx_usd",
        "jst.cpi",
    }
    assert all(s.tier == 1 for s in catalogue.series.values())
    assert all(s.source_id == "jst" for s in catalogue.series.values())


def test_every_series_cites_the_jst_returns_paper() -> None:
    """JST exige la citation du QJE (2019) pour toute donnée de rendements."""
    for series in load_catalogue().series.values():
        assert "The Rate of Return on Everything, 1870-2015" in series.citation
        assert "134(3), 1225-1298" in series.citation


def test_every_series_has_bilingual_labels_and_a_caveat() -> None:
    for series in load_catalogue().series.values():
        assert series.label_fr and series.label_en
        assert series.caveat_fr and series.caveat_en


def test_unavailable_nodes_carry_a_tier_and_a_bilingual_reason() -> None:
    catalogue = load_catalogue()
    unavailable = [n for n in _walk(catalogue.tree) if n.reason is not None]
    assert len(unavailable) == 8 + 2 + 4  # secteurs + crédit + matières premières
    for node in unavailable:
        assert node.series_id is None
        assert node.unavailable_tier in (2, 3)
        reason = catalogue.reasons[node.reason or ""]
        assert reason["fr"] and reason["en"]


def test_all_eight_sectors_are_listed_as_tier_3_unavailable() -> None:
    nodes = {n.id: n for n in _walk(load_catalogue().tree)}
    sectors = [nodes[i] for i in nodes if i.startswith("sector_")]
    assert len(sectors) == 8
    assert all(n.unavailable_tier == 3 for n in sectors)


def test_private_markets_are_shown_as_excluded_never_as_data() -> None:
    catalogue = load_catalogue()
    node = next(n for n in _walk(catalogue.tree) if n.id == "private_markets")
    assert node.excluded == "private_markets"
    assert node.series_id is None
    assert "Cambridge Associates" in catalogue.reasons["private_markets"]["en"]


def test_no_node_is_both_available_and_unavailable() -> None:
    for node in _walk(load_catalogue().tree):
        states = [node.series_id, node.reason, node.excluded]
        assert sum(s is not None for s in states) <= 1


def test_parse_rejects_duplicate_series() -> None:
    raw = _raw()
    raw["series"].append(copy.deepcopy(raw["series"][0]))
    with pytest.raises(ValueError, match="en double"):
        parse_catalogue(raw)


def test_parse_rejects_tree_pointing_to_unknown_series() -> None:
    raw = _raw()
    raw["tree"][0]["series"] = "jst.does_not_exist"
    with pytest.raises(ValueError, match="série inconnue"):
        parse_catalogue(raw)


def test_parse_rejects_unknown_reason() -> None:
    raw = _raw()
    raw["tree"][0]["children"][0]["children"][0]["unavailable"]["reason"] = "nope"
    with pytest.raises(ValueError, match="raison inconnue"):
        parse_catalogue(raw)


def test_parse_requires_a_column_for_stored_series() -> None:
    raw = _raw()
    del raw["series"][0]["column"]
    with pytest.raises(ValueError, match="column"):
        parse_catalogue(raw)
