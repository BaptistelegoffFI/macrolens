# Méthodologie

Ce document décrit, formule par formule, ce que MacroLens calcule — c'est la référence
technique complète derrière la vue *Sources & méthode* de l'interface (résumé fidèle mais
plus court, §11.3). Toute affirmation ci-dessous correspond à du code réellement exécuté dans
`backend/macrolens/core/` (pur, sans I/O, testé — voir `CLAUDE.md` règle 6) ; rien ici n'est
aspirationnel.

**Rappel (§0, `CLAUDE.md`) :** MacroLens ne prédit rien. Il répond à « qu'est-il arrivé
historiquement dans les situations les plus proches ? », jamais à « que va-t-il se passer ? ».
Aucun modèle entraîné, aucune IA — uniquement de l'algèbre linéaire et des statistiques
descriptives, déterministes et rejouables à l'identique (rejeu du pipeline complet → même
`build_id`, mêmes résultats).

## 1. Vecteur d'état (§8.1)

Un état est un couple (pays, année) réduit à **14 features**, réparties en 7 familles. Toutes
sont des transformations stationnaires — on compare des *régimes économiques*, pas des
*époques calendaires* (comparer des niveaux bruts ferait ressembler 1950 à 1950 et rien
d'autre).

| # | `feature_code` | Formule | Famille | Type |
|---|---|---|---|---|
| 1 | `infl_level` | inflation IPC glissante à *t* | Prix | niveau |
| 2 | `infl_accel` | inflation(*t*) − inflation(*t*−2) | Prix | variation |
| 3 | `growth_level` | croissance PIB réel/hab à *t* | Activité | niveau |
| 4 | `growth_gap` | croissance(*t*) − moyenne mobile 10 ans | Activité | variation |
| 5 | `rate_short_real` | `rate_short` − `infl_level` | Taux | niveau |
| 6 | `rate_short_delta` | `rate_short`(*t*) − `rate_short`(*t*−2) | Taux | variation |
| 7 | `curve_slope` | `rate_long` − `rate_short` | Taux | niveau |
| 8 | `debt_level` | `debt_public_gdp` à *t* | Dette | niveau |
| 9 | `debt_delta5` | `debt_public_gdp`(*t*) − (*t*−5) | Dette | variation |
| 10 | `credit_gap5` | `credit_private_gdp`(*t*) − (*t*−5) | Crédit | variation |
| 11 | `equity_real_3y` | rendement réel actions cumulé sur 3 ans | Marchés | variation |
| 12 | `house_real_3y` | variation réelle prix immobilier sur 3 ans | Marchés | variation |
| 13 | `unemp_gap` | chômage(*t*) − moyenne mobile 10 ans | Activité | variation |
| 14 | `ca_level` | `current_account_gdp` à *t* | Externe | niveau |

Implémentation : `core/features.py`. Toutes les moyennes mobiles (fenêtre 10 ans, minimum 7
observations valides, `_trailing_mean`) sont **strictement rétrospectives** : `[t−10, t−1]`,
jamais `[t−10, t]`. Un filtre HP centré ou toute moyenne incluant *t* injecterait l'avenir dans
le passé — c'est le piège n°1 du projet (§15 pt. 1), testé explicitement (§5 ci-dessous, test
anti-look-ahead).

## 2. Comparabilité entre époques (§8.2)

**Le problème.** Une dette publique à 60 % du PIB était un niveau extrême en 1890, un pays
prudent en 2025. Le crédit privé pesait ~30 % du PIB vers 1900, dépasse 110 % aujourd'hui, sans
qu'aucune crise ne l'explique — c'est de l'approfondissement financier. Comparer des niveaux
bruts (ou des rangs sur le pool complet) ferait dominer la dérive séculaire : chaque année ne
ressemblerait qu'à ses voisines temporelles, et le produit serait mort (§15 pt. 0).

**Le principe.** On ne compare pas des valeurs, on compare des **positions relatives à ce qui
était normal à l'époque, dans le pays concerné** — la question posée est « l'inflation est-elle
haute par rapport à ce que ce pays a connu depuis une génération ? », pas « l'inflation est-elle
à 4 % ? ».

