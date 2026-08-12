# MACROLENS — Plan de construction intégral

**Moteur de recherche de précédents historiques macro-financiers (1870 → aujourd'hui)**

Document de spécification destiné à être exécuté par Claude Code.
Version 1.0 — 12 août 2026

---

## 0. Comment utiliser ce document

Ce document est le contrat. Il se lit dans l'ordre. Chaque phase (§13) est un lot de travail
autonome, avec des critères d'acceptation vérifiables. **Ne pas passer à la phase N+1 tant que
tous les critères d'acceptation de la phase N ne passent pas.**

Règles de travail permanentes (à recopier dans `CLAUDE.md` à la racine du repo) :

1. **Zéro IA dans le produit.** Aucun appel LLM, aucun modèle entraîné, aucune prédiction
   générée. Le moteur est 100 % déterministe : algèbre linéaire, statistiques descriptives, SQL.
   Deux exécutions identiques donnent bit-pour-bit le même résultat.
2. **Zéro chiffre non sourcé.** Toute valeur affichée dans l'interface doit être traçable
   jusqu'à un identifiant de source et une URL. Si une valeur ne peut pas être sourcée, elle
   n'entre pas dans la base.
3. **Zéro extrapolation silencieuse.** Aucune interpolation, aucun remplissage de trou, aucun
   raccordement de série sans que l'observation soit marquée d'un flag visible en UI.
4. **On ne prédit jamais.** On répond à *« qu'est-ce qui s'est produit, historiquement, dans
   les situations les plus proches de celle-ci ? »*. Jamais à *« que va-t-il se passer ? »*.
   Cette distinction doit être visible dans le vocabulaire du code, des endpoints et de l'UI.
5. **Petit n assumé.** Le nombre d'analogues est toujours affiché. Aucun intervalle de confiance
   paramétrique. On montre la distribution empirique complète et la liste nominative des
   épisodes, jamais une moyenne isolée.
6. **Tout est testé.** Chaque transformation de données a un test avec des valeurs attendues
   écrites à la main. Le moteur de similarité a des tests de non-régression sur des cas connus.

---

## 1. Vision

MacroLens est une plateforme web qui répond à une seule question, très bien :

> *« Cet état macroéconomique — telle inflation, tels taux, telle dette, tel crédit —
> ressemble à quoi dans l'histoire, et qu'est-ce qui s'est passé ensuite ? »*

L'utilisateur décrit une configuration économique (soit réelle et actuelle, soit hypothétique).
Le système parcourt ~2 500 couples (pays, année) de données historiques vérifiées, calcule une
distance quantitative, remonte les k configurations les plus proches, et affiche **ce qui s'est
réellement produit** dans les 1, 3, 5 et 10 années suivantes : croissance, inflation, marchés
actions, obligations, chômage, occurrence de crise bancaire.

Positionnement : un croisement entre la rigueur documentaire de *Our World in Data*, la
méthode d'analogie historique de Bridgewater / Ray Dalio, et l'ergonomie d'un terminal.

**Ce que MacroLens n'est pas** : un outil de prévision, un backtest de stratégie, un modèle
économétrique structurel, un chatbot.

---

## 2. Périmètre v1

### 2.1 Pays

| Pays | Code ISO | Couverture socle | Remarque |
|---|---|---|---|
| France | FRA | 1870 → | Complet |
| Allemagne | DEU | 1870 → | Ruptures 1914-1924, 1939-1949 (voir §7.5) |
| Italie | ITA | 1870 → | Complet |
| Suède | SWE | 1870 → | Complet, excellentes sources longues |
| Finlande | FIN | 1870 → | Complet |
| Norvège | NOR | 1870 → | Complet |

**Pays de contrôle ajoutés au pool d'analogues (v1.1, non affichés comme pays principaux) :**
USA, GBR, JPN, ESP, NLD, CHE, DNK, BEL, PRT, AUS, CAN.
Raison : avec 6 pays × 155 ans = 930 observations, le pool d'analogues est trop maigre pour que
les distances aient du sens. Avec 17 pays, on passe à ~2 600. **Cette extension n'est pas une
option de confort, c'est une nécessité statistique.** Elle est gratuite : la source principale
(JST) couvre déjà les 18 pays.

### 2.2 Période

- **Socle canonique : 1870 → dernière année complète.** ⚠️ Les années 1870-1894 servent
  d'historique de normalisation mais ne sont pas candidates comme analogues (voir §8.2.4). C'est la borne de la seule source
  homogène multi-pays existante (JST Macrohistory Database).
- **1850–1869 : extension best-effort**, pays par pays, uniquement pour PIB, prix et taux courts,
  via Maddison Project et les statistiques monétaires historiques nationales. Ces observations
  portent le flag `coverage_partial = true` et sont **exclues par défaut** du pool d'analogues
  (l'utilisateur peut les réintégrer via un toggle).

> **Décision à assumer face au brief initial :** le brief dit « 1850 ». La donnée multi-pays
> comparable n'existe pas avant 1870. Livrer 1850 pour 3 variables sur 2 pays serait un mensonge
> de couverture. On livre 1870 solide + 1850 documenté comme partiel.

### 2.3 Fréquence

- **Socle : annuel.** Seule fréquence disponible sur 155 ans pour tous les pays.
- **Couche mensuelle : à partir de 1955**, uniquement pour IPC, taux directeur, taux court,
  taux long, indice actions, chômage, change. Source : OCDE / BRI / FMI / banques centrales.
- **Conséquence directe sur les horizons** : l'horizon « 6 mois » du brief n'est calculable
  que sur la fenêtre mensuelle post-1955. Les horizons du socle historique sont **1, 3, 5, 10 ans**.
  L'UI doit désactiver l'horizon 6 mois quand le scénario porte sur le socle annuel, avec
  l'explication affichée.

### 2.4 Indicateurs du socle

Groupés par famille. Code = identifiant stable en base.

**Activité**
| Code | Libellé | Unité |
|---|---|---|
| `gdp_real_pc` | PIB réel par habitant | index / monnaie constante |
| `gdp_real` | PIB réel | monnaie constante |
| `gdp_nominal` | PIB nominal | monnaie courante |
| `unemployment_rate` | Taux de chômage | % |
| `population` | Population | personnes |
| `investment_gdp` | Investissement / PIB | % |
| `consumption_gdp` | Consommation / PIB | % |

**Prix & monnaie**
| Code | Libellé | Unité |
|---|---|---|
| `cpi` | Indice des prix à la consommation | index |
| `inflation_yoy` | Inflation glissante | % (dérivé) |
| `money_broad` | Masse monétaire large (M2/M3) | monnaie courante |
| `wages_nominal` | Salaires nominaux | index |

**Taux & marchés**
| Code | Libellé | Unité |
|---|---|---|
| `rate_short` | Taux court terme | % |
| `rate_long` | Rendement souverain long (10 ans) | % |
| `policy_rate` | Taux directeur | % |
| `equity_index_nominal` | Indice actions total return | index |
| `equity_capgain_index` | Indice actions prix seul | index |
| `dividend_yield` | Rendement du dividende | % |
| `house_price_index` | Prix immobilier | index |
| `exchange_rate_usd` | Change vs USD | unités/USD |

**Dette, crédit, extérieur**
| Code | Libellé | Unité |
|---|---|---|
| `debt_public_gdp` | Dette publique / PIB | % |
| `revenue_public_gdp` | Recettes publiques / PIB | % |
| `expenditure_public_gdp` | Dépenses publiques / PIB | % |
| `credit_private_gdp` | Crédit bancaire au privé / PIB | % |
| `mortgage_credit_gdp` | Crédit hypothécaire / PIB | % |
| `current_account_gdp` | Balance courante / PIB | % |
| `bank_capital_ratio` | Ratio de capital bancaire | % |

### 2.5 Hors périmètre v1 (à écrire noir sur blanc dans le README)

Données infra-mensuelles ; données sectorielles ; données d'entreprises ; pays émergents ;
prévisions ; optimisation de portefeuille ; comptes utilisateurs ; multi-tenant.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  SOURCES (fichiers déposés + APIs)                               │
│  JST · Maddison · BRI · FMI · OCDE · Banques centrales · OWID    │
└────────────────────────────┬─────────────────────────────────────┘
                             │  scripts d'ingestion versionnés, idempotents
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  RAW LAYER — /data/raw/<source_id>/<vintage>/<fichier>           │
│  Fichiers d'origine, jamais modifiés, hash SHA-256 enregistré    │
└────────────────────────────┬─────────────────────────────────────┘
                             │  normalisation + validation pandera
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  CURATED LAYER — PostgreSQL                                       │
│  countries · indicators · sources · observations · events        │
│  ~250 000 lignes. Tient intégralement en RAM.                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │  build du panel de features (batch, reproductible)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  FEATURE STORE — table `state_vectors` + parquet en cache        │
│  1 ligne = (pays, année) → 14 features normalisées               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
┌───────────────────────────┐  ┌───────────────────────────────────┐
│  MOTEUR DE SIMILARITÉ     │  │  MOTEUR D'OUTCOMES                │
│  distances, k-NN, DTW     │  │  réalisations à t+1/3/5/10        │
└────────────┬──────────────┘  └────────────┬──────────────────────┘
             └────────────┬─────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  API — FastAPI, JSON, sans état, entièrement cacheable           │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  WEB — React + TypeScript, ECharts, TanStack Query               │
└──────────────────────────────────────────────────────────────────┘
```

**Décision d'architecture majeure :** le volume total est minuscule (~250 k lignes, < 40 Mo).
Le moteur de similarité **ne fait jamais de SQL** : au démarrage de l'API, le panel de features
est chargé en un `numpy.ndarray` (2 600 × 14 flottants = 300 Ko). Une recherche k-NN est un
produit matriciel qui prend < 2 ms. Il ne faut donc **aucun** index vectoriel, **aucune** base
vectorielle, **aucun** service de calcul séparé. Toute proposition contraire est du sur-design.

PostgreSQL sert à la traçabilité, aux jointures de métadonnées et à l'exploration — pas au calcul.

---

## 4. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Langage backend | Python 3.12 | Écosystème données incontournable |
| Gestion de deps | `uv` | Rapide, lockfile déterministe |
| Ingestion | `httpx`, `pandas`, `openpyxl`, `pyreadstat` (fichiers Stata JST) | JST se distribue en `.dta` et `.xlsx` |
| Validation | `pandera` | Contrats de schéma déclaratifs et testables |
| Calcul | `numpy`, `scipy`, `statsmodels` | Filtres de tendance, stats |
| Base | PostgreSQL 16 | Contraintes fortes, traçabilité |
| ORM / migrations | SQLAlchemy 2 + Alembic | Migrations versionnées obligatoires |
| API | FastAPI + Pydantic v2 | Typage strict, OpenAPI auto |
| Cache | `functools.lru_cache` en process | Suffisant, pas de Redis en v1 |
| Front | React 18 + TypeScript 5 + Vite | — |
| État serveur | TanStack Query | Cache, invalidation |
| Graphiques | Apache ECharts | Heatmaps, brush, timelines, 50 k points sans ramer |
| UI | Tailwind + shadcn/ui | — |
| Tests back | pytest + pytest-cov (seuil 85 % sur `core/`) | — |
| Tests front | Vitest + Playwright | — |
| Qualité | ruff, mypy `--strict` sur `core/`, ESLint | — |
| Exécution | Docker Compose (db + api + web) | Reproductible |
| CI | GitHub Actions : lint → types → tests → build | Bloquant sur main |

**Interdits explicites :** aucun SDK LLM, aucun `scikit-learn` pour de la prédiction (autorisé
uniquement pour `StandardScaler`/distances — et encore, numpy suffit), aucune base vectorielle,
aucun ORM no-code, aucun composant graphique payant.

---

## 5. Sources de données

### 5.1 Source primaire — le pilier du projet

**Jordà-Schularick-Taylor Macrohistory Database (JST), release 6.**
`https://www.macrohistory.net/database/`

La base couvre 18 économies avancées depuis 1870 en fréquence annuelle, et regroupe en un seul
endroit des données macroéconomiques auparavant dispersées ; la 6e version a ajouté de nouvelles
variables et prolongé les séries de rendements. Elle comprend 45 variables réelles et nominales,
dont des séries financières jusqu'alors indisponibles : crédit bancaire au secteur privé non
financier, prêts hypothécaires, rendements longs sur l'immobilier et les actions.

Elle couvre **les six pays cibles du projet** et fournit à elle seule ~80 % du socle décrit
en §2.4, déjà harmonisé, avec une documentation de 100 pages et un codage des crises bancaires.

⚠️ **Licence** : l'usage est accordé gratuitement pour des finalités non commerciales
(académiques), à condition que la base soit correctement attribuée et citée, et que tout
partage se fasse sous des termes de licence identiques. Le projet étant non commercial, c'est
compatible — mais l'attribution doit figurer en pied de page de l'application **et** dans le
README, et cette contrainte interdit définitivement toute revente ou intégration commerciale
du dataset.

**Action Claude Code** : télécharger le `.dta`/`.xlsx` release la plus récente + le PDF de
documentation, les déposer dans `data/raw/jst/<release>/`, enregistrer le hash.

### 5.2 Sources complémentaires

| ID source | Nom | Apporte | Format | Priorité |
|---|---|---|---|---|
| `jst` | JST Macrohistory R6 | Socle 1870→ , 18 pays, 45 variables, crises bancaires | .dta / .xlsx | **P0** |
| `maddison` | Maddison Project Database (Groningen) | PIB/hab réel avant 1870, extension 1850-1869 | .xlsx | P1 |
| `bis_cbpol` | BRI — taux directeurs | `policy_rate` mensuel, post-1946 selon pays | CSV | P1 |
| `bis_credit` | BRI — crédit au secteur privé non financier | Crédit trimestriel post-1940/1970 | CSV | P2 |
| `bis_pp` | BRI — prix immobiliers | Immobilier long | CSV | P2 |
| `imf_ifs` | FMI International Financial Statistics | Change, taux, IPC post-1948 | API / CSV | P2 |
| `imf_weo` | FMI World Economic Outlook | Dette, solde public, PIB récents | .xlsx | P1 |
| `imf_ghd` | FMI Global Debt Database / Historical Public Debt | Dette publique/PIB long | .xlsx | P1 |
| `oecd_mei` | OCDE Main Economic Indicators | IPC / chômage / taux mensuels post-1955 | SDMX API | P2 |
| `eurostat` | Eurostat | Trimestriel harmonisé UE post-1995 | SDMX API | P3 |
| `riksbank_hms` | Historical Monetary and Financial Statistics for Sweden | Suède, extension pré-1870 et contrôle qualité | .xlsx par chapitre | P2 |
| `norges_hms` | Historical Monetary Statistics for Norway 1819–2003 | Norvège, extension pré-1870 | .xlsx | P2 |
| `boe_millennium` | Bank of England — A Millennium of Macroeconomic Data | Contrôle qualité, GBR | .xlsx | P3 |
| `owid` | Our World in Data | Population, contexte, vérification croisée | CSV / GitHub | P3 |
| `rr_crises` | Reinhart & Rogoff — chronologie des crises | Recoupement des dates de crise | .xlsx | P3 |
| `events_manual` | **Fichiers YAML du repo** | Guerres, régimes, élections, réformes, défauts | YAML versionné | **P0** |

Sur les statistiques historiques nordiques : le projet suédois de compilation de statistiques
monétaires historiques a été inspiré par un projet équivalent de la Norges Bank, qui a produit
plusieurs volumes couvrant la politique monétaire norvégienne de 1819 à 2003 ; l'objectif est de
construire des séries cohérentes dans le temps en appliquant les définitions actuelles. Les
séries norvégiennes — prix, monnaie, statistiques bancaires, taux d'intérêt, taux de change et
PIB — ont été mises gratuitement à disposition sur le site de la banque centrale. Ce sont les
meilleures sources disponibles pour SWE et NOR avant 1870.

### 5.3 Règle de résolution des conflits entre sources

Quand deux sources donnent une valeur différente pour le même (pays, date, indicateur) :

1. Priorité par rang de source, défini une fois pour toutes dans `sources.priority` :
   `jst (100) > banque centrale nationale (90) > BRI (80) > FMI (70) > OCDE (60) > Maddison (50) > OWID (30)`
2. La valeur retenue est écrite dans `observations`, **les autres sont conservées** dans
   `observations_alt` avec le motif d'écartement.
3. Si l'écart relatif dépasse 5 %, l'observation est marquée `conflict = true` et apparaît dans
   un rapport `reports/conflicts.md` généré à chaque build. Ces cas sont revus manuellement.

**Jamais de moyenne entre sources. Jamais.** On choisit une source, on l'assume, on trace.

---

## 6. Modèle de données

Schéma PostgreSQL. Migrations Alembic obligatoires, pas de DDL manuel.

```sql
-- ─────────────────────────────────────────────────────────────
CREATE TABLE countries (
    iso3            CHAR(3) PRIMARY KEY,
    name_en         TEXT NOT NULL,
    name_fr         TEXT NOT NULL,
    is_core         BOOLEAN NOT NULL DEFAULT FALSE,  -- 6 pays du brief
    in_analog_pool  BOOLEAN NOT NULL DEFAULT TRUE,   -- entre dans la recherche d'analogues
    currency_hist   JSONB                            -- historique des monnaies + dates
);

CREATE TABLE sources (
    id              TEXT PRIMARY KEY,          -- 'jst', 'imf_weo', ...
    full_name       TEXT NOT NULL,
    url             TEXT NOT NULL,
    citation        TEXT NOT NULL,             -- citation académique complète
    licence         TEXT NOT NULL,
    priority        SMALLINT NOT NULL,
    retrieved_at    DATE NOT NULL,
    file_sha256     TEXT,
    notes           TEXT
);

CREATE TABLE indicators (
    code            TEXT PRIMARY KEY,          -- 'inflation_yoy', ...
    label_fr        TEXT NOT NULL,
    label_en        TEXT NOT NULL,
    family          TEXT NOT NULL,             -- activity|prices|rates|debt|external
    unit            TEXT NOT NULL,             -- pct | index | lcu | ratio | persons
    is_derived      BOOLEAN NOT NULL DEFAULT FALSE,
    derivation      TEXT,                      -- formule lisible si dérivé
    higher_is_worse BOOLEAN,                   -- pour le sens des couleurs en UI
    definition_fr   TEXT NOT NULL              -- définition exacte, affichée au survol
);

CREATE TABLE observations (
    country_iso3    CHAR(3) NOT NULL REFERENCES countries(iso3),
    indicator_code  TEXT    NOT NULL REFERENCES indicators(code),
    period_start    DATE    NOT NULL,          -- 1974-01-01 pour l'année 1974
    freq            CHAR(1) NOT NULL,          -- 'A' | 'Q' | 'M'
    value           DOUBLE PRECISION,          -- NULL autorisé = trou explicite
    source_id       TEXT    NOT NULL REFERENCES sources(id),
    is_interpolated BOOLEAN NOT NULL DEFAULT FALSE,
    is_spliced      BOOLEAN NOT NULL DEFAULT FALSE,  -- raccord de séries
    is_break        BOOLEAN NOT NULL DEFAULT FALSE,  -- rupture méthodologique connue
    conflict        BOOLEAN NOT NULL DEFAULT FALSE,
    coverage_partial BOOLEAN NOT NULL DEFAULT FALSE, -- typiquement 1850-1869
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ── Traçabilité au niveau de la valeur (voir §18) ───────────────
    raw_file_id     BIGINT REFERENCES raw_files(id),  -- fichier exact d'origine
    locator         JSONB NOT NULL,   -- où, précisément, dans ce fichier
    raw_value_text  TEXT,             -- valeur telle qu'écrite dans la source
    transform_chain TEXT[],           -- suite des opérations appliquées

    PRIMARY KEY (country_iso3, indicator_code, period_start, freq)
);
CREATE INDEX ON observations (indicator_code, period_start);
CREATE INDEX ON observations (country_iso3, period_start);

CREATE TABLE raw_files (          -- inventaire des fichiers sources, immuable
    id              BIGSERIAL PRIMARY KEY,
    source_id       TEXT NOT NULL REFERENCES sources(id),
    vintage         TEXT NOT NULL,          -- 'R6', '2026-04', ...
    filename        TEXT NOT NULL,
    relpath         TEXT NOT NULL,          -- data/raw/jst/R6/JSTdatasetR6.xlsx
    media_type      TEXT NOT NULL,          -- xlsx | dta | csv | pdf | json
    sha256          TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    origin_url      TEXT NOT NULL,
    downloaded_at   TIMESTAMPTZ NOT NULL,
    archive_url     TEXT,                   -- copie Wayback si disponible
    UNIQUE (sha256)
);

CREATE TABLE source_pages (       -- rendus d'images des sources documentaires
    id              BIGSERIAL PRIMARY KEY,
    raw_file_id     BIGINT NOT NULL REFERENCES raw_files(id),
    page_number     SMALLINT NOT NULL,
    image_path      TEXT NOT NULL,          -- data/derived/pages/<sha>/p0042.webp
    image_sha256    TEXT NOT NULL,
    width_px        INT NOT NULL,
    height_px       INT NOT NULL,
    rendered_at     TIMESTAMPTZ NOT NULL,
    UNIQUE (raw_file_id, page_number)
);

CREATE TABLE observations_alt (   -- valeurs écartées, conservées pour audit
    LIKE observations INCLUDING ALL,
    rejected_reason TEXT NOT NULL
);

CREATE TABLE events (
    id              BIGSERIAL PRIMARY KEY,
    country_iso3    CHAR(3) REFERENCES countries(iso3),  -- NULL = événement global
    date_start      DATE NOT NULL,
    date_end        DATE,
    kind            TEXT NOT NULL,   -- banking_crisis | currency_crisis | sovereign_default
                                     -- | war | regime_change | election | policy_reform
                                     -- | oil_shock | pandemic | monetary_regime
    label_fr        TEXT NOT NULL,
    label_en        TEXT NOT NULL,
    severity        SMALLINT,        -- 1..5, échelle documentée
    source_id       TEXT NOT NULL REFERENCES sources(id),
    source_url      TEXT NOT NULL,   -- NOT NULL : pas d'événement sans preuve
    notes_fr        TEXT
);
CREATE INDEX ON events (country_iso3, date_start);

CREATE TABLE state_vectors (       -- feature store, régénéré par batch
    country_iso3    CHAR(3) NOT NULL,
    year            SMALLINT NOT NULL,
    feature_code    TEXT NOT NULL,
    raw_value       DOUBLE PRECISION,
    pct_rank        DOUBLE PRECISION,   -- rang percentile dans le pool [0,1]
    is_complete     BOOLEAN NOT NULL,
    build_id        TEXT NOT NULL,      -- hash de la config de build
    PRIMARY KEY (country_iso3, year, feature_code, build_id)
);
```

Les événements sont saisis dans `data/events/*.yaml`, un fichier par type, chargés par un
script d'import. Exemple :

```yaml
# data/events/banking_crises.yaml
- country: FRA
  date_start: 1882-01-01
  kind: banking_crisis
  label_fr: "Krach de l'Union Générale"
  label_en: "Union Générale crash"
  severity: 4
  source_id: jst
  source_url: "https://www.macrohistory.net/database/"
  notes_fr: "Crise bancaire codée dans la chronologie JST."
```

---

## 7. Pipeline d'ingestion

Un script par source, dans `etl/sources/<source_id>.py`, exposant tous la même interface :

```python
class SourceLoader(Protocol):
    source_id: str
    def download(self, dest: Path) -> DownloadReport: ...      # idempotent, hash vérifié
    def parse(self, raw: Path) -> pd.DataFrame: ...            # → schéma long canonique
    def validate(self, df: pd.DataFrame) -> ValidationReport: ...
```

Sortie canonique commune, validée par `pandera` :
`country_iso3 | indicator_code | period_start | freq | value | source_id | flags…`

### 7.1 Étapes

1. **download** — récupération, écriture dans `data/raw/`, calcul SHA-256, mise à jour de
   `sources.file_sha256`. Si le hash est inchangé, on ne retraite pas.
2. **parse** — passage au format long. Mapping des noms de colonnes source → `indicator_code`
   dans un fichier `etl/mappings/<source_id>.yaml` **explicite et relu**, jamais deviné.
3. **validate** — contrôles bloquants (§12.1).
4. **reconcile** — application des règles de priorité (§5.3), écriture dans `observations` et
   `observations_alt`, génération de `reports/conflicts.md`.
5. **derive** — calcul des indicateurs dérivés (inflation, ratios/PIB, rendements réels).
6. **build_features** — construction du panel d'états (§8).

Chaque étape est une commande CLI : `macrolens etl download --source jst`, etc.
Le pipeline complet : `macrolens etl run-all`. **Il doit être rejouable de zéro en une commande.**

### 7.2 Conversions à faire une fois, correctement

- Ratios au PIB : toujours au **PIB nominal de la même année, même monnaie**. Jamais de mélange
  réel/nominal.
- Rendements réels actions : `(1 + r_nominal) / (1 + inflation) - 1`, pas la soustraction.
- Toute série en niveau (indice, monnaie) n'entre **jamais** telle quelle dans les features :
  seules des transformations stationnaires sont utilisées (§8.1).

### 7.3 Changements de monnaie

Franc → euro, mark → reichsmark → deutsche mark → euro, lire → euro, markka → euro.
Les séries en monnaie courante sont **raccordées par ratio de chevauchement** à la date de
conversion officielle, jamais par conversion nominale brute. Toute observation issue d'un
raccord porte `is_spliced = true`. Les taux de conversion et dates sont codés dans
`data/reference/currency_changes.yaml` avec source.

### 7.4 Zones de danger connues — à traiter explicitement

| Cas | Problème | Traitement retenu |
|---|---|---|
| Hyperinflation allemande 1922-23 | Inflation à 10¹⁰ % — écrase toute normalisation par z-score | Motive l'usage des rangs percentiles (§8.2). Années conservées, jamais supprimées. |
| Allemagne 1914-1924 / 1939-1949 | Discontinuité territoriale et statistique | `is_break = true`, **exclues du pool d'analogues par défaut**, toggle utilisateur pour les réintégrer |
| RFA/RDA → Allemagne réunifiée 1990 | Rupture de périmètre | `is_break = true` sur 1990-1991, documentée |
| Guerres mondiales, tous pays | Données de guerre souvent estimées a posteriori | Flag `wartime` dérivé de la table `events`, filtre UI dédié |
| COVID 2020-2021 | Outlier extrême sur PIB et chômage | Conservé, mais signalé comme épisode atypique quand il ressort comme analogue |
| Finlande 1917-1918 | Indépendance + guerre civile | `is_break = true` |

### 7.5 Aucune interpolation par défaut

Si un trou existe, `value = NULL`. Une année dont une feature obligatoire est manquante n'entre
pas dans le pool d'analogues (`is_complete = false`). C'est plus honnête qu'un remplissage.
Une seule exception autorisée, désactivée par défaut et signalée en UI : interpolation linéaire
sur **un trou d'un an maximum** entre deux points observés, uniquement pour les séries de stock
(dette, crédit) — jamais pour les flux ni les prix.

---

## 8. Moteur de similarité — spécification mathématique

C'est le cœur du produit. À implémenter exactement comme décrit, dans `core/similarity.py`.

### 8.1 Vecteur d'état

Un état est un couple (pays *c*, année *t*) décrit par 14 features. **Toutes les features sont
des transformations stationnaires** : on compare des *régimes*, pas des *époques*. Comparer des
niveaux bruts ferait ressembler 1950 à 1950 et rien d'autre.

| # | `feature_code` | Formule | Famille | Traitement §8.2.1 |
|---|---|---|---|---|
| 1 | `infl_level` | inflation IPC glissante à *t* | Prix | **(a) niveau** |
| 2 | `infl_accel` | inflation(*t*) − inflation(*t*−2) | Prix | **(b) variation** |
| 3 | `growth_level` | croissance PIB réel/hab à *t* | Activité | **(a) niveau** |
| 4 | `growth_gap` | croissance(*t*) − moyenne mobile 10 ans | Activité | **(b) variation** |
| 5 | `rate_short_real` | `rate_short` − `infl_level` | Taux | **(a) niveau** |
| 6 | `rate_short_delta` | `rate_short`(*t*) − `rate_short`(*t*−2) | Taux | **(b) variation** |
| 7 | `curve_slope` | `rate_long` − `rate_short` | Taux | **(a) niveau** |
| 8 | `debt_level` | `debt_public_gdp` à *t* | Dette | **(a) niveau** |
| 9 | `debt_delta5` | `debt_public_gdp`(*t*) − (*t*−5) | Dette | **(b) variation** |
| 10 | `credit_gap5` | `credit_private_gdp`(*t*) − (*t*−5) | Crédit | **(b) variation** |
| 11 | `equity_real_3y` | rendement réel actions cumulé sur 3 ans | Marchés | **(b) variation** |
| 12 | `house_real_3y` | variation réelle prix immobilier sur 3 ans | Marchés | **(b) variation** |
| 13 | `unemp_gap` | chômage(*t*) − moyenne mobile 10 ans | Activité | **(b) variation** |
| 14 | `ca_level` | `current_account_gdp` à *t* | Extérieur | **(a) niveau** |

Toutes les fenêtres glissantes sont **strictement rétrospectives** (aucune information de *t*+1
n'entre dans le vecteur d'état de *t*). C'est non négociable : un seul look-ahead invalide tout
le produit. À tester explicitement (§12.3).

### 8.2 Comparabilité entre époques — le problème central du projet

**Le problème.** Une dette publique à 60 % du PIB en 1890 était un niveau extrême ; en 2025
c'est un pays prudent. Le crédit privé pesait ~30 % du PIB vers 1900 et dépasse 110 %
aujourd'hui, sans qu'aucune crise n'explique cette hausse : c'est de l'approfondissement
financier. Trois pour cent d'inflation sous l'étalon-or était un choc, en 1978 un soulagement.
Un mouvement de 200 points de base sur les taux courts était un séisme en 1890 et une routine
en 1981.

Si on compare des niveaux bruts, ou même des rangs calculés sur le pool complet, la dérive
séculaire domine tout : chaque année ne ressemblera qu'à ses voisines temporelles, et le
moteur ne trouvera jamais que des analogues de la même décennie. **Le produit serait mort.**

**Le principe retenu.** On ne compare pas des valeurs, on compare des **positions relatives à
ce qui était normal à l'époque, dans le pays concerné**. C'est aussi ce qu'un contemporain
ressentait : la question n'est pas « l'inflation est-elle à 4 % ? » mais « l'inflation est-elle
haute par rapport à ce que ce pays a connu depuis une génération ? ».

#### 8.2.1 Deux traitements selon la nature de la feature

**(a) Features de niveau → rang percentile glissant, rétrospectif**

Pour une feature de niveau `f` observée en (pays *c*, année *t*), on calcule son rang dans la
fenêtre des **W = 30 années précédentes du même pays**, bornes strictement antérieures :

```
r(c, t, f) = #{ f(c, s) < f(c, t) : s ∈ [t−W, t−1] } / #{ s ∈ [t−W, t−1] : f(c, s) observé }
```

Lecture : `r = 0.95` signifie « plus élevé que 95 % de ce que ce pays a connu au cours des
30 dernières années ». Cette grandeur est comparable entre 1890 et 2025 par construction.

Concernées : `infl_level`, `growth_level`, `rate_short_real`, `curve_slope`, `debt_level`,
`ca_level`.

**(b) Features de variation → mise à l'échelle par la volatilité locale**

Un delta n'a de sens que rapporté à la volatilité normale de l'époque. On divise par
l'écart-type robuste (MAD × 1.4826) de la **même variable, même pays, 30 années précédentes** :

```
z(c, t, f) = Δf(c, t) / max( MAD_robuste(Δf(c, t−W … t−1)), plancher_f )
```

Puis on passe ce score à rang percentile sur le pool complet (les scores, eux, sont déjà
comparables entre époques). Le `plancher_f` évite l'explosion quand une variable a été
quasi immobile pendant 30 ans — valeurs déclarées dans `data/reference/feature_floors.yaml`.

Concernées : `infl_accel`, `growth_gap`, `rate_short_delta`, `debt_delta5`, `credit_gap5`,
`equity_real_3y`, `house_real_3y`, `unemp_gap`.

#### 8.2.2 Le référentiel est un paramètre, pas une constante

Quatre référentiels, exposés dans l'API et dans l'interface (`reference_frame`) :

| Valeur | Normalisation | Question à laquelle on répond |
|---|---|---|
| `rolling30` **(défaut)** | 30 ans glissants, même pays | « Est-ce anormal *pour ce pays, à cette époque* ? » |
| `era` | Au sein du régime monétaire (§8.2.3) | « Est-ce anormal *pour ce régime monétaire* ? » |
| `cross_section` | Parmi les autres pays de la **même année** | « Est-ce anormal *par rapport aux voisins au même moment* ? » |
| `pool` | Pool complet, tous pays toutes années | Comparaison absolue — utile pour l'inflation forte, trompeur pour la dette |

Ce n'est pas un réglage cosmétique : **changer le référentiel change la question posée**.
L'interface doit l'afficher en clair dans le panneau Scénario et dans la barre d'état, et le
`reference_frame` fait partie du `build_id` des résultats.

`rolling30` est le défaut parce qu'il est le seul strictement rétrospectif, pays par pays, et
donc le seul immunisé contre la dérive séculaire **et** contre le look-ahead.

#### 8.2.3 Régimes monétaires (pour `reference_frame = era`)

Découpage déclaré dans `data/reference/monetary_regimes.yaml`, par pays, avec source :

| Régime | Bornes indicatives |
|---|---|
| Étalon-or classique | 1870 – 1914 |
| Entre-deux-guerres / retour à l'or | 1919 – 1939 |
| Bretton Woods | 1946 – 1971 |
| Flottement, forte inflation | 1972 – 1985 |
| Désinflation, ciblage d'inflation | 1986 – 2007 |
| Post-crise, taux zéro | 2008 – 2021 |
| Resserrement, inflation de retour | 2022 – |

Les dates réelles varient par pays (la Suède quitte l'or en 1931, la France en 1936…) : le
fichier est renseigné **pays par pays**, sourcé, jamais approximé sur un découpage global.

#### 8.2.4 Ce que ça coûte, honnêtement

La fenêtre glissante exige un historique. Avec W = 30 et un minimum de **20 observations
valides**, les vecteurs d'état ne deviennent calculables qu'à partir de ~1890-1900 selon les
pays et les variables.

**Le pool exploitable démarre donc vers 1895, pas 1870.** Les années 1870-1894 restent en base,
consultables dans l'explorateur de séries et utilisées comme *historique de référence* pour
normaliser les années suivantes — mais elles ne sont pas candidates comme analogues. C'est le
prix de la comparabilité, et il est bien inférieur au coût de l'alternative (des analogues
faux). À écrire dans `docs/limitations.md` et à afficher dans la vue Couverture.

#### 8.2.5 Double affichage obligatoire

Partout où une valeur normalisée apparaît, la valeur brute apparaît aussi. Format imposé :

```
Dette/PIB      112.4 %   ·  r30 = 0.98   (au plus haut depuis 30 ans)
Inflation        4.5 %   ·  r30 = 0.91
Δ taux 2 ans   +2.00 pp  ·  z   = 2.4 σ  (mouvement fort pour l'époque)
```

Et dans le tableau des analogues, la comparaison est explicite :

```
                        FRA 2025          SWE 1990
Dette/PIB          112.4 % (r 0.98)   43.8 % (r 0.96)
```

Ce tableau est la meilleure réponse à ta question : **43,8 % en Suède 1990 et 112,4 % en France
2025 sont le même événement** — un pays au plus haut de son propre historique de dette. C'est
cette équivalence que le moteur exploite, et elle doit être visible à l'écran, sinon l'utilisateur
croira à une erreur.

#### 8.2.6 Avertissement d'écart d'époque

Règle déterministe dans `core/warnings.py` : si un analogue est distant de plus de **50 ans** de
l'ancre et que sa distance repose à plus de 40 % sur des features de niveau, l'interface affiche :

> *Analogue distant de 87 ans. Le rapprochement porte sur des positions relatives, pas sur des
> niveaux comparables (dette 43,8 % vs 112,4 %). Structures économiques très différentes.*

#### 8.2.7 Pourquoi pas de z-score global

L'hyperinflation allemande de 1923 produit un z-score à plusieurs milliers et écrase toute la
dimension inflation. Le rang percentile est borné, robuste aux queues extrêmes, préserve
l'ordre, et se combine naturellement avec les fenêtres glissantes. Les seuls z-scores du système
sont **locaux** (§8.2.1b), calculés sur 30 ans d'un seul pays, puis eux-mêmes convertis en rangs.

#### 8.2.8 Tests spécifiques (à ajouter au §12.3)

8. **Test de dérive séculaire** *(critique)* : sur le pool normalisé en `rolling30`, la
   corrélation entre l'écart temporel |année_a − année_b| et la distance `d(a,b)` doit être
   **quasi nulle** (|ρ| < 0,10). Si elle est nettement positive, la normalisation ne fait pas
   son travail et le moteur ne fait que retrouver des voisins temporels.
9. **Test d'équivalence structurelle** : (SWE, 1990) et (ESP, 2007) doivent apparaître dans
   leurs 20 plus proches voisins réciproques malgré 17 ans et des niveaux de dette très
   différents. C'est le cas d'école du produit.
10. **Test anti-look-ahead sur fenêtre glissante** : la fenêtre est strictement `[t−30, t−1]`.
    Tronquer la base à *t* ne doit rien changer au vecteur d'état de *t*. (Extension du test 1,
    à rejouer spécifiquement sur les features de type (a) et (b).)
11. **Test de sensibilité au référentiel** : les quatre `reference_frame` doivent produire des
    résultats *différents* sur au moins une requête canonique. S'ils donnent tous la même chose,
    l'un d'eux n'est pas implémenté.

### 8.3 Distance

Distance euclidienne pondérée sur les rangs :

```
d(a, b) = sqrt( Σ_f  w_f · (pct_rank_f(a) − pct_rank_f(b))² )   avec  Σ_f w_f = 1
```

- Poids par défaut : uniformes (1/14).
- Poids par famille modifiables par l'utilisateur (sliders : Prix, Activité, Taux, Dette,
  Crédit, Marchés, Extérieur). Les poids sont renormalisés à 1 côté serveur.
