# ADR 0005 — Décisions techniques non prévues par le plan, Phase 6 (interface)

Le détail complet des critères testés et des corrections apportées est dans
`reports/validation.md` (section Phase 6 et son addendum §5bis) ; ce document se concentre sur
les choix d'implémentation eux-mêmes, écrits avant/pendant l'implémentation comme demandé par
`CLAUDE.md`.

## 1. Éventail (§11.5) : points discrets, jamais un ruban lissé

Le mockup ASCII du plan (§11.2) dessine l'éventail comme une courbe continue. Le backend
n'expose les réalisations qu'à des horizons discrets (§9 : 1/3/5/10 ans — pas de trajectoire
continue dans les données). `FanChart` ne relie donc que des points réellement calculés
(`connectNulls: false`), plus un point (0,0) à *t*=0 ajouté parce qu'une variation cumulée à
l'horizon 0 vaut 0 par définition, pas par extrapolation. Choix : représenter fidèlement des
données par nature discrètes plutôt que suggérer visuellement une dynamique inter-horizons
inexistante — application directe de la règle 3 (`CLAUDE.md`, zéro extrapolation silencieuse).

## 2. `<Num>` (§12.4bis) : composant centralisé + test statique au lieu d'une règle ESLint

Le plan demande une règle ESLint dédiée forçant tout affichage numérique à passer par
`<Num value unit indicator />`. Une règle ESLint correcte, au niveau AST, distinguant une
position JSX-texte d'un attribut de chaîne (`title=""`) ou d'un callback consommé par un
moteur non-React (formatters ECharts) est un petit projet d'analyse statique en soi. Remplacé
par `tests/numeric-rendering.test.ts` : un scan de `.toFixed()`/`Math.round()` hors de
`Num.tsx`, avec une liste d'exceptions nommément justifiées (même principe que
`tests/vocabulary.test.ts` et `tests/contrast.test.ts`, déjà établi en Phase 5/6). Quatre
catégories d'exceptions documentées dans le test lui-même : formatters ECharts (rendu canvas
interne), attributs `title=""` (chaînes natives), texte presse-papiers (`Table` Ctrl+C→TSV),
arithmétique de pixels pour le redimensionnement des panneaux.

Sous-décision : les libellés `<text>` SVG de `Timeline`/`EventFrieze` ne passent pas par
`<Num>` (qui produit un `<span>` HTML, invalide en contenu SVG) — exception structurelle,
documentée inline à chaque site plutôt que dans l'allowlist du test (ces sites n'appellent pas
`.toFixed()`/`Math.round()`, ils n'y apparaissent donc pas).

## 3. Vecteur d'état de la requête affiché uniquement en mode ancre

§8.2.5 exige le double affichage (valeur brute + rang) partout où une valeur normalisée
apparaît. Le panneau Scénario affiche maintenant le vecteur d'état de la requête elle-même
(pas seulement celui de chaque analogue retourné), récupéré via `GET /state/{country}/{year}`
et déclenché à partir de `query_echo` (la requête normalisée renvoyée par le serveur), jamais
depuis l'état local du formulaire qui a pu changer depuis la dernière recherche exécutée. Ce
mécanisme ne fonctionne qu'en mode `anchor`, seul mode où pays+année existent au sens de cet
endpoint — les modes `manual`/`shock` n'ont pas d'équivalent (un état hypothétique ou choqué
n'est identifié par aucun (pays, année) réel). Choix : masquer la section plutôt qu'afficher
un état incorrect ou vide qui laisserait croire à un bug. Documenté aussi dans
`docs/limitations.md`.

## 4. Permalien : requête complète encodée en base64 dans `?q=`

Le plan demande que « le permalien reproduise exactement une recherche » sans préciser le
mécanisme. Choix : encoder `AnalogsSearchRequest` complet (pas un sous-ensemble de champs) en
JSON puis base64 dans le paramètre `q` de l'URL, mis à jour via `query_echo` (la requête telle
que normalisée par le serveur, donc fidèle même si le frontend a omis des champs par défaut).
Alternative écartée : des paramètres de requête individuels par champ — plus lisible dans
l'URL, mais fragile dès qu'un champ imbriqué (poids par famille, deltas de choc) doit être
sérialisé, et plus verbeux pour un lien destiné à être partagé tel quel.

## 5. Palette de commande (`Ctrl+K`) : deux motifs, pas d'interprétation floue

Le plan donne deux exemples littéraux (« FRA 2025 », « SWE 1990 vs FIN 1990 ») et un troisième
plus vague (« credit_gap5 »). Choix : reconnaître exactement les deux premiers motifs
(regex strictes), et traiter toute autre saisie comme non reconnue plutôt que de deviner une
intention (ex. sauter vers un panneau de poids si le texte ressemble à un nom de feature) —
conforme à la règle « ne pas deviner en cas d'ambiguïté » plutôt qu'une heuristique qui
échouerait silencieusement sur un cas non prévu.
