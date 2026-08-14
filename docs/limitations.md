# Limitations connues

Ce document liste les limitations assumées du projet, comme demandé explicitement par le plan
(§18.5) plutôt que de les laisser implicites dans le code.

## Pas d'échec automatique sur changement de hash à vintage identique (§18.7)

Le plan spécifie : « si un hash change alors que le vintage est identique, le pipeline échoue »
— un garde-fou contre une source qui change de contenu sous nos pieds sans le signaler. En
pratique, `register_raw_files` (`etl/load.py`) fait un upsert sur `sha256` : un nouveau hash pour
le même `(source_id, vintage, filename)` crée simplement une nouvelle ligne `raw_files`, sans
échec ni alerte. La partie « jamais réécrit » de la règle est bien respectée (l'ancienne ligne,
avec l'ancien hash, reste intacte — aucune observation existante ne perd sa provenance) ; la
partie « échoue et le signale » ne l'est pas. Pertinent pour `bis_cbpol`, seule source ingérée à
vintage `current` (rolling, sans version figée) — voir `docs/data-refresh.md`.

Corrigé en Phase 7 : quand le hash est identique (fichier déjà connu), l'upsert ne se
contentait pas de ne rien faire — il réécrivait `relpath`/`downloaded_at` sur la ligne
existante à chaque rejeu de l'ingestion, y compris depuis un environnement différent (conteneur
Docker vs hôte). Un `raw_file` déjà enregistré pointait alors vers le chemin absolu de la
*dernière* ingestion plutôt que de la première, cassant silencieusement le test de retour à la
source (§18.8) dès qu'il tournait dans un environnement autre que celui de la dernière
ingestion — découvert en rejouant le test de fraîche installation de la Phase 7. `relpath` est
désormais figé au premier enregistrement ; seul un nouveau hash crée une nouvelle ligne.

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

## Le pool d'analogues démarre vers 1895-1905, pas 1870 (§8.2.3/§8.2.4)

Conséquence directe et assumée de la normalisation : une feature de niveau exige 30 ans de
recul et un minimum de 20 observations valides pour produire un rang. Les années 1870-≈1900
restent en base et consultables (Explorateur de séries, `GET /series`, `GET /state`), utilisées
comme historique de référence pour normaliser les années suivantes, mais ne sont jamais
candidates comme analogue elles-mêmes (`is_complete = false`). Ce n'est pas un trou de données à
combler — c'est le prix de la comparabilité inter-époques, documenté dans
`docs/methodology.md` §2.3 et visible dans la vue Couverture (`GET /meta/coverage`).

## Sources déclarées mais non ingérées

16 sources sont référencées dans `data/reference/sources.yaml` ; seules 3 (`jst`, `bis_cbpol`,
`maddison`) alimentent réellement `observations` aujourd'hui. Le détail, source par source, et
la raison de chaque choix (décision explicite Phase 3 pour les sources FMI, socle JST suffisant
pour les autres) sont dans `docs/data-sources.md`.

## Distance de Mahalanobis et comparaison de trajectoires (DTW) — non implémentées

§8.3 documente ces deux extensions comme prévues pour v1.1 (Mahalanobis, corrige la corrélation
entre features comme inflation ↔ taux courts) et v1.2 (DTW, compare une fenêtre de 5 ans plutôt
qu'un instantané). Seule l'euclidienne pondérée sur rangs est implémentée en v1 — choix
délibéré du plan, pas un oubli : elle est plus lisible et plus explicable, et l'explicabilité
(décomposition de la distance par feature, §8.5) est un objectif du produit. L'API accepte un
paramètre `metric`, mais seule la valeur `"euclidean"` est actuellement supportée.

## Vecteur d'état affiché seulement en mode ancre

Le panneau Scénario affiche le vecteur d'état complet (valeur brute + rang, §8.2.5) de la
requête elle-même quand le mode est `anchor`, via `GET /state/{country}/{year}`. Les modes
`manual` et `shock` n'ont pas d'endpoint équivalent pour un état hypothétique ou choqué — la
section reste masquée plutôt que d'afficher quelque chose de trompeur. `POST /analogs/search`
renvoie bien le vecteur d'état de chaque *analogue retourné* dans tous les modes (`state` sur
chaque `AnalogOut`) ; seul l'affichage de l'état de la *requête elle-même* est limité au mode
ancre.

## `GET /export/{search_id}` non implémenté

Le tableau §10 du plan liste cet endpoint ; il présuppose une recherche persistée et adressable
par identifiant, ce qui contredit le choix explicite d'une API sans état (§10 : « réponses
cacheables »). Reporté après le permalien (livré en Phase 6, qui résout le même besoin de
partage/reproduction d'une recherche par un mécanisme différent — l'URL elle-même). Les exports
CSV/TSV/JSON/PNG existent déjà par ailleurs (Explorateur de séries, Bordereau, graphiques).

## Interface bilingue FR/EN — portée du chrome, pas de tout le texte affiché

Retirée en Phase 7 (voir `docs/decisions/0006-menu-retrait-et-bilinguisme-fr-en.md`) : la barre
de menus Fichier/Édition/Scénario/Données/Fenêtre/Aide (§11.2), qui n'a jamais eu de menu
déroulant fonctionnel, remplacée par une barre de titre portant le sélecteur de langue FR/EN.

Le chrome applicatif, les 14 features/7 familles, les 10 indicateurs bruts, le résumé
méthodologique et les noms de pays/indicateurs/événements (déjà bilingues côté backend) sont
traduits. Restent en français dans les deux langues, documenté dans l'ADR 0006 : les messages
d'erreur et avertissements renvoyés par l'API (backend non internationalisé), la `definition_fr`
des indicateurs (pas de `definition_en` en base), les citations/licences bibliographiques des
sources, les en-têtes de colonnes des exports CSV/TSV/JSON, et le formatage numérique
(`<Num>`, séparateur décimal `.` dans les deux langues).

## Pas de version responsive / mobile

Assumé explicitement par le plan (§11.8) : poste de travail, largeur minimale 1280px. En
dessous, un message dédié le dit clairement plutôt que de dégrader silencieusement l'interface.
