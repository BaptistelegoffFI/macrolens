# Mise en ligne des rendements d'actifs : liste de contrôle et retour arrière

À exécuter **uniquement sur votre feu vert explicite**. Rien n'a été poussé, fusionné, déployé ni
migré en production. Branche : `feature/asset-returns`.

## Ce qui change pour les visiteurs

Bloc « Ce qui s'est produit pour les actifs » sous le tableau des analogues (onglet Scénario), onglet
Classes d'actifs (F9), nouveau groupe de séries dans l'Explorateur, nouvelle section dans Sources &
méthode. Les hauteurs des rangées du panneau central sont réinitialisées une fois (une rangée
ajoutée). Aucun endpoint existant ne change : 21 routes et 41 schémas vérifiés à l'octet près.

## Danger à connaître

Le démarrage de l'API exécute `alembic upgrade head && seed && etl run-all && uvicorn`.
- **Ne migrez jamais la base de production à la main avant le déploiement.** L'ancien code lancé sur
  une base à la nouvelle révision échoue (`Can't locate revision identified by '7a341bae9936'`),
  et l'API ne démarre pas. Cela s'est produit pendant les tests locaux. La migration s'applique
  d'elle-même au démarrage de la nouvelle version.
- Une instance gratuite qui se réveille relance cette séquence : tant que le code déployé est
  l'ancien, la base doit rester à `fc77db09a6e1`.

## Avant

1. `make check` vert sur la branche, base locale (fait : 287 tests backend, 191 frontend au dernier
   passage).
2. Noter les points de retour : SHA des déploiements actuels (`render deploys list <service>`) pour
   `macrolens-api` et `macrolens-web`, et la révision de la base (`fc77db09a6e1`, vérifiable en
   lecture seule avec `alembic current` contre l'URL du pooleur de session Supabase).
3. Ouvrir une pull request vers `main` pour faire tourner la CI sur une base vide : elle télécharge
   les sources de zéro. Ne pas fusionner.
4. Optionnel : sauvegarde logique (`pg_dump -Fc`) de la base Supabase.

## Déploiement

1. Fusionner dans `main`. Render peut déployer `api` et `web` en parallèle : si `web` passe en ligne
   avant `api`, le nouveau frontend affiche brièvement « rendements d'actifs indisponibles » sur les
   zones concernées, rien d'autre n'est affecté.
2. Suivre les journaux de `api` : `Running upgrade fc77db09a6e1 -> 7a341bae9936`, puis
   `asset_returns: lignes=8818`, puis `Application startup complete`.
3. Vérifications :
   - `curl -s -X POST <api>/api/v1/scenario/asset-returns -H 'Content-Type: application/json'
     -d '{"analogs":[{"country":"USA","year":1929}],"horizons":[3]}'` : 200, six classes ;
   - `curl <api>/api/v1/series/USA/asset-classes` : 200 ;
   - dans le navigateur : une recherche Scénario affiche le bloc, F9 s'ouvre, l'Explorateur et les
     autres onglets fonctionnent comme avant.

## À surveiller après

- Journal de `api` : une ligne `asset_returns: ECHEC (non bloquant)` signifie que les données
  d'actifs n'ont pas été chargées ; l'application reste en service, les endpoints d'actifs
  répondent 503 et l'interface dégrade (notice), rien d'autre ne casse.
- Temps de démarrage à froid : environ +1 s.
- Taux de 5xx sur `/scenario/asset-returns` et `/series/*/asset-classes`.
- Taille de la base : environ 8 800 lignes ajoutées, négligeable.

## Retour arrière

**Problème côté interface seulement** : redéployer le commit précédent de `macrolens-web`
(`render deploys create <web> --commit <sha>`). L'ancien frontend fonctionne avec la nouvelle API.

**Problème côté API ou base** : l'ordre compte.
1. Redescendre la base **d'abord**, depuis un poste avec la branche :
   `cd backend && DATABASE_URL=<URL pooleur Supabase> uv run alembic downgrade fc77db09a6e1`.
   Supprime `asset_observations` et `asset_series` (leur contenu se reconstruit avec
   `macrolens etl run-all`).
2. Puis redéployer le commit précédent de `macrolens-api`.
Redéployer l'ancien code avant de redescendre la base échouerait au démarrage (voir plus haut).
Entre les deux étapes, les endpoints d'actifs répondent 503 (tables absentes) sans toucher au reste.

Procédure de montée et de descente testée sur une base jetable : schéma des tables existantes
identique avant, après montée et après descente.
