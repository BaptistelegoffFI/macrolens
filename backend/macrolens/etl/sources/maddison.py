"""Loader Maddison Project Database (§5.2 : maddison). Extension best-effort
1850-1869 (§2.2) pour `gdp_real_pc` et `population`, pays par pays, sur les
17 pays du pool.

Maddison exprime le PIB réel par habitant en dollars internationaux **2011**
(Notes du classeur : "Real GDP per capita in 2011$"), alors que JST utilise
une base **1990** (rgdpmad). Concaténer les deux séries brutes créerait une
rupture de niveau artificielle à la jointure de 1870 — au lieu de ça, on
calcule un ratio de raccord par pays à partir du **seul point de
chevauchement réel entre les deux sources, l'année 1870** (§7.3 : « raccordés
par ratio de chevauchement ») et on l'applique aux années 1850-1869.

Toutes les observations de ce loader portent `coverage_partial=true` (§2.2)
et `is_spliced=true` pour gdp_real_pc (`population` n'a pas de base de prix,
donc pas de raccord nécessaire — seulement une conversion d'unité).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import openpyxl
import pandas as pd
import pyreadstat
import yaml

from macrolens.etl.common import DownloadedFile, download_targets
from macrolens.etl.derive import apply_splice_ratio, multiply_1000
from macrolens.paths import DATA_DIR

SOURCE_ID = "maddison"
VINTAGE = "2023"

DATASET_URL = "https://dataverse.nl/api/access/datafile/421302"
DOWNLOAD_TARGETS = [("maddison2023.xlsx", DATASET_URL, "xlsx")]

ANCHOR_YEAR = 1870
EXTENSION_YEARS = range(1850, ANCHOR_YEAR)  # 1850-1869 inclus

COUNTRIES_PATH = DATA_DIR / "reference" / "countries.yaml"
JST_DTA_PATH = DATA_DIR / "raw" / "jst" / "R6" / "JSTdatasetR6.dta"


def download(dest_dir: Path, *, force: bool = False) -> list[DownloadedFile]:
    return download_targets(dest_dir, DOWNLOAD_TARGETS, force=force)


def _read_full_data(xlsx_path: Path) -> list[dict[str, Any]]:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb["Full data"]
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    records = cast(
        "list[dict[str, Any]]", [dict(zip(header, row, strict=True)) for row in rows]
    )
    wb.close()
    return records


def _jst_anchor_values(indicator_col: str = "rgdpmad") -> dict[str, float]:
    """PIB réel/hab. JST pour l'année d'ancrage, par pays — nécessaire pour
    calculer le ratio de raccord (§7.3). Suppose JST déjà téléchargé
    (Phase 2 s'exécute avant Phase 3 dans `macrolens etl run-all`)."""
    df, _meta = pyreadstat.read_dta(str(JST_DTA_PATH))
    anchor = df[df["year"] == ANCHOR_YEAR][["iso", indicator_col]].dropna()
    return dict(zip(anchor["iso"], anchor[indicator_col], strict=True))


def _load_known_countries() -> set[str]:
    raw = yaml.safe_load(COUNTRIES_PATH.read_text()) or []
    return {c["iso3"] for c in raw}


def parse(xlsx_path: Path) -> pd.DataFrame:
    records = _read_full_data(xlsx_path)
    known_countries = _load_known_countries()
    jst_anchor = _jst_anchor_values()

    by_country_year: dict[tuple[str, int], dict[str, Any]] = {}
    for rec in records:
        country = rec.get("countrycode")
        year = rec.get("year")
        if country not in known_countries or year is None:
            continue
        year_int = int(year)
        if year_int == ANCHOR_YEAR or year_int in EXTENSION_YEARS:
            by_country_year[(str(country), year_int)] = rec

    splice_ratio: dict[str, float] = {}
    for country in known_countries:
        anchor_rec = by_country_year.get((country, ANCHOR_YEAR))
        jst_value = jst_anchor.get(country)
        if anchor_rec is None or jst_value is None:
            continue
        maddison_anchor = anchor_rec.get("gdppc")
        if maddison_anchor:
            splice_ratio[country] = float(jst_value) / float(maddison_anchor)

    rows: list[dict[str, Any]] = []
    for (country, year), rec in by_country_year.items():
        if year not in EXTENSION_YEARS:
            continue  # l'année d'ancrage 1870 ne sert qu'au calcul du ratio

        ratio = splice_ratio.get(country)
        gdppc = rec.get("gdppc")
        if ratio is not None and gdppc is not None:
            spliced_value = apply_splice_ratio(float(gdppc), ratio)
            rows.append(
                {
                    "country_iso3": country,
                    "indicator_code": "gdp_real_pc",
                    "period_start": pd.Timestamp(year=year, month=1, day=1),
                    "freq": "A",
                    "value": spliced_value,
                    "source_id": SOURCE_ID,
                    "is_interpolated": False,
                    "is_spliced": True,
                    "is_break": False,
                    "coverage_partial": True,
                    "locator": {
                        "kind": "xlsx",
                        "sheet": "Full data",
                        "row_key": {"countrycode": country, "year": year},
                    },
                    "raw_value_text": (
                        f"gdppc={gdppc!r} (2011$) x ratio={ratio!r} "
                        f"(ancrage JST/Maddison {ANCHOR_YEAR})"
                    ),
                    "transform_chain": ["parse_xlsx_float", "apply_splice_ratio"],
                }
            )

        pop = rec.get("pop")
        if pop is not None:
            rows.append(
                {
                    "country_iso3": country,
                    "indicator_code": "population",
                    "period_start": pd.Timestamp(year=year, month=1, day=1),
                    "freq": "A",
                    "value": multiply_1000(float(pop)),
                    "source_id": SOURCE_ID,
                    "is_interpolated": False,
                    "is_spliced": False,
                    "is_break": False,
                    "coverage_partial": True,
                    "locator": {
                        "kind": "xlsx",
                        "sheet": "Full data",
                        "row_key": {"countrycode": country, "year": year},
                    },
                    "raw_value_text": f"pop={pop!r} (milliers)",
                    "transform_chain": ["parse_xlsx_float", "multiply_1000"],
                }
            )

    return pd.DataFrame(rows)
