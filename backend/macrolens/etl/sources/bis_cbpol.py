"""Loader BRI — taux directeurs (§5.2 : bis_cbpol). Seule série ciblée :
`policy_rate`, que JST ne fournit pas (§13 Phase 2, etl/mappings/jst.yaml
`not_mapped`). Source SDMX interrogée directement (API BIS Data Portal,
stats.bis.org), URL vérifiée par requête le 2026-08-12 — voir
docs/decisions/0003-ambiguites-plan-phase-3.md.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any, cast

import pandas as pd
import yaml

from macrolens.etl.common import DownloadedFile, download_targets
from macrolens.etl.derive import monthly_to_annual_mean

SOURCE_ID = "bis_cbpol"
VINTAGE = "current"  # la BRI met à jour en continu ; pas de release versionnée

MAPPING_PATH = Path(__file__).resolve().parent.parent / "mappings" / "bis_cbpol.yaml"

_AREAS = "FR+DE+IT+SE+FI+NO+US+GB+JP+ES+NL+CH+DK+BE+PT+AU+CA+XM"
DATASET_URL = f"https://stats.bis.org/api/v1/data/BIS,WS_CBPOL,1.0/M.{_AREAS}?format=csv"
DOWNLOAD_TARGETS = [("bis_cbpol_policy_rates.csv", DATASET_URL, "csv")]


def download(dest_dir: Path, *, force: bool = False) -> list[DownloadedFile]:
    return download_targets(dest_dir, DOWNLOAD_TARGETS, force=force, timeout=180.0)


def load_mapping() -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load(MAPPING_PATH.read_text())
    return data


def _row(country: str, year: int, area: str, values: list[float]) -> dict[str, Any]:
    return {
        "country_iso3": country,
        "indicator_code": "policy_rate",
        "period_start": pd.Timestamp(year=year, month=1, day=1),
        "freq": "A",
        "value": monthly_to_annual_mean(values),
        "source_id": SOURCE_ID,
        "is_interpolated": False,
        "is_break": False,
        "locator": {
            "kind": "csv",
            "area": area,
            "time_period_range": f"{year}-01..{year}-12",
            "n_months": len(values),
        },
        "raw_value_text": f"BIS {area} {year} : moyenne de {len(values)} relevés mensuels",
        "transform_chain": ["parse_csv_float", "monthly_to_annual_mean"],
    }


def parse(csv_path: Path) -> pd.DataFrame:
    raw = pd.read_csv(csv_path, usecols=["REF_AREA", "TIME_PERIOD", "OBS_VALUE"])
    mapping = load_mapping()

    records = cast("list[dict[str, Any]]", raw.to_dict("records"))
    by_area_year: dict[tuple[str, int], list[float]] = defaultdict(list)
    for rec in records:
        value = rec["OBS_VALUE"]
        if pd.isna(value):
            continue
        area = str(rec["REF_AREA"])
        year = int(str(rec["TIME_PERIOD"])[:4])
        by_area_year[(area, year)].append(float(value))

    euro_adoption_year = int(mapping["euro_adoption_year"])
    euro_area_code = str(mapping["euro_area_code"])

    rows: list[dict[str, Any]] = []
    for country, spec in mapping["countries"].items():
        national_area = spec["national_area"]
        euro_adopter = bool(spec["euro_adopter"])

        if national_area:
            for (area, year), values in by_area_year.items():
                if area != national_area:
                    continue
                if euro_adopter and year >= euro_adoption_year:
                    continue  # relais pris par la zone euro à partir de cette année
                rows.append(_row(country, year, area, values))

        if euro_adopter:
            for (area, year), values in by_area_year.items():
                if area != euro_area_code or year < euro_adoption_year:
                    continue
                rows.append(_row(country, year, area, values))

    return pd.DataFrame(rows)
