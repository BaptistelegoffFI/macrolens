# ADR 0017 — Rendement en monnaie locale, change dans une ligne séparée

Le rendement d'un actif est exprimé en monnaie locale. Le change n'est jamais fondu en silence
dans ce rendement : au gérant de décider s'il couvre ou non son exposition.

## Ligne change

`x` = `xrusd` de JST, en **monnaie locale par USD** (égal à 1 pour les États-Unis). Rendement de
change = `x[t-1] / x[t] - 1`, c'est-à-dire la variation de la valeur en USD d'une unité de monnaie
locale : positif quand la monnaie locale s'apprécie. Nominal, jamais déflaté. Pour les États-Unis la
ligne vaut zéro, monnaie de référence, ce qui est affiché comme tel.

## Pictogramme de régime

Sous l'étalon-or puis Bretton Woods, `xrusd` est plat pendant des décennies puis discontinu aux
dévaluations. Sans explication, une colonne plate sur 1950-1970 ferait douter de tout l'outil. Chaque
cellule de change porte `n_pegged` : le nombre de fenêtres dont au moins une année tombe dans un
régime « Étalon-or classique » (jusqu'à la sortie propre à chaque pays) ou « Bretton Woods »
(`data/reference/monetary_regimes.yaml`, déjà utilisé par le cadre de référence « ère »).

Classification volontairement minimale : l'entre-deux-guerres n'est pas classé fixe, faute de
borne vérifiée pays par pays pour tous (le fichier de régimes le dit lui-même pour ESP, PRT, AUS,
CAN, DNK).

## Écart de couverture

Le Canada n'a aucun rendement d'actif dans JST R6 mais possède change et inflation : sa ligne change
est disponible, ses lignes d'actifs sont « sans série ».
