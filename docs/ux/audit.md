# Audit UX de MacroLens — état avant refonte

Branche `feature/ux-system` (depuis `main` ee38845). Aucun code modifié à ce stade : ce document et
les captures `docs/ux/before/` sont les seuls ajouts. Mesures faites sur l'application locale
(Chrome, langue EN sauf mention), aux largeurs 1280, 1680 et 2560 px, sept onglets chacun.

Sources de la mesure : inventaire statique des 28 feuilles CSS et des styles en ligne ; styles calculés
du DOM rendu, onglet par onglet ; captures plein format ; ratios de contraste calculés d'après les
jetons ; test des raccourcis clavier ; recherche des textes dans la mauvaise langue.

## 1. Constat global

Le système existe déjà en germe (`styles/tokens.css`, polices Plex Sans/Mono, filets 1 px, jetons de
surface) mais **les composants n'en consomment qu'une petite partie** : la majorité des tailles,
espacements et graisses sont écrits en dur dans chaque feuille.

| Dimension | Variantes constatées | Rôles sémantiques réels |
|---|---|---|
| Tailles de police (CSS) | **9, 10, 11, 12, 13, 15, 16, 20 px** + 3 jetons (10, 12, 13) ; dans les graphiques ECharts 9, 11 ; styles en ligne 9, 11, 14, 16 | 6 |
| Combinaisons famille/taille/graisse/casse/interlettrage rendues | **17** sur Scénario, 12 Épisode, 11 Classes d'actifs, 10 Séries, 9 Couverture, 9 Sources | ~6 |
| Graisses | 400, 500, 600 déclarées ; **700 en pratique** (les `<th>` héritent du gras du navigateur) → 4 | 3 |
| Valeurs de `gap` | 2, 4, 6, 8, 10, 12, 14, 16 (8 valeurs) | 4 |
| Valeurs de `padding` (combinaisons) | **39** | ~5 |
| Valeurs de `margin` (combinaisons) | **16**, dont 13 px (marges par défaut du navigateur non remises à zéro sur la page Sources) | ~4 |
| Interlettrage | 0, 0,02, 0,03, 0,04 em | 1 |
| Moyens de séparation | filet `--rule` (56 usages), filet `--rule-light` (29), bordure 2 px accent/flag/rule (6), fond `--bg-chrome` (26), `--bg-row-alt`, `--bg-selected`, `--bg-hover`, panneau bordé + rembourré (Séries, Classes d'actifs) | 5 |
| Largeurs de contenu | colonne centrale de Scénario **figée à 760 px** ; Sources 868 px ; Classes d'actifs sans plafond ; avertissements jusqu'à 1540 px | 2 règles |

Conclusion : conformément à votre attente, nous avons environ **trois fois plus de variantes que de
rôles**. Rien d'irréparable : presque toutes les variantes sont des quasi-doublons (10 / 11 / 12 px
pour le même rôle de libellé, 6 / 8 / 10 px pour le même espacement).

## 2. Polices

Deux familles seulement, c'est bon : **IBM Plex Sans** (prose, libellés) et **IBM Plex Mono**
(chiffres, codes pays, années, raccourcis). Aucune troisième famille.

Les écarts à la règle « tous les nombres en mono, jamais deux familles dans une colonne » :

| Page | Nombres rendus en sans | Exemples |
|---|---|---|
| Scénario | 54 | « N = 20 sur 20 » ×18, « 20 sur 20 positifs », « Δ 2y », « 5y gap » |
| Épisode | 15 | années de la frise d'événements (texte SVG) |
| Séries | 7 | « Base 100 », « Countries (6) » |
| Compare | 10 | `debt_delta5`, `credit_gap5`… (codes bruts) |
| Sources | 47 | dates de consultation, `sha256 …`, citations |
| Classes d'actifs | 17 | « 1950 to 2020 » ×7, « real index, base 100 » |

