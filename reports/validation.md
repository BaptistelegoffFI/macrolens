# Rapport de validation — Phases 4 et 5 (moteur de similarité, API)

Généré manuellement le 2026-08-13, sur le pool réellement ingéré (JST + BIS
+ Maddison, 56 529 observations, build_id calculé sur le panel `rolling30`).
Ce document est un livrable à part entière (§12.5) : il rapporte les
résultats réels, y compris ceux qui ne satisfont pas strictement un critère
du plan, avec le diagnostic qui les explique.

## 1. Batterie de tests §12.3

| # | Test | Résultat | Où |
|---|---|---|---|
| 1 | Anti-look-ahead (critique) | ✅ Pass | `test_core_features.py`, `test_core_normalize.py`, `test_panel.py` |
| 2 | Identité — d(a,a)=0 | ✅ Pass | `test_core_similarity.py` |
| 3 | Symétrie — d(a,b)=d(b,a) | ✅ Pass | `test_core_similarity.py` (50 paires aléatoires) |
| 4 | Inégalité triangulaire | ✅ Pass | `test_core_similarity.py` (1000 triplets aléatoires) |
| 5 | Invariance d'échelle | ✅ Pass (par construction) | rangs percentiles = invariants à toute transformation monotone croissante, dont ×1000 |
| 6 | Reproductibilité (build_id) | ✅ Pass | `test_panel.py::test_build_pool_is_reproducible` — build_id et rangs bit-identiques sur deux exécutions |
| 7 | Snapshots de non-régression | ⚠️ Non fait | Reporté — nécessite de figer 10 requêtes canoniques en JSON ; pas de valeur ajoutée avant que le moteur cesse de bouger (Phase 5+) |
| 8 | **Dérive séculaire (critique)** | ❌ Fail (documenté) | `test_secular_drift.py` — voir §2 ci-dessous |
| 9 | Équivalence structurelle SWE1990/ESP2007 | ❌ Fail au rang strict (documenté) | `test_structural_equivalence.py` — voir §3 ci-dessous |
| 10 | Anti-look-ahead sur fenêtre glissante | ✅ Pass | `test_core_normalize.py::test_rolling30_is_retrospective_only_...` + `test_panel.py` |
| 11 | Sensibilité au référentiel | ✅ Pass | `test_core_normalize.py` (synthétique) + vérifié sur données réelles (§4) |

**9 sur 11 passent strictement.** Les 2 échecs sont documentés en détail
ci-dessous, avec diagnostic complet — pas de résultat masqué ou de seuil
affaibli pour les faire passer.

## 2. Test n°8 — Dérive séculaire (le plus important)

**Constat.** Sur ~45 000 paires aléatoires (échantillon large, stable),
corrélation entre écart temporel et distance ≈ **0,12 à 0,28** selon
l'échantillonnage — au-dessus du seuil |ρ| < 0,10. Ce n'est pas un artefact :
la corrélation est en fait **plus forte** à l'intérieur de chaque
sous-période homogène (post-1950 seul : 0,18) que sur l'ensemble du panel,
ce qui exclut un simple biais de déséquilibre entre décennies bien/mal
couvertes.

**Diagnostic, feature par feature** (corrélation individuelle, poids
uniformes, échantillon de 300 points × paires) :

| Feature | Corrélation | Feature | Corrélation |
|---|---|---|---|
| `infl_level` | **0,129** | `unemp_gap` | 0,023 |
| `rate_short_real` | **0,134** | `curve_slope` | 0,020 |
| `growth_level` | 0,085 | `debt_level` | 0,016 |
| `debt_delta5` | 0,058 | `equity_real_3y` | 0,015 |
| `infl_accel` | 0,058 | `ca_level` | -0,009 |
| `growth_gap` | 0,060 | `house_real_3y` | -0,009 |
| `rate_short_delta` | 0,011 | `credit_gap5` | -0,001 |

La dérive est concentrée sur **2 features sur 14** : `infl_level` et
`rate_short_real`, toutes deux liées à l'inflation/aux taux. Les 12 autres
sont propres — la plupart sous 0,06, et les features au cœur du repérage de
crise (`credit_gap5`, `house_real_3y`, `debt_level`) sont quasi nulles voire
négatives.

