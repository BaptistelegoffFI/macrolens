# ADR 0009 — Contexte de build à la racine du dépôt (déploiement Render)

Décision demandée directement par l'utilisateur (hors plan) : déployer MacroLens sur une
infrastructure gratuite et autonome (Render + Supabase) pour un lien partageable sans dépendre
de la machine locale (voir aussi ADR 0007, ADR 0008).

## Le problème

`backend/Dockerfile` et `frontend/Dockerfile` avaient chacun leur propre sous-dossier comme
contexte de build (`docker-compose.yml` : `build: ./backend`, `build: ./frontend`). En local,
`data/` (référentiels §2.1/§2.4, requis par `macrolens seed`) était monté en volume depuis la
racine du dépôt (`./data:/app/data`) — un mécanisme propre à docker-compose, absent sur Render
(pas de bind-mount arbitraire depuis un hôte). Sans ce volume, `macrolens seed` échouerait au
démarrage faute de trouver les fichiers de référence.

Docker interdit à une instruction `COPY` de remonter au-dessus de son contexte de build — avec
un contexte `backend/`, impossible de `COPY ../data ...`.

## Solution retenue : un seul contexte de build, la racine du dépôt

Les trois Dockerfiles (`backend/`, `frontend/`, nouveau `proxy/Dockerfile`) prennent maintenant
la racine du dépôt comme contexte, avec leurs chemins `COPY` préfixés en conséquence
(`COPY backend/pyproject.toml ...`, `COPY data/ /app/data`, etc.). `docker-compose.yml` est mis
à jour pour construire les trois avec `context: .` — donc local et Render utilisent
**exactement la même définition de build**, jamais deux qui pourraient diverger.

Alternative écartée : dupliquer les fichiers de référence dans `backend/` (ex.
`backend/seed_data/`) pour garder chaque Dockerfile dans son propre sous-dossier. Rejetée : ça
crée deux copies d'une même source de vérité qui peuvent diverger silencieusement si l'une est
modifiée sans l'autre — exactement le genre d'incohérence que ce projet évite systématiquement
ailleurs (voir ADR 0007 sur les chemins API relatifs, pour la même raison).

`data/raw/` (jeux de données bruts téléchargés) reste hors du dépôt git (`.gitignore` déjà en
place) — non copié dans l'image, retéléchargé par `macrolens etl run-all` à chaque démarrage du
conteneur. Comportement déjà conçu pour être idempotent et sûr à rejouer (Phase 3/7) ; les
services Render gratuits ayant un système de fichiers éphémère (rien ne persiste entre deux
redémarrages), ce mécanisme de re-téléchargement s'avère être exactement ce qu'il fallait plutôt
qu'un problème à contourner.

## Portée de l'automatisation via la CLI Render

`render services create` ne permet pas de spécifier un contexte de build distinct du chemin du
Dockerfile (contrairement à un `render.yaml` de Blueprint, qui supporte des clés
`dockerContext`/`dockerfilePath` séparées mais ne peut être appliqué que depuis le tableau de
bord Render, pas depuis la CLI — `render blueprints` ne fait que `validate`). Ce changement de
contexte permet donc de créer les trois services directement en CLI (`--root-directory .`
partout), sans étape manuelle dans le tableau de bord Render.