- Poids nul autorisé = la dimension est ignorée.
- **Distance normalisée affichée** : `d_norm = d / sqrt(Σ w_f) ∈ [0,1]`, convertie en score de
  similarité `100 · (1 − d_norm)` pour l'UI.

**Option Mahalanobis** (paramètre `metric=mahalanobis`) : les features sont corrélées
(inflation ↔ taux courts). La distance de Mahalanobis avec la matrice de covariance du pool
corrige ce double comptage. À implémenter en v1.1, avec la matrice calculée sur le pool et
régularisée (Ledoit-Wolf) pour éviter la singularité. **Euclidienne pondérée en v1** : plus
lisible, plus explicable, et l'explicabilité est un objectif du produit.

**Option trajectoire (DTW)** — v1.2 : comparer non pas un point mais une fenêtre de 5 ans
(*t*−4 … *t*), avec Dynamic Time Warping sur les séquences de rangs. Répond à « quelle période
ressemble à *notre trajectoire*, pas juste à *notre instantané* ». À garder pour plus tard :
la version ponctuelle doit être irréprochable d'abord.

### 8.4 Règles d'exclusion du pool

Une observation candidate est exclue si :

1. `is_complete = false` (au moins une feature obligatoire manquante) ;
2. elle appartient au même pays que la requête et |année − année_requête| ≤ **3**
   (évite l'auto-appariement trivial et l'autocorrélation) ;