### 2.1 Deux traitements selon la nature de la feature (`core/normalize.py`)

**(a) Features de niveau → rang percentile glissant, rétrospectif**

```
r(c, t, f) = #{ f(c, s) < f(c, t) : s ∈ [t−30, t−1] } / #{ s ∈ [t−30, t−1] : f(c, s) observé }
```

`r = 0.95` signifie « plus élevé que 95 % de ce que ce pays a connu au cours des 30 dernières
années ». Minimum 20 observations valides dans la fenêtre pour produire un rang (sinon
`is_complete = false`). Concernées : `infl_level`, `growth_level`, `rate_short_real`,
`curve_slope`, `debt_level`, `ca_level`.

**(b) Features de variation → mise à l'échelle par la volatilité locale**

```
z(c, t, f) = Δf(c, t) / max( MAD_robuste(Δf(c, t−30 … t−1)) × 1.4826, plancher_f )
```

Un delta n'a de sens que rapporté à la volatilité normale de l'époque. `MAD_robuste` est
l'écart absolu médian, × 1.4826 pour en faire un estimateur cohérent de l'écart-type sous
normalité. `plancher_f` (déclaré dans `data/reference/feature_floors.yaml`) évite l'explosion
quand une variable a été quasi immobile pendant 30 ans. Le score `z` est ensuite lui-même
converti en rang percentile (comme en (a)) — les scores z sont déjà comparables entre époques,
mais le passage au rang uniformise l'échelle avec les features de niveau et borne l'effet des
queues extrêmes (l'hyperinflation allemande de 1923 produirait un z à plusieurs milliers ;
converti en rang, il reste borné à [0,1]). Concernées : `infl_accel`, `growth_gap`,
`rate_short_delta`, `debt_delta5`, `credit_gap5`, `equity_real_3y`, `house_real_3y`,
`unemp_gap`.

### 2.2 Le référentiel (`reference_frame`) est un paramètre, pas une constante

| Valeur | Normalisation | Question posée |
|---|---|---|
| `rolling30` **(défaut)** | 30 ans glissants, même pays | Anormal *pour ce pays, à cette époque* ? |
| `era` | Au sein du régime monétaire | Anormal *pour ce régime monétaire* ? |
| `cross_section` | Parmi les autres pays de la même année | Anormal *par rapport aux voisins au même moment* ? |
| `pool` | Pool complet, tous pays toutes années | Comparaison absolue |

`rolling30` est le défaut : c'est le seul référentiel strictement rétrospectif pays par pays,
donc le seul immunisé à la fois contre la dérive séculaire et contre le look-ahead. Changer de
référentiel change la question posée, pas juste le style d'affichage — le `reference_frame` fait
partie du `build_id` du panel.

**Régimes monétaires** (pour `era`), déclarés par pays et sourcés dans
`data/reference/monetary_regimes.yaml` : étalon-or classique (1870-1914), entre-deux-guerres
(1919-1939), Bretton Woods (1946-1971), flottement/forte inflation (1972-1985), désinflation
(1986-2007), post-crise/taux zéro (2008-2021), resserrement (2022-). Les dates réelles varient
par pays (la Suède quitte l'or en 1931, la France en 1936) — jamais un découpage global
approximé.

### 2.3 Ce que ça coûte

Avec une fenêtre de 30 ans et un minimum de 20 observations valides, les vecteurs d'état ne
deviennent calculables qu'à partir de ~1895-1905 selon les pays et les variables. **Le pool
exploitable démarre donc vers 1895-1905, pas 1870.** Les années antérieures restent en base et
consultables (Explorateur de séries), utilisées comme historique de référence pour normaliser
les années suivantes, mais ne sont jamais candidates comme analogues elles-mêmes. C'est le prix
de la comparabilité — voir `docs/limitations.md`.

### 2.4 Double affichage obligatoire

Partout où une valeur normalisée (un rang) apparaît dans l'interface, la valeur brute apparaît
aussi, jamais l'une sans l'autre — un rang seul est illisible, une valeur brute seule cache
exactement la comparabilité inter-époques que le moteur existe pour fournir. Format :
`valeur brute · r=rang`. Implémenté dans les panneaux Scénario, Épisode et Comparateur.

### 2.5 Avertissement d'écart d'époque

Règle déterministe (`core/warnings.py::epoch_gap_warning`) : si un analogue est distant de plus
de **50 ans** de l'ancre et que sa distance repose à plus de 40 % sur des features de niveau,
l'interface affiche un avertissement explicite (« le rapprochement porte sur des positions
relatives, pas sur des niveaux comparables »). Visible dans le panneau Analogues du Scénario.

