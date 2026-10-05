"""Catalogue des rendements d'actifs : séries disponibles, hiérarchie de la page
Classes d'actifs, raisons d'indisponibilité (ADR 0022). Source unique, lue par
l'ingestion et par l'API depuis data/reference/asset_catalogue.yaml.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from macrolens.paths import DATA_DIR

CATALOGUE_PATH = DATA_DIR / "reference" / "asset_catalogue.yaml"

STORAGE_ASSET_OBSERVATIONS = "asset_observations"
STORAGE_OBSERVATIONS = "observations"


@dataclass(frozen=True)
class SeriesDef:
    id: str
    asset_class: str
    tier: int
    measure: str
    source_id: str
    storage: str
    citation: str
    label_fr: str
    label_en: str
    caveat_fr: str | None
    caveat_en: str | None
    column: str | None = None
    interp_columns: tuple[str, ...] = ()
    indicator_code: str | None = None


@dataclass(frozen=True)
class TreeNode:
    id: str
    label_fr: str
    label_en: str
    series_id: str | None = None
    unavailable_tier: int | None = None
    reason: str | None = None
    excluded: str | None = None
    children: tuple[TreeNode, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Catalogue:
    series: dict[str, SeriesDef]
    reasons: dict[str, dict[str, str]]
    tree: tuple[TreeNode, ...]


def _parse_node(raw: dict[str, Any]) -> TreeNode:
    unavailable = raw.get("unavailable") or {}
    return TreeNode(
        id=raw["id"],
        label_fr=raw["label_fr"],
        label_en=raw["label_en"],
        series_id=raw.get("series"),
        unavailable_tier=unavailable.get("tier"),
        reason=unavailable.get("reason"),
        excluded=raw.get("excluded"),
        children=tuple(_parse_node(c) for c in raw.get("children", [])),
    )


def _walk(nodes: tuple[TreeNode, ...]) -> list[TreeNode]:
    out: list[TreeNode] = []
    for node in nodes:
        out.append(node)
        out.extend(_walk(node.children))
    return out


def parse_catalogue(raw: dict[str, Any]) -> Catalogue:
    citation = " ".join(str(raw["citation_jst"]).split())
    series: dict[str, SeriesDef] = {}
    for s in raw["series"]:
        if s["id"] in series:
            raise ValueError(f"série en double dans le catalogue : {s['id']}")
        storage = s["storage"]
        if storage == STORAGE_ASSET_OBSERVATIONS and not s.get("column"):
            raise ValueError(f"{s['id']} : `column` obligatoire pour asset_observations")
        if storage == STORAGE_OBSERVATIONS and not s.get("indicator_code"):
            raise ValueError(f"{s['id']} : `indicator_code` obligatoire pour observations")
        series[s["id"]] = SeriesDef(
            id=s["id"],
            asset_class=s["asset_class"],
            tier=int(s["tier"]),
            measure=s["measure"],
            source_id=s["source_id"],
            storage=storage,
            citation=citation,
            label_fr=s["label_fr"],
            label_en=s["label_en"],
            caveat_fr=s.get("caveat_fr"),
            caveat_en=s.get("caveat_en"),
            column=s.get("column"),
            interp_columns=tuple(s.get("interp_columns", [])),
            indicator_code=s.get("indicator_code"),
        )
    reasons = {k: {"fr": v["fr"], "en": v["en"]} for k, v in raw["reasons"].items()}
    tree = tuple(_parse_node(n) for n in raw["tree"])

    seen: set[str] = set()
    for node in _walk(tree):
        if node.id in seen:
            raise ValueError(f"nœud en double dans l'arbre : {node.id}")
        seen.add(node.id)
        if node.series_id is not None and node.series_id not in series:
            raise ValueError(f"{node.id} référence une série inconnue : {node.series_id}")
        for key in (node.reason, node.excluded):
            if key is not None and key not in reasons:
                raise ValueError(f"{node.id} référence une raison inconnue : {key}")
    return Catalogue(series=series, reasons=reasons, tree=tree)


@lru_cache(maxsize=4)
def load_catalogue(path: Path = CATALOGUE_PATH) -> Catalogue:
    return parse_catalogue(yaml.safe_load(path.read_text()))
