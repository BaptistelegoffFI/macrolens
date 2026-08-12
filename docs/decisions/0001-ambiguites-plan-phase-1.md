# 0001 — Ambiguïtés résolues pendant la Phase 1

Statut : appliqué. Contexte : PLAN.md §6, §13 (Phase 1), §18.9.

PLAN.md §0 et CLAUDE.md demandent de ne pas deviner face à une ambiguïté du
plan, mais de choisir et documenter. Cinq points rencontrés pendant
l'implémentation de la Phase 1 sont consignés ici.

## 1. Neuf tables, pas sept

§13 Phase 1 dit « Migrations Alembic pour les 7 tables », mais le DDL de §6
plus l'ajout de §18.9 (« Tables raw_files et source_pages dans les
migrations ») donnent 9 tables : countries, sources, indicators,
observations, observations_alt, events, state_vectors, raw_files,
source_pages. Le compte « 7 » est visiblement antérieur à l'amendement §18
(traçabilité). Les 9 tables sont implémentées ; §18.9 le prévoit
explicitement, ce n'est pas une extrapolation.

## 2. Vingt-six indicateurs, pas vingt-quatre

§13 Phase 1 dit « les 24 indicateurs ont une définition FR non vide », mais
le tableau de §2.4 liste littéralement 26 lignes (7 activité + 4 prix/monnaie
+ 8 taux&marchés + 7 dette/crédit/extérieur). Contrairement au point 1, aucun
autre passage du plan ne justifie ni ne corrige cet écart : c'est un compte
resté obsolète dans la section roadmap. Décision : suivre le tableau §2.4
tel quel (26 indicateurs, tous seedés avec une `definition_fr` non vide) —
c'est la spécification de contenu, la roadmap n'en est qu'un résumé.

## 3. `indicators.family` étendu à 7 valeurs

Le commentaire du DDL (§6) suggère `activity|prices|rates|debt|external`
(5 valeurs, non contraint par un CHECK). Mais §8.3 nomme 7 familles de
pondération pour le moteur de similarité : Prix, Activité, Taux, Dette,
Crédit, Marchés, Extérieur. Les indicateurs de marché (actions, immobilier,
change) et de crédit (crédit privé, hypothécaire, capital bancaire) n'ont pas
de case dans les 5 valeurs du commentaire. Décision : utiliser les 7 valeurs
de §8.3 (`prices, activity, rates, debt, credit, markets, external`), qui
seront de toute façon la granularité utilisée par l'UI de pondération en
Phase 4 — deux systèmes de classement différents pour les mêmes indicateurs
n'auraient aucun sens.

## 4. Clé primaire de `observations_alt`

Le DDL dit `LIKE observations INCLUDING ALL`, ce qui copierait littéralement
la clé primaire (country, indicator, period, freq) — alors que la table doit
justement conserver *plusieurs* valeurs concurrentes rejetées pour la même
clé (§5.3 : « les autres sont conservées dans observations_alt » — pluriel,
une ligne par source écartée). Décision : la clé primaire de
`observations_alt` inclut `source_id` en plus. Documenté aussi dans la
docstring de `backend/macrolens/db/models.py`.

## 5. `sources.retrieved_at` en Phase 1

La colonne est NOT NULL, mais Phase 1 seed le catalogue `sources` (URL,
citation, licence) avant tout téléchargement réel de fichier (Phase 2+).
Décision : `retrieved_at` porte la date à laquelle l'URL et la citation ont
été vérifiées (recherche web, 2026-08-12) — pas une date de téléchargement.
`raw_files.downloaded_at` portera la date réelle de récupération de chaque
fichier concret en Phase 2+, sans ambiguïté avec ce champ.

## 6. `banking_crises.yaml` vide en Phase 1

§13 Phase 1 liste « crises bancaires JST » parmi les YAML à créer ; §13
Phase 2 dit « Extraction de la chronologie des crises bancaires vers events »
à partir du JST réellement ingéré. Écrire à la main une liste d'années de
crise en citant `source_id=jst` sans avoir téléchargé/vérifié le fichier JST
violerait la règle 2 (zéro chiffre non sourcé) au niveau de la provenance.
Décision : `data/events/banking_crises.yaml` reste vide en Phase 1 ; le
loader JST de Phase 2 écrira directement ces événements avec `raw_file_id`
et `locator`.

## 7. Étalon-or : seulement les sorties, pas les adoptions

`data/events/monetary_regimes.yaml` couvre les sorties de l'étalon-or
1931-1936 (années vérifiées par recherche web le 2026-08-12) mais pas les
dates d'adoption (1870s-1880s), pour lesquelles je n'ai pas de précision
vérifiée au jour près pays par pays. Le découpage complet des régimes
monétaires par pays (§8.2.3, `data/reference/monetary_regimes.yaml`) est de
toute façon un livrable de Phase 4, sourcé à ce moment-là.
