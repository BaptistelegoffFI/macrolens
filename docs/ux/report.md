# Passe UX de MacroLens : rapport

Branche `feature/ux-system` (depuis `main` ee38845). **Rien n'est fusionné, rien n'est déployé.**
Audit initial : [audit.md](audit.md). Décision : [ADR 0030](../decisions/0030-systeme-de-conception.md).
Captures avant/après : [before-after.md](before-after.md). Traductions à relire :
[translations-to-review.md](translations-to-review.md).

## 1. Résultat, mesuré sur le build de production

| | Avant | Après |
|---|---|---|
| Tailles de police (CSS) | 9, 10, 11, 12, 13, 15, 16, 20 px (8) | **10, 11, 12, 13, 16 px (5)**, une seule déclaration chacune |
| Graisses rendues | 400, 500, 600, **700** | **400, 500, 600** |
| Familles | 2 | 2 (mono pour les nombres) |
| Combinaisons de style par page | 17 / 12 / 11 / 10 / 9 / 9 | 14 / 8 / 11 / 7 / 7 / 10 |
| `gap` | 2, 4, 6, 8, 10, 12, 14, 16 | **4, 8, 12, 16, 32** |
| `padding` en CSS | 39 combinaisons, valeurs 3/6/10/14… | tokens ; test refuse tout px hors multiple de 4 |
| Moyens de séparation | 5 mélangés au même niveau | hiérarchie nommée, un niveau par profondeur |
| Textes en français sous EN | 16 licences, 24 infobulles, 3 noms/citations | **0** (vérifié dans les deux sens, 7 onglets) |
| Contraste AA | orange 4,20:1, gris 4,15:1 sur surfaces teintées | **0 échec sur 1 957 textes rendus, pire 4,60:1** |
| Infobulle de `r=`, `BC`, `T1` | 0 / 0 / oui | 14 sur 14 / oui / oui, plus légendes visibles |
| Raccourcis F2-F9, F5, Ctrl+K | fonctionnent, 2 styles d'écriture | fonctionnent, un composant `Kbd` |

Les résidus de l'inventaire automatique (marges de 2 et 3 px, rembourrage de 1 px) viennent des
contrôles natifs du navigateur (cases à cocher, boutons), pas des feuilles du projet.

## 2. Le fichier de jetons

`frontend/src/styles/tokens.css`, source unique, chaque jeton avec son rôle en commentaire.
Complété par `styles/typography.module.css` (six rôles de texte, `.num` pour les nombres) et
`styles/surfaces.module.css` (séparations, encadrés, boutons, puces, segments, champs, pastilles).
Ces deux fichiers et `base.css` sont dans des couches CSS (`@layer base, system`) : une règle de
composant gagne toujours sur une règle partagée, quel que soit l'ordre de chargement.

## 3. Page par page : ce qui a changé et pourquoi

