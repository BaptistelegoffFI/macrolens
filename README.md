# MacroLens

Moteur de recherche de précédents historiques macro-financiers (1870 → aujourd'hui).

> *« Cet état macroéconomique ressemble à quoi dans l'histoire, et qu'est-ce qui s'est
> passé ensuite ? »*

L'utilisateur décrit une configuration économique (réelle ou hypothétique). Le système
compare les couples (pays, année) de données historiques vérifiées, calcule une distance
quantitative, remonte les *k* configurations les plus proches, et affiche ce qui s'est
**réellement produit** dans les années suivantes — jamais une prédiction.

Le contrat complet (vision, architecture, modèle de données, moteur de similarité, roadmap)
est dans [`PLAN.md`](PLAN.md). Les règles permanentes de travail sont dans [`CLAUDE.md`](CLAUDE.md).
La méthode complète (chaque formule) est dans [`docs/methodology.md`](docs/methodology.md).

## Ce que MacroLens n'est pas

Un outil de prévision, un backtest de stratégie, un modèle économétrique structurel, un
chatbot. Aucune IA, aucun modèle entraîné, aucune prédiction générée : le moteur est
100 % déterministe (algèbre linéaire, statistiques descriptives, SQL).

## Périmètre v1

- **Pays cœur** : France, Allemagne, Italie, Suède, Finlande, Norvège (1870 →). Pool
  d'analogues élargi à 17 pays au total pour que les distances aient un sens statistique —
  voir `PLAN.md` §2.1.
- **Période** : socle annuel 1870 → dernière année complète. 1850-1869 en extension
  best-effort (Maddison), flaguée `coverage_partial` et exclue par défaut du pool d'analogues.
  Le pool réellement *exploitable comme analogue* démarre vers 1895-1905 (30 ans de recul
  nécessaires à la normalisation) — voir `docs/methodology.md` §2.3 et `docs/limitations.md`.
- **26 indicateurs** en base, dont les 10 qui alimentent le vecteur d'état à 14 features.
  Liste complète en `PLAN.md` §2.4 et dans la vue *Sources & méthode* de l'application.

### Hors périmètre v1

Données infra-mensuelles ; données sectorielles ; données d'entreprises ; pays émergents ;
prévisions ; optimisation de portefeuille ; comptes utilisateurs ; multi-tenant ; distance de
Mahalanobis et comparaison de trajectoires DTW (prévues v1.1/v1.2, voir `docs/limitations.md`).

## Architecture

```
Sources (JST, Maddison, BRI) → jamais modifiées, hash SHA-256, provenance intégrale
  → PostgreSQL 16 (countries, indicators, sources, observations, events, state_vectors)
  → Moteur de similarité + moteur d'outcomes (backend/macrolens/core/, pur, sans I/O)
  → API (FastAPI, /api/v1 — 19 endpoints, OpenAPI sur /docs)
  → Web (React + TypeScript + ECharts, poste de travail dense façon Macrobond)
```

Détail complet en `PLAN.md` §3.

## Stack

Backend Python 3.12 (`uv`, FastAPI, SQLAlchemy 2 + Alembic, pandera, numpy/scipy),
PostgreSQL 16, frontend React 18 + TypeScript 5 + Vite + ECharts. Détail en `PLAN.md` §4.

## Démarrer en local

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) (Postgres + build/run des conteneurs).
- Pour le développement backend hors conteneur : [`uv`](https://docs.astral.sh/uv/),
  Python 3.12.
- Pour le développement frontend hors conteneur : Node.js 20+.

### Voie rapide — tout via Docker

```bash
docker compose up --build
```

C'est **la seule commande nécessaire**. `--build` garantit que les images reflètent le code
présent sur disque plutôt qu'une image locale plus ancienne déjà construite (utile après un
`git pull` — sans `--build`, Compose réutilise silencieusement l'image existante, même
périmée) ; au premier lancement il n'y a de toute façon aucune image à réutiliser, donc le
coût est le même. Au démarrage du conteneur `api`, l'*entrypoint*
(`backend/docker-entrypoint.sh`) applique les migrations, charge les référentiels
(`macrolens seed`), ingère les données (`macrolens etl run-all`), puis démarre le serveur —
qui construit lui-même le panel de features en mémoire au premier appel (`GET /health`,
`GET /version`, ou toute recherche). Aucune étape manuelle supplémentaire.

- **Web** : http://localhost:5173
- **API** : http://localhost:8000/docs (documentation OpenAPI interactive)
- **Postgres** : `localhost:5432` (utilisateur/mot de passe/base : `macrolens`)

