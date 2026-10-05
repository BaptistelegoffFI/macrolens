# ADR 0019 — Aucune imputation, N affiché, fenêtres tronquées exclues

Un rendement manquant n'est jamais imputé, interpolé ni reporté. Si un analogue n'a pas de série,
la cellule est vide et **N baisse**. N est la première information d'une statistique, pas une
décoration : la couverture des rendements est bien plus mince que celle du PIB avant 1900.

## Règle de fenêtre

La fenêtre prospective de l'analogue (pays, t) sur h ans exige un rendement pour **chacune** des
années t+1 à t+h. Sinon la fenêtre est exclue de cet horizon, jamais affichée partielle. Un analogue
de 2018 n'a pas de fenêtre à 3 ans parce que JST s'arrête en 2020 (et non en 2026 comme le supposait
le brief). Chaque cellule porte `n_requested`, `n` et la raison de chaque exclusion :
`before_start`, `truncated_end`, `gap`, `no_series`.

## Constats de cette session, tous visibles dans les tests

- **Canada** : aucune série de rendement (actions, obligations, bons, immobilier) dans JST R6.
  Ses analogues sortent des lignes d'actifs (`no_series`), pas comptés à zéro. Change et
  inflation existent.
- **Japon 1946-1947** : JST n'a pas de rendement actions ces deux années (bourse fermée). L'indice
  chaîné existant (`equity_index_nominal`, derrière `out_equity_real_cum` déjà déployé) saute les
  deux années, ce qui revient à leur attribuer 0 %. Cela touche 12 fenêtres japonaises (ancrages
  1938-1945). Le nouveau calcul les exclut. **Le comportement déployé n'est pas modifié** (consigne
  de déploiement) ; il est consigné dans
  `tests/integration/test_asset_returns_vs_existing_outcomes.py`. Il surestime probablement
  fortement le rendement réel de ces fenêtres, l'inflation japonaise de 1946-1947 étant très élevée.
- 48 fenêtres n'existent que dans le nouveau calcul : l'ancrage est l'année qui précède le premier
  rendement publié, que l'ancien indice (base 100 la première année) ne peut pas représenter.

## Doublons et pays inconnus

Les analogues en double sont comptés une fois. Un pays inconnu est exclu (`no_series`), pas une
erreur.
