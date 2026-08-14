# ADR 0006 — Retrait de la barre de menus, interface bilingue FR/EN

Décision demandée directement par l'utilisateur (hors plan) : retirer la barre de menus
(Fichier/Édition/Données/Fenêtre/Aide) et permettre de choisir la langue de l'outil, français ou
anglais.

## 1. Retrait de la barre de menus plutôt que son implémentation

La barre de menus (§11.2) n'a jamais eu de menus déroulants fonctionnels — `docs/limitations.md`
le documentait déjà comme un manque connu depuis la Phase 6. Plutôt que de continuer à
l'afficher inerte (des libellés cliquables qui ne font rien), elle est retirée. Remplacée par
`components/shell/TitleBar.tsx` : le titre de l'application et le nouveau sélecteur de langue,
seul élément qui avait réellement besoin d'une place dans le chrome permanent de la fenêtre.

## 2. Portée du bilinguisme : chrome applicatif, pas tout le texte affiché

Choix scopé délibérément, pas une traduction totale :

- **Traduit** : tout le chrome (barre d'outils, barre d'état, onglets de vues, palette de
  commande, en-têtes de tableau, libellés de formulaire, états vides, avertissements de
  structure d'interface), les 14 features et 7 familles du vecteur d'état, les 10 indicateurs
  bruts, le résumé méthodologique (§8) de la vue Sources & méthode, les noms de pays/indicateurs/
  événements (déjà bilingues côté backend — `name_fr`/`name_en`, `label_fr`/`label_en` existaient
  déjà dans `data/reference/*.yaml` et étaient exposés par l'API sans jamais être consommés côté
  frontend).
- **Non traduit, documenté** :
  - Les messages d'erreur renvoyés par l'API (détails de validation FastAPI/Pydantic, avertissements
    du moteur — `core/warnings.py`) restent dans la langue du backend (français). Les traduire
    exigerait un système d'i18n côté backend ; hors périmètre d'une demande portant sur « l'outil »
    (l'interface), pas sur l'API.
  - `definition_fr` des indicateurs (infobulle de la vue Couverture) n'a pas de `definition_en` en
    base — seul `label_fr`/`label_en` existait. Ajouter une colonne nécessiterait une migration
    Alembic et 26 traductions pour une simple infobulle ; laissé en français dans les deux langues.
  - Les citations bibliographiques et licences des sources (`SourceOut.citation`/`licence`/
    `full_name`) restent telles que fournies par `sources.yaml` — texte de référence, pas une
    traduction équivalente ne changerait pas leur valeur probante.
  - Les en-têtes de colonnes des exports CSV/TSV/JSON restent fixes (interopérabilité des fichiers
    exportés, pas un affichage à l'écran).
  - Le formatage numérique (séparateur décimal `.`, pas de séparateur de milliers) ne change pas
    avec la langue — `<Num>` (§12.4bis) reste la seule source de rendu numérique dans les deux cas ;
    changer le séparateur décimal par langue aurait dédoublé toute la suite de tests numériques
    pour un gain d'authenticité locale marginal.

## 3. Mécanisme : dictionnaire typé, pas des clés-chaînes

`frontend/src/i18n/strings.ts` exporte un objet `S` où chaque entrée est `{fr, en}` (chaîne fixe
ou fonction paramétrée pour les gabarits comme « Données utilisées (n) »). Les composants
appellent `t(S.section.entree)` via `useLanguage()` (`frontend/src/i18n/LanguageContext.tsx`).
Alternative écartée : un système de clés-chaînes (`t("scenario.search")`) façon `i18next` — une
faute de frappe dans une clé y est un fallback silencieux en production ; avec `S.section.entree`
référencé directement, c'est une erreur de compilation TypeScript. Choix cohérent avec la rigueur
déjà appliquée au reste du projet (`tsc`/`mypy` stricts partout).

Persistance : `localStorage` (`ml.lang`), défaut français (comportement historique inchangé pour
qui ne touche jamais au sélecteur). `document.documentElement.lang` est mis à jour à l'exécution
pour rester correct côté accessibilité/lecteurs d'écran.