Le premier démarrage télécharge réellement les jeux de données sources (JST ~1 Mo, BIS,
Maddison) — prévoir une connexion réseau active et quelques minutes.

Pour vérifier que tout fonctionne : ouvrez http://localhost:5173, la vue Scénario doit
s'afficher (menu, barre d'outils, trois colonnes) ; tapez `FRA 2019` puis Entrée dans `Ctrl+K`,
ou choisissez un pays/année dans le panneau Scénario et cliquez *Rechercher [F5]* — une table
d'analogues avec de vraies années historiques doit apparaître en quelques centaines de
millisecondes.

### Voie développement — backend et frontend en local

Utile pour itérer avec rechargement à chaud sur les deux stacks. Postgres reste en Docker.

```bash
# 1. Démarrer uniquement Postgres
docker compose up db

# 2. Backend — dans un premier terminal
cd backend
uv sync
export DATABASE_URL="postgresql+psycopg://macrolens:macrolens@localhost:5432/macrolens"
make -C .. migrate    # ou : uv run alembic upgrade head
make -C .. seed       # charge les référentiels (pays, indicateurs, sources, événements)
make -C .. etl        # télécharge et ingère JST + BIS + Maddison
uv run uvicorn macrolens.api.main:app --reload --port 8000

# 3. Frontend — dans un second terminal
cd frontend
npm install
npm run dev
```

Le frontend lit `frontend/.env.development` (déjà présent dans le dépôt,
`VITE_API_URL=http://localhost:8000`) — pas de configuration supplémentaire.

`make build-features` (optionnel) matérialise les vecteurs d'état dans la table
`state_vectors` pour les 4 référentiels — l'API les calcule déjà en mémoire au démarrage
(`rolling30` par défaut) ; cette étape sert surtout à un usage hors-API (notebooks, scripts).

### Rafraîchir les données

Voir [`docs/data-refresh.md`](docs/data-refresh.md) — `make refresh` automatise la partie
sûre et idempotente ; le passage à une nouvelle version de source (JST, Maddison) reste une
décision humaine documentée, jamais automatisée à l'aveugle (§18.7).

### Vérifier son installation

```bash
make check   # lint + types + tests, backend et frontend
```

Backend : 140+ tests (`pytest`), y compris le test de retour à la source sur 200 observations
tirées au hasard (§18.8) et la batterie de correction du moteur (§12.3). Frontend : 100+ tests
(`vitest`), y compris un scan automatique du vocabulaire interdit (§12.4) et du contraste AA
(§11.8). Le détail des résultats réels, avec les cas où un critère du plan a été trouvé en
défaut puis corrigé, est dans [`reports/validation.md`](reports/validation.md) — ce document
n'est pas un tableau de cases cochées, c'est un rapport honnête.

## Documentation

| Document | Contenu |
|---|---|
| [`PLAN.md`](PLAN.md) | Le contrat complet — vision, architecture, spécification mathématique, roadmap |
| [`CLAUDE.md`](CLAUDE.md) | Les règles permanentes de travail sur ce dépôt |
| [`docs/methodology.md`](docs/methodology.md) | Chaque formule du moteur, en clair |
| [`docs/data-sources.md`](docs/data-sources.md) | Une fiche par source de données |
| [`docs/data-refresh.md`](docs/data-refresh.md) | Procédure de rafraîchissement annuel |
| [`docs/limitations.md`](docs/limitations.md) | Limites connues, assumées et détaillées |
| [`docs/decisions/`](docs/decisions/) | Journal des décisions (ADR), une décision = un fichier |
| [`reports/validation.md`](reports/validation.md) | Résultats réels de validation, phase par phase |

## État du projet

Phases 0 à 6 complètes (socle, ingestion JST/BIS/Maddison, moteur de similarité, API, interface).
Phase 7 (durcissement et documentation) en cours. Voir `PLAN.md` §13 pour la roadmap complète et
les critères d'acceptation de chaque phase, et `reports/validation.md` pour l'état réel de
chacune — y compris les critères non satisfaits du premier coup et comment ils ont été corrigés.

## Licence des données

La source primaire, la Jordà-Schularick-Taylor Macrohistory Database, est distribuée sous
licence non commerciale avec attribution obligatoire (CC BY-NC-SA). Ce projet est non
commercial et respecte cette contrainte — voir `PLAN.md` §5.1 et §15 point 8.

Jordà, Ò., Schularick, M., Taylor, A. M. (2017). "Macrofinancial History and the New
Business Cycle Facts." *NBER Macroeconomics Annual 2016*, vol. 31.
https://www.macrohistory.net/database/
