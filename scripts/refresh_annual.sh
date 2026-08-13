#!/usr/bin/env bash
# Rafraîchissement annuel des données (Phase 7, PLAN.md §13).
#
# Ce script automatise la partie sûre et idempotente du rafraîchissement :
# re-télécharger la source à vintage "rolling" (BIS), rejouer le pipeline
# complet, reconstruire les vecteurs d'état sur les 4 référentiels, puis
# faire tourner la suite de tests pour détecter toute régression introduite
# par les nouvelles données.
#
# Ce script NE décide PAS à votre place de créer un nouveau vintage pour
# JST ou Maddison (§18.7 : "jamais réécrit, une nouvelle version = un
# nouveau vintage") — c'est une décision humaine documentée dans
# docs/data-refresh.md, pas quelque chose à automatiser à l'aveugle.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== 1/5 — Rafraîchissement de la source à vintage rolling (BIS) ==="
echo "Un changement de hash ici est ATTENDU (source sans version figée, voir"
echo "docs/limitations.md § hash à vintage identique) — pas une erreur."
(cd backend && uv run macrolens etl download --source bis_cbpol --force)

echo
echo "=== 2/5 — Vérification manuelle requise avant de continuer ==="
cat <<'EOF'
Avant de poursuivre, vérifiez si une NOUVELLE release existe pour les
sources versionnées :
  - JST  : https://www.macrohistory.net/database/  (release actuelle : R6)
  - Maddison : https://www.rug.nl/ggdc/historicaldevelopment/maddison/ (2023)

Si oui : suivez la procédure "Bumper un vintage" dans docs/data-refresh.md
avant de relancer ce script — ne PAS écraser le vintage existant.
Si non (cas le plus fréquent, une fois par an) : appuyez sur Entrée pour
continuer avec les vintages actuels.
EOF
read -r -p "Entrée pour continuer... "

echo
echo "=== 3/5 — Rejeu du pipeline complet (idempotent) ==="
(cd backend && uv run macrolens etl run-all)

echo
echo "=== 4/5 — Reconstruction des vecteurs d'état (4 référentiels) ==="
for frame in rolling30 era cross_section pool; do
  echo "-- reference_frame=$frame"
  (cd backend && uv run macrolens build-features --reference-frame "$frame")
done

echo
echo "=== 5/5 — Suite de tests complète (détecte les régressions) ==="
make check

echo
echo "=== Terminé ==="
cat <<'EOF'
Prochaines étapes recommandées (manuelles, pas automatisées ici) :
  - Relire reports/validation.md § cas connus (Espagne 2007, USA 1979,
    France 2020) sur les données rafraîchies — les résultats attendus
    doivent rester cohérents.
  - Relire le rapport de conflits (etl/conflicts.py) si de nouvelles
    divergences entre sources sont apparues.
  - Committer data/reference/sources.yaml si retrieved_at a changé, et le
    build_id résultant si vous versionnez reports/validation.md.
EOF
