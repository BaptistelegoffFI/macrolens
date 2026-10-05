# ADR 0028 — Journal d'usage et classements dans le panneau admin

Demande directe de l'utilisateur : voir l'heure de chaque événement dans une fenêtre à droite du
panneau admin, voir les recherches effectuées, et classer les recherches et les pages les plus
utilisées. Jusqu'ici le site ne conservait qu'une ligne par chargement (`page_views`, ADR 0011) :
ni page ouverte, ni recherche.

## Décision

- **Nouvelle table `usage_events`** (migration additive `3c5d9e1b7a42`, retour arrière
  `alembic downgrade 7a341bae9936`) : `client_id`, `occurred_at`, `kind` (`page` | `search`), `name`,
  `detail`. `page_views` n'est pas touchée et continue de compter les chargements.
- **Ce qui est enregistré** : l'identifiant de la vue ouverte (`scenario`, `episode`…, page initiale
  comprise) et, pour une recherche **réussie**, l'étiquette « PAYS ANNÉE » (« PAYS ANNÉE (shock) »
  pour un choc, « manual » pour une saisie manuelle) avec mode, référentiel et k. Les valeurs saisies
  à la main ne sont jamais envoyées.
- **Un appel public `POST /analytics/event`** (204, une seule tentative, erreurs ignorées côté
  navigateur), comme `/analytics/view`. Le type est limité à `page` ou `search`, les longueurs sont
  bornées.
- **Deux lectures protégées par le jeton admin** : `GET /admin/activity?limit=` (journal horodaté,
  fusion de `page_views` et `usage_events`, du plus récent au plus ancien) et
  `GET /admin/rankings?days=` (pages, recherches, pays ; 7 jours, 30 jours ou `days=0` pour tout).
  Le classement des pays regroupe les recherches par leur premier mot et ignore « manual ».
- **Aucun identifiant brut n'est renvoyé** : chaque ligne porte une empreinte de six caractères
  (SHA-256 de l'UUID navigateur) qui relie les actions d'un même appareil. Cela prolonge l'ADR 0011
  (agrégats seulement) en l'assouplissant sur ce point précis, pour l'administrateur seul.
- **Interface** : la page `/admin` passe sur deux colonnes une fois connecté ; le journal (heure
  locale à la seconde, séparateurs de jour, rafraîchi toutes les 20 s) est à droite, les
  classements à gauche. Sous 900 px, une seule colonne.
- Les 3 routes sont additives : le test de contrat OpenAPI confirme que les routes et schémas
  existants sont inchangés.

## Limites assumées

- Le détail n'existe que depuis la mise en ligne : les visites antérieures apparaissent sans page
  ni recherche.
- L'appareil est un UUID de navigateur : vider le stockage ou changer de navigateur crée un nouvel
  appareil.
- L'endpoint d'écriture est public et sans limitation de débit : un tiers pourrait gonfler les
  chiffres ou la table. Même exposition que `/analytics/view`.
- Pas de purge automatique : la table grossit d'une ligne par page ouverte ou recherche.
