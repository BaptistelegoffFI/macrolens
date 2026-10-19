# ADR 0029 — Avertissements de recherche dans la colonne de droite, rendements d'actifs en bas

Deux demandes d'ergonomie sur l'onglet Scénario.

## Avertissements

Les avertissements du moteur (analogue éloigné de plus de 50 ans, peu d'analogues, concentration
des pays ou des décennies, indice HHI élevé) s'affichaient en bandeaux au-dessus du tableau des
analogues, en français seulement, et un bandeau était répété pour chaque analogue éloigné.

- La colonne de droite est coupée en deux : **Avertissements** au-dessus, **Provenance** dessous
  (séparateur redimensionnable, hauteur mémorisée sous `ml.scenario.side`). Le tableau n'en porte
  plus.
- **Traduction FR/EN** : l'API renvoie des phrases françaises et son contrat ne change pas (le test
  de contrat OpenAPI l'impose). Le client les reconnaît par leur forme (`lib/searchWarnings.ts`) et
  les rend lui-même depuis des gabarits bilingues. Une phrase inconnue est affichée telle quelle,
  jamais supprimée.
- **Une carte par type** : les avertissements « analogue distant de N ans » sont fusionnés (nombre et
  écart minimal et maximal) au lieu d'être répétés.
- Une recherche sans avertissement l'écrit explicitement ; avant toute recherche, un message invite
  à en lancer une.
- Le couplage de formulation est gardé des deux côtés : `backend/tests/unit/test_core_warnings.py`
  et `frontend/tests/searchWarnings.test.ts` figent les mêmes phrases.

## Rendements d'actifs

Le bloc « Ce qui s'est produit pour les actifs » était une rangée de hauteur fixe (460 px) entre le
tableau et le graphique en éventail, donc comprimée avec défilement interne. Il passe **sous tout le
reste** (après la chronologie), à sa hauteur naturelle : c'est le panneau qui défile. Les rangées
redimensionnables ne portent plus que le tableau, le graphique en éventail et la chronologie ; leur
disposition mémorisée (`ml.scenario.rows`) change de longueur, donc revient une fois aux valeurs par
défaut.
