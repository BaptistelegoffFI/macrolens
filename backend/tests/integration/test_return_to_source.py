"""§18.8 test n°2 — « le test le plus important du projet » : pour un
échantillon d'observations réellement en base, on rouvre le fichier brut
au `locator` indiqué, on relit la valeur, on rejoue `transform_chain`, et
on vérifie qu'on retombe exactement sur la valeur en base. Ça prouve que
le bordereau (§18.4) ne ment pas — sans lui, `raw_file_id`/`locator`
pourraient pointer n'importe où sans que rien ne le remarque.

Portée : la famille de transformation `["parse_dta_float"]` (source JST,
pas-plat identité typée) couvre 26 374 des 56 529 observations (~47 %,
la plus grande famille) et suffit à vérifier le pipeline
locator -> fichier -> valeur de bout en bout sans avoir à rejouer les
transformations à plusieurs colonnes (ratio_to_gdp_pct, etc.), qui sont
elles-mêmes couvertes unitairement par tests/unit/test_derive.py."""

import random

import pyreadstat
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.db.models import Observation, RawFile
from macrolens.db.session import make_engine
from macrolens.etl.derive import parse_dta_float

SAMPLE_SIZE = 200


@pytest.fixture(scope="module")
def db_session():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    connection.close()
    with Session(engine) as session:
        yield session


def test_locator_coverage_is_total(db_session: Session) -> None:
    """§18.8 test n°1, bloquant : 100 % des observations ont un
    raw_file_id non nul et un locator non vide (règle 7, CLAUDE.md)."""
    n_total = db_session.scalar(select(func.count()).select_from(Observation))
    assert n_total, "aucune observation en base — lancer `macrolens etl run-all`"

    n_missing_raw_file = db_session.scalar(
        select(func.count()).select_from(Observation).where(Observation.raw_file_id.is_(None))
    )
    assert n_missing_raw_file == 0

    n_missing_locator = db_session.scalar(
        select(func.count()).select_from(Observation).where(Observation.locator == {})
    )
    assert n_missing_locator == 0


def test_replay_matches_stored_value_for_sampled_observations(db_session: Session) -> None:
    rows = db_session.execute(
        select(Observation).where(
            Observation.source_id == "jst", Observation.transform_chain == ["parse_dta_float"]
        )
    ).scalars().all()
    assert len(rows) >= SAMPLE_SIZE, (
        f"seulement {len(rows)} observations pass-through JST en base, "
        f"attendu au moins {SAMPLE_SIZE} — la base a-t-elle bien été ingérée ?"
    )

    random.seed(0)  # échantillon fixe : rejeu déterministe (règle 1, CLAUDE.md)
    sample = random.sample(rows, SAMPLE_SIZE)

    raw_file_ids = {obs.raw_file_id for obs in sample}
    assert len(raw_file_ids) == 1, "toutes les obs. pass-through JST viennent du même fichier"
    raw_file = db_session.get(RawFile, raw_file_ids.pop())
    assert raw_file is not None

    raw_df, _meta = pyreadstat.read_dta(raw_file.relpath)

    mismatches: list[tuple[str, str, int, float | None, float | None]] = []
    for obs in sample:
        assert obs.locator["kind"] == "dta"
        obs_index = int(obs.locator["obs_index"])  # type: ignore[call-overload]
        variable = str(obs.locator["variables"][0])  # type: ignore[index]
        raw_cell = raw_df.iloc[obs_index][variable]
        replayed = parse_dta_float(None if _is_missing(raw_cell) else float(raw_cell))
        if replayed != obs.value:
            mismatches.append(
                (obs.country_iso3, obs.indicator_code, obs.period_start.year, replayed, obs.value)
            )

    assert not mismatches, (
        f"{len(mismatches)}/{SAMPLE_SIZE} observations ne correspondent pas à leur source : "
        f"{mismatches[:5]}"
    )


def _is_missing(value: object) -> bool:
    return value != value  # NaN != NaN
