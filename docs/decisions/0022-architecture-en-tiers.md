# ADR 0022 — Architecture en tiers, visible dans l'interface et dans l'API

Les données granulaires n'existent pas depuis 1870 pour 17 pays. Elles ne sont ni inventées, ni
interpolées, ni remplacées par un proxy silencieux : un système de tiers explicite, visible sur
chaque ligne et dans chaque réponse.

| Tier | Contenu | Statut |
|---|---|---|
| 1 | JST : actions, obligations d'État long terme, bons du Trésor, immobilier, change, inflation ; 1870-2020 ; 16 pays pour les rendements (Canada absent) et 17 pour change et inflation | **ingéré** |
| 2 | matières premières (prix spot), indices nationaux, change après 2020 | rien d'ingéré |
| 3 | secteurs actions (États-Unis), sous-types obligataires, sous-groupes matières premières | rien d'ingéré |

## Pourquoi rien en Tier 2 et 3

La recherche de sources (`docs/research/asset-sources.md`) a invalidé plusieurs hypothèses du
brief : S&P GSCI est propriétaire ; Moody's interdit copie, stockage et redistribution ; ICE BofA
interdit la reproduction et FRED n'en garde que 3 ans depuis avril 2026 ; la bibliothèque Ken French
ne donne aucune licence de redistribution explicite. Les sources licenciables restantes (Pink Sheet,
Ken French sous réserve) attendent une décision.

## Lignes « non disponible »

La page Classes d'actifs affiche toute la hiérarchie demandée. Une ligne sans donnée porte son tier,
sa raison, et le mot « non disponible » ; jamais un blanc, jamais un zéro, jamais une estimation.
`not_ingested` (source choisie mais non chargée), `excluded` (volontairement), `no_country_data`
(série existante mais absente pour ce pays) et « non disponible à cette date » (hors couverture ou
trou dans la période) sont des états distincts. Le catalogue vit dans
`data/reference/asset_catalogue.yaml`.

## Définitions sectorielles

Les portefeuilles Fama-French sont définis par code SIC, pas par GICS, et ne se raccordent pas aux
reclassements GICS de 2018 et 2023. Si ces séries sont ingérées, elles seront étiquetées SIC et
aucune jonction avec une série GICS ne sera faite.
