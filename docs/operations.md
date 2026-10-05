# Exploitation — ce qui peut arriver et quoi faire

Hébergement : web et API sur Render (offre gratuite), base sur Supabase (offre gratuite).

## Démarrage de l'API

`alembic upgrade head && macrolens seed && macrolens etl run-all && uvicorn`. Depuis l'ADR 0026,
`etl run-all` ne télécharge rien si les données sont déjà en base : le démarrage dépend seulement de
la base. Les logs doivent contenir « déjà chargée, ingestion ignorée » pour chaque source.

## Situations connues

| Symptôme | Cause | Action |
|---|---|---|
| Premier chargement lent (30-60 s) | Render endort les services inactifs | Aucune : l'interface réessaie seule et affiche un bandeau « le serveur se réveille » |
| API ne démarre pas, erreur de connexion base | Projet Supabase en pause (inactivité ~7 jours) | Le restaurer dans le tableau de bord Supabase ; le contrôle planifié `uptime.yml` l'évite en l'interrogeant plusieurs fois par jour |
| API ne démarre pas, « Can't locate revision » | Ancien code sur une base migrée | Voir `docs/deploy-asset-returns.md` : `alembic downgrade` avant de redéployer l'ancien commit |
| Contrôle planifié désactivé | GitHub désactive les workflows planifiés d'un dépôt public après 60 jours sans activité | Réactiver depuis l'onglet Actions |
| Page blanche | Bundle ancien en cache ou erreur de chargement | Recharger ; l'interface affiche un message de repli avec bouton de rechargement |

## Contrôle planifié

`.github/workflows/uptime.yml` interroge le site web, `/health`, `/api/v1/status`, une recherche
et l'endpoint des rendements d'actifs, avec nouvelles tentatives (le réveil prend jusqu'à une
minute). Un échec fait échouer le workflow, donc GitHub envoie une notification.