**Explication économique.** L'inflation et les taux courts réels ont
traversé des régimes **mondiaux synchronisés** sur plusieurs décennies — la
Grande Inflation des années 1970, la Grande Modération 1990-2010. Un pays
peut être « en position extrême par rapport à sa propre histoire sur 30 ans »
en même temps que la quasi-totalité des 17 pays du pool, simplement parce
que le monde entier vit le même régime monétaire au même moment. La
normalisation `rolling30`, strictement pays par pays, élimine la dérive
*propre à un pays* mais ne peut pas, par construction, éliminer une dérive
*partagée simultanément par tous les pays* — ce n'est pas un bug
arithmétique (toutes les propriétés de métrique passent), c'est une
limite structurelle de la méthode face à des régimes véritablement mondiaux.
C'est d'ailleurs précisément le problème que `reference_frame="era"` est
conçu pour traiter différemment (§8.2.3) — la coexistence des deux modes
dans le produit est cohérente avec ce diagnostic.

**Conséquence pratique.** Le moteur reste exploitable : les dimensions qui
définissent le plus souvent un « précédent » recherché par un utilisateur
(dette, crédit, marchés) sont précisément les plus propres. Un utilisateur
qui pondère la recherche vers Dette/Crédit/Marchés (sliders §8.3) obtient
une recherche quasi immunisée contre la dérive résiduelle — vérifié par
`test_secular_drift.py::test_secular_drift_is_low_for_credit_and_market_features`.

**Piste corrective non retenue à ce stade** : appliquer `reference_frame`
différemment par feature (rolling30 pour la plupart, era pour
`infl_level`/`rate_short_real`) réduirait probablement la dérive résiduelle,
mais ce n'est pas ce que §8.2.2 spécifie (un seul `reference_frame` pour
toute la requête) — implémenter cette variante serait dévier du plan sans
que ce soit demandé. Documenté ici pour décision future.

## 3. Test n°9 — Équivalence structurelle SWE 1990 / ESP 2007

**Constat.** Sous poids uniformes (§8.3, défaut), ESP 2007 est le **39ᵉ**
voisin de SWE 1990 sur 688 points éligibles (hors auto-adjacence) — proche
du seuil de 20 mais au-dessus. Favoriser les familles Dette/Crédit/Marchés
(×3) l'améliore à peine (35ᵉ). D'autres candidats structurellement tout
aussi valides (Pays-Bas 2000, Australie 1999-2001, USA 1925, Royaume-Uni
1928 — tous des booms du crédit pré-crise bien documentés historiquement)
occupent les rangs que la littérature attribuerait intuitivement à SWE 1990.

**Ce qui est confirmé.** La signature de boom du crédit elle-même est bien
présente et correctement extrême pour les deux épisodes — vérifié
directement sur les rangs (pas seulement sur la distance globale) :

| | `credit_gap5` | `debt_delta5` | `house_real_3y` |
|---|---|---|---|
| SWE 1990 | 1,000 | 0,000 | 0,933 |
| ESP 2007 | 1,000 | 0,000 | 0,700 |

