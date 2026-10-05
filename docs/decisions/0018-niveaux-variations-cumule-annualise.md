# ADR 0018 — Niveaux absolus et variations, cumulé et annualisé

## Définitions

- **Cumulé** : `prod(1 + r) - 1` sur la fenêtre. Affichage par défaut.
- **Annualisé** : `(1 + cumulé)^(1/n) - 1`, géométrique.
- **Repli maximal** : pire écart entre un pic et le creux suivant sur la fenêtre, le point de départ
  (valeur 1,0 en fin d'année t) comptant comme un pic. Mesuré en fin d'année : un repli à l'intérieur
  d'une année est invisible, donc c'est un **minorant** du repli réel. Le texte de l'interface le dit.

## Statistiques sur l'ensemble d'analogues

Le cumulé, l'annualisé et le repli sont calculés **par analogue**, puis agrégés : médiane, Q1, Q3,
min, max. La médiane des annualisés n'est pas l'annualisé de la médiane ; c'est la première qui est
affichée. Les quartiles utilisent exactement `aggregate_continuous`, la même définition que pour les
réalisations de PIB (§9.2). Aucune moyenne n'est jamais affichée.

Taux de réussite : part des fenêtres à rendement réel strictement positif (zéro ne compte pas).
« Le Trésor a donné un rendement réel positif dans 11 précédents sur 20 à 3 ans » est la phrase
qu'un comité d'investissement lit en une seconde.

## Niveaux absolus (page Classes d'actifs)

Sur une période choisie : indice de rendement total réel en base 100 au début de la période et sa
valeur finale, avec le nominal à côté ; pour le change, le niveau `xrusd` (monnaie locale par USD) ;
pour l'inflation, l'indice des prix (1990 = 100). La variation en pourcentage, cumulée et annualisée,
est affichée en regard.

## Période avec trou

Si une année manque à l'intérieur de la période, aucun cumulé n'est calculé (le chaîner serait
combler le trou) : la réponse liste les années manquantes et la page affiche « non disponible ».
