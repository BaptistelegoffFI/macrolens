# Limitations connues

Ce document liste les limitations assumées du projet, comme demandé explicitement par le plan
(§18.5) plutôt que de les laisser implicites dans le code.

## Vue source (§18.5) — pas de rendu de page pour les sources API

Le plan distingue deux niveaux de preuve : le **bordereau** (toujours disponible, §18.4) et la
**vue source** (image de la page d'origine, quand la source le permet).

- **JST** (`JST_documentationR6.pdf`, `JSTcrisis_chronology.pdf`) et toute source livrée en PDF :
  la vue source *pourrait* être rendue via `pdftoppm` (§18.5), mais **le pipeline de rendu n'est
  pas encore branché** — la table `source_pages` est vide et `GET /provenance/page/{raw_file_id}/{page}`
  répond systématiquement `404` pour l'instant. L'endpoint est implémenté et correct : il sert
  l'image dès qu'une ligne existe dans `source_pages`, il n'y a simplement aucun rendu à ce jour.
- **BIS** (API SDMX/CSV) et **Maddison** (xlsx) : pas de rendu de page possible par nature — la
  preuve est le triptyque *fichier archivé + hash + locator* (`raw_files.sha256` +
  `observations.locator`), ce qui est déjà strictement plus vérifiable qu'une capture d'écran
  (§18.1). Ce n'est pas un manque à combler, c'est la preuve documentaire pour ce type de source.

## Archivage Wayback Machine (§18.7)

La soumission automatique des `origin_url` à la Wayback Machine et le remplissage d'`archive_url`
ne sont pas implémentés. La colonne `raw_files.archive_url` existe dans le schéma et reste `NULL`
pour toutes les sources ingérées à ce jour.

## `out_bond_real_cum` non disponible (§9.1)

Le socle de 26 indicateurs ne contient pas d'indice obligataire (seulement `rate_long`, un taux,
pas un indice de rendement total) — l'outcome `out_bond_real_cum` prévu par le plan n'est donc
jamais calculé. Documenté dans `outcomes_build.py` (docstring du module).

## Dérive séculaire et cas de structure (Phase 4)

Deux des 11 tests de la batterie §12.3 échouent de façon documentée et diagnostiquée — voir
`reports/validation.md` (§12.3, tests n°8 et n°9) pour le détail. Les deux sont marqués
`pytest.mark.xfail` (pas `skip`) : ils restent visibles dans la suite et remonteraient un `XPASS`
s'ils se mettaient à passer.
