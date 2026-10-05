# ADR 0020 — Aucun écrêtage, médiane en titre, marqueur d'épisode extrême

Aucune winsorisation, aucune suppression de valeurs aberrantes. L'Allemagne 1923 reste dans
les données : JST publie un rendement actions de 2 639 074 816 (inflation de 1 057 096 703 la même
année, soit +149,65 % en réel).

## Statistique de tête

La **médiane** est le chiffre en grand ; l'intervalle interquartile est en dessous ; min et max
restent disponibles. Aucune moyenne n'est calculée. Un test vérifie que remplacer une valeur par +2,6
milliards ne déplace pas la médiane.

## Marqueur

Un épisode est marqué « extrême » (`n_extreme` par cellule) si, dans la fenêtre, une année a un
rendement réel inférieur ou égal à -50 %, ou supérieur ou égal à +100 %, ou une inflation supérieure
ou égale à 100 % par an. Les seuils sont des constantes nommées dans `core/asset_returns.py`.
Le marqueur **signale, ne filtre pas** : la valeur reste dans N, dans min et dans max.

Le choix des seuils est une convention, pas une propriété de la donnée ; les mettre en constantes les
rend discutables et testables (limites -0,5 et +1,0 couvertes par les tests).
