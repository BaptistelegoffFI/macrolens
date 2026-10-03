# ADR 0014 — Unités affichées sur les champs Manuel et Choc

Demande de l'utilisateur : indiquer l'unité de chaque champ à remplir en modes Manuel et Choc
(pourcentage, point de base, etc.).

## Les unités sont celles du calcul, pas un choix d'affichage

Une valeur saisie est utilisée telle quelle par le moteur, dans la même unité que les variables
calculées par `backend/macrolens/core/features.py`. Les unités affichées en sont donc déduites de
ces formules :

| Unité | Variables | Origine dans le code |
|---|---|---|
| `%` | inflation, croissance, taux court réel, rendements réels actions et immobilier sur 3 ans | `100 × (x[t] / x[t−lag] − 1)`, ou taux nominal moins inflation |
| `pp` (points de pourcentage) | accélération de l'inflation, écart de croissance, écart de chômage, variation du taux court sur 2 ans, pente de la courbe | différences entre deux taux |
| `% PIB` | dette / PIB, compte courant / PIB | ratio au PIB |
| `pp PIB` | variation de la dette sur 5 ans, écart de crédit sur 5 ans | différence de ratios au PIB |

En mode Choc, la valeur saisie est un écart ajouté à l'état de base : la même unité s'applique
(« 2 » dans un champ en `pp` signifie +2 points).

## Pas de points de base

Les points de base (1 pb = 0,01 pp) n'ont pas été retenus : afficher « pb » sans convertir
tromperait (saisir 100 reviendrait à 100 points, soit 1 pp attendu), et convertir changerait la
convention de saisie par rapport à toutes les valeurs affichées ailleurs dans l'outil (en %). Chaque
unité a une infobulle qui l'explique (`UNIT_HELP`), en français et en anglais.

## Mise en page

La colonne Scénario fait 220px par défaut et sa largeur est mémorisée chez chaque visiteur, donc
elle ne peut pas être élargie pour tous. L'unité est affichée en grisé à l'intérieur du champ, à
droite. Le champ est étroit pour `%` et `pp`, plus large pour `% PIB` et `pp PIB`, afin que les
libellés longs (ex. « Unemployment gap ») tiennent sur une ligne. Les flèches haut/bas natives des
champs numériques sont masquées : elles réservaient de la largeur et tronquaient les valeurs
(« -12,35 » affiché « -12,3 ») ; les touches ↑/↓ continuent de fonctionner.
