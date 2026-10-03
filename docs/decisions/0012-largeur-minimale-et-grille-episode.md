# ADR 0012 — Fin de la barrière 1280px et grille Épisode pleine largeur

Deux défauts signalés par l'utilisateur sur le site déployé.

## 1. Page blanche en fenêtre non plein écran

PLAN §11.8 prévoyait un message « largeur minimale 1280px requise » sous 1280px. La règle CSS
masquait `#root` (`display: none`) sous ce seuil, mais le message lui-même était rendu **à
l'intérieur** de `#root` : il disparaissait avec le reste, et le visiteur voyait une page blanche
sans explication dès que la fenêtre faisait moins de 1280px (cas courant d'une fenêtre de
navigateur non maximisée).

Décision : suppression de la barrière et du message (`mobile-gate`, `S.app.mobileGate`). À la
place, `#root` garde une largeur minimale de 960px ; en dessous, la page défile horizontalement
au lieu de se masquer. L'application reste un outil de poste de travail (pas de mise en page
mobile), mais elle s'affiche toujours. Vérifié à 800, 1100 et 1700px.

## 2. Vue Épisode collée à gauche

`ResizableColumns` enveloppait chaque colonne dans un `div` flex sans croissance ; la dernière
colonne (`flex: 1` à l'intérieur) ne prenait donc que la largeur de son contenu, et la grille des
graphiques restait en petit à gauche. L'enveloppe de la dernière colonne reçoit maintenant
`flex: 1; min-width: 0`.

La grille Épisode passe de 2 colonnes fixes à `repeat(auto-fill, minmax(320px, 1fr))` : 2 colonnes
à 1100px, 4 à 1700px. Chaque cellule a un bouton « Agrandir / Réduire » qui la fait occuper toute
la ligne avec un graphique plus haut (150px → 340px) ; première brique d'un tableau de bord
personnalisable, sans mémorisation de l'agencement pour l'instant.

`EChart` redimensionne désormais explicitement le graphique quand sa prop `height` change, au lieu
de dépendre uniquement du `ResizeObserver`.
