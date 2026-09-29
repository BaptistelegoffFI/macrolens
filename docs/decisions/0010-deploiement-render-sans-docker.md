# ADR 0010 — Déploiement Render sans Docker, deux services publics

Suite de l'ADR 0009. En essayant de créer les services via `render services create` (CLI,
sans passer par le tableau de bord), une limite plus profonde est apparue : cette commande ne
permet pas de spécifier un contexte de build Docker distinct de l'emplacement du Dockerfile
(contrairement à un `render.yaml` de Blueprint, mais celui-ci ne peut être appliqué que depuis
le tableau de bord — `render blueprints` ne fait que `validate`). Avec `--root-directory`, ce
dossier sert à la fois de contexte ET d'emplacement attendu du `Dockerfile` — incompatible avec
la stratégie de contexte-racine de l'ADR 0009 (qui suppose que le contexte de build et
l'emplacement du Dockerfile diffèrent : `backend/Dockerfile` avec un contexte à la racine).

## Décision : runtimes natifs Render, pas Docker

Render clone le dépôt Git complet pour un service en runtime natif (Python, Node), puis exécute
les commandes de build/démarrage depuis `--root-directory` — contrairement à un contexte Docker,
rien n'empêche `backend/macrolens/paths.py` de résoudre `data/` comme un dossier frère de
`backend/` (`REPO_ROOT = Path(__file__).resolve().parents[2]`, déjà le comportement par défaut
du code, sans configuration supplémentaire). Le problème de fond de l'ADR 0009 (accéder à
`data/` depuis un contexte de build restreint) ne se pose tout simplement plus.

- `api` : runtime `python`, `root-directory: backend`, build `pip install uv && uv sync --no-dev`,
  start `uv run alembic upgrade head && uv run macrolens seed && uv run macrolens etl run-all &&
  uv run uvicorn macrolens.api.main:app --host 0.0.0.0 --port $PORT` (Render assigne le port via
  `$PORT`, jamais un port fixe).
- `web` : runtime `node`, `root-directory: frontend`, build `npm install && npm run build`,
  start `npx serve -s dist -l $PORT` — même mécanisme `serve -s` (repli SPA) qu'en local.

`docker-compose.yml`, les trois Dockerfiles et `proxy/` (ADR 0007/0009) restent inchangés et
pleinement valides pour l'usage local et le partage par tunnel — ce ne sont pas des chemins
concurrents, seulement deux cibles de déploiement différentes avec des contraintes différentes.

## Décision : deux origines publiques, pas de proxy unique

Sans conteneur nginx viable en runtime natif, le choix aurait été de déployer `proxy` seul en
Docker (root-directory=`proxy`, qui contient directement `proxy/Dockerfile` — compatible avec la
contrainte CLI). Écarté : ça mélange runtimes natifs et Docker pour un gain minime, et le
bénéfice principal du proxy (chemins API relatifs, ADR 0007) ne s'applique qu'à l'usage local/
tunnel, pas ici. `api` et `web` sont donc chacun un service public Render avec sa propre URL.

Le frontend appelle l'API en absolu (`VITE_API_URL` fixé à l'URL Render de `api` au moment du
build de `web`), pas en chemin relatif — `api/client.ts` supportait déjà ce mode (utilisé par
`npm run dev` en local). Corollaire : CORS redevient nécessaire. `CORS_EXTRA_ORIGINS` (variable
d'environnement, liste séparée par des virgules) ajoutée à `allow_origins` dans `main.py` plutôt
que de coder en dur une URL de déploiement dans le dépôt — la même image/le même code source
sert n'importe quel déploiement, seule la configuration change.

Ordre de création imposé par cette dépendance mutuelle : `api` d'abord (URL nécessaire au build
de `web`), puis `web`, puis mise à jour de `CORS_EXTRA_ORIGINS` sur `api` avec l'URL de `web`
une fois connue.

Conséquence assumée : deux liens distincts existent (`web` pour l'application, `api` pour
l'API/OpenAPI) au lieu d'un seul — l'utilisateur n'a besoin de partager que celui de `web`.