## 3. Distance (§8.3, `core/similarity.py`)

Distance euclidienne pondérée sur les rangs :

```
d(a, b) = sqrt( Σ_f  w_f · (pct_rank_f(a) − pct_rank_f(b))² )   avec  Σ_f w_f = 1
```

- Poids par défaut : uniformes (1/14).
- Poids par famille modifiables (Prix, Activité, Taux, Dette, Crédit, Marchés, Externe),
  renormalisés à somme 1 côté serveur ; un poids nul ignore la dimension.
- Score de similarité affiché : `100 · (1 − d)`.
- Décomposition obligatoire : chaque analogue affiché porte la contribution de chaque feature
  à sa distance (`w_f · Δ_f²`) — un analogue non explicable est un analogue inutilisable.

**Non implémenté en v1, par choix documenté** : la distance de Mahalanobis (corrige la
corrélation entre features, ex. inflation ↔ taux courts) et la comparaison de trajectoires par
Dynamic Time Warping sont prévues pour v1.1/v1.2. L'euclidienne pondérée sur rangs est plus
lisible et plus explicable — l'explicabilité est un objectif du produit, pas un compromis.

## 4. Règles d'exclusion du pool (§8.4, `core/similarity.py::filter_pool`)

Une observation candidate est exclue si :

1. `is_complete = false` (au moins une feature obligatoire manquante) ;
2. même pays que la requête et |année − année_requête| ≤ 3 (évite l'auto-appariement trivial) ;
3. il reste moins de *H* années de données après elle, où *H* = horizon maximal demandé — **une
   observation ne peut pas être un analogue si son avenir n'est pas observable** (conséquence :
   les 10 dernières années ne peuvent jamais être analogues pour un horizon 10 ans) ;
4. `is_break = true` et le toggle « inclure les ruptures » est désactivé ;
5. `coverage_partial = true` (extension 1850-1869) et le toggle correspondant est désactivé ;
6. l'utilisateur a explicitement exclu ce pays ou cette période ;
7. années de guerre, si `filters.exclude_wartime = true` (désactivé par défaut).

## 5. Sortie et garde-fous (§8.5, §9)

Pour chaque requête : les *k* plus proches (défaut 20, max 100), avec distance, similarité,
décomposition par feature, valeurs brutes comparées. Pour chaque horizon demandé (1/3/5/10 ans),
les réalisations historiques des analogues sont agrégées (`core/outcomes.py`) en **médiane, Q1,
Q3, min, max, part de cas négatifs** — jamais une moyenne isolée, jamais un intervalle de
confiance paramétrique (les fenêtres se chevauchent, les observations sont autocorrélées, les
hypothèses ne tiennent pas). Formulation imposée dans toute l'UI : « sur les *n* épisodes
historiques les plus proches, *m* ont été suivis de… ».

Garde-fous d'affichage (`core/warnings.py`) :
- **n < 5** : bandeau d'avertissement, agrégats grisés.
- **Concentration** (≤ 2 pays ou ≤ 2 décennies parmi les analogues) : indice de Herfindahl
  affiché avec avertissement — Suède 1990, Finlande 1990 et Norvège 1988 sont *une* crise, pas
  trois observations indépendantes (§15 pt. 3).

## 6. Batterie de tests de correction (§12.3)

Tenue à jour dans `reports/validation.md`. Résumé : anti-look-ahead, identité (d(a,a)=0),
symétrie, inégalité triangulaire (1000 triplets), invariance d'échelle, reproductibilité du
`build_id`, dérive séculaire (|ρ| < 0.10 entre écart temporel et distance), sensibilité au
référentiel, équivalence structurelle (SWE 1990 ↔ ESP 2007). Deux tests restent `xfail`,
diagnostiqués en détail dans `reports/validation.md` plutôt que masqués.
