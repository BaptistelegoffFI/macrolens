# ADR 0030 — Système de conception unique

Audit UX (docs/ux/audit.md) : 8 tailles de police pour 6 rôles, 39 combinaisons de `padding`,
5 moyens de séparation mélangés au même niveau, trois composants différents pour le même vecteur
d'état, un orange (#B26B00) et un gris de métadonnée qui échouaient WCAG AA, et des textes français
sous l'interface anglaise. Direction artistique inchangée : dense, chiffres en mono, accent bleu
retenu, aspect de terminal de recherche. Aucun arrondi, ombre, dégradé ni couleur décorative.

## Décision

1. **Une source unique** : `src/styles/tokens.css`, chaque jeton avec son rôle documenté.
   - Typographie : deux familles (Plex Sans, Plex Mono) ; six tailles à un rôle chacune — 16 titre de
     page, 13 en-tête de section, 12 corps et donnée, 11 onglets et contrôles, 10 en-tête de colonne,
     10 métadonnée (casse et graisse les distinguent) ; trois graisses (400, 500, 600).
   - Espacement : base 4 px ; cellule 4/8, entre lignes 4, entre sous-sections 16, entre régions
     majeures 32 (nettement plus grand).
   - Séparation, du plus faible au plus fort, un niveau par profondeur : espace < filet fin < filet plein
     < teinte de fond < panneau bordé.
   - Couleur : palette conservée et codifiée (bleu = positif/actif/lien, rouge = négatif/ancre/crise,
     orange = avertissement et caveat seulement, gris = métadonnée). Deux ajustements de luminosité pour
     passer AA : `--flag` #B26B00 → #9A5B00 (5,43:1 sur blanc, 4,62:1 au pire) et `--fg-muted`
     #6B7278 → #646B71 (5,41:1, 4,60:1 au pire).
2. **Des classes partagées, pas de redéclaration** : `typography.module.css` (rôles) et
   `surfaces.module.css` (séparations, encadrés, boutons, puces, champs, pastilles). Les feuilles de
   composants y puisent par `composes`.
3. **Des composants partagés** : `Section` (deux niveaux d'en-tête), `ChartFrame` (en-tête, pied et
   export communs à tous les graphiques), `StateVector` (Scénario, Épisode, Comparateur), `Kbd`
   (raccourcis), `ChartLightbox` (plein écran).
4. **Les nombres, toujours en mono** ; un nombre dans une métadonnée prend la taille de la métadonnée
   (`<Num size="meta">`).
5. **Garde-fous automatiques** : `tests/designSystem.test.ts` refuse toute taille, graisse, famille,
   interlettrage, couleur ou espacement hors échelle dans une feuille, et vérifie les `composes` ;
   `tests/contrast.test.ts` lit les jetons et vérifie AA pour chaque couleur de texte sur chaque surface.

## Ce qui n'a PAS changé

Aucun calcul, contrat d'API, endpoint, donnée, migration ni garantie de déterminisme. Le seul fichier
nouveau sous `src/lib` est `compare.ts` : il trie des rangs percentile déjà affichés pour mettre en
évidence des lignes (aucune métrique nouvelle).

## Traductions

Les définitions d'indicateurs et les licences, noms et citations de sources n'existaient qu'en français
(base de données). Elles sont traduites côté client (`src/i18n/dataStrings.ts`, indexées par code
d'indicateur et identifiant de source, repli sur le texte de l'API) ; `tests/dataStrings.test.ts`
échoue si un indicateur ou une source de `data/reference/` n'a pas de traduction. Texte à relire :
docs/ux/translations-to-review.md.

## Limites

- Le rang percentile `r` et la similarité sont décrits d'après le code (`core/similarity.py`,
  `outcomes_build.py`) ; si leur définition change, leurs infobulles doivent suivre.
- Ctrl+L : géré par l'application ; son interception par le navigateur de bureau n'a pas pu être testée.
- Le remplissage de la grille de couverture est plafonné à 0,7 d'opacité : au-delà, le texte ne passe plus AA.
