# Sources de données

Une fiche par source déclarée dans `data/reference/sources.yaml` (§5.2/§5.3). La colonne
**Statut** distingue ce qui alimente réellement `observations` aujourd'hui de ce qui est déclaré
pour un usage futur — voir `docs/decisions/0003-ambiguites-plan-phase-3.md` pour la décision de
ne pas ingérer les sources IMF en Phase 3 (leur base de dette historique commence aussi en 1914
pour la Finlande, donc n'aurait pas comblé le trou visé).

| id | Statut |
|---|---|
| `jst` | **Ingérée** — source primaire |
| `bis_cbpol` | **Ingérée** |
| `maddison` | **Ingérée** |
| `bis_credit`, `bis_pp` | Déclarée, non ingérée |
| `imf_ifs`, `imf_weo`, `imf_ghd` | Déclarée, non ingérée (décision Phase 3) |
| `oecd_mei`, `eurostat` | Déclarée, non ingérée |
| `riksbank_hms`, `norges_hms`, `boe_millennium` | Déclarée — contrôle qualité, jamais source primaire de valeur |
| `owid` | Déclarée — contexte/vérification croisée |
| `rr_crises` | Déclarée — recoupement des dates de crise uniquement |
| `events_manual` | **Utilisée** — événements (`events`), jamais une valeur numérique dans `observations` (règle 2, `CLAUDE.md`) |

---

## jst — Jordà-Schularick-Taylor Macrohistory Database

- **URL** : https://www.macrohistory.net/database/
- **Citation** : Jordà, Ò., Schularick, M., Taylor, A. M. (2017). "Macrofinancial History and
  the New Business Cycle Facts." *NBER Macroeconomics Annual 2016*, vol. 31, 213-263.
  Release 6 (2022), 18 économies avancées depuis 1870.
- **Licence** : usage non commercial, attribution obligatoire, partage à l'identique
  (CC BY-NC-SA). Contrainte structurante — voir `README.md` § Licence des données.
- **Priorité de résolution** : 100 (la plus haute — source primaire).
- **Statut** : ingérée. Fichier `JSTdatasetR6.dta`, ~80 % du socle §2.4 sur 18 pays (17 après
  exclusion de l'Irlande, voir `docs/decisions/0002-ambiguites-plan-phase-2.md`), format Stata
  parsé via `pyreadstat`. Fournit aussi la chronologie des crises bancaires
  (`JSTcrisis_chronology.pdf`, extraction programmatique — jamais transcrite à la main).
- **Format brut** : `.dta` (Stata), colonnes mappées dans `backend/macrolens/etl/mappings/jst.yaml`,
  vérifié contre le codebook PDF réel (extrait via `pdftotext`), jamais deviné.

## bis_cbpol — BIS, Central bank policy rates

- **URL** : https://data.bis.org/topics/CBPOL (API SDMX, format CSV)
- **Citation** : Bank for International Settlements, Central bank policy rates statistics.
- **Licence** : réutilisation avec attribution, conditions BIS Data Portal.
- **Priorité** : 80.
- **Statut** : ingérée. Taux directeur mensuel → moyenne annuelle (`monthly_to_annual_mean`).
  Bascule explicite pays-par-pays vers la série euro (`XM`) à partir de 1999 pour les adopteurs
  de l'euro (`data/reference/... ` mapping dans `etl/mappings/bis_cbpol.yaml`), vérifiée contre
  les réponses API réelles (le libellé France confirme « discontinued as France joined the euro
  area »).
- **Vintage** : `current` — cette source n'a pas de version figée, l'API sert toujours les
  dernières données disponibles à la même URL. Un rafraîchissement redemande donc la même
  URL et **s'attend** à un hash différent (voir `docs/data-refresh.md`).

## maddison — Maddison Project Database 2023

- **URL** : https://www.rug.nl/ggdc/historicaldevelopment/maddison/
- **Citation** : Bolt, J. and van Zanden, J. L. Maddison Project Database, Groningen Growth and
  Development Centre, University of Groningen.
- **Licence** : réutilisation libre avec attribution (CC BY 4.0).
- **Priorité** : 50 (la plus basse des sources ingérées — sert d'extension, pas de source
  primaire pour la période couverte par JST).
- **Statut** : ingérée. Fournit le PIB réel/habitant pour l'extension 1850-1869 (best-effort,
  flaguée `coverage_partial = true`, exclue par défaut du pool d'analogues). Raccordement à JST
  par ratio de chevauchement sur l'année d'ancrage 1870 commune aux deux sources (méthode des
  splices, `apply_splice_ratio` — voir `etl/sources/maddison.py`), pas une simple concaténation
  qui aurait ignoré la différence de base monétaire (2011$ PPA vs séries JST).
- **Format brut** : `.xlsx`, parsé via `openpyxl`.

## bis_credit, bis_pp — BIS, Credit / Property prices

Déclarées dans `sources.yaml` avec priorité 80 (même rang que `bis_cbpol`), pour `credit_private_gdp`
trimestriel et `house_price_index`. **Non ingérées à ce jour** — le socle actuel s'appuie sur les
séries JST pour ces indicateurs, qui couvrent l'essentiel du périmètre v1. Prêtes à être activées
sans changement de schéma si un besoin de granularité trimestrielle post-1970 apparaît.

## imf_ifs, imf_weo, imf_ghd — FMI (IFS, WEO, Global/Historical Public Debt Database)

Déclarées avec priorité 70. **Décision explicite de ne pas les ingérer en Phase 3** — voir
`docs/decisions/0003-ambiguites-plan-phase-3.md` : la Historical Public Debt Database du FMI
démarre elle-même en 1914 pour la Finlande, elle n'aurait donc pas comblé le trou de couverture
visé, pour un coût d'intégration (mapping, réconciliation) non justifié à ce stade.

## oecd_mei, eurostat — Séries harmonisées post-1955/1995

Déclarées, non ingérées. Couvriraient IPC/chômage/taux mensuels (OCDE, post-1955) et des
séries trimestrielles harmonisées UE (Eurostat, post-1995) — hors du périmètre annuel 1870→
qui est le cœur du produit v1.

## riksbank_hms, norges_hms, boe_millennium — Publications de banques centrales

Trois séries longues nationales (Suède, Norvège, Royaume-Uni), priorité 90 — **juste sous JST**
dans l'ordre de résolution, pour servir de contrôle qualité sur les pays cœur concernés en cas
de divergence avec JST, jamais comme source primaire d'une valeur. Non ingérées : le socle JST
suffit actuellement sur la période couverte pour ces pays.

## owid — Our World in Data

Priorité 30. Déclarée pour la population et la vérification croisée de contexte, non ingérée —
`gdp_real_pc` (JST/Maddison) suffit au socle actuel sans avoir besoin d'une série de population
séparée.

## rr_crises — Reinhart & Rogoff, chronologie des crises

Priorité 20. Déclarée pour recouper les dates de crise bancaire face à la chronologie JST
(`crisisJST`) — **jamais une source de valeur numérique**. Non utilisée activement : la
chronologie JST, extraite programmatiquement, est la source actuellement utilisée pour `events`
de type `banking_crisis`.

## events_manual — Curation interne du dépôt

Priorité 0 (la plus basse — jamais utilisée pour arbitrer un conflit de *valeur*, puisqu'elle
n'en fournit aucune). Couvre les événements des fichiers `data/events/*.yaml` : guerres, chocs
pétroliers, changements de régime monétaire — chaque événement individuel porte sa propre
`source_url` vérifiée (Wikipédia ou publication historique reconnue), listée dans le fichier YAML
correspondant, jamais une simple affirmation sans preuve.
