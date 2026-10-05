# Rendements d'actifs : audit JST et recherche de sources Tier 2/3

Rapport demandé avant toute ingestion nouvelle. Établi le 2026-10-05. Chaque constat est marqué
**vérifié** (lu à la source pendant cette session) ou **non vérifié**.

## 1. Audit des colonnes JST (version R6 ingérée)

Lecture directe de `data/raw/jst/R6/JSTdatasetR6.dta` (2718 lignes, 18 pays, 1870-2020 ; 17 pays
après exclusion de l'Irlande, comme le reste du produit).

| Colonne demandée | Présente dans R6 | Ingérée aujourd'hui | Unité réelle | Observations (17 pays) | Première / dernière année |
|---|---|---|---|---|---|
| `eq_tr` | oui | oui, mais seulement sous forme d'indice chaîné (`equity_index_nominal`) | fraction (0,086 = 8,6 %) | 2263 | 1870 / 2020 |
| `bond_tr` | oui | **non** | fraction | 2295 | 1870 / 2020 |
| `bill_rate` | oui | **non** | fraction (rendement `coupon/prix`, pas un taux affiché) | 2351 | 1870 / 2020 |
| `housing_tr` | oui | **non** (seul `hpnom`, indice de prix, est ingéré) | fraction | 1909 | 1871 / 2020 |
| `ltrate` | oui | oui (`rate_long`) | pourcent | 2630 (18 pays) | |
| `stir` | oui | oui (`rate_short`) | pourcent | 2520 (18 pays) | |
| `cpi` | oui | oui | indice, 1990 = 100 | 2567 | 1870 / 2020 |
| `xrusd` | oui | oui (`exchange_rate_usd`) | monnaie locale par USD | 2564 | 1870 / 2020 |

Définitions officielles (documentation JST R6, p. 6-7) : `eq_tr` et `housing_tr` =
`(p[t] + d[t]) / p[t-1] - 1` ; `bond_tr` = `(p[t] + coupon[t]) / p[t-1] - 1` ; `bill_rate` =
`coupon[t] / p[t-1]`. Drapeaux fournis par JST : `eq_tr_interp` (7 lignes : interpolé pour
couvrir une fermeture de bourse), `rent_ipolated` (29 lignes) et `housing_capgain_ipol` (5 lignes,
loyers et plus-values interpolés, par exemple en temps de guerre). **Aucun drapeau n'existe pour
`bond_tr` ni `bill_rate`.**

Constats qui contredisent le cahier des charges ou demandent une décision :

1. **JST R6 s'arrête en 2020, pas en 2026.** Tout le Tier 1 finit en 2020. Un analogue ancré en
   2012 n'a pas de fenêtre à 10 ans, un analogue ancré en 2018 n'en a pas à 3 ans. Prolonger
   jusqu'à 2026 demanderait de raccorder une autre source, ce que le produit s'interdit de faire
   silencieusement.
2. **`housing_tr` est le plus lacunaire** : 86 observations pour l'Italie (depuis 1928), 75 pour
   le Japon (depuis 1931), 73 pour le Portugal (depuis 1948), 99 pour la Finlande. Les lignes
   que JST a interpolées (29 pour les loyers, 5 pour les plus-values, deux drapeaux qui peuvent se
   recouvrir) doivent rester signalées.
3. **Unités mixtes dans la même source** : `bill_rate`, `bond_tr`, `eq_tr`, `housing_tr` sont des
   fractions, alors que `stir` et `ltrate` sont en pourcent. Le code d'ingestion doit convertir
   explicitement et le tester.
4. **Licence JST : CC BY-NC-SA** (déjà notée dans `sources.yaml`). Non commercial, attribution
   obligatoire, partage à l'identique. Le brief cible des gérants de portefeuille : si l'outil est
   proposé dans un cadre commercial, l'usage de JST doit être clarifié avec les auteurs avant.
5. **JST exige de citer** Jordà, Knoll, Kuvshinov, Schularick, Taylor (2019), « The Rate of
   Return on Everything, 1870-2015 », *QJE*, pour toute donnée de prix d'actifs ou de rendements.
   La citation actuelle de `sources.yaml` ne mentionne que l'article de 2017. Elle est ajoutée
   dans les métadonnées des nouvelles séries ; la modifier dans `sources.yaml` changerait la
   sortie de l'endpoint existant `/meta/sources`, donc c'est laissé à votre décision.
6. **Allemagne 1922-1923** : `eq_tr` vaut 20,7 (+2069 %) en 1922 et 2,6 milliards en 1923, le CPI
   est exprimé dans des unités reconverties. Conservé tel quel et signalé comme épisode extrême,
   conformément à la consigne (aucun écrêtage).
7. **`xrusd` est « monnaie locale par USD »**, égal à 1 pour les États-Unis. Un rendement de
   change « valeur en USD d'une unité de monnaie locale » se calcule `x[t-1] / x[t] - 1`.

## 2. Validation contre le dossier publié (constats préliminaires)

| Épisode | Publié | JST (colonne brute) | Verdict |
|---|---|---|---|
| Actions US 1929-1932 | S&P 500 dividendes inclus (Damodaran, vérifié) : -8,30 %, -25,12 %, -43,84 %, -8,64 % → cumul -64,8 % | -3,4 %, -22,9 %, -40,3 %, -13,3 % → cumul -61,4 % | même histoire, écarts annuels jusqu'à 5 points |
| Actions Japon 1990-1995 | Nikkei 225 (prix, Wikipedia, vérifié) : -38,7 %, -3,6 %, -26,4 %, +2,9 %, +13,2 %, +0,7 % → cumul -48,9 % en prix | -13,2 %, -15,5 %, -26,1 %, +13,0 %, +6,5 %, -13,7 % → cumul -43,7 % | **cumul cohérent, mais les valeurs annuelles divergent fortement (1990 : -13 % contre -39 %)** |

L'écart japonais existe dans la colonne brute de JST, avant tout code du projet. La documentation
JST ne décrit pas la construction de ces séries pays par pays (elle ne couvre que les données macro
et bancaires), donc la cause ne peut pas être établie ici. Les tests de validation porteront sur
les cumuls pluriannuels avec une tolérance documentée, et l'écart annuel japonais sera consigné
comme limite connue plutôt que masqué.

## 3. Sources Tier 2 et Tier 3

| Source proposée | Tier | Ce qui a été vérifié | Licence / conditions | Historique | Verdict |
|---|---|---|---|---|---|
| **S&P GSCI** | 2 | propriétaire S&P Dow Jones Indices ; copies gratuites seulement sur des sites tiers (Investing.com, Barchart sur abonnement) | redistribution interdite sans accord écrit (vérifié) | 1980 chez Barchart | **Exclu** : ni citable ni reproductible |
| **World Bank Pink Sheet** | 2/3 | indices de prix spot : énergie, alimentation, boissons, matières premières, engrais, métaux, métaux précieux ; mensuel et annuel ; mise à jour mensuelle (vérifié) | modèle d'accès « CC BY » (version non confirmée) | **non vérifié** (1960 d'après la documentation de la Banque mondiale) | **Retenu sous réserve de votre accord**, étiqueté « prix spot, pas rendement total, sans roll yield » |
| **Indices actions nationaux (MSCI)** | 2 | propriétaire | conditions restrictives (non vérifié en détail) | | **Exclu** |
| Indices de prix actions OECD | 2 | série de prix uniquement ; démarrage variable selon le pays (États-Unis 1957, Royaume-Uni 1957, Australie 1958 d'après FRED) | page des conditions OECD inaccessible (HTTP 403) : **non vérifié** | | **Possible, prix seulement.** JST donne déjà les rendements totaux 1870-2020 pour les 17 pays : l'apport serait limité à 2021-2026 |
| FX post-2020 (Réserve fédérale H.10) | 2 | non consulté en détail | **non vérifié** | | **Possible**, uniquement pour prolonger après 2020 |
| **Moody's Aaa / Baa via FRED** | 2 | page FRED : « MOODY'S INFORMATION MAY NOT BE COPIED OR OTHERWISE REPRODUCED, REPACKAGED, FURTHER TRANSMITTED... OR STORED FOR SUBSEQUENT USE » sans accord écrit (vérifié) ; ce sont des rendements à l'échéance, pas des rendements totaux | stockage et redistribution interdits | | **Exclu** |
| **ICE BofA via FRED** | 3 | page FRED : « Starting in April 2026, this series will only include 3 years of observations » ; « Reproduction of this data in any form is prohibited except with the prior written permission of ICE Data Indices » (vérifié) | reproduction interdite | 3 ans | **Exclu** : l'historique 1996 supposé n'existe plus |
| **Ken French, portefeuilles sectoriels** | 3 | États-Unis uniquement ; échantillon depuis juillet 1926 ; rendements quotidiens, mensuels, annuels ; portefeuilles de 5 à 49 industries définis par code SIC (vérifié) | la page ne porte que « Copyright Eugene F. Fama and Kenneth R. French » ; citation recommandée, **aucune licence de redistribution explicite** | 1927 (premier exercice civil complet) | **Utilisable pour la recherche avec citation ; demander l'autorisation avant publication.** Ce ne sont pas des secteurs GICS |
| Rendements obligataires par échéance | 3 | les taux du Trésor US sont des taux, pas des rendements ; en tirer un rendement exigerait une hypothèse de duration | | | **Exclu.** Découpage court/long obtenu via JST : `bill_rate` (court) et `bond_tr` (long) |
| Crédit IG / HY | 3 | aucun indice de rendement total gratuit et reproductible trouvé ; plus proche : écart de crédit GZ de la Réserve fédérale (fichier CSV public, depuis 1973, États-Unis) | licence **non vérifiée** ; c'est un écart de crédit, pas un rendement | 1973 | **Lignes « non disponible »** ; l'écart GZ peut être ajouté comme ligne de niveau si vous le souhaitez |
| Private equity / private debt | | exclusion demandée par le brief | | | **Exclu**, documenté (ADR et onglet Sources) ; les affirmations sur Cambridge Associates, Preqin et Burgiss viennent du brief et n'ont pas été vérifiées ici |

## 4. Conséquence sur l'architecture

- Le **Tier 1 (JST, 1870-2020, 17 pays)** couvre à lui seul : actions, obligations d'État long
  terme, bons du Trésor (court terme), immobilier résidentiel, change et inflation. C'est ce qui est
  construit en premier et ce que le bloc Scénario affiche.
- Les **Tier 2 et 3 réellement disponibles et licenciables** sont beaucoup plus minces que dans le
  brief : matières premières en prix spot (Banque mondiale), secteurs américains (Ken French, sous
  réserve d'autorisation), éventuellement prolongation après 2020. **Rien du Tier 2/3 n'est
  ingéré** tant que vous n'avez pas validé ce tableau. Les lignes correspondantes de la page Classes
  d'actifs s'affichent « non disponible » avec la raison.

## 5. Décisions (2026-10-05)

1. **Pink Sheet de la Banque mondiale : non ingéré.** Le lien de téléchargement contient un
   identifiant qui change chaque année (`...-0050012025` puis `...-0050012026`) alors que la
   production retélécharge ses sources à chaque démarrage : le lien se casserait chaque janvier. Ce
   sont en outre des prix en USD, sans rendement total ni roll yield, qui n'existent que depuis 1960
   alors que la plupart des analogues sont plus anciens.
2. **Ken French : non ingéré.** Aucune procédure formelle : la page ne porte qu'un copyright. La
   voie normale est un courriel à l'auteur demandant l'autorisation de publier des séries dérivées.
3. **JST : usage non commercial confirmé** (projet personnel et intellectuel). Mention ajoutée à
   l'onglet Sources et méthode.
4. **Citation du QJE dans `sources.yaml` : non faite.** Elle n'est pas nécessaire au fonctionnement ;
   elle figure déjà sur chaque nouvelle série et dans l'onglet Sources et méthode, et ne pas toucher
   `sources.yaml` laisse `/meta/sources` identique.
5. **Défaut japonais 1946-1947 : corrigé** par une garde de calcul (voir ADR 0019).
6. 2021-2026 : pas de raccord de source (jonction silencieuse refusée).
