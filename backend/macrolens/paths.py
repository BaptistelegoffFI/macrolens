"""Résolution du répertoire de données, cohérente entre dev local et
conteneur Docker. En local (dépôt cloné), data/ et reports/ sont des dossiers
frères de backend/. En conteneur, le contexte de build ne contient que
backend/ : data/ et reports/ sont montés en volume et leurs chemins fournis
via MACROLENS_DATA_DIR / MACROLENS_REPORTS_DIR (voir docker-compose.yml).

Seule source de vérité pour ces chemins — ne pas recalculer REPO_ROOT
ailleurs dans le code.
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("MACROLENS_DATA_DIR", str(REPO_ROOT / "data")))
REPORTS_DIR = Path(os.environ.get("MACROLENS_REPORTS_DIR", str(REPO_ROOT / "reports")))