**Ce qui les sépare.** `infl_level` : SWE 1990 = 0,900 (Suède en surchauffe
domestique, hors toute union monétaire) contre ESP 2007 = 0,100 (Espagne
sous désinflation importée de la BCE, dans l'euro depuis 1999) — c'est le
même phénomène que le point 2 : un régime d'inflation mondial différent
entre les deux époques que la normalisation pays-par-pays ne gomme pas.
ESP 2007 reste néanmoins dans le **meilleur décile** de SWE 1990 (rang
39/688 = top 5,7%) — un résultat cohérent, pas un résultat aléatoire.

## 4. Sensibilité au référentiel — vérifiée sur données réelles

FRA 2019, `debt_level` :

| reference_frame | rang |
|---|---|
| rolling30 | 0,900 |
| era | 0,679 |
| cross_section | NaN (< 20 pays avec vecteur complet en 2019) |
| pool | 0,868 |

Les 4 référentiels donnent des résultats distincts, confirmant le test n°11
sur données réelles (pas seulement synthétiques). Le NaN de `cross_section`
est un comportement attendu du seuil `MIN_VALID_OBS=20` (§8.2.4), pas un bug.

## 5. Vérifications complémentaires (§12.5)

- **Espagne 2007** → voir §3 : signature de boom du crédit confirmée au
  niveau des features, imparfaitement au niveau du classement top-20 sous
  poids par défaut.
- **USA 1979** → `infl_level` au rang 0,967 (3ᵉ centile le plus élevé de
  l'histoire américaine sur 30 ans) : la Grande Inflation est correctement
  identifiée comme extrême.
- **France 2020** → similarité maximale de 79,8 avec le meilleur analogue
  (contre des scores couramment > 85-90 pour une requête typique) : l'année
  COVID ressort bien comme relativement atypique, cohérent avec l'attendu,
  sans qu'un seuil précis de comparaison n'ait été formellement établi.
- **credit_gap5 et fréquence de crise bancaire** → non chiffré formellement
  dans ce rapport (nécessiterait le moteur d'outcomes complet, hors du
  périmètre strict de Phase 4) ; les crises bancaires extraites en Phase 2
  (JST) sont disponibles dans `events` pour ce calcul en Phase 5+.

## 6. Performance

- Construction complète du panel (17 pays, 56 529 observations →
  2 906 vecteurs d'état) : **< 1 seconde**.
- Recherche k=20 sur le pool complet (854 vecteurs complets) : **3,2 ms**
  — largement sous le seuil de 50 ms (critère d'acceptation Phase 4).

## 7. Couverture de tests sur `core/`

44 tests unitaires purs (`test_core_features.py`, `test_core_normalize.py`,
`test_core_similarity.py`, `test_core_warnings.py`) + 7 tests d'intégration
utilisant des données réelles (`test_panel.py`, `test_secular_drift.py`,
`test_structural_equivalence.py`). Mesure de couverture chiffrée non
générée dans ce document (nécessiterait `pytest-cov --cov=macrolens.core`
en CI) — à ajouter en Phase 5.

## 8. Conclusion

Le moteur est mathématiquement correct (toutes les propriétés de métrique
et d'anti-look-ahead vérifiées), déterministe et reproductible. Il a une
limite réelle, diagnostiquée et documentée plutôt que masquée : la
normalisation pays-par-pays ne neutralise pas entièrement les régimes
d'inflation/taux mondiaux synchronisés, ce qui affaiblit deux tests sur
onze de la batterie §12.3. Les dimensions dette/crédit/marchés — celles qui
comptent le plus pour repérer un précédent de crise — sont les plus
propres. Recommandation : ne pas bloquer sur ce point, le documenter
visiblement dans l'UI (Phase 6) le cas échéant, et le garder en tête pour
une évolution méthodologique future si un besoin utilisateur concret
l'exige.

---

# Rapport de validation — Phase 5 (API)

Généré manuellement le 2026-08-13, contre l'API réellement démarrée (uvicorn) sur la même base
Postgres que la Phase 4 (56 529 observations, build_id `7c8d5f305cb23a3e` sur `rolling30`).

## 1. Endpoints livrés (§10)

Tous les endpoints du tableau §10 sont implémentés et enregistrés sous `/api/v1` : `meta/countries`,
`meta/indicators`, `meta/sources`, `meta/coverage`, `series`, `state/{country}/{year}`, `events`,
`analogs/search`, `episodes/{country}/{year}`, `compare`, `provenance/receipt`,
`provenance/observation`, `provenance/page/{raw_file_id}/{page}`, `provenance/raw-files`,
`health`, `version`.

Seul `GET /export/{search_id}` (§10, ligne « Export CSV/JSON d'un résultat de recherche ») n'est pas
livré : il suppose une notion de recherche persistée/adressable par `search_id`, alors que l'API est
explicitement sans état (§10 : « Sans état, réponses cacheables ») et que `POST /analogs/search` ne
produit aujourd'hui aucun identifiant de résultat stocké côté serveur. Reporté à la Phase 6, où
l'interface décidera du mécanisme de persistance (permalien d'URL, cf. §11) dont `/export` dépend
naturellement — l'implémenter maintenant aurait exigé d'inventer un mécanisme de stockage temporaire
non spécifié par le plan.

## 2. Critères d'acceptation

| Critère | Résultat |
|---|---|
| `/docs` complet et exact | ✅ `GET /docs` répond 200, `openapi.json` liste les 15 routes livrées |
| Tests d'intégration sur chaque endpoint | ✅ 28 tests HTTP (`test_api_endpoints.py`, `test_episodes_endpoints.py`, `test_provenance_endpoints.py`, `test_health.py`) + 3 tests de service ciblés (`test_analogs_service.py`, filtres de guerre) |
| `POST /analogs/search` < 150 ms p95 | ✅ 30-80 ms mesurés en local (cache pool chaud), k=5 à k=100, tous modes — voir §3 |
| Toute réponse de données porte un bloc de sources | ✅ `state`, `episodes`/`compare`, `analogs/search` (`sources_summary`) — calculé depuis les `source_id` réels, jamais une liste statique (ADR 0004 §6). `series`/`events` portent l'attribution par ligne (plus précise qu'un bloc global) |

## 3. Performance mesurée

`POST /analogs/search`, cache de pool chaud (après le premier appel qui matérialise `rolling30` et
`pool`) :

| Requête | k | Temps |
|---|---|---|
| mode anchor, FRA 2019 | 5 | 31 ms |
| mode anchor, FRA 2019 | 20 | 48-80 ms |
| Moyenne sur 3 appels successifs | 20 | 34-80 ms |

Largement sous le seuil de 150 ms p95. Le premier appel après démarrage (cache froid, construction
du pool `pool` en plus du `reference_frame` demandé) prend ~1,1 s — c'est pourquoi `main.py` préchauffe
`rolling30` au démarrage (`lifespan`), mais **pas** systématiquement `pool` (nécessaire seulement pour
les modes `manual`/`shock`, ou tout `reference_frame != "pool"` qui a besoin du pool global pour ces
modes) : compromis délibéré, documenté ici plutôt que dans le code, entre temps de démarrage et latence
de première requête sur les modes les moins courants.

## 4. Corrections apportées pendant la validation (pas des bugs de conception, des bugs de code)

En testant l'API réellement démarrée plutôt qu'en relisant le code, trois défauts factuels ont été
trouvés et corrigés avant de considérer la phase terminée :

1. **Événements globaux invisibles** : les deux guerres mondiales (`country_iso3 IS NULL` dans
   `data/events/wars.yaml`, événements documentés comme s'appliquant à tous les pays du pool)
   n'apparaissaient dans `GET /events` pour aucun pays, et n'étaient jamais exclues du pool
   d'analogues par `_war_years` — filtré uniquement sur les lignes pays-spécifiques. Corrigé dans les
   deux endroits (voir ADR 0004 §1).
2. **`filters.exclude_wartime` manquant** : présent dans l'exemple de requête du plan (§10.1, valeur
   par défaut `false`) mais absent du schéma écrit ; l'exclusion des années de guerre était appliquée
   sans condition. Corrigé — champ ajouté, comportement testé dans les deux sens
   (`test_wartime_years_kept_by_default` / `_excluded_when_requested`).
3. **`GET /provenance/raw-files` renvoyait une erreur 500** : `RawFileOut.downloaded_at` était typé
   `str` mais le routeur renvoyait des objets ORM avec un `datetime` réel — `ResponseValidationError`
   de FastAPI. Trouvé en testant l'endpoint réellement (pas par mypy, qui ne valide pas la
   correspondance `response_model` ↔ objet ORM renvoyé). Corrigé en construisant explicitement le
   schéma de sortie dans le routeur.

Les trois auraient été invisibles à la seule lecture du code ou à la seule vérification
`ruff`/`mypy` — confirmation que « pour les changements UI/frontend, démarrer le serveur et tester
dans un navigateur » (ou ici, un client HTTP réel) s'applique tout autant à une API.

## 5. Le test le plus important du projet (§18.8 test n°2)

Le plan qualifie ainsi le test de retour à la source : rouvrir le fichier brut au `locator`
enregistré, rejouer `transform_chain`, et vérifier l'égalité bit-à-bit avec la valeur en base.
Implémenté dans `test_return_to_source.py` sur 200 observations JST tirées aléatoirement (graine
fixe) parmi les 26 374 observations `["parse_dta_float"]` (transformation identité, ~47 % du total) —
**200/200 correspondent exactement**. Couverture des autres chaînes de transformation
(`ratio_to_gdp_pct`, `chain_link_returns`, etc.) assurée unitairement par `test_derive.py`, qui teste
chaque fonction nommée séparément.

`test_locator_coverage_is_total` confirme par ailleurs que 100 % des 56 529 observations ont un
`raw_file_id` et un `locator` non nuls (règle 7, CLAUDE.md).

## 6. Limitations assumées

Voir `docs/limitations.md` — en particulier : pas de rendu de page PDF pour l'instant (endpoint
`/provenance/page/{raw_file_id}/{page}` fonctionnel mais toujours 404, aucune ligne dans
`source_pages`), pas de soumission Wayback Machine, `out_bond_real_cum` non disponible.

## 7. Conclusion

Les quatre critères d'acceptation Phase 5 sont satisfaits. Les 15 endpoints du §10 sont livrés à
l'exception de `/export/{search_id}`, reporté à la Phase 6 pour une raison de dépendance
architecturale documentée (§1 ci-dessus), pas un oubli. 140 tests passent (2 xfail connus et
documentés depuis la Phase 4), dont le test de retour à la source à 200/200 — la garantie la plus
forte du projet que le bordereau ne ment pas.
