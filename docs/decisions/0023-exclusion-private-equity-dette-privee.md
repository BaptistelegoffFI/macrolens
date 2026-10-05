# ADR 0023 — Private equity et dette privée exclus

Aucune série gratuite, reproductible et valorisée au prix de marché n'existe pour le private
equity et la dette privée. Les indices de référence (Cambridge Associates, Preqin, Burgiss) sont
décrits dans le brief comme propriétaires, derrière un accès payant, débutant vers 1986, et lissés
par des valorisations d'expert : ce lissage contredit ce que le produit affirme partout ailleurs
(rendements observables, traçables jusqu'à un fichier public). Ces affirmations viennent du brief ;
elles n'ont pas été vérifiées à la source dans cette session.

## Décision

Exclusion volontaire, affichée comme telle sur la page Classes d'actifs (ligne « Private equity et
dette privée », état « exclu », avec la raison) et dans l'onglet Sources et méthodologie. L'API la
renvoie dans `/scenario/asset-returns/detail` avec le statut `excluded`.

## Si un proxy coté est ajouté plus tard

Véhicules cotés de private equity ou indices de BDC : ils devront être étiquetés « proxy coté », avec
leur volatilité de marché, et ne jamais être présentés comme des rendements du marché privé.