Cellule à deux familles dans une même colonne : le bloc des rendements d'actifs (médiane mono, `IQR`
sans, valeurs mono, `N =` sans), la colonne Couverture des Classes d'actifs (années mono sur la
ligne principale, années sans sur la ligne secondaire), la ligne de métadonnées des cartes de Sources
(`priority 100` en mono au milieu d'une phrase en sans).

## 3. Échelle typographique actuelle, rôle par rôle

| Rôle réel | Rendu actuel (variantes) | Où |
|---|---|---|
| Titre d'application | sans 12/400 | barre de titre |
| Onglets | sans 11/400 + raccourci mono 10 | barre d'onglets |
| Titre de panneau | sans 10/400 MAJ 0,4 px | Panel (Scénario, Analogues…) |
| Titre de section | **5 variantes** : 12/600 MAJ 0,48 (Séries, Classes d'actifs), 11/400 MAJ 0,44 (Sources, frise Épisode, « Timeline »), 11/600 (« Ce qui s'est produit… »), 12/600 gras sans MAJ, mono 12 MAJ (titre du graphique en éventail) | pages |
| En-tête de colonne | **4 variantes** : 10/700 MAJ (analogues), 10/600 MAJ (actifs), 11/700 sans MAJ (Couverture), 10/600 MAJ (Classes d'actifs) | tableaux |
| Corps / donnée | sans 11, sans 12, mono 12, mono 11 | partout |
| Métadonnée | sans 10, sans 9, mono 9, mono 10 | N, IQR, fenêtres, provenance, badges `T1` |
| Chiffre en vedette | mono 15 (médiane des rendements), 20 (admin) | blocs |
| Texte d'avertissement | sans 11/400 orange, sans 10 orange | avertissements, caveat immobilier |

La taille 9 px est présente sur 6 règles (axes de graphique, badge `T1`, pied du graphique) : elle est
sous le seuil de lisibilité même quand le contraste est suffisant.

## 4. Espacements

Écarts entre sections : `gap` 2/4/6/8/10/12/14/16, `padding` de conteneurs 4/6/8/10/12/14/16/32 px,
marges 2/3/4/6/8/10/12/13/16/24. Les valeurs hors échelle 4 px sont nombreuses : 2, 3, 6, 10, 13, 14.

La distinction exigée « entre régions majeures plus grand qu'entre sous-sections » n'est pas lisible :
entre la table des analogues, le graphique en éventail, la frise et le bloc des actifs, l'espace est
de 0 (les rangées se touchent, séparées par un filet) ; entre sous-sections d'un panneau c'est 6 à 12 px.

## 5. Séparations (filets, fonds, panneaux)

Sur la même profondeur d'imbrication, plusieurs moyens se mélangent :

- Scénario : le panneau a un en-tête `bg-chrome` + filet, le bloc des actifs un filet haut 1 px, la
  section « Immobilier » un fond `bg-chrome` **et** un filet 2 px, les avertissements un liseré orange
  2 px sur fond blanc.
- Séries et Classes d'actifs utilisent des **cartes bordées et rembourrées** (bordure + fond chrome +
  16 px) que le reste de l'application n'emploie pas (les autres pages sont des panneaux à bandeau).
- Les lignes de tableau alternent `--rule-light` (entre lignes) et `--rule` (entre groupes) sans règle
  constante ; Coverage utilise une bordure par cellule.

## 6. Même élément sémantique, rendu différent selon la page

| Élément | Variantes |
|---|---|
| **Ligne du vecteur d'état** | Scénario : libellé court (« Infl. ») + valeur mono 12 + `r=` gris ; Épisode : **code brut** (`infl_level`) ; Compare : **code brut** + ligne bordée de 24 px, sans groupes. Trois composants, trois libellés, trois groupements |
| Groupes du vecteur d'état | Scénario : 7 groupes (PRICES…EXTERNAL) ; Épisode et Compare : liste plate |
| Boutons | puces segmentées de la barre d'outils, « + Add / Compare » (bordure + texte accent), puces Séries/Tiers, « Expand » (bordure + accent), « Export PNG » (lien sans bordure 9 px) vs « Export CSV » (bordé), **« Données utilisées (200) » (un bouton rendu comme un champ de saisie mono, étiré sur toute la colonne)** |
| Titre de graphique | texte ECharts dans le canvas (éventail), `<div>` mono MAJ (Épisode), `<div>` sans 9 px (Compare) |
| États vides | composant `EmptyState`, texte en ligne, ligne de tableau « Chargement… » |
| Badge d'indice | `T1` (mono 9, bordé), `INDEX` (sans 10 MAJ, bordé fond tinté) |
| Libellé de couple | « SWE1991 » (Compare, sans espace) vs « SWE 1991 » (journal admin, rendements d'actifs) |
| Marqueur de crise | rond rouge `●` (Scénario) ; losange rouge (frise Épisode) |

## 7. Langue : français sous l'anglais, anglais sous le français

L'interface elle-même est correctement centralisée (`i18n/strings.ts`, aucun libellé en dur dans les
composants). Les fuites viennent **des champs que l'API renvoie en une seule langue** :

| Où | Texte en français avec EN actif | Origine |
|---|---|---|
| Sources & méthode | « Usage non commercial, attribution obligatoire… », « Publication de banque centrale, réutilisation avec attribution », « Réutilisation avec attribution, conditions BIS/IMF/OECD… », « Réutilisation libre… (CC BY 4.0) », « Données de recherche académique… », « N/A — curation interne… » : **les 16 cartes** | `sources.yaml` → base → champ `licence`, français uniquement |
| Sources & méthode | « Fichiers YAML du dépôt — événements curés manuellement », « Curation interne MacroLens… », « Reinhart & Rogoff — chronologie des crises » | champs `nom` et `notes` des sources |
| Couverture | **24 infobulles** de définition d'indicateur (« Produit intérieur brut valorisé aux prix de l'année courante… ») | `indicators.yaml` → `definition_fr` : **il n'existe aucune version anglaise nulle part** |
| Vecteur d'état (Épisode, Compare) | codes bruts `infl_level`, `rate_short_real`… dans les deux langues | libellés de `lib/features.ts` non utilisés |

