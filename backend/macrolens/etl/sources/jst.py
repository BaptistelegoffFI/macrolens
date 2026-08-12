"""Loader JST (§5.1, §7). Implémente le protocole SourceLoader du plan :
download / parse / validate, plus l'extraction de la chronologie des crises
bancaires (§13 Phase 2) directement depuis le dataset ingéré — jamais
transcrite à la main (voir docs/decisions/0001-ambiguites-plan-phase-1.md,
point 6).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, cast

import httpx
import pandas as pd
import pyreadstat
import yaml

from macrolens.etl.derive import (
    chain_link_returns,
    fraction_to_percent,
    gdp_real_from_percapita_and_pop,
    multiply_1000,
    parse_dta_float,
    ratio_to_gdp_pct,
)
from macrolens.paths import DATA_DIR

SOURCE_ID = "jst"
VINTAGE = "R6"

DATASET_URL = "https://www.macrohistory.net/app/download/9834512469/JSTdatasetR6.dta?t=1763503850"
DOC_URL = "https://www.macrohistory.net/app/download/9834516169/JST_documentationR6.pdf?t=1676279836"
CRISIS_DOC_URL = (
    "https://www.macrohistory.net/app/download/9844625569/JSTcrisis_chronology.pdf?t=1616702593"
)

_MODULE_DIR = Path(__file__).resolve().parent.parent
MAPPING_PATH = _MODULE_DIR / "mappings" / "jst.yaml"
COUNTRY_BREAKS_PATH = DATA_DIR / "reference" / "country_breaks.yaml"
COUNTRIES_PATH = DATA_DIR / "reference" / "countries.yaml"

TRANSFORMS: dict[str, Any] = {
    "parse_dta_float": parse_dta_float,
    "multiply_1000": multiply_1000,
    "fraction_to_percent": fraction_to_percent,
    "ratio_to_gdp_pct": ratio_to_gdp_pct,
    "gdp_real_from_percapita_and_pop": gdp_real_from_percapita_and_pop,
}

DOWNLOAD_TARGETS = [
    ("JSTdatasetR6.dta", DATASET_URL, "dta"),
    ("JST_documentationR6.pdf", DOC_URL, "pdf"),
    ("JSTcrisis_chronology.pdf", CRISIS_DOC_URL, "pdf"),
]


@dataclass(frozen=True)
class DownloadedFile:
    filename: str
    path: Path
    media_type: str
    sha256: str
    size_bytes: int
    origin_url: str
    downloaded_at: datetime


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(dest_dir: Path, *, force: bool = False) -> list[DownloadedFile]:
    """Idempotent : si le fichier existe déjà, ne retéléchargement pas (§7.1)."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for filename, url, media_type in DOWNLOAD_TARGETS:
        path = dest_dir / filename
        if force or not path.exists():
            with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as resp:
                resp.raise_for_status()
                with path.open("wb") as fh:
                    for chunk in resp.iter_bytes():
                        fh.write(chunk)
        results.append(
            DownloadedFile(
                filename=filename,
                path=path,
                media_type=media_type,
                sha256=_sha256(path),
                size_bytes=path.stat().st_size,
                origin_url=url,
                downloaded_at=datetime.now(UTC),
            )
        )
    return results


def load_mapping() -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load(MAPPING_PATH.read_text())
    return data


def _load_country_breaks() -> list[dict[str, Any]]:
    raw = yaml.safe_load(COUNTRY_BREAKS_PATH.read_text())
    return raw or []


def _load_known_countries() -> set[str]:
    """§2.1 : le pool d'analogues est volontairement limité à 17 pays. JST R6
    couvre 18 pays (l'Irlande a été ajoutée en R6) — l'Irlande n'est pas dans
    la liste explicite du plan et ses observations sont donc filtrées ici,
    plutôt que silencieusement ajoutées à countries.yaml."""
    raw = yaml.safe_load(COUNTRIES_PATH.read_text()) or []
    return {c["iso3"] for c in raw}


def _is_break(country: str, year: int, breaks: list[dict[str, Any]]) -> bool:
    return any(
        b["country"] == country and b["year_start"] <= year <= b["year_end"] for b in breaks
    )