**Scénario.** Une seule pile à plat devenait deux groupes titrés : « 1 · La correspondance » (tableau,
légende, chronologie des analogues) puis « 2 · Ce qui s'est passé ensuite » (éventail, rendements
d'actifs). La colonne centrale n'est plus figée à 760 px (elle fluctue, les deux côtés sont fixes) et il
n'y a plus qu'un défilement. La colonne de droite est assumée comme **barre latérale** (avertissements
au-dessus, provenance dessous). Vecteur d'état : en-têtes de groupe teintés qui ne rivalisent plus avec
les valeurs ; `r=` expliqué par infobulle et légende d'une ligne ; `T1`, `Sim.`, `ΔPIB`, `CB 10a`
expliqués (infobulle d'en-tête + légende sous le tableau) ; le point de crise bancaire a un libellé
accessible. Cellules d'actifs : la médiane domine (12 px, gras, couleur de signe), IQR, N et fréquence
de réussite passent en métadonnées (10 px, gris, mono). Le bouton « Données utilisées » est un vrai
bouton.

**Épisode.** La grille s'étire pour remplir la hauteur (rangées `1fr`, jamais sous 220 px) et le nombre
de colonnes suit la largeur : plus de zone morte de 544 px à 2560. « Agrandir » est devenu « Plein
écran » (boîte de dialogue, Échap pour fermer). La liste d'état est le même composant que Scénario :
mêmes libellés (plus de `infl_level`), mêmes groupes.

**Explorateur de séries.** Les contrôles sont une barre en haut (indicateur, période, échelle, pays) :
tout est atteignable sans défiler. Les pays sont des puces compactes (nom complet au survol) ; les séries
superposées sont dans un bloc replié par défaut, sans zone qui défile dans une zone qui défile. Le
graphique remplit toute la hauteur restante (mini 320 px) et le tableau des séries est ancré dessous.

**Comparateur.** Les trois variables dont le rang percentile diverge le plus entre les épisodes sont
surlignées sur toutes les colonnes (`lib/compare.ts`, testé : on trie des rangs déjà affichés, aucune
métrique nouvelle). Mêmes libellés et groupes que Scénario. La liste d'état et les courbes se placent
côte à côte quand la colonne est large ; les courbes grandissent avec la hauteur.

**Couverture.** Conservée. Jetons partagés, en-têtes de décennies et légende alignés, infobulles de
définition traduites. Seule retouche visuelle : le remplissage est plafonné à 0,7 d'opacité, parce qu'à
pleine intensité ni le texte sombre ni le texte blanc ne passe 4,5:1 dans la plage 76-84 %.

**Sources et méthode.** Toutes les licences, noms et citations suivent la langue. Les seize cartes sont
regroupées par priorité (primaires, complémentaires, appui) avec un poids décroissant, en grille. La
prose est plafonnée à 72 caractères ; les en-têtes de page et de section viennent de `Section`.

**Classes d'actifs.** Contrôles en barre (comme Séries), tableau plafonné à 1280 px : LEVEL/CHANGE/
ANNUALISED restent près de leur libellé. Un groupe entièrement non ingéré affiche « 8 séries non
disponibles (tiers 2 et 3, non ingérés) » au lieu de paraître vide. « Capital-investissement et dette
privée : exclus » est un encadré à liseré d'accent, texte plein, avec sa raison, pas une ligne grise.

**Transverse.** Largeur de lecture plafonnée (prose) alors que tableaux et graphiques gardent toute la
largeur ; barre d'état inchangée dans son contenu (séparateurs en contenu CSS) ; raccourcis écrits par
un seul composant ; infobulles et légendes ; chaque graphique a le même cadre (titre, unité, pied, export).

## 4. Vérifications

- `make check` : vert (backend 314 tests, frontend 551 tests, dont `designSystem.test.ts`).
- Build de production : vert ; toutes les mesures ci-dessus sont faites dessus (Chrome, 1280/1680/2560).
- Langues : 7 onglets × FR et EN, aucun texte de l'autre langue ; mise en page FR à 1280 sans rupture.
- Contraste : 1 957 textes rendus, 0 sous 4,5:1 (pire 4,60:1).
- Raccourcis : F2, F3, F4, F6, F7, F8, F9 changent d'onglet, F5 lance la recherche, Ctrl+K ouvre la palette.

## 5. Confirmation : ce qui n'a pas été touché

`git diff main -- backend data frontend/src/api` est **vide** : aucun calcul, contrat d'API, endpoint,
migration, donnée ni garantie de déterminisme. Les fichiers de calcul du frontend (`lib/seriesScale.ts`,
`lib/features.ts`, `lib/assetReturns.ts`…) sont inchangés. Seul ajout sous `lib/` : `compare.ts`,
qui ordonne des rangs percentile déjà affichés pour décider quelles lignes surligner.

## 6. Points à connaître avant de publier

1. **Traductions** : 26 définitions d'indicateurs et 16 sources sont écrites en anglais (contenu) :
   [translations-to-review.md](translations-to-review.md). Une note interne (`higher_is_worse`) qui fuit
   dans la définition française de l'inflation est omise de la version anglaise.
2. **Ctrl+L** : géré par l'application, mais je n'ai pas pu vérifier que Safari ou Chrome ne le captent pas
   pour la barre d'adresse.
3. **Mises en page mémorisées** : les largeurs de colonnes de Scénario et d'Épisode changent de clé
   (`.v2`) ; les visiteurs qui reviennent retrouvent la disposition par défaut, une fois.
4. **Serveur de développement Vite** : il injecte les feuilles partagées en plusieurs exemplaires, et
   certaines surcharges locales y perdent leur priorité. Le build de production, qui est ce que voient
   les visiteurs, est correct (vérifié sur les 8 cas de surcharge). Les captures sont issues du build.
5. **Le bloc « séries superposées »** de l'explorateur est replié par défaut : ce choix libère la
   hauteur du graphique ; il demande un clic pour superposer.
6. **Annulation** : web seul, sans migration ni donnée. Revenir en arrière = annuler la fusion et
   redéployer le web.
