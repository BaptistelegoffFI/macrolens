# ADR 0025 — Frise d'événements de l'onglet Épisode

L'ancienne frise bornait son axe à l'ancre ±10 ans et listait en texte, collés au bord gauche, tous
les événements antérieurs. Elle recevait en outre une liste incohérente : l'API de l'épisode ne
renvoie que les événements proches de la fenêtre, avec une exception pour les événements ponctuels
anciens (sans date de fin), d'où 1878 et 1907 présents mais ni la Première Guerre mondiale ni 2008.

## Décision

- **Source** : `GET /events?country=XXX` (endpoint existant, global compris), appelé par la vue
  Épisode. L'API de l'épisode n'est pas modifiée ; ses événements ne servent plus qu'en repli si cet
  appel échoue, pour que la page n'en dépende jamais.
- **Axe** : de la décennie du premier événement à celle du dernier, ancre et fenêtre incluses
  (étendue minimale de 30 ans). Graduations rondes choisies selon la largeur (`niceStep`).
- **Couloirs par type** : crises bancaires, guerres, régimes monétaires et politiques, chocs
  pétroliers, autres ; un couloir sans événement n'est pas dessiné. Barre pour une période (au moins
  six mois), repère pour une date.
- **Libellés** : répartis sur des sous-lignes sans chevauchement ; à gauche du repère près du bord
  droit. Les crises bancaires n'affichent que l'année (le couloir et la page disent déjà le reste) ;
  le libellé complet, les dates et la source restent dans l'infobulle.
- **Repères** : l'ancre, et la fenêtre de ±10 ans affichée par les graphiques du dessus.
- La mise en page est dans des fonctions pures (`lib/timelineLayout.ts`) testées à la main ; le
  composant mesure sa largeur et redessine à chaque redimensionnement.

L'ancien composant `EventFrieze` est supprimé.
