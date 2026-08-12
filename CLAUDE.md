# MacroLens — règles permanentes

Moteur de recherche de précédents historiques macro-financiers (1870 → aujourd'hui).
Spécification complète : voir `PLAN.md`. Ce fichier ne contient que les règles qui
s'appliquent à tout le code écrit dans ce dépôt, à toute phase.

1. **Zéro IA dans le produit.** Aucun appel LLM, aucun modèle entraîné, aucune prédiction
   générée. Le moteur est 100 % déterministe : algèbre linéaire, statistiques descriptives,
   SQL. Deux exécutions identiques donnent bit-pour-bit le même résultat.
2. **Zéro chiffre non sourcé.** Toute valeur affichée dans l'interface doit être traçable
   jusqu'à un identifiant de source et une URL. Si une valeur ne peut pas être sourcée, elle
   n'entre pas dans la base.
3. **Zéro extrapolation silencieuse.** Aucune interpolation, aucun remplissage de trou, aucun
   raccordement de série sans que l'observation soit marquée d'un flag visible en UI.
4. **On ne prédit jamais.** On répond à « qu'est-ce qui s'est produit, historiquement, dans
   les situations les plus proches de celle-ci ? ». Jamais à « que va-t-il se passer ? ».
   Cette distinction doit être visible dans le vocabulaire du code, des endpoints et de l'UI.
   Les termes `prévision`, `prédiction`, `probabilité que`, `attendu`, `forecast`,
   `expected value` sont interdits hors contexte explicatif whitelisté, et testés (§12.4).
5. **Petit n assumé.** Le nombre d'analogues est toujours affiché. Aucun intervalle de
   confiance paramétrique. On montre la distribution empirique complète et la liste
   nominative des épisodes, jamais une moyenne isolée.
6. **Tout est testé.** Chaque transformation de données a un test avec des valeurs attendues
   écrites à la main. Le moteur de similarité a des tests de non-régression sur des cas connus.
7. **Aucune valeur n'entre en base sans `raw_file_id` et `locator`.** Un chiffre dont on ne
   sait pas dire la page n'est pas une donnée (voir §18 du plan — traçabilité).

## Contraintes d'architecture

- `backend/macrolens/core/` est du code métier pur : aucune I/O, ni base de données, ni HTTP,
  ni pandas en signature publique. Il prend des tableaux numpy et des dataclasses, il rend des
  dataclasses. Vérifié par un test d'import qui échoue si `core/` importe `sqlalchemy` ou
  `fastapi`.
- Le panel de features (~2 600 × 14 flottants) est chargé en mémoire au démarrage de l'API.
  Aucun index vectoriel, aucune base vectorielle, aucun service de calcul séparé : le volume
  est trop petit pour le justifier.
- Migrations Alembic obligatoires. Pas de DDL manuel.

## Interdits explicites (UI, revue de code bloquante)

`border-radius` > 2px, `box-shadow`, dégradés, glassmorphism, animations > 120 ms, emoji,
icônes rondes, cartes flottantes, page d'accueil marketing. Référence visuelle : Macrobond /
terminal Bloomberg, pas un produit SaaS grand public. Voir §11 du plan pour le détail complet
des jetons de conception.

## Ne pas passer à la phase suivante

Chaque phase du plan (§13) a des critères d'acceptation vérifiables. Ne pas commencer la
phase N+1 tant que les critères de la phase N ne sont pas tous validés. En cas d'ambiguïté
dans le plan, ne pas deviner : poser la question. Toute décision technique non prévue par le
plan est écrite dans `docs/decisions/` avant d'être implémentée.
