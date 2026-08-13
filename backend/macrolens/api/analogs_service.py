"""Orchestration de POST /analogs/search (§10.1) : résout la requête (3
modes), applique les filtres et exclusions (§8.4), cherche les k plus
proches (§8.3/§8.5), calcule et agrège les réalisations (§9), produit les
avertissements (§8.2.6, §9.4). Hors core/ — orchestration + accès DB."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from macrolens.api.schemas.analogs import (
    AnalogOut,
    AnalogsSearchRequest,
    AnalogsSearchResponse,
    ConcentrationOut,
    ContextEventOut,
    ExcludedOut,
    OutcomeAggregateOut,
    StateFeatureOut,
)
from macrolens.api.sources_utils import sources_for_country_years
from macrolens.api.utils import none_if_nan
from macrolens.core.features import FEATURE_FAMILY, FEATURE_KIND, FEATURE_NAMES
from macrolens.core.outcomes import aggregate_boolean, aggregate_continuous, similarity_weights
from macrolens.core.similarity import (
    AnalogResult,
    PoolEntry,
    StateVector,
    filter_pool,
    find_analogs,
    normalize_weights,
)
from macrolens.core.similarity import (
    concentration as concentration_stats,
)
from macrolens.core.warnings import concentration_warning, epoch_gap_warning, small_n_warning
from macrolens.db.models import Event
from macrolens.outcomes_build import RealizedOutcomes, outcomes_for_analogs
from macrolens.panel import RAW_INDICATORS, BuiltPool, rank_hypothetical_state

LEVEL_FEATURES = frozenset(f for f in FEATURE_NAMES if FEATURE_KIND[f] == "level")

_CONTINUOUS_VARS = (
    "out_growth_cum",
    "out_growth_ann",
    "out_inflation_ann",
    "out_equity_real_cum",
    "out_house_real_cum",
    "out_unemp_change",
    "out_rate_short_change",
    "out_debt_change",
    "out_max_drawdown_equity",
)


class SearchError(ValueError):
    pass


def expand_family_weights(family_weights: dict[str, float] | None) -> dict[str, float]:
    if family_weights is None:
        return dict.fromkeys(FEATURE_NAMES, 1.0)  # §8.3 : uniforme 1/14 par défaut

    by_family: dict[str, list[str]] = defaultdict(list)
    for f in FEATURE_NAMES:
        by_family[FEATURE_FAMILY[f]].append(f)

    out = dict.fromkeys(FEATURE_NAMES, 0.0)
    for family, w in family_weights.items():
        for f in by_family.get(family, []):
            out[f] = w / len(by_family[family])
    return out


def _war_years(session: Session, countries: list[str]) -> dict[str, set[int]]:
    if not countries:
        return {}
    # country_iso3 IS NULL = événement global (data/events/wars.yaml, ex. les
    # deux guerres mondiales) : concerne tous les pays du pool, pas seulement
    # ceux explicitement listés.
    rows = session.execute(
        select(Event.country_iso3, Event.date_start, Event.date_end).where(
            Event.kind == "war",
            or_(Event.country_iso3.in_(countries), Event.country_iso3.is_(None)),
        )
    ).all()
    out: dict[str, set[int]] = defaultdict(set)
    for country, start, end in rows:
        end_year = (end or start).year
        targets = countries if country is None else [country]
        for target in targets:
            for y in range(start.year, end_year + 1):
                out[target].add(y)
    return out


def _resolve_query(
    request: AnalogsSearchRequest, frame_pool: BuiltPool, global_pool: BuiltPool
) -> tuple[StateVector, str | None, int]:
    if request.mode == "anchor":
        assert request.anchor is not None
        country, year = request.anchor.country.upper(), request.anchor.year
        match = next(
            (sv for sv in frame_pool.state_vectors if sv.country == country and sv.year == year),
            None,
        )
        if match is None:
            raise SearchError(f"Aucun vecteur d'état pour {country} {year}")
        return match, country, year

    if request.mode == "manual":
        assert request.state is not None
        ranks = rank_hypothetical_state(global_pool, request.state)
        is_complete = all(f in ranks and ranks[f] == ranks[f] for f in FEATURE_NAMES)
        return (
            StateVector(country="__QUERY__", year=0, ranks=ranks, is_complete=is_complete),
            None,
            0,
        )

    assert request.shock is not None
    base_country = request.shock.base.country.upper()
    base_year = request.shock.base.year
    idx = next(
        (
            i
            for i, sv in enumerate(global_pool.state_vectors)
            if sv.country == base_country and sv.year == base_year
        ),
        None,
    )
    if idx is None:
        raise SearchError(f"Aucun vecteur d'état pour {base_country} {base_year} (base du choc)")
    raw = dict(global_pool.raw_values[idx])
    for feature, delta in request.shock.deltas.items():
        if feature in raw:
            raw[feature] = raw[feature] + delta
    ranks = rank_hypothetical_state(global_pool, raw)
    is_complete = all(f in ranks and ranks[f] == ranks[f] for f in FEATURE_NAMES)
    return (
        StateVector(country="__QUERY__", year=0, ranks=ranks, is_complete=is_complete),
        base_country,
        base_year,
    )


def _filter_by_request(
    frame_pool: BuiltPool, request: AnalogsSearchRequest, war_years: dict[str, set[int]]
) -> tuple[list[StateVector], list[PoolEntry]]:
    kept_sv: list[StateVector] = []
    kept_entries: list[PoolEntry] = []
    for sv, entry in zip(frame_pool.state_vectors, frame_pool.pool_entries, strict=True):
        if request.filters.countries and sv.country not in request.filters.countries:
            continue
        if sv.year < request.filters.year_min:
            continue
        if request.filters.year_max is not None and sv.year > request.filters.year_max:
            continue
        if request.filters.exclude_wartime and sv.year in war_years.get(sv.country, set()):
            continue
        kept_sv.append(sv)
        kept_entries.append(entry)
    return kept_sv, kept_entries


def _events_by_country(session: Session, countries: list[str]) -> dict[str, list[Event]]:
    """Événements pays-exacts + événements globaux (country_iso3 IS NULL,
    ex. les deux guerres mondiales, data/events/wars.yaml) rattachés à
    chaque pays du périmètre. Une seule requête, filtrage par fenêtre
    ensuite en mémoire (table events petite, ~150 lignes)."""
    if not countries:
        return {}
    rows = (
        session.execute(
            select(Event).where(
                or_(Event.country_iso3.in_(countries), Event.country_iso3.is_(None))
            )
        )
        .scalars()
        .all()
    )
    out: dict[str, list[Event]] = defaultdict(list)
    for ev in rows:
        targets = countries if ev.country_iso3 is None else [ev.country_iso3]
        for c in targets:
            out[c].append(ev)
    return out


def _context_events(
    events: list[Event], year: int, horizon_max: int
) -> list[ContextEventOut]:
    """ADR 0004 §3 : événements chevauchant [année, année + min(3, horizon
    max demandé)] — fenêtre tournée vers l'avenir immédiat de l'épisode."""
    window_end = year + min(3, horizon_max) if horizon_max > 0 else year
    out: list[ContextEventOut] = []
    for ev in events:
        start_year = ev.date_start.year
        end_year = (ev.date_end or ev.date_start).year
        if start_year <= window_end and end_year >= year:
            out.append(
                ContextEventOut(
                    kind=ev.kind,
                    label_fr=ev.label_fr,
                    date_start=ev.date_start.isoformat(),
                    date_end=ev.date_end.isoformat() if ev.date_end else None,
                )
            )
    return out


def _state_for(
    sv_index: dict[tuple[str, int], int], frame_pool: BuiltPool, r: AnalogResult
) -> list[StateFeatureOut]:
    idx = sv_index.get((r.country, r.year))
    if idx is None:
        return []
    sv = frame_pool.state_vectors[idx]
    raws = frame_pool.raw_values[idx]
    return [
        StateFeatureOut(
            feature_code=f,
            raw_value=none_if_nan(raws[f]),
            pct_rank=none_if_nan(sv.ranks[f]),
        )
        for f in FEATURE_NAMES
    ]


def _outcomes_dict(realized: RealizedOutcomes) -> dict[str, float | bool | int | None]:
    return {
        "out_growth_cum": none_if_nan(realized.out_growth_cum),
        "out_growth_ann": none_if_nan(realized.out_growth_ann),
        "out_inflation_ann": none_if_nan(realized.out_inflation_ann),
        "out_equity_real_cum": none_if_nan(realized.out_equity_real_cum),
        "out_house_real_cum": none_if_nan(realized.out_house_real_cum),
        "out_unemp_change": none_if_nan(realized.out_unemp_change),
        "out_rate_short_change": none_if_nan(realized.out_rate_short_change),
        "out_debt_change": none_if_nan(realized.out_debt_change),
        "out_banking_crisis": realized.out_banking_crisis,
        "out_recession_years": realized.out_recession_years,
        "out_max_drawdown_equity": none_if_nan(realized.out_max_drawdown_equity),
    }


def search_analogs(
    session: Session, request: AnalogsSearchRequest, frame_pool: BuiltPool, global_pool: BuiltPool
) -> AnalogsSearchResponse:
    query_sv, query_country, query_year = _resolve_query(request, frame_pool, global_pool)

    all_countries = sorted({sv.country for sv in frame_pool.state_vectors})
    war_years = (
        _war_years(session, all_countries) if request.filters.exclude_wartime else {}
    )
    candidate_sv, candidate_entries = _filter_by_request(frame_pool, request, war_years)

    horizon_max = max(request.horizons) if request.horizons else 0
    eligible_idx, counts = filter_pool(
        candidate_entries,
        query_country=query_country or "",
        query_year=query_year,
        horizon_max=horizon_max,
        include_breaks=request.filters.include_breaks,
        include_partial_coverage=request.filters.include_partial_coverage,
    )
    eligible_sv = [candidate_sv[i] for i in eligible_idx]

    weights = normalize_weights(expand_family_weights(request.weights))
    results = find_analogs(query_sv, eligible_sv, weights=weights, k=request.k)

    realized = outcomes_for_analogs(
        session, [(r.country, r.year) for r in results], horizons=tuple(request.horizons)
    )

    sim_weights = (
        similarity_weights([r.distance for r in results])
        if request.weighting == "similarity"
        else [1.0] * len(results)
    )

    sv_index = {(sv.country, sv.year): i for i, sv in enumerate(frame_pool.state_vectors)}
    events_by_country = _events_by_country(session, sorted({r.country for r in results}))

    analogs_out: list[AnalogOut] = []
    warnings: list[str] = []
    for r in results:
        outcomes_by_h = {
            str(h): _outcomes_dict(realized[(r.country, r.year)][h]) for h in request.horizons
        }
        analogs_out.append(
            AnalogOut(
                country=r.country,
                year=r.year,
                distance=r.distance,
                similarity=r.similarity,
                feature_contributions=r.feature_contributions,
                state=_state_for(sv_index, frame_pool, r),
                context_events=_context_events(
                    events_by_country.get(r.country, []), r.year, horizon_max
                ),
                outcomes=outcomes_by_h,
            )
        )
        if query_year:
            gap_warning = epoch_gap_warning(query_year, r, LEVEL_FEATURES)
            if gap_warning is not None:
                warnings.append(gap_warning.message_fr)

    aggregates: dict[str, dict[str, OutcomeAggregateOut]] = {}
    for h in request.horizons:
        per_var: dict[str, OutcomeAggregateOut] = {}
        for var in _CONTINUOUS_VARS:
            raw_values = [getattr(realized[(r.country, r.year)][h], var) for r in results]
            values = [v if v is not None else float("nan") for v in raw_values]
            agg = aggregate_continuous(values, weights=sim_weights)
            per_var[var] = OutcomeAggregateOut(
                n=agg.n,
                median=agg.median,
                q1=agg.q1,
                q3=agg.q3,
                min=agg.min,
                max=agg.max,
                share_negative=agg.share_negative,
            )
        bool_values = [realized[(r.country, r.year)][h].out_banking_crisis for r in results]
        bool_agg = aggregate_boolean(bool_values)
        per_var["out_banking_crisis"] = OutcomeAggregateOut(
            n=bool_agg.n, count_true=bool_agg.count_true
        )
        aggregates[str(h)] = per_var

    conc = concentration_stats(results)
    conc_out = ConcentrationOut(
        hhi_country=conc.hhi_country,
        hhi_decade=conc.hhi_decade,
        n_countries=conc.n_countries,
        n_decades=conc.n_decades,
    )
    n_warning = small_n_warning(len(results))
    if n_warning:
        warnings.append(n_warning)
    conc_warning = concentration_warning(conc)
    if conc_warning:
        warnings.append(conc_warning)

    excluded_out = ExcludedOut(
        incomplete=counts.incomplete,
        self_adjacent=counts.self_adjacent,
        too_recent=counts.too_recent,
        breaks=counts.breaks,
        partial_coverage=counts.partial_coverage,
        user_excluded=counts.user_excluded,
    )

    # §10 (critère d'acceptation Phase 5) : toute réponse contenant des
    # données porte un bloc de sources — ici, les sources ayant réellement
    # contribué aux features des analogues affichés (+ de l'ancre, en mode
    # anchor/shock ; sans objet en mode manual, qui n'a pas de pays/année).
    source_pairs = [(r.country, r.year) for r in results]
    if query_country is not None and query_year:
        source_pairs.append((query_country, query_year))
    sources_summary_out = sources_for_country_years(session, source_pairs, RAW_INDICATORS)

    return AnalogsSearchResponse(
        build_id=frame_pool.build_id,
        query_echo=request,
        pool_size=len(eligible_sv),
        excluded=excluded_out,
        analogs=analogs_out,
        aggregates=aggregates,
        concentration=conc_out,
        warnings=warnings,
        sources_summary=sources_summary_out,
    )
