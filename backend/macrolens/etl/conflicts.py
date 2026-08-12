"""Rapport de conflits (§5.3, §13 Phase 3, critère d'acceptation) : chaque
écart relatif > 5% entre deux sources sur la même clé (pays, indicateur,
période) doit apparaître ici avec une décision écrite — jamais de moyenne
entre sources, jamais un écart silencieusement ignoré."""

from __future__ import annotations

import datetime as dt

from macrolens.etl.reconcile import ConflictEntry


def render_report(conflicts: list[ConflictEntry]) -> str:
    generated = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    lines = [
        "# Rapport de conflits entre sources",
        "",
        f"Généré le {generated}. {len(conflicts)} conflit(s) détecté(s) "
        "(écart relatif > 5% entre deux sources sur la même clé, §5.3).",
        "",
    ]

    if not conflicts:
        lines.append(
            "Aucun conflit détecté sur les sources actuellement chargées : "
            "les couvertures ne se recoupent pas encore, ou toutes les "
            "valeurs concurrentes sont dans les 5% l'une de l'autre."
        )
        return "\n".join(lines) + "\n"

    lines += [
        "Décision appliquée dans tous les cas : la source de plus haute "
        "priorité est retenue (§5.3 — jst 100 > banque centrale 90 > BRI 80 "
        "> FMI 70 > OCDE 60 > Maddison 50 > OWID 30), jamais de moyenne. "
        "La valeur écartée reste consultable dans `observations_alt`.",
        "",
        "| Pays | Indicateur | Période | Source retenue | Valeur retenue "
        "| Source écartée | Valeur écartée | Écart relatif |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for c in sorted(conflicts, key=lambda c: c.relative_gap, reverse=True):
        lines.append(
            f"| {c.country_iso3} | {c.indicator_code} | {c.period_start} "
            f"| {c.winning_source} | {c.winning_value} "
            f"| {c.losing_source} | {c.losing_value} | {c.relative_gap:.1%} |"
        )
    return "\n".join(lines) + "\n"