En FR actif, je n'ai trouvé aucune fuite d'anglais dans les libellés d'interface ; les noms et citations
bibliographiques de sources sont en anglais par nature (titres d'ouvrages). Les avertissements du moteur
sont déjà traduits côté client depuis la PR 5.

Le correctif ne demande **aucun changement de données ni d'API** : des tables bilingues côté client,
indexées par identifiants stables (code d'indicateur, identifiant de source, chaîne de licence), avec
repli sur le texte de l'API. La rédaction des 24 définitions et des ~9 licences en anglais est du contenu :
à relire par vous (voir questions).

## 8. Comportement selon la largeur (1280 / 1680 / 2560)

| Page | 1280 | 2560 | Défaut |
|---|---|---|---|
| Scénario | colonnes 220 / 760 / reste | colonnes 220 / **760** / **1580 px** vides ; le bouton « Données utilisées » s'étire à 1200 px ; avertissements sur 1540 px de long | la colonne centrale est figée, c'est la colonne de droite qui absorbe la largeur |
| Épisode | 10 graphiques de 331×150 | 10 graphiques **317×150** (7 colonnes) ; **544 px de vide** sous la frise | hauteur des graphiques figée à 150, aucune croissance |
| Séries | graphique 898×280 | graphique **2178×280** sur une zone de 1300 px de haut, tableau poussé en bas | le canvas ne remplit pas sa zone |
| Compare | 2 colonnes de 640 | **1159 px de vide** (état vide) ; 659 px à 1280 | idem Épisode |
| Couverture | tient | 528 px de vide sous la grille | acceptable (page la plus proche du but) |
| Sources | cartes de 868 px calées à gauche | cartes de 868 px, **plus de 1500 px vides** à droite, 16 cartes de poids égal | pas de plafond centré, pas de hiérarchie |
| Classes d'actifs | colonnes serrées | colonnes **LEVEL / CHANGE / ANNUALISED écartées de 400 px**, 542 px de vide dessous | tableau sans largeur maximale |

Défilements imbriqués (zone qui défile dans une zone qui défile) :
- **Séries** : le panneau de contrôles (662 px sur 1197) contient **deux listes** qui défilent seules
  (séries superposées 318/794, pays 318/408). C'est la liste des pays, le contrôle le plus utilisé,
  qui est tout en bas.
- **Scénario** : la rangée du tableau des analogues défile (240/507) à l'intérieur d'un panneau qui
  défile (670/1568), lui-même à côté du panneau de gauche qui défile (670/883).

## 9. Couleur et contraste (WCAG AA, 4,5:1)

| Jeton | blanc | chrome | row-alt | selected | hover |
|---|---|---|---|---|---|
| `--fg-secondary` #5a6169 | 6,27 | 5,75 | 6,05 | 5,34 | 5,67 |
| `--fg-muted` #6b7278 | 4,88 | **4,47** | 4,71 | **4,15** | **4,42** |
| `--flag` (orange) #b26b00 | **4,20** | **3,85** | **4,06** | **3,58** | **3,80** |
| `--accent`/`--pos` | 6,57 | 6,02 | 6,35 | 5,59 | 5,95 |
| `--neg`/`--crisis` | 6,55 | 6,00 | 6,33 | 5,58 | 5,93 |
| `--axis` #8b9298 (non textuel, seuil 3:1) | 3,15 | 2,89 | 3,04 | 2,68 | 2,85 |

- **L'orange échoue partout** (4,20 sur blanc) alors qu'il porte précisément les avertissements et les
  caveats (immobilier, drapeaux ⚑), c'est-à-dire de l'information à ne pas manquer.
- Le gris de métadonnée échoue sur les surfaces teintées (chrome, sélection, survol).
- Ajustement minimal proposé, même méthode que le commentaire existant de `tokens.css` : `--flag` →
  `#9a5b00` (5,43 sur blanc, 4,62 minimum) ; `--fg-muted` → `#646b71` (5,41 / 4,60 minimum). La teinte
  reste dans la même famille, seule la luminosité baisse.
- `--axis` n'est utilisé que pour les graduations de graphique, non textuel : conforme.

Sémantique actuelle des couleurs, à codifier : bleu = rendement positif **et** état actif **et** liens
(trois sens) ; rouge = négatif, repère d'ancre, drapeau crise, **et** bouton de suppression et erreurs ;
orange = avertissement, mais aussi le pictogramme « saut de change » dans les cellules ; gris =
métadonnée, mais aussi libellés de champ et en-têtes. Le **marqueur de crise bancaire est un point
rouge seul** : la couleur est son unique porteuse de sens (le « — » de l'absence de crise est en gris).

## 10. Explications manquantes (infobulles)

| Élément | Infobulle |
|---|---|
| `r=` (rang percentile, 14 occurrences) | **aucune**, ni légende |
| Badges `T1`/`T2`/`T3` | oui, mais seulement au survol ; pas de légende visible |
| En-tête « BC 10Y » (banking crisis dans les 10 ans) | **aucune** |
| « Données utilisées (200) » | aucune explication de ce que contient le bordereau |

## 11. Clavier

Test automatisé de chaque raccourci annoncé : **F2, F3, F4, F6, F7, F8, F9 changent bien d'onglet ;
F5 lance la recherche ; Ctrl+K ouvre la palette.** Ctrl+L est géré par l'application, mais je ne peux
pas confirmer en navigateur réel que le navigateur ne le capte pas pour la barre d'adresse (Chrome le
laisse à la page, Safari à vérifier). Les raccourcis sont écrits de deux façons : `F2` en mono 10 px dans
l'onglet, mais « [F5] » et « [Ctrl+L] » entre crochets, en sans, dans le libellé des boutons.

## 12. Barre d'état

Très bien, à conserver. Elle est identique sur les sept onglets (mono 11, séparateurs en `·`). Un seul
défaut : elle affiche les chiffres de la dernière recherche Scénario même sur Couverture, Sources et
Classes d'actifs où ils n'ont pas de sens ; je la laisserai telle quelle (c'est son rôle de « signature »)
sauf avis contraire.

## 13. Par page : constats et correctif prévu

**Scénario** — une seule pile non hiérarchisée (tableau, éventail, frise, actifs, sans titre de groupe) ;
colonne centrale figée à 760 px ; état à gauche en liste ; `r=` inexpliqué ; cellule d'actif à quatre
lignes de poids quasi égal ; colonne de droite sans statut clair.
Prévu : deux groupes titrés (« 1 · La correspondance » : tableau ; « 2 · Ce qui s'est passé ensuite » :
éventail, frise, rendements d'actifs), colonne centrale fluide, colonne de droite en **barre latérale
assumée** à largeur fixe, médiane dominante dans les cellules, légende de `r=`/`T1`/`BC`.

**Épisode** — grille de 150 px de haut, 544 px de vide au-dessous, boutons « Expand » ;
Prévu : grille responsive (colonnes et hauteur selon la largeur et la hauteur disponibles), vecteur
d'état = le même composant que Scénario, « Expand » remplacé par un affichage plein écran.

**Séries** — chart de 280 px dans une zone qui en fait 1300 ; listes imbriquées qui défilent ;
Prévu : graphique qui remplit la hauteur, tableau des séries ancré en bas, contrôles principaux
(indicateur, pays, période) en haut du panneau, liste des séries en accordéon sans défilement propre.

**Compare** — deltas invisibles, codes bruts, vide.
Prévu : surlignage de la ligne selon l'écart de rang percentile (`r`) entre les deux épisodes (donnée déjà
affichée, aucune métrique nouvelle), mêmes libellés et groupes que Scénario, graphiques responsives.

**Couverture** — conservée ; jetons partagés ; en-têtes de décennies et légende alignés sur le système ;
infobulles traduites.

**Sources & méthode** — licences en français sous titres anglais ; 16 cartes identiques à 868 px à gauche.
Prévu : traduction de toutes les chaînes, regroupement des cartes par priorité (sources primaires /
complémentaires), largeur de lecture plafonnée et centrée pour la prose.

**Classes d'actifs** — tout replié, colonnes écartées, exclusion du capital-investissement en gris
italique de pied de page.
Prévu : déploiement par défaut des classes principales, largeur maximale du tableau, la ligne
« capital-investissement et dette privée — exclus » promue en bloc d'énoncé (filet accent, texte plein).

## 14. Jetons proposés (aperçu de l'étape 2, rien n'est encore écrit)

Typographie (6 tailles) : 16 titre · 13 en-tête de section · 12 corps et donnée · 11 barre d'onglets et
contrôles · 10 en-tête de colonne (MAJ, interlettrage) · 10 métadonnée (casse normale, gris).
La taille 9 disparaît, ainsi que 15 et 20 (le chiffre de la médiane des actifs passe à la taille
corps en gras via la graisse, pas via une taille supplémentaire). Graisses : 400, 500, 600.

Espacement (base 4 px) : cellule 4 / 8 · entre lignes 4 · entre sous-sections 16 · entre régions
majeures 32. Aucune valeur hors échelle dans les composants.

Séparation, du plus faible au plus fort, **un niveau par profondeur** : espace → filet fin
(`--rule-light`, entre lignes) → filet plein (`--rule`, entre sections) → teinte de fond
(`--bg-chrome`, bandeaux et caveats) → panneau bordé (uniquement les colonnes de premier niveau et les
fenêtres flottantes).

Largeur : texte de lecture plafonné à 72 caractères (`max-width: 72ch`) ; tableaux et graphiques
utilisent toute la largeur disponible.

## 15. Questions qui bloquent ou orientent la suite

1. **Traductions** : j'écrirai les 24 définitions d'indicateurs et ~9 licences en anglais côté client
   (aucun changement de données ni d'API). Voulez-vous les relire avant publication ? Je les listerai dans
   un fichier à valider.
2. **Orange et gris** : j'ajuste `--flag` et `--fg-muted` d'un cran de luminosité pour passer AA
   (aucune autre couleur ne bouge). D'accord ?
3. **Échelle** : le brief demande six tailles à six rôles distincts ; « en-tête de colonne » et
   « métadonnée » partagent 10 px et se distinguent par la casse et la graisse. Pour les séparer
   strictement il faudrait faire passer la métadonnée à 11 px, la même taille que la barre d'onglets.
   Je recommande de garder 10 px pour les deux.
4. **Scénario** : « 1 · La correspondance / 2 · Ce qui s'est passé ensuite » et la colonne de droite en
   barre latérale fixe vous conviennent-ils ?
5. **Ctrl+L** : à vérifier par vous dans Safari et Chrome ; je ne peux pas le tester dans un vrai
   navigateur de bureau.

Rien n'a été déployé, aucun code de calcul, de contrat d'API ou de déterminisme n'a été touché.
