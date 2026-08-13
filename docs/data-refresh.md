# Rafraîchissement annuel des données

MacroLens n'a pas de flux de données temps réel — il vit d'un rejeu périodique et délibéré du
pipeline d'ingestion contre des sources qui publient, au mieux, une fois par an. Ce document
décrit la procédure complète ; `scripts/refresh_annual.sh` en automatise la partie sûre.

## Ce qui est automatisé (`make refresh` / `scripts/refresh_annual.sh`)

1. Re-télécharge `bis_cbpol` avec `--force` — c'est la seule source ingérée à vintage `current`
   (rolling, sans version figée : l'API BIS sert toujours les dernières données à la même URL).
   Un changement de hash est **attendu**, pas une anomalie (voir `docs/limitations.md`).
2. Pause pour une vérification manuelle (voir plus bas).
3. Rejoue `macrolens etl run-all` — idempotent : ne re-télécharge pas JST/Maddison si leur
   vintage actuel est déjà présent sur disque.
4. Reconstruit les vecteurs d'état sur les 4 référentiels (`rolling30`, `era`, `cross_section`,
   `pool`) — chacun a son propre `build_id`, tous doivent être à jour.
5. Fait tourner `make check` (lint + types + tests) pour détecter toute régression introduite
   par les nouvelles données (une valeur qui dépasse une borne déclarée, par exemple).

## Ce qui reste une décision humaine : bumper un vintage

JST et Maddison publient des **releases versionnées** (JST R6, Maddison 2023), pas un flux
continu. Le script s'arrête et demande de vérifier s'il existe une nouvelle release avant de
continuer — **ne jamais réutiliser le même dossier de vintage pour un contenu différent** (§18.7 :
« jamais réécrit, une nouvelle version de source = un nouveau vintage, l'ancien reste »).

Procédure si une nouvelle release existe (exemple : JST publie R7) :

1. Créer le nouveau dossier de vintage : `data/raw/jst/R7/` (à côté de `R6/`, jamais à sa place).
2. Mettre à jour `VINTAGE` dans `backend/macrolens/etl/sources/jst.py`.
3. Vérifier le mapping de colonnes (`etl/mappings/jst.yaml`) contre le nouveau codebook — une
   release majeure peut renommer ou ajouter des colonnes. Ne jamais supposer que le mapping
   R6 reste valable sans le revérifier contre la documentation réelle (`pdftotext` sur le PDF
   du codebook, comme en Phase 2 — jamais deviné).
4. Documenter le changement dans `docs/decisions/` (nouvelle ADR) si le mapping ou le
   comportement de raccordement change.
5. Lancer `scripts/refresh_annual.sh` (ou les étapes manuellement).
6. Comparer `reports/validation.md` avant/après — les cas connus (Espagne 2007, USA 1979,
   France 2020) doivent rester cohérents ; un changement de résultat sur ces cas de référence
   mérite une investigation avant de committer.

Le même principe s'applique à Maddison si une édition ultérieure à 2023 est publiée.

## Fréquence recommandée

Une fois par an, après la clôture des séries annuelles de l'année précédente par les sources
primaires (typiquement au premier trimestre de l'année suivante pour la plupart des agrégats
macro). Un rafraîchissement plus fréquent n'apporterait rien : les sources elles-mêmes ne
publient pas plus vite.
