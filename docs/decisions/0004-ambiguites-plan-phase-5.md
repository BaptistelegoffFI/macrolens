# ADR 0004 — Ambiguïtés du plan résolues en Phase 5 (API)

## 1. `filters.exclude_wartime`

Le plan (§10.1, exemple de requête `POST /analogs/search`) montre un champ `filters.exclude_wartime`
par défaut à `false`, absent du schéma initialement écrit (le champ manquait dans
`AnalogsSearchRequest`/`FiltersSpec`, et l'exclusion des années de guerre était appliquée
inconditionnellement dans `_filter_by_request`). Corrigé : `FiltersSpec.exclude_wartime: bool = False`,
et le filtre pays/années de guerre (`data/events/wars.yaml`, `kind="war"`) n'est appliqué au pool de
candidats que si `exclude_wartime=True`. Les événements `country: null` (première et seconde guerres
mondiales) sont documentés comme globaux — ils s'appliquent à tous les pays du pool, pas seulement à
ceux listés explicitement (corrigé aussi dans `GET /events?country=...`, qui doit inclure les
événements globaux pertinents pour le pays demandé).

## 2. `analogs[].state` dans la réponse de `/analogs/search`

Le plan montre `"state": { /* valeurs brutes + rangs */ }` sans préciser la structure exacte. Choix :
même forme que `GET /state/{country}/{year}` (`StateVectorOut`/`StateVectorFeatureOut`), c'est-à-dire
une liste de `{feature_code, raw_value, pct_rank}` — cohérence avec un endpoint déjà spécifié plutôt
qu'une structure ad hoc.

## 3. `context_events` pour chaque analogue

Le plan ne précise pas la fenêtre temporelle retenue pour associer des événements à un analogue
(l'exemple §10.1 montre une crise bancaire suédoise datée de 1991 associée à l'analogue SWE 1990).
Choix : un événement (pays exact ou événement global `country: null`) est retenu comme contexte d'un
analogue (pays, année) s'il chevauche la fenêtre `[année, année + min(3, horizon_max_demandé)]` — une
fenêtre courte tournée vers l'avenir immédiat de l'épisode, cohérente avec l'exemple donné et avec les
horizons déjà demandés par l'utilisateur (pas de fenêtre arbitraire indépendante de la requête).

## 4. `GET /episodes/{country}/{year}`

Le plan (tableau §10) dit seulement : « Fiche complète d'un épisode + contexte + événements ». Choix
d'implémentation, en réutilisant les briques déjà spécifiées ailleurs dans le plan plutôt qu'en
inventant un nouveau format :
- le vecteur d'état complet (même forme que `GET /state/{country}/{year}`) ;
- les valeurs brutes des 10 indicateurs socle (§8.1) sur une fenêtre `[année-10, année+10]`, pour
  situer l'épisode dans sa trajectoire (permet à l'UI de tracer un mini-graphique de contexte) ;
- les événements (tout `kind`, y compris globaux) chevauchant cette même fenêtre `[année-10, année+10]`.

## 5. `POST /compare`

Le plan dit : « Comparaison directe de 2..6 couples (pays, année) », sans détailler la sortie. Choix :
renvoyer, pour chaque couple, exactement la même fiche que `GET /episodes/{country}/{year}` (liste de
2 à 6 fiches), sans agrégation croisée — un « compare » est une juxtaposition de fiches complètes que
l'UI aligne en colonnes, pas un nouveau calcul statistique (qui relèverait de `/analogs/search`).
Validation : `2 <= len(pairs) <= 6`, dédoublonnage non imposé (l'utilisateur peut comparer un couple à
lui-même intentionnellement, ex. avant/après une révision de source — cas rare mais pas invalide).

## 6. Portée du bloc « sources » (critère d'acceptation Phase 5)

Le critère d'acceptation §10 dit : « toute réponse contenant des données porte un bloc de sources ».
Interprétation retenue, faute de liste explicite d'endpoints concernés :
- **`GET /state/{country}/{year}`**, **`GET /episodes/{country}/{year}`** (et donc `POST /compare`,
  qui réutilise la fiche d'épisode), **`POST /analogs/search`** (`sources_summary`) : bloc de sources
  ajouté, calculé à partir des `source_id` réels des observations sous-jacentes (jamais une liste
  statique) — voir `macrolens/api/sources_utils.py::sources_for_country_years`.
- **`GET /series`** : chaque ligne (`ObservationOut`) porte déjà son `source_id` individuel (§18.2) —
  c'est une réponse « à plat » consommée telle quelle par une bibliothèque de graphique ; l'envelopper
  dans un objet `{sources, rows}` casserait ce contrat pour un gain nul (l'attribution par ligne est
  déjà strictement plus précise qu'un bloc global). Non modifié.
- **`GET /meta/coverage`** : matrice de complétude (pourcentages), pas de valeur économique affichée —
  `GET /meta/sources` est déjà l'endpoint dédié aux sources. Non modifié.
- **`GET /events`** : chaque événement porte déjà `source_id`/`source_url` individuels (colonnes du
  modèle `Event`). Non modifié, même raisonnement que `/series`.
