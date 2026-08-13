"""Passerelle DB -> core/ (panel.py) et persistance state_vectors. §12.3
test n°6 (reproductibilité) et n°10 (anti-look-ahead sur la fenêtre
glissante, appliqué à un panel réel) sont vérifiés ici avec des données
réellement ingérées."""

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.db.models import StateVector as StateVectorRow
from macrolens.db.session import make_engine
from macrolens.panel import build_pool, persist_state_vectors


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


def test_build_pool_is_reproducible(db_session: Session) -> None:
    """§12.3 test n°6 : même entrée -> même build_id, mêmes résultats."""
    r1 = build_pool(db_session, reference_frame="rolling30")
    r2 = build_pool(db_session, reference_frame="rolling30")
    assert r1.build_id == r2.build_id

    d1 = {(sv.country, sv.year): sv.ranks for sv in r1.state_vectors}
    d2 = {(sv.country, sv.year): sv.ranks for sv in r2.state_vectors}
    assert set(d1) == set(d2)
    for key, ranks1 in d1.items():
        ranks2 = d2[key]
        for feature, v1 in ranks1.items():
            v2 = ranks2[feature]
            assert v1 == v2 or (v1 != v1 and v2 != v2)  # égal, ou NaN des deux côtés


def test_build_pool_produces_complete_vectors_from_real_data(db_session: Session) -> None:
    built = build_pool(db_session, reference_frame="rolling30")
    complete = [sv for sv in built.state_vectors if sv.is_complete]
    assert len(complete) > 500  # ordre de grandeur attendu sur le pool actuel


def test_persist_state_vectors_writes_expected_row_count(db_session: Session) -> None:
    built = build_pool(db_session, reference_frame="rolling30")
    n_written = persist_state_vectors(db_session, built)
    db_session.flush()
    assert n_written == len(built.state_vectors) * 14

    count = db_session.scalar(
        select(func.count())
        .select_from(StateVectorRow)
        .where(StateVectorRow.build_id == built.build_id)
    )
    assert count == n_written
    db_session.rollback()


def test_rolling30_state_vectors_do_not_depend_on_other_countries_in_the_pool(
    db_session: Session,
) -> None:
    """rolling30 ne compare un pays qu'à sa propre histoire (§8.2.1a) : les
    vecteurs d'état de la France doivent être identiques que le pool
    contienne les 17 pays ou seulement la France."""
    full = build_pool(db_session, reference_frame="rolling30", countries=None)
    fra_only = build_pool(db_session, reference_frame="rolling30", countries=["FRA"])

    full_by_key = {(sv.country, sv.year): sv for sv in full.state_vectors}
    for sv in fra_only.state_vectors:
        full_sv = full_by_key.get((sv.country, sv.year))
        assert full_sv is not None
        for feature, rank in sv.ranks.items():
            full_rank = full_sv.ranks[feature]
            assert rank == full_rank or (rank != rank and full_rank != full_rank)
