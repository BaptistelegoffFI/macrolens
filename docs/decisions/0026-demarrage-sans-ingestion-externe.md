# ADR 0026 — Démarrage de l'API sans dépendance aux sources externes

La commande de démarrage en production est `alembic upgrade head && seed && etl run-all && uvicorn`,
rejouée à chaque (re)démarrage, y compris chaque réveil du service gratuit après inactivité. Avant
cette décision, `etl run-all` re-téléchargeait les sources absentes du disque (le disque de Render
est éphémère) : une indisponibilité de JST, de la BIS ou de Maddison au moment d'un réveil
empêchait l'API de démarrer, alors que la base contenait déjà toutes les données. La CI a montré le
même défaut (timeouts réseau sur l'étape d'ingestion).

## Décision

- **Une source déjà chargée n'est pas rejouée.** « Chargée » = fichier brut enregistré pour le
  vintage ET observations présentes pour la source. Un fichier enregistré sans observations
  (ingestion interrompue) compte comme non chargé et est rejoué. Même règle pour les rendements
  d'actifs (`asset_returns.is_loaded` : catalogue enregistré et lignes présentes).
- **`etl run-all --refresh` force le rejeu complet** ; `make etl` et `scripts/refresh_annual.sh`
  l'utilisent, car un rafraîchissement est une décision délibérée.
- **Installation à neuf stricte** : une source absente de la base qui ne peut pas être téléchargée
  fait échouer la commande. On ne démarre jamais avec des données manquantes en silence.
- **Rapports annexes non bloquants** : l'écriture de `reports/*.md` peut échouer sans empêcher le
  démarrage ; le rapport de conflits n'est réécrit que si toutes les sources ont réellement tourné
  (sinon il afficherait à tort « aucun conflit »).
- **Téléchargements durcis** (déjà en place) : nouvelles tentatives avec attente, fichier `.part`
  renommé atomiquement. La CI met en cache `data/raw`.

## Conséquences

- Un démarrage normal ne touche plus le réseau : plus rapide, et indépendant de l'état des
  fournisseurs.
- Corriger une source sans changer de vintage exige `--refresh` explicite (comportement voulu).
- Risque restant : si la base elle-même (Supabase) est en pause ou indisponible, l'API ne peut pas
  démarrer ; voir `docs/operations.md`.