3. il reste moins de `H` années de données après elle, où `H` = horizon maximal demandé
   (sinon on ne peut pas calculer l'outcome — **une observation ne peut pas être un analogue
   si son avenir n'est pas observable**) ;
4. `is_break = true` et le toggle « inclure les ruptures » est off ;
5. `coverage_partial = true` et le toggle « inclure 1850-1869 » est off ;
6. l'utilisateur a exclu ce pays ou cette plage d'années.

La règle 3 a une conséquence importante : **les 10 dernières années ne peuvent jamais être des
analogues pour l'horizon 10 ans.** L'UI doit le dire.

### 8.5 Sortie du moteur

Pour chaque requête, on retourne les *k* plus proches (défaut k = 20, max 100), chacun avec :
distance, score de similarité, contribution de chaque feature à la distance (`w_f · Δ_f²`,
qui permet d'afficher **pourquoi** ce match), et les valeurs brutes comparées.

L'affichage de la décomposition de la distance est obligatoire. Un analogue non explicable
est un analogue inutilisable.

---

## 9. Moteur d'outcomes

Dans `core/outcomes.py`. Pour chaque analogue (pays *c*, année *t*) et chaque horizon
*h* ∈ {1, 3, 5, 10} :

### 9.1 Variables de sortie

| Code | Calcul | Unité |
|---|---|---|
| `out_growth_cum` | croissance réelle cumulée PIB/hab de *t* à *t*+*h* | % |
| `out_growth_ann` | équivalent annualisé | % |
| `out_inflation_ann` | inflation moyenne annualisée sur la fenêtre | % |
| `out_equity_real_cum` | rendement réel actions cumulé (total return) | % |
| `out_bond_real_cum` | rendement réel obligataire cumulé | % |
| `out_house_real_cum` | variation réelle prix immobilier | % |
| `out_unemp_change` | variation du taux de chômage (points) | pp |
| `out_rate_short_change` | variation du taux court (points) | pp |
| `out_debt_change` | variation dette/PIB (points) | pp |
| `out_banking_crisis` | crise bancaire survenue dans (*t*, *t*+*h*] ? | booléen |
| `out_recession_years` | nombre d'années de croissance négative | entier |
| `out_max_drawdown_equity` | pire perte réelle actions dans la fenêtre | % |

### 9.2 Agrégation — et ce qu'on interdit

Pour chaque variable et chaque horizon, sur les *k* analogues :

- **n** (affiché systématiquement, en gros)
- médiane, Q1, Q3, min, max
- part des cas < 0
- pour les booléens : fréquence brute, exprimée « X épisodes sur n »

**Interdits :**
- Toute moyenne présentée seule.
- Tout intervalle de confiance paramétrique. Les fenêtres se chevauchent, les observations sont
  autocorrélées, les hypothèses ne tiennent pas. On montre la dispersion empirique, point.
- Toute phrase du type « il y a X % de chances que… ». La formulation imposée dans toute l'UI
  est : **« sur les n épisodes historiques les plus proches, m ont été suivis de… »**.

### 9.3 Pondération par la similarité (option)

Paramètre `weighting = equal | similarity`. En mode `similarity`, chaque analogue reçoit un
poids `(1 − d_norm)^2` normalisé, et on calcule des quantiles pondérés. Par défaut : `equal`,
plus simple à expliquer. Les deux doivent donner un résultat affichable côte à côte.

### 9.4 Garde-fous d'affichage

- Si n < 5 : bandeau d'avertissement, distribution affichée mais agrégats grisés.
- Si les analogues sont concentrés sur ≤ 2 pays ou ≤ 2 décennies : affichage d'un indicateur
  de concentration (indice de Herfindahl sur pays et sur décennies) avec avertissement.
- Chaque épisode est toujours listable nominativement : « Suède 1991 », « Finlande 1990 »,
  cliquable vers sa fiche détaillée.

---

## 10. API

FastAPI, préfixe `/api/v1`. Sans état, réponses cacheables, OpenAPI généré.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/meta/countries` | Liste + couverture réelle par pays |
| GET | `/meta/indicators` | Catalogue avec définitions et unités |
| GET | `/meta/sources` | Sources, licences, citations, dates de récupération |
| GET | `/meta/coverage` | Matrice pays × indicateur × décennie (pour la heatmap de couverture) |
| GET | `/series` | Séries brutes. Params : `country`, `indicator`, `from`, `to`, `freq` |
| GET | `/state/{country}/{year}` | Vecteur d'état complet d'une observation |
| GET | `/events` | Événements filtrés par pays / type / période |
| POST | `/analogs/search` | **Endpoint central** (voir ci-dessous) |
| GET | `/episodes/{country}/{year}` | Fiche complète d'un épisode + contexte + événements |
| POST | `/compare` | Comparaison directe de 2..6 couples (pays, année) |
| GET | `/export/{search_id}` | Export CSV/JSON d'un résultat de recherche |
| POST | `/provenance/receipt` | **Bordereau** : lignes exactes ayant produit un rendu (§18) |
| GET | `/provenance/observation` | Fiche de traçabilité d'une valeur unique |
| GET | `/provenance/page/{raw_file_id}/{page}` | Image de la page source (WebP) |
| GET | `/provenance/raw-files` | Inventaire des fichiers sources + hash + URL |
| GET | `/health`, `/version` | `version` renvoie le `build_id` des données |

### 10.1 `POST /analogs/search`

```jsonc
// Requête — trois modes d'entrée, un seul à la fois
{
  "mode": "anchor",                      // "anchor" | "manual" | "shock"

  // mode "anchor" : partir d'une situation historique ou actuelle réelle
  "anchor": { "country": "FRA", "year": 2025 },

  // mode "manual" : l'utilisateur fixe directement les features
  "state": { "infl_level": 4.5, "rate_short_real": 0.5, "debt_public_gdp": 112.0 },

  // mode "shock" : partir d'une ancre et appliquer des deltas
  "shock": {
    "base": { "country": "FRA", "year": 2025 },
    "deltas": { "rate_short_delta": 2.0, "infl_level": 3.0 }
  },

  "k": 20,
  "horizons": [1, 3, 5, 10],
  "weights": { "prices": 0.3, "rates": 0.3, "debt": 0.2, "activity": 0.1,
               "credit": 0.1, "markets": 0.0, "external": 0.0 },
  "filters": {
    "countries": null,                   // null = tous
    "year_min": 1870, "year_max": null,
    "include_breaks": false,
    "include_partial_coverage": false,
    "exclude_wartime": false
  },
  "weighting": "equal",
  "metric": "euclidean",
  "reference_frame": "rolling30"   // rolling30 | era | cross_section | pool
}
```


```jsonc
// Réponse
{
  "build_id": "d41f8a…",
  "query_echo": { /* requête normalisée, poids renormalisés */ },
  "pool_size": 2431,                      // nombre de candidats après filtres
  "excluded": { "incomplete": 187, "breaks": 42, "too_recent": 60, "self_adjacent": 7 },
  "analogs": [
    {
      "country": "SWE", "year": 1990,
      "distance": 0.184, "similarity": 81.6,
      "feature_contributions": { "infl_level": 0.031, "credit_gap5": 0.058, "…": 0.0 },
      "state": { /* valeurs brutes + rangs */ },
      "context_events": [ { "kind": "banking_crisis", "label_fr": "Crise bancaire nordique", "date_start": "1991-09-01" } ],
      "outcomes": {
        "3":  { "out_growth_cum": -4.2, "out_equity_real_cum": -18.7, "out_banking_crisis": true },
        "10": { "out_growth_cum": 18.9, "out_equity_real_cum": 121.4, "out_banking_crisis": true }
      }
    }
  ],
  "aggregates": {
    "3": {
      "out_growth_cum": { "n": 20, "median": 1.8, "q1": -2.1, "q3": 5.4,
                          "min": -11.2, "max": 12.0, "share_negative": 0.35 },
      "out_banking_crisis": { "n": 20, "count_true": 6 }
    }
  },
  "concentration": { "hhi_country": 0.19, "hhi_decade": 0.22, "n_countries": 9, "n_decades": 8 },
  "warnings": ["Trois analogues appartiennent à la crise nordique 1990-1993 (épisodes corrélés)."]
}
```

Le champ `warnings` est produit par des règles déterministes listées dans `core/warnings.py`
(épisodes corrélés, n faible, concentration, présence d'années de guerre, etc.).

---

## 11. Interface — application de poste de travail

### 11.0 Direction, non négociable

**Référence assumée : Macrobond et le terminal Bloomberg. Fond blanc, densité maximale,
rigidité assumée.** MacroLens est un instrument de travail, pas un produit à vendre. On imite
la grammaire du logiciel financier professionnel : barre de menus, panneaux redimensionnables,
grilles denses, chiffres en chasse fixe, barre d'état permanente.

L'utilisateur cible passe des heures dessus, connaît son domaine, et veut voir le maximum
d'information au premier écran sans faire défiler ni cliquer pour révéler.

**Interdits explicites — liste bloquante en revue de code :**

| Interdit | Pourquoi |
|---|---|
| `border-radius` > 2px | Le logiciel financier a des angles droits |
| `box-shadow`, élévation, cartes flottantes | Aucune profondeur : on sépare par des filets 1px |
| Dégradés, glassmorphism, flou d'arrière-plan | — |
| Page d'accueil marketing, hero, slogan, illustration | L'application ouvre **directement** sur l'espace de travail |
| Animation > 120 ms, transitions décoratives, apparitions au défilement | Le seul mouvement autorisé est fonctionnel (curseur, redimensionnement) |
| Emoji, icônes rondes, avatars, badges colorés « pilule » | — |
| Espacement généreux, grands titres, sections aérées | La densité est une fonctionnalité |
| Modales pour de l'information | Tout va dans un panneau ancré |
| Défilement infini, chargement progressif décoratif | — |
| Rouge/vert comme seul porteur de sens | Convention finance **et** accessibilité : bleu/rouge |
| Vert acide, violet, dégradé de marque | La couleur signifie une donnée, jamais une identité |

**Test de recette visuelle :** une capture d'écran de MacroLens posée à côté d'une capture de
Macrobond ne doit pas trancher par le style. Si un designer de startup trouve l'interface
« datée », c'est réussi.

### 11.1 Jetons de conception

```css
/* Surfaces — le fond est blanc, point. */
--bg-app:        #FFFFFF;   /* canevas de travail */
--bg-chrome:     #F4F5F6;   /* barres d'outils, en-têtes de colonnes */
--bg-row-alt:    #FAFBFC;   /* zébrage de tableau, très léger */
--bg-selected:   #E4EEF7;   /* ligne sélectionnée */
--bg-hover:      #F0F4F8;

/* Filets — la structure est portée par des traits de 1px, pas par des ombres */
--rule:          #D2D6DB;   /* séparateur de panneau */
--rule-light:    #E6E9EC;   /* grille interne de tableau */
--grid-chart:    #EAECEF;   /* grille de graphique */
--axis:          #8B9298;

/* Texte */
--fg:            #16191C;
--fg-secondary:  #5A6169;
--fg-muted:      #8B9298;   /* unités, notes, valeurs estimées */

/* Sémantique — bleu/rouge, jamais vert/rouge */
--pos:           #0B5FA5;   /* variation positive */
--neg:           #B3242B;   /* variation négative */
--accent:        #0B5FA5;   /* élément interactif, sélection */
--flag:          #B26B00;   /* donnée interpolée, raccordée, rupture */
--crisis:        #B3242B;   /* bandes de crise sur les frises */

/* Séries de graphiques — 8 teintes désaturées, discriminables en niveaux de gris */
--s1:#1F4E79; --s2:#B3242B; --s3:#4C7A34; --s4:#7A5195;
--s5:#00707C; --s6:#A85B00; --s7:#5A6169; --s8:#8C3A6B;
```

**Typographie**

| Rôle | Fonte | Taille | Usage |
|---|---|---|---|
| Chrome | IBM Plex Sans | 12 px / 16 px | Menus, libellés, en-têtes |
| Micro-chrome | IBM Plex Sans | 10 px, `letter-spacing: .04em`, majuscules | En-têtes de colonnes, titres de panneaux |
| **Chiffres** | **IBM Plex Mono, `font-variant-numeric: tabular-nums`** | 12 px | **Toute valeur numérique, sans exception** |
| Corps (méthodologie) | IBM Plex Sans | 13 px / 20 px | Uniquement pages `/sources` et `/methodology` |

Choix justifié : Plex a été dessiné pour de la documentation technique, ses chiffres en chasse
fixe s'alignent en colonne au pixel, et la famille couvre sans/mono/condensed. Ce n'est ni la
grotesque géométrique par défaut du web moderne, ni une serif éditoriale — c'est une fonte
d'instrument. Une colonne de nombres qui ne s'aligne pas est un défaut bloquant.

**Grille et densité**

```
base 4px · hauteur de ligne de tableau 24px · en-tête de tableau 26px
barre de menus 28px · barre d'outils 32px · barre d'état 22px
titre de panneau 24px · gouttière entre panneaux 1px (un filet, pas un espace)
padding de cellule 6px horizontal / 3px vertical
```

Densité cible : **≥ 30 lignes de tableau visibles** sur un écran 1080p sans défilement.

### 11.2 Structure de fenêtre

Pas de pages qui se remplacent : un espace de travail persistant, comme un logiciel de bureau.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Fichier  Édition  Scénario  Données  Fenêtre  Aide          MacroLens 1.0      │ 28px
├────────────────────────────────────────────────────────────────────────────────┤
│ [Ancre▾][Manuel][Choc]  k[ 20]  Horizons[1][3][5][10]  Métrique[Euclid▾] [F5]  │ 32px
├───────────────────┬────────────────────────────────────────┬───────────────────┤
│ SCÉNARIO          │ ANALOGUES (20)                         │ BORDEREAU         │
│                   ├────────────────────────────────────────┤                   │
│ Pays    [FRA  ▾]  │ #  PAYS  ANNÉE   SIM   ΔPIB3  ACT10 CB │ 187 obs.          │
│ Année   [2025  ]  │ ─────────────────────────────────────  │ 3 sources         │
│                   │ 1  SWE   1990   81.6   -4.2  +121  ●   │                   │
│ ── PRIX ────────  │ 2  FIN   1990   79.1   -8.7   +94  ●   │ jst        174    │
│ Infl.       4.50  │ 3  ESP   2007   77.4   -3.1   +12  ●   │ imf_weo     11    │
│ Accél.     +1.20  │ 4  JPN   1990   74.2   -0.4   -31  ●   │ maddison     2    │
│ ── TAUX ────────  │ 5  NOR   1988   72.8   -1.9   +88  ●   │                   │
│ Court réel  0.50  │ …                                      │ [Tableau]         │
│ Δ 2 ans    +2.00  ├────────────────────────────────────────┤ [Sources]         │
│ Pente      +1.30  │ ÉVENTAIL — Actions réel, indice 100    │ [Vue source]      │
│ ── DETTE ───────  │  260┤                             ╱    │                   │
│ Dette/PIB 112.00  │     │                        ╱─╱       │ ⚑ 4 valeurs       │
│ Δ 5 ans   +14.00  │  180┤             ╱────╱──╱            │   raccordées      │
│ ── CRÉDIT ──────  │     │      ╱──╱───  ▓▓▓▓ Q1–Q3         │                   │
│ Gap 5 ans  +8.00  │  100┼──╱────────────────────────       │ [Exporter ▾]      │
│                   │     │                                  │                   │
│ ── POIDS ───────  │   40┤  ╲──╲___                         │                   │
│ Prix       0.30▬  │     └──┬───┬───┬───┬───┬───┬───┬───    │                   │
│ Taux       0.30▬  │       t  +2  +4  +6  +8  +10           │                   │
│ Dette      0.20▬  ├────────────────────────────────────────┤                   │
│ Activité   0.10▬  │ CHRONOLOGIE 1870 ──────────────── 2025 │                   │
│ Crédit     0.10▬  │ ▏  ▏ ▏▏   ▏  ▏▏▏ ▏  ▏▏  ▏ ▏▏▏  ▏  ▏    │                   │
│ Marchés    0.00▬  │ ▒▒crises bancaires▒▒                   │                   │
├───────────────────┴────────────────────────────────────────┴───────────────────┤
│ build d41f8a · 2 431 candidats · 296 exclus · n=20 · HHI pays 0.19 · 41 ms      │ 22px
└────────────────────────────────────────────────────────────────────────────────┘
```

- **Trois colonnes, séparateurs déplaçables**, largeurs mémorisées en `localStorage`.
- Le panneau central s'empile verticalement : tableau, graphique, chronologie — chacun
  redimensionnable, aucun repliable par défaut.
- **Barre d'état toujours visible** : identifiant de build, taille du pool, exclusions, n,
  concentration, temps de calcul. C'est la signature de l'application — l'utilisateur voit en
  permanence sur quoi repose ce qu'il regarde.
- Onglets de document en haut du panneau central pour ouvrir plusieurs scénarios en parallèle.

### 11.3 Vues (onglets, pas pages)

| Vue | Raccourci | Contenu |
|---|---|---|
| Scénario | `F2` | La disposition ci-dessus |
| Épisode | `F3` | Toutes les séries autour d'une année, frise d'événements, ce qui a suivi |
| Explorateur de séries | `F4` | Sélection pays × indicateurs, superposition, export |
| Comparateur | `F6` | 2 à 6 épisodes en colonnes, tableau + petits multiples |
| Couverture | `F7` | Matrice pays × indicateur × décennie |
| Sources & méthode | `F8` | Sources, licences, citations, formules |

`Ctrl+K` ouvre une ligne de commande (« FRA 2025 », « SWE 1990 vs FIN 1990 », « credit_gap5 »)
qui exécute directement une requête. C'est un logiciel piloté au clavier avant d'être piloté à
la souris. **Chaque action de barre d'outils doit avoir un raccourci et l'afficher.**

### 11.4 Tableaux

- Ligne 24 px, zébrage `--bg-row-alt`, filet horizontal `--rule-light`, **pas de filets verticaux**
  sauf séparation de groupes de colonnes.
- En-tête collant, 26 px, `--bg-chrome`, libellé 10 px majuscules, filet 1px `--rule` en bas.
- Nombres alignés à droite, chasse fixe, tabulaires, **nombre de décimales fixe par indicateur**
  (déclaré dans `indicators`). Jamais d'arrondi variable d'une ligne à l'autre.
- Séparateur de milliers = espace fine insécable. Négatifs en `--neg` avec signe moins réel (−),
  pas de parenthèses ni de couleur seule.
- Valeur manquante = `—` en `--fg-muted`, jamais `0`, jamais une case vide.
- Valeur flaguée = filet vertical 2px `--flag` en bord gauche de cellule + infobulle du motif.
- Colonnes redimensionnables, réordonnables, triables sur trois états (asc / desc / ordre naturel).
- Sélection de lignes au clavier, `Ctrl+C` copie en TSV collable dans Excel.

### 11.5 Graphiques

Configuration ECharts imposée, centralisée dans `charts/theme.ts` :

- Fond blanc, **aucune bordure de conteneur** (le filet du panneau suffit).
- Grille : `--grid-chart`, horizontale seulement, 1px, continue. Pas de pointillés décoratifs.
- Axes : filet `--axis` 1px, graduations sortantes 4px, étiquettes 10 px en chasse fixe.
- Séries : **trait 1 px**, pas de lissage de courbe (`smooth: false`), pas d'aplat dégradé,
  pas de marqueurs sauf sur les points isolés.
- Éventail : analogues en `#C4C9CE` 0,75 px, bande Q1–Q3 en aplat `#DCE6EF` sans transparence
  variable, médiane en `--fg` 1,75 px. Ligne verticale pleine à *t*=0.
- Légende = **petit tableau sous le graphique** (série, dernière valeur, variation), pas des
  pastilles arrondies flottantes.
- Survol : réticule croisé sur les deux axes + infobulle **ancrée dans un coin fixe**, jamais
  une bulle qui suit le curseur et masque les données.
- Titre du graphique : 11 px majuscules à gauche ; unité et échelle en `--fg-muted` à droite.
- Aucune animation à l'entrée (`animation: false`). Le redessin est instantané.
- Chaque graphique porte en pied, en 9 px `--fg-muted` : source(s), identifiant de build, et le
  bouton `Données utilisées (n)` du §18.

### 11.6 Contrôles

Champs rectangulaires 24 px, bordure 1px `--rule`, fond blanc, focus = bordure `--accent` 1px
+ contour 2px (jamais un halo flou). Boutons rectangulaires, 24 px, texte 11 px, `--bg-chrome`,
bordure 1px ; l'action primaire est le texte en `--accent`, **pas un bouton plein coloré**.
Curseurs de poids = rail 2px + poignée carrée 10px, avec la valeur numérique éditable à côté :
tout curseur doit aussi être saisissable au clavier.

### 11.7 Vocabulaire d'interface

Sobre, technique, à la voix active. « Rechercher les précédents », pas « Découvrir les
insights ». Aucune exclamation, aucun ton commercial, aucun encouragement. Les erreurs disent
ce qui a échoué et quoi faire. Les vides disent ce qu'il manque et où cliquer.

Rappel du §11 précédent, toujours actif : les termes `prévision`, `prédiction`,
`probabilité que`, `attendu` sont interdits et testés automatiquement (§12.4).

### 11.8 Plancher de qualité

Densité maximale ne dispense de rien : focus clavier visible (contour 2px, jamais supprimé),
navigation complète au clavier y compris dans les grilles, contraste AA sur tout texte y compris
le 10 px, `prefers-reduced-motion` respecté, information jamais portée par la seule couleur
(un flag a toujours un marqueur de forme en plus de sa teinte).

Pas de responsive mobile : c'est une application de poste de travail, largeur minimale 1280 px.
En dessous, un message le dit clairement. Assumé et écrit dans `docs/limitations.md`.

### 11.9 Note sur « en Python »

Si l'objectif est un vrai logiciel de bureau installable façon Macrobond, la voie Python native
existe : **PySide6 (Qt) + pyqtgraph**, avec le même `core/` réutilisé tel quel. C'est
techniquement viable et le rendu serait encore plus proche de la référence.

**Recommandation : rester sur la pile web décrite au §4.** Raisons : déploiement et itération
plus rapides, pas d'empaquetage par système d'exploitation, pas de gestion de mises à jour, et
ECharts est très supérieur à pyqtgraph pour les heatmaps et les frises. La cible visuelle décrite
ci-dessus est parfaitement atteignable en HTML — Macrobond Web existe et ressemble à Macrobond.
La frontière `core/` posée au §14 laisse de toute façon la porte ouverte : si un client lourd
devient nécessaire, seule la couche de présentation est à réécrire.

---

## 12. Qualité, tests, validation

### 12.1 Contrôles bloquants à l'ingestion

Le pipeline échoue si :
- un `indicator_code` n'existe pas dans `indicators` ;
- un `country_iso3` n'existe pas dans `countries` ;
- une date sort de [1800, année courante] ;
- une valeur viole les bornes déclarées de l'indicateur (taux de chômage hors [0, 100],
  ratio dette/PIB négatif, indice ≤ 0…) ;
- une clé primaire est dupliquée ;
- une source n'a ni URL ni citation ;
- un événement n'a pas de `source_url` ;
- le taux de complétude d'un pays cœur passe sous un seuil défini par indicateur.

### 12.2 Contrôles d'alerte (non bloquants, rapportés)

Variation annuelle > 10 écarts-types robustes (MAD) ; changement de signe inhabituel ;
plateau suspect (même valeur ≥ 5 ans consécutifs) ; divergence > 5 % entre sources ;
trou nouvellement apparu par rapport au build précédent.

### 12.3 Tests du moteur — les tests qui comptent

1. **Test anti-look-ahead** *(critique)* : construire le vecteur d'état de (FRA, 1990) sur la
   base complète, puis sur une base tronquée à 1990 inclus. Les deux vecteurs doivent être
   **identiques**. Tout écart = fuite d'information future = bug bloquant.
2. **Test d'identité** : la recherche d'analogues pour (SWE, 1990) sans exclusion de voisinage
   doit renvoyer (SWE, 1990) en premier, distance 0.
3. **Test de symétrie** : `d(a,b) == d(b,a)`.
4. **Test d'inégalité triangulaire** sur 1 000 triplets aléatoires.
5. **Test d'invariance à l'échelle** : multiplier une série d'indice par 1 000 ne doit pas
   changer les rangs, donc pas les distances.
6. **Test de reproductibilité** : deux exécutions du pipeline complet sur les mêmes fichiers
   sources produisent le même `build_id` et des résultats identiques.
7. **Snapshots de non-régression** : 10 requêtes canoniques (dont FRA 2025, USA 1979,
   JPN 1990, SWE 1990, ESP 2007) avec leurs 20 analogues figés en JSON. Toute évolution
   volontaire du moteur exige la mise à jour explicite du snapshot dans le commit.

### 12.4 Tests de vocabulaire

Un test parcourt les fichiers de traduction et les composants front à la recherche des termes
interdits (`prévision`, `prédit`, `probabilité que`, `forecast`, `expected value`) et échoue
s'il en trouve hors d'un contexte explicatif whitelisté.

### 12.4bis Tests de conformité visuelle

Un test parcourt le CSS et les composants compilés et échoue s'il trouve : un `border-radius`
supérieur à 2px, un `box-shadow` non nul, un `linear-gradient`, une `transition-duration`
supérieure à 120 ms, un caractère emoji dans une chaîne d'interface, ou une valeur numérique
rendue dans une fonte non monospace (vérifié par une règle ESLint sur le composant `<Num>`,
seul autorisé à afficher un nombre).

Toute valeur numérique passe obligatoirement par `<Num value unit indicator />`, qui applique
la fonte, l'alignement, le nombre de décimales déclaré et le marqueur de flag. Un nombre écrit
en dur dans du JSX est un échec de revue.

### 12.5 Validation par des cas connus (sanity checks documentés)

À la fin de la phase 4, produire `reports/validation.md` répondant à :

- La recherche ancrée sur **Espagne 2007** fait-elle remonter Suède 1990, Finlande 1990,
  Japon 1990, USA 2006 ? (Configuration classique de boom du crédit — c'est le résultat
  attendu par la littérature. Si le moteur ne les trouve pas, il est cassé.)
- **USA 1979** remonte-t-il des configurations de forte inflation avec taux réels négatifs ?
- **France 2020** est-il correctement signalé comme atypique (peu d'analogues proches) ?
- La fréquence de crise bancaire dans les 3 ans après un `credit_gap5` élevé est-elle
  nettement supérieure à la fréquence de base ? (Résultat robuste de Schularick-Taylor ;
  c'est un test de cohérence externe du pipeline.)

Ce document de validation est autant un livrable que le code.

---

## 13. Roadmap par phases

> Chaque phase se termine par un commit taggé et une démonstration exécutable.
> Pas de phase suivante sans critères d'acceptation validés.

### Phase 0 — Socle (½ journée)
Monorepo, Docker Compose (postgres + api + web), `uv`, ruff/mypy/pytest, CI GitHub Actions,
`CLAUDE.md` contenant les 6 règles permanentes, README avec le périmètre et les non-objectifs.

✅ *Acceptation* : `docker compose up` démarre les 3 services ; `make check` passe (lint,
types, tests) ; la CI est verte.

### Phase 1 — Modèle de données et référentiels (1 jour)
Migrations Alembic pour les 7 tables. Seed de `countries`, `indicators` (avec définitions FR
complètes), `sources`. Fichiers YAML d'événements initiaux : crises bancaires JST, guerres
majeures, chocs pétroliers, changements de régime monétaire (étalon-or, Bretton Woods, SME, euro).

✅ *Acceptation* : `alembic upgrade head` puis `macrolens seed` remplit les référentiels ;
les 24 indicateurs ont une définition FR non vide ; tout événement a une `source_url`.

### Phase 2 — Ingestion JST (1,5 jour)
Loader JST complet : téléchargement, hash, parsing du `.dta`, mapping explicite vers les codes
d'indicateurs, validation pandera, chargement. Extraction de la chronologie des crises bancaires
vers `events`. Rapport de couverture généré.

✅ *Acceptation* : ≥ 250 000 observations en base ; les 6 pays cœur ont ≥ 90 % de complétude
sur PIB, IPC, taux court, taux long, dette/PIB, crédit/PIB pour 1870-2020 hors guerres ;
`reports/coverage.md` généré ; `macrolens etl run-all` rejouable de zéro.

### Phase 3 — Sources complémentaires et dérivations (2 jours)
Loaders Maddison, FMI (WEO + dette historique), BRI (taux directeurs). Moteur de réconciliation
avec priorités. Raccords de monnaies. Calcul de tous les indicateurs dérivés. Rapport de conflits.

✅ *Acceptation* : la couverture 1850-1869 existe et est flaguée `coverage_partial` ; la base
va jusqu'à la dernière année complète ; `reports/conflicts.md` liste les écarts > 5 % et chacun
a une décision écrite ; aucun trou comblé silencieusement.

### Phase 4 — Moteur de similarité et d'outcomes (3,5 jours)
`core/features.py`, `core/normalize.py`, `core/similarity.py`, `core/outcomes.py`,
`core/warnings.py`. Feature store, **normalisation inter-époques du §8.2 (le morceau le plus
délicat du projet)**, distance pondérée, exclusions, agrégations, garde-fous.
Toute la batterie de tests §12.3 et le rapport de validation §12.5.

✅ *Acceptation* : **le test anti-look-ahead passe** ; **le test de dérive séculaire passe
(|ρ| < 0,10 entre écart temporel et distance)** ; les 11 tests du moteur passent ;
les 4 `reference_frame` sont implémentés et donnent des résultats distincts ;
`reports/validation.md` est écrit et ses résultats sont conformes aux attentes documentées ;
une recherche k=20 s'exécute en < 50 ms ; couverture de tests ≥ 85 % sur `core/`.

### Phase 5 — API (1,5 jour)
Tous les endpoints §10, schémas Pydantic stricts, OpenAPI, pagination, gestion d'erreurs
explicite, chargement du panel en mémoire au démarrage, cache LRU, endpoint `/version`
renvoyant le `build_id`.

✅ *Acceptation* : `/docs` complet et exact ; tests d'intégration sur chaque endpoint ;
`POST /analogs/search` répond en < 150 ms p95 ; toute réponse contenant des données porte
un bloc de sources.

### Phase 6 — Interface (4 jours)
**Commencer par les jetons du §11.1 et le thème ECharts du §11.5** — ils sont figés avant
d'écrire le premier composant. Puis la coque de fenêtre du §11.2 (menus, barres, panneaux
déplaçables, barre d'état), puis la vue Scénario, puis les 5 autres vues. Ligne de commande
`Ctrl+K`, raccourcis F2–F8, permalien dans l'URL, exports, panneau Bordereau du §18.

✅ *Acceptation* : les 3 modes de scénario fonctionnent ; ≥ 30 lignes de tableau visibles en
1080p ; toute valeur numérique est en chasse fixe tabulaire et alignée à droite ; aucun
`border-radius` > 2px ni `box-shadow` dans le CSS livré (test automatique) ; aucune animation
> 120 ms ; toutes les actions de barre d'outils ont un raccourci affiché ; le permalien
reproduit exactement une recherche ; exports CSV/JSON/PNG/TSV ; test de vocabulaire (§12.4)
passe ; navigation clavier complète y compris dans les grilles ; contrastes AA à 10 px.

### Phase 7 — Durcissement et documentation (1,5 jour)
Page méthodologie rédigée intégralement (formules, choix, limites). README d'installation.
Script de rafraîchissement annuel des données. Journal des décisions (`docs/decisions/`).
Section « limites connues » assumée et détaillée.

✅ *Acceptation* : une personne extérieure installe et lance le projet en suivant le seul
README ; la page méthodologie décrit chaque formule du §8 ; les limites sont écrites.

**Total estimé : 18–19 jours de travail effectif.**

### Extensions ultérieures (ne pas commencer avant la v1 complète)
v1.1 : distance de Mahalanobis · couche mensuelle post-1955 · horizon 6 mois ·
pays supplémentaires. v1.2 : DTW sur trajectoires de 5 ans · comparaison de trajectoires
multi-variables. v1.3 : annotations utilisateur sur les épisodes · notebooks d'analyse ·
API publique documentée.

---

## 14. Structure du dépôt

```
macrolens/
├── CLAUDE.md                      # les 6 règles permanentes
├── README.md
├── Makefile                       # check, etl, dev, test, build
├── docker-compose.yml
├── docs/
│   ├── methodology.md             # formules du §8, en clair
│   ├── data-sources.md            # une fiche par source
│   ├── limitations.md             # limites assumées
│   └── decisions/                 # ADR numérotés, une décision = un fichier
├── data/
│   ├── raw/<source_id>/<vintage>/ # jamais modifié, en .gitignore, hash en base
│   ├── reference/
│   │   ├── currency_changes.yaml
│   │   ├── country_breaks.yaml
│   │   └── indicator_bounds.yaml
│   └── events/
│       ├── banking_crises.yaml
│       ├── wars.yaml
│       ├── regime_changes.yaml
│       └── monetary_regimes.yaml
├── backend/
│   ├── pyproject.toml
│   ├── alembic/
│   ├── macrolens/
│   │   ├── cli.py                 # commandes etl / seed / build
│   │   ├── db/                    # modèles SQLAlchemy, session
│   │   ├── etl/
│   │   │   ├── sources/           # un module par source
│   │   │   ├── mappings/          # YAML colonne source → indicator_code
│   │   │   ├── reconcile.py
│   │   │   ├── derive.py
│   │   │   └── validate.py
│   │   ├── core/                  # ← code métier pur, sans I/O, mypy strict
│   │   │   ├── features.py
│   │   │   ├── similarity.py
│   │   │   ├── outcomes.py
│   │   │   ├── warnings.py
│   │   │   └── stats.py
│   │   └── api/
│   │       ├── main.py
│   │       ├── routers/
│   │       └── schemas/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── snapshots/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/charts/     # FanChart, Distribution, Heatmap, Timeline
│   │   ├── components/ui/
│   │   ├── api/                   # client typé généré depuis OpenAPI
│   │   └── lib/
│   └── tests/
└── reports/                       # générés : coverage, conflicts, validation
```

**Règle d'architecture :** `backend/macrolens/core/` ne connaît ni la base, ni HTTP, ni pandas
en signature publique — il prend des tableaux numpy et des dataclasses, il rend des dataclasses.
C'est ce qui rend le moteur testable, rapide et vérifiable. Cette frontière est vérifiée par un
test d'import qui échoue si `core/` importe `sqlalchemy` ou `fastapi`.

---

## 15. Pièges à ne pas rater

0. **La dérive séculaire.** Si les niveaux bruts entrent dans les features, chaque année ne
   ressemblera qu'à ses voisines temporelles et le produit ne sert à rien. Tout le §8.2 existe
   pour ça, et le test de dérive séculaire (§12.3 n°8) est le juge de paix : tant que |ρ| entre
   écart temporel et distance n'est pas quasi nul, le moteur est cassé, quoi qu'il affiche.
1. **Le look-ahead.** C'est l'erreur qui tue ce genre de projet. Une moyenne mobile centrée, un
   filtre HP appliqué sur la série complète, un rang percentile calculé sur des données futures :
   tout cela injecte l'avenir dans le passé et rend les résultats magiquement bons et totalement
   faux. Le filtre HP est d'ailleurs **exclu du calcul des features** pour cette raison précise —
   on utilise des moyennes mobiles rétrospectives.
2. **L'auto-appariement.** Sans la règle d'exclusion ±3 ans, les 5 meilleurs analogues de
   France 2025 seront France 2024, 2023, 2026… Résultat impressionnant, information nulle.
3. **Les épisodes corrélés.** Suède 1990, Finlande 1990 et Norvège 1988 sont *une* crise, pas
   trois observations indépendantes. D'où l'indice de concentration et l'avertissement obligatoire.
4. **La fenêtre glissante mal bornée.** `[t−30, t−1]`, jamais `[t−30, t]`. Inclure *t* dans sa
   propre fenêtre de normalisation est un look-ahead discret et difficile à repérer.
5. **La tentation de l'agrégat unique.** « Historiquement, les actions font +12 % » est une
   phrase fausse dès lors qu'elle masque n = 6 et un intervalle [−40 %, +80 %].
6. **Le sur-design technique.** 250 000 lignes. Pas de Kafka, pas de Spark, pas de microservices,
   pas de base vectorielle, pas de Kubernetes. Un Postgres, un process Python, un front.
7. **Le glissement vers l'IA.** À la première difficulté (une donnée manquante, un libellé à
   normaliser, une classification d'événement), la tentation sera d'appeler un modèle. C'est
   interdit par la règle 1 : on écrit un mapping YAML à la main, on documente, on avance.
8. **La licence JST.** Non commercial, attribution, partage à l'identique. À respecter et à
   afficher. Cela ferme la porte à toute commercialisation ultérieure du produit avec ces données —
   c'est une décision structurante, à assumer dès maintenant.

---

## 16. Prompt de démarrage pour Claude Code

À coller tel quel, avec ce fichier joint :

> Tu vas construire MacroLens en suivant intégralement le plan joint (`PLAN.md`).
>
> Contraintes absolues, valables sur toute la durée du projet :
> aucune IA ni modèle entraîné dans le produit livré ; aucune donnée non sourcée ;
> aucune interpolation non flaguée ; aucun vocabulaire de prévision ; le moteur reste
> déterministe et explicable.
>
> Commence par la **Phase 0** uniquement. Crée le dépôt, la structure décrite au §14, le
> `docker-compose.yml`, la configuration outillage, la CI, et un `CLAUDE.md` reprenant
> les 6 règles permanentes du §0. Ne code aucune logique métier à ce stade.
>
> Quand la Phase 0 satisfait ses critères d'acceptation, arrête-toi, montre-moi le résultat
> et attends ma validation avant la Phase 1.
>
> Si tu rencontres une ambiguïté dans le plan, ne devine pas : pose la question et propose
> deux options argumentées. Si tu prends une décision technique non prévue par le plan,
> écris-la dans `docs/decisions/` avant de l'implémenter.

---

## 17. Ce que le projet livre, en une phrase

Une base de données macro-financière de six pays européens sur 155 ans, entièrement sourcée et
traçable, et un moteur déterministe qui répond à *« qu'est-ce qui s'est passé, la dernière fois
que ça ressemblait à ça ? »* — avec les épisodes nommés, les chiffres réels, et l'honnêteté
statistique de dire combien il y en a.

---

## 18. Traçabilité — le bordereau de données

**Exigence :** tout tableau, toute courbe, toute agrégation affichée doit pouvoir exhiber, à la
demande, les données exactes qui l'ont produite — jusqu'au fichier d'origine et à la page.

C'est faisable sans aucune IA. Ce n'est que de la comptabilité : on note d'où vient chaque
chiffre au moment où on le lit, et on le ressort quand on l'affiche.

### 18.1 Pourquoi pas une capture d'écran

Une image est un cul-de-sac : non vérifiable, non exportable, non rejouable, et à regénérer à
chaque build. On livre à la place **deux niveaux de preuve**, dont le second contient bien une
image — mais une image de la *source*, pas de l'écran.

| Niveau | Nom | Contenu | Disponibilité |
|---|---|---|---|
| 1 | **Bordereau** | Les lignes exactes utilisées + source + fichier + hash + locator | **Toujours**, sur tout rendu |
| 2 | **Vue source** | Extrait brut : page PDF rendue en image, ou plage de cellules du tableur, ou lignes CSV | Quand la source le permet |

### 18.2 Le `locator` — enregistré à l'ingestion

Chaque observation stocke où elle a été lue, dans un JSONB dont la forme dépend du type de fichier :

```jsonc
// tableur
{ "kind": "xlsx", "sheet": "Data", "row": 4187, "col": "AC",
  "cell": "AC4187", "header_row": 1 }

// Stata (JST)
{ "kind": "dta", "obs_index": 4186, "variable": "debtgdp" }

// CSV / API
{ "kind": "csv", "line": 91204, "column": "OBS_VALUE",
  "key": "FRA.A.DEBT_GDP" }

// document PDF
{ "kind": "pdf", "page": 412, "table": "A6.9", "row_label": "1974",
  "col_label": "Short-term interest rate" }
```

Le `locator` est produit par le loader, **jamais reconstitué après coup**. Un parser qui ne sait
pas dire d'où vient une valeur est un parser à réécrire.

### 18.3 `transform_chain` — la valeur brute et son trajet

On conserve `raw_value_text` (la chaîne littérale du fichier, ex. `"112,4"`) et la suite des
opérations qui mènent à la valeur en base :

```
["parse_decimal_comma", "pct_of_nominal_gdp", "splice_FRF_EUR_1999"]
```

Chaque opération est une fonction nommée et testée de `etl/derive.py`. Le bordereau affiche la
chaîne en clair : *« 112,4 (source) → conversion décimale → ratio au PIB nominal → raccord
franc/euro 1999 → 112,4 % »*. L'utilisateur voit la transformation, pas seulement le résultat.

### 18.4 `POST /provenance/receipt`

Tout composant d'affichage sait déclarer les observations qu'il a consommées. Le front envoie
cette liste, l'API renvoie le bordereau complet.

```jsonc
// Requête
{ "build_id": "d41f8a…",
  "keys": [ { "country": "SWE", "indicator": "credit_private_gdp", "period": "1990-01-01", "freq": "A" } ],
  "context": { "widget": "fan_chart", "variable": "out_equity_real_cum", "horizon": 10 } }

// Réponse
{ "build_id": "d41f8a…",
  "generated_at": "2026-08-12T10:22:11Z",
  "rows": [
    { "country": "SWE", "indicator": "credit_private_gdp", "period": "1990",
      "value": 108.7, "raw_value_text": "108.7", "unit": "pct",
      "transform_chain": ["parse_float", "pct_of_nominal_gdp"],
      "flags": { "interpolated": false, "spliced": false, "break": false, "conflict": false },
      "source": { "id": "jst", "citation": "Jordà, Ò., Schularick, M., Taylor, A. M. (2017)…",
                  "url": "https://www.macrohistory.net/database/", "licence": "CC BY-NC-SA" },
      "raw_file": { "filename": "JSTdatasetR6.xlsx", "sha256": "9f2c…",
                    "downloaded_at": "2026-08-01", "origin_url": "https://…" },
      "locator": { "kind": "xlsx", "sheet": "Data", "cell": "AC4187" },
      "source_page": null }
  ],
  "sources_summary": [ { "id": "jst", "n_rows": 187, "citation": "…" } ],
  "checksum": "sha256 du bordereau lui-même" }
```

Le `checksum` permet de vérifier qu'un bordereau exporté n'a pas été altéré.

### 18.5 Vue source — le vrai « screen pic »

Pour les sources documentaires (PDF), à l'ingestion et **une seule fois** :

```
pdftoppm -r 150 -f <page> -l <page> source.pdf → PNG → WebP → data/derived/pages/<sha256>/pNNNN.webp
```

L'image est stockée, hashée, servie par `/provenance/page/{raw_file_id}/{page}`. Clic sur une
valeur issue du volume Riksbank → la page 412 du volume s'affiche, tableau A6.9 sous les yeux.
Zéro IA : `pdftoppm` (poppler) est déterministe.

Pour les autres formats, l'équivalent est un **extrait brut rendu en HTML** : les 5 lignes
autour de la ligne source, en-têtes compris, colonne concernée surlignée. Même valeur de preuve,
et vérifiable au clavier plutôt qu'à l'œil.

> Limite à assumer : pas de rendu de page pour les sources livrées en API (FMI, OCDE, Eurostat).
> Pour celles-ci la preuve est le triptyque *fichier archivé + hash + numéro de ligne*, ce qui
> est strictement plus vérifiable qu'une capture d'écran. À écrire dans `docs/limitations.md`.

### 18.6 Dans l'interface

Sur **chaque** graphique et **chaque** tableau, un bouton discret « Données utilisées (n) » :

1. **Onglet Tableau** — les n lignes, triables, avec les colonnes source / fichier / locator /
   flags. Bouton « Télécharger le bordereau » → CSV + JSON + un `SOURCES.txt` contenant les
   citations académiques complètes.
2. **Onglet Sources** — une carte par source utilisée : nom, citation, licence, URL, date de
   récupération, hash du fichier, nombre de lignes fournies.
3. **Onglet Vue source** — l'image de page ou l'extrait brut, quand disponible.
4. Sur les agrégats (médiane, quartiles), le bordereau liste en plus **les épisodes retenus et
   les épisodes exclus avec le motif d'exclusion**. Une médiane sans sa population n'est pas
   auditable.

Toute cellule d'un tableau reste par ailleurs cliquable → `/provenance/observation` → fiche de
traçabilité d'une valeur unique.

### 18.7 Archivage

- `data/raw/` n'est jamais modifié, jamais écrasé : une nouvelle version de source = un nouveau
  `vintage`, l'ancien reste.
- Chaque fichier est hashé. Si un hash change alors que le vintage est identique, le pipeline
  **échoue** : une source a bougé sous nos pieds, il faut le voir.
- Pour chaque `origin_url`, on tente une soumission à la Wayback Machine et on stocke
  l'`archive_url`. Les liens meurent ; le projet est censé durer plus longtemps qu'eux.
- Les fichiers volumineux sortent de git (git-lfs ou stockage objet), mais l'inventaire
  `raw_files` — noms, hash, URL — est versionné dans le dépôt.

### 18.8 Tests de traçabilité (à ajouter au §12)

1. **Couverture du locator** : 100 % des lignes de `observations` ont un `raw_file_id` non nul
   et un `locator` non vide. Test bloquant.
2. **Test de retour à la source** : pour 200 observations tirées au hasard, rouvrir le fichier
   brut au `locator` indiqué, relire la valeur, et vérifier qu'en rejouant `transform_chain` on
   retombe exactement sur la valeur en base. **C'est le test le plus important du projet** — il
   prouve que le bordereau ne ment pas.
3. **Complétude du bordereau** : pour chaque type de widget, le nombre de lignes du bordereau
   égale le nombre d'observations réellement consommées par le rendu. Un widget qui affiche
   plus de données qu'il n'en déclare est un bug bloquant.
4. **Stabilité des images de page** : rerendre une page produit le même `image_sha256`.

### 18.9 Impact sur la roadmap

| Phase | Ajout |
|---|---|
| 1 | Tables `raw_files` et `source_pages` dans les migrations |
| 2 | Le loader JST remplit `locator`, `raw_value_text`, `raw_file_id` dès la première ligne écrite |
| 3 | `transform_chain` sur toutes les dérivations ; rendu des pages PDF ; soumission Wayback |
| 4 | Le moteur propage les clés d'observations consommées jusque dans sa réponse |
| 5 | Les 4 endpoints `/provenance/*` |
| 6 | Le panneau « Données utilisées » sur tous les widgets |

**Coût réel : ~2 jours de plus.** Le total passe de 14-15 à 16-17 jours.

Contrainte permanente à ajouter à `CLAUDE.md` : *règle 7 — aucune valeur n'entre en base sans
`raw_file_id` et `locator`. Un chiffre dont on ne sait pas dire la page n'est pas une donnée.*
