# Validation des rendements d'actifs contre des épisodes connus

Phase 5. Tests : `backend/tests/integration/test_asset_returns_validation.py`,
`test_asset_returns_vs_existing_outcomes.py` et `backend/tests/unit/test_asset_returns.py`.

## Ce que racontent les sorties

| Précédent | Résultat (médiane d'un seul précédent, rendement réel cumulé) | Cohérent avec l'histoire ? |
|---|---|---|
| **États-Unis 1929** | actions -21 % à 1 an, **-50 % à 3 ans** (repli maximal -50 %), +23 % à 10 ans ; obligations d'État +45 % à 3 ans ; liquidités +40 % ; prix -20 % sur 3 ans ; immobilier -10 % | oui : krach, déflation qui fait des titres sûrs les gagnants réels, redressement des actions sur dix ans |
| **Japon 1989** | actions -50 % réel à 3 ans, **-48 % à 10 ans** ; obligations d'État +79 % à 10 ans ; liquidités +16 % ; change +40 % | oui : décennie perdue des actions, forte baisse des taux |
| **Allemagne 1922** | obligations d'État **-100 %** ; change **-100 %** ; actions +150 % en 1923 puis -81 % à 3 ans (repli -93 %) ; inflation ×1e9 par an ; **espèces et immobilier non disponibles** (aucune série), marqués extrêmes | oui : hyperinflation, porteurs d'obligations anéantis, actions couverture partielle puis effondrement |

Rien n'est inventé pour l'Allemagne : espèces (pas de `bill_rate` en 1923) et immobilier (aucune
valeur de 1919 à 1924) affichent « non disponible » avec N = 0, jamais zéro.

## Écarts avec l'enregistrement publié

- **États-Unis 1930-1932** : JST nominal -60,1 % cumulé contre -61,6 % pour le S&P 500
  dividendes inclus (Damodaran, vérifié) : même histoire, écarts annuels jusqu'à 5 points (indices
  construits différemment).
- **Japon 1989-1995** : cumul JST -43,7 % contre -48,9 % pour le Nikkei en prix : cohérent.
  **Mais les valeurs annuelles divergent fortement** : 1990 -13,2 % chez JST, -38,72 % pour le
  Nikkei ; 1995 -13,7 % contre +0,74 %. L'écart est dans la colonne brute `eq_tr` du fichier JST
  R6, lue directement, avant tout code du projet. La documentation JST ne décrit pas la
  construction de ces séries pays par pays : la cause n'a pas pu être établie. À utiliser avec
  prudence pour des questions de timing annuel sur le Japon. Un test détecteur le consigne et
  échouera si JST corrige la colonne.
- **France 1973-1978** : aucun chiffre publié et vérifiable n'a été trouvé. Validé en interne
  (actions -31 % réel sur 5 ans, signe et ordre de grandeur) et par recoupement exact avec le
  pipeline existant.

## Recoupement avec le pipeline déployé, et une correction

8 729 fenêtres (pays, année, horizon) comparées à `out_equity_real_cum` : écart maximal inférieur
à 1e-6. Divergences expliquées (ADR 0019) : 48 fenêtres que seul le nouveau calcul produit
(ancrage la dernière année avant un rendement), et 12 fenêtres japonaises que seul l'ancien
calcul produisait, parce que l'indice chaîné sautait 1946-1947 (aucun rendement dans JST) en leur
attribuant 0 %.

**Ce défaut est corrigé** par une garde de calcul (`_chain_has_gap`, et `chained=True` pour la
variable `equity_real_3y`). Effet mesuré sur 14 ancres et 4 cadres de référence : l'ensemble des
analogues ne change pour aucune requête ordinaire ; le cadre par défaut est identique ; les cadres
`era` et `pool` changent de moins de 0,0002 en distance (une valeur de moins dans la distribution
de référence) ; seules les requêtes ancrées sur le Japon 1948 changent nettement, parce que leur
variable actions reposait sur un rendement imputé.

## Couverture réelle

Le Canada n'a aucune série de rendement dans JST R6. Les analogues canadiens sont exclus des lignes
d'actifs (`no_series`) ; leur change et leur inflation existent.
