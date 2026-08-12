# MacroLens

Moteur de recherche de précédents historiques macro-financiers (1870 → aujourd'hui).

> *« Cet état macroéconomique ressemble à quoi dans l'histoire, et qu'est-ce qui s'est
> passé ensuite ? »*

L'utilisateur décrit une configuration économique (réelle ou hypothétique). Le système
compare ~2 600 couples (pays, année) de données historiques vérifiées, calcule une distance
quantitative, remonte les *k* configurations les plus proches, et affiche ce qui s'est
**réellement produit** dans les années suivantes — jamais une prédiction.

Le contrat complet (vision, architecture, modèle de données, moteur de similarité, roadmap)
est dans [`PLAN.md`](PLAN.md). Les règles permanentes de travail sont dans [`CLAUDE.md`](CLAUDE.md).

## Ce que MacroLens n'est pas

Un outil de prévision, un backtest de stratégie, un modèle économétrique structurel, un
chatbot. Aucune IA, aucun modèle entraîné, aucune prédiction générée : le moteur est
100 % déterministe (algèbre linéaire, statistiques descriptives, SQL).

## Périmètre v1

- **Pays cœur** : France, Allemagne, Italie, Suède, Finlande, Norvège (1870 →). Pool
  d'analogues élargi à 17 pays au total (v1.1) pour que les distances aient un sens
  statistique — voir `PLAN.md` §2.1.
- **Période** : socle annuel 1870 → dernière année complète. 1850-1869 en extension
  best-effort, flaguée `coverage_partial` et exclue par défaut du pool d'analogues.
- **Fréquence** : annuelle sur tout l'historique ; couche mensuelle limitée post-1955 pour
  quelques indicateurs.
- **24 indicateurs** groupés en 4 familles : activité, prix & monnaie, taux & marchés,
  dette/crédit/extérieur. Liste complète en `PLAN.md` §2.4.

### Hors périmètre v1

Données infra-mensuelles ; données sectorielles ; données d'entreprises ; pays émergents ;
prévisions ; optimisation de portefeuille ; comptes utilisateurs ; multi-tenant.

## Architecture

```
Sources (JST, Maddison, BRI, FMI, OCDE, banques centrales, OWID)
  → Raw layer (fichiers d'origine, jamais modifiés, hash SHA-256)
  → Curated layer (PostgreSQL — countries, indicators, sources, observations, events)
  → Feature store (state_vectors — panel numpy en mémoire, ~2 600 × 14)
  → Moteur de similarité + moteur d'outcomes (core/, pur, sans I/O)
  → API (FastAPI, /api/v1)
  → Web (React + TypeScript + ECharts, poste de travail dense façon Macrobond)
```

Détail complet en `PLAN.md` §3.

## Stack

Backend Python 3.12 (`uv`, FastAPI, SQLAlchemy 2 + Alembic, pandera, numpy/scipy),
PostgreSQL 16, frontend React 18 + TypeScript 5 + Vite + ECharts. Détail en `PLAN.md` §4.

## Démarrer en local

Prérequis : [`uv`](https://docs.astral.sh/uv/), Node.js 20+, Docker (pour Postgres et
l'exécution conteneurisée).

```bash
make check   # lint + types + tests, backend et frontend
make dev     # docker compose up — db + api + web
```

- API : `http://localhost:8000/docs`
- Web : `http://localhost:5173`

## État du projet

Phase 0 (socle du dépôt) en cours. Voir `PLAN.md` §13 pour la roadmap par phases et les
critères d'acceptation de chacune. Aucune logique métier n'est encore implémentée : pas de
migrations appliquées, pas de données ingérées, pas de moteur de similarité.

## Licence des données

La source primaire, la Jordà-Schularick-Taylor Macrohistory Database, est distribuée sous
licence non commerciale avec attribution obligatoire (CC BY-NC-SA). Ce projet est non
commercial et respecte cette contrainte — voir `PLAN.md` §5.1 et §15 point 8.

Jordà, Ò., Schularick, M., Taylor, A. M. (2017). "Macrofinancial History and the New
Business Cycle Facts." *NBER Macroeconomics Annual 2016*, vol. 31.
https://www.macrohistory.net/database/