def parse(dta_path: Path) -> pd.DataFrame:
    """Passage au format long canonique (§7.1 étape 2)."""
    raw_df, _meta = pyreadstat.read_dta(str(dta_path))
    raw_df = raw_df.reset_index(names="orig_index")
    known_countries = _load_known_countries()
    raw_df = raw_df[raw_df["iso"].isin(known_countries)]
    mapping = load_mapping()
    breaks = _load_country_breaks()

    # Dicts Python plutôt que raw_df.iterrows() : accès homogène et typé,
    # pas de valeur d'un DataFrame hétérogène à démêler ligne par ligne.
    records: list[dict[str, Any]] = cast("list[dict[str, Any]]", raw_df.to_dict("records"))

    rows: list[dict[str, Any]] = []

    for code, spec in mapping["indicators"].items():
        cols: list[str] = spec["source_columns"]
        transform_fn = TRANSFORMS[spec["transform"]]
        transform_chain = ["parse_dta_float"]
        if spec["transform"] != "parse_dta_float":
            transform_chain.append(spec["transform"])

        for record in records:
            raw_vals = [record[c] for c in cols]
            if any(pd.isna(v) for v in raw_vals):
                continue  # trou explicite (§7.5) : pas de ligne plutôt qu'un remplissage
            value = transform_fn(*raw_vals)
            if value is None:
                continue
            country = str(record["iso"])
            year = int(record["year"])
            rows.append(
                {
                    "country_iso3": country,
                    "indicator_code": code,
                    "period_start": pd.Timestamp(year=year, month=1, day=1),
                    "freq": "A",
                    "value": float(value),
                    "source_id": SOURCE_ID,
                    "is_interpolated": False,
                    "is_break": _is_break(country, year, breaks),
                    "locator": {
                        "kind": "dta",
                        "obs_index": int(record["orig_index"]),
                        "variables": cols,
                    },
                    "raw_value_text": ", ".join(f"{c}={record[c]!r}" for c in cols),
                    "transform_chain": transform_chain,
                }
            )

    for code, spec in mapping["chained_indicators"].items():
        ret_col = spec["return_column"]
        interp_col = spec.get("interp_flag_column")
        for group_key, group in raw_df.sort_values("year").groupby("iso"):
            iso3 = str(group_key)
            years: list[int] = group["year"].astype(int).tolist()
            orig_indices: list[int] = group["orig_index"].astype(int).tolist()
            returns = [None if pd.isna(v) else float(v) for v in group[ret_col]]
            interp_flags: list[bool] = (
                group[interp_col].fillna(False).astype(bool).tolist()
                if interp_col and interp_col in group.columns
                else [False] * len(group)
            )
            chained = chain_link_returns(returns)
            for i, level in enumerate(chained):
                if level is None:
                    continue
                year = years[i]
                rows.append(
                    {
                        "country_iso3": iso3,
                        "indicator_code": code,
                        "period_start": pd.Timestamp(year=year, month=1, day=1),
                        "freq": "A",
                        "value": float(level),
                        "source_id": SOURCE_ID,
                        "is_interpolated": interp_flags[i],
                        "is_break": _is_break(iso3, year, breaks),
                        "locator": {
                            "kind": "dta",
                            "obs_index": orig_indices[i],
                            "variables": [ret_col],
                        },
                        "raw_value_text": f"{ret_col}={returns[i]!r}",
                        "transform_chain": ["parse_dta_float", "chain_link_returns"],
                    }
                )

    return pd.DataFrame(rows)


def extract_banking_crises(dta_path: Path) -> list[dict[str, Any]]:
    """§13 Phase 2 : extraction programmatique, jamais transcrite à la main."""
    raw_df, _meta = pyreadstat.read_dta(str(dta_path))
    raw_df = raw_df.reset_index(names="orig_index")
    known_countries = _load_known_countries()
    raw_df = raw_df[raw_df["iso"].isin(known_countries)]
    crisis_records = cast(
        "list[dict[str, Any]]",
        raw_df[raw_df["crisisJST"] == 1].to_dict("records"),
    )

    events: list[dict[str, Any]] = []
    for record in crisis_records:
        country = str(record["iso"])
        year = int(record["year"])
        events.append(
            {
                "country_iso3": country,
                "date_start": date(year, 1, 1),
                "date_end": None,
                "kind": "banking_crisis",
                "label_fr": f"Crise bancaire systémique ({record['country']}, {year})",
                "label_en": f"Systemic banking crisis ({record['country']}, {year})",
                "severity": None,
                "source_id": SOURCE_ID,
                "source_url": CRISIS_DOC_URL,
                "notes_fr": (
                    f"Année de début codée crisisJST=1 dans JST release {VINTAGE} "
                    f"(obs_index={record['orig_index']})."
                ),
            }
        )
    return events
