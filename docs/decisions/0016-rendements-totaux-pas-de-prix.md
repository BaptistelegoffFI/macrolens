# ADR 0016 — Rendements totaux, jamais des rendements de prix

Les rendements affichés incluent dividendes, coupons et loyers imputés, tels que JST les
définit (documentation R6, p. 6-7) : `eq_tr` et `housing_tr` = `(p + d) / p[-1] - 1`, `bond_tr` =
`(p + coupon) / p[-1] - 1`, `bill_rate` = `coupon / p[-1]`.

## Séries de prix

Une série qui n'existe qu'en prix (indices spot de matières premières, indices de prix actions de
l'OECD) ne doit jamais être mélangée à des rendements totaux dans une même colonne sans marqueur.
Le schéma porte donc `measure` sur chaque série (`total_return`, `fx_rate`, `price_index`) et la
page affiche le type. Aucune série de prix n'est ingérée à ce jour (ADR 0022).

Matières premières : les indices disponibles gratuitement (Pink Sheet de la Banque mondiale) sont
des prix spot, sans roll yield. Ils devront porter l'étiquette « prix spot », jamais « rendement
total » ni « rendement excédentaire ».

## Immobilier

`housing_tr` repose sur des rendements locatifs reconstitués et JST interpole loyers et
plus-values en temps de guerre (29 lignes `rent_ipolated` et 5 lignes `housing_capgain_ipolated` dans le fichier brut).
C'est la série la moins fiable du jeu : le bloc Scénario la place dans une section distincte, avec
son avertissement, et le drapeau d'interpolation est conservé jusque dans la réponse (`n_interpolated`).

## Cohabitation avec un indice de prix existant

L'Explorateur de séries propose déjà `house_price_index` (prix nominal seul). Il reste inchangé. Les
deux séries sont désormais côte à côte : l'une en prix, l'autre en rendement total, étiquetées comme
telles.
