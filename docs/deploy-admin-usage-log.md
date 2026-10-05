# Mise en ligne du journal d'usage admin : liste de contrôle et retour arrière

À exécuter **uniquement sur votre feu vert explicite**. Branche : `feature/admin-usage-log`.
Décision : `docs/decisions/0028-journal-d-usage-admin.md`.

## Ce qui change

- Visiteurs : rien de visible. Le navigateur envoie un petit appel anonyme à chaque page ouverte et
  chaque recherche réussie (erreurs ignorées).
- Admin : colonne « Journal d'activité » et carte « Classements » sur `/admin`.
- Base : une table de plus, `usage_events`. Aucune table ni route existante n'est modifiée.

## Danger à connaître (identique à l'ADR 0024)

Le démarrage de l'API exécute `alembic upgrade head` ; la migration s'applique d'elle-même au
déploiement de l'API. **Ne migrez pas la production à la main avant le déploiement du code.** L'ancien
code sur une base à la révision `3c5d9e1b7a42` échoue (`Can't locate revision`) et l'API ne démarre pas.

## Déploiement

1. Fusionner la PR (la CI a déjà tourné sur base vide). Déployer `api` d'abord, puis `web`
   (`render deploys create <srv> --commit <sha> --wait --confirm`).
2. Journal de `api` : `Running upgrade 7a341bae9936 -> 3c5d9e1b7a42`, puis `Application startup complete`.
3. Vérifier : `/admin` affiche le journal (au moins la page ouverte à l'instant) et les classements ;
   une recherche dans l'application apparaît dans le journal dans les 20 s.

## Retour arrière

1. `alembic downgrade 7a341bae9936` contre la base (supprime `usage_events`, rien d'autre).
2. Redéployer le commit précédent (api puis web). Dans l'ordre inverse, l'API échoue au démarrage.
   Le frontend ancien ne contient aucun appel vers la nouvelle route : l'ordre web/api est sans risque
   pour les visiteurs dans ce sens.
