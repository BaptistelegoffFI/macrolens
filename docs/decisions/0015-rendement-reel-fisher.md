# ADR 0015 — Rendement réel (relation de Fisher), jamais nominal

Les rendements d'actifs affichés pour un analogue sont des rendements **réels** : un gérant ne
raisonne pas en monnaie courante quand l'inflation a atteint 15 % ou plus.

## Formule

`réel = (1 + nominal) / (1 + inflation) - 1`, jamais la soustraction `nominal - inflation`.
L'inflation de l'année t est `CPI[t] / CPI[t-1] - 1`, avec le CPI du pays et de l'année concernés
(table `observations`, indicateur `cpi`, JST). Les deux niveaux de CPI doivent exister : un trou de
CPI supprime le rendement réel des deux années voisines, il n'est jamais comblé (ADR 0019).

## Pourquoi pas la soustraction

L'écart devient important dès que l'inflation monte. Un rendement nominal de 30 % avec 20 %
d'inflation donne 8,33 % réel, pas 10 %. Allemagne 1923 : rendement nominal des actions de
2 639 074 816, inflation de 1 057 096 703 ; la relation de Fisher donne +149,65 %, la soustraction
donnerait +1,58 milliard.

## Ce qui n'est pas déflaté

Le change (ADR 0017) et la ligne Inflation restent nominaux. Le rendement réel s'applique aux
actions, obligations d'État, bons du Trésor et immobilier.

## Vérification

Recoupé avec la réalisation déjà déployée `out_equity_real_cum` : 8 729 fenêtres (pays, année,
horizon) comparées, aucune différence supérieure à 1e-6 (voir ADR 0019 pour les 60 fenêtres qui
n'existent que d'un côté). Valeurs de référence écrites à la main : États-Unis 1929 sur 3 ans
-50,20 % ; Japon 1989 sur 3 ans -49,93 % ; France 1973 sur 5 ans -30,90 %.
