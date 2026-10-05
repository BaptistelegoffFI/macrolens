# ADR 0024 — Migration additive, sûreté de déploiement, forme des endpoints

Le site est montré à des gérants de portefeuille et à un professeur de finance : une version à moitié
migrée coûte plus cher que cette fonctionnalité ne rapporte.

## Migration `7a341bae9936`, strictement additive

Deux tables (`asset_series`, `asset_observations`) et un index. Aucune colonne ajoutée, modifiée ou
supprimée sur une table existante ; ni `indicators` ni `observations` ne reçoivent de ligne
(sinon l'Explorateur et la Couverture déployés auraient affiché de nouveaux indicateurs). Le
retour arrière (`alembic downgrade fc77db09a6e1`) a été écrit avant la montée, puis testé sur une base
jetable : schéma des tables existantes identique avant montée, après montée et après descente ;
remontée possible.

## Danger propre à ce déploiement

La production démarre par `alembic upgrade head && seed && etl run-all && uvicorn` à chaque
démarrage, y compris au réveil d'une instance gratuite. Démontré : l'ancien code lancé sur une
base portant la nouvelle révision échoue (`Can't locate revision identified by '7a341bae9936'`) et,
à cause du `&&`, l'API ne démarre pas. Conséquences :

1. **Ne jamais migrer la base de production avant de déployer le code.** Le déploiement du nouveau
   code applique lui-même la migration additive au démarrage.
2. **Un retour arrière commence par redescendre la base**, puis redéploie l'ancien commit.
3. L'ancien code, une fois la base migrée et peuplée, passe sa suite complète (157 tests) : il ne
   lit aucune des nouvelles tables.

## Ingestion non bloquante

`etl run-all` écrit les rendements dans un savepoint ; un échec est journalisé (`asset_returns:
ECHEC`) mais n'arrête ni l'ingestion principale ni le démarrage. Les endpoints répondent 503 si les
tables sont vides ou absentes ; le frontend dégrade sans bloquer (ADR de la Phase 4).

## Forme des endpoints

`POST /scenario/asset-returns` plutôt que `GET /scenario/{id}/asset-returns` : MacroLens ne stocke
aucun scénario côté serveur (recherche sans état, permalien qui encode la requête). Une table de
scénarios aurait ajouté une écriture et du risque de migration. L'appelant transmet les analogues
reçus. Les réponses sont versionnées (`schema_version: asset-returns/1`) ; les endpoints de scénario
respectent le mode maintenance comme `/analogs/search`.

## Contrats existants

`tests/snapshots/openapi_existing_contracts.json` a été généré depuis `main` : un test exige que les
21 routes et 41 schémas existants soient identiques à l'octet près. Les trois routes ajoutées sont les
seules différences.
