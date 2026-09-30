# ADR 0011 — Dashboard analytics dans le panneau admin

Décision demandée directement par l'utilisateur (hors plan) : savoir combien de fois le site est
consulté et par combien d'appareils différents, visible dans le panneau admin existant (voir
ADR 0008).

## 1. Identifiant anonyme côté client, jamais une adresse IP

« Différents ordinateurs » pourrait se mesurer par adresse IP côté serveur, mais une IP est une
donnée personnelle (RGPD), change souvent (4G, VPN, box qui redémarre) et peut regrouper
plusieurs personnes distinctes derrière un même foyer/bureau — un mauvais proxy pour « appareil
distinct » dans les deux sens.

Choix retenu : un UUID v4 généré une seule fois dans le navigateur (`crypto.randomUUID()`) et
conservé en `localStorage` (clé `ml.clientId`). Il n'est lié à aucune identité réelle, ne sort
jamais du navigateur sauf vers ce compteur, et permet de distinguer les appareils sans jamais
collecter d'adresse IP, d'user-agent ni de cookie de session. Un utilisateur qui vide son
`localStorage` ou change de navigateur compte comme un nouvel appareil — compromis assumé, cohérent
avec l'objectif (mesurer l'usage, pas identifier les personnes).

## 2. Deux endpoints, deux niveaux d'accès

`POST /api/v1/analytics/view` est public et ne renvoie rien (`204`) : n'importe quelle page
chargée peut l'appeler sans jeton, comme un compteur de visite classique. Il enregistre une seule
ligne (`client_id`, horodatage, chemin optionnel) dans la nouvelle table `page_views`
(migration `fc77db09a6e1`).

`GET /api/v1/admin/analytics` est protégé par `require_admin` (le même jeton porteur que le reste
du panneau, voir ADR 0008) et renvoie les agrégats : total des vues, nombre d'appareils uniques,
mêmes chiffres sur 7 jours glissants, et un détail jour par jour sur 30 jours. Aucun `client_id`
individuel n'est jamais renvoyé par cet endpoint : seuls des comptes agrégés sortent de l'API,
jamais la liste des identifiants.

## 3. Un ping par chargement, pas un tracking de session

Le ping est envoyé une fois au montage de l'application (`App.tsx`), pas à chaque interaction ni
en continu : ça mesure « combien de fois le site a été ouvert », pas le comportement détaillé de
navigation à l'intérieur. Cohérent avec le besoin exprimé (nombre de vues, nombre d'appareils) et
évite de construire un système de tracking plus intrusif que nécessaire pour une question aussi
simple. L'appel est fire-and-forget : un échec réseau (site en maintenance, coupure passagère) ne
doit jamais bloquer ni ralentir le chargement de l'application elle-même.

## 4. Agrégation en base à la lecture, pas de table pré-calculée

Les compteurs (`COUNT`, `COUNT DISTINCT`, regroupement par jour) sont calculés à chaque appel de
`GET /admin/analytics` plutôt que maintenus dans une table de compteurs mise à jour à chaque vue.
Le volume attendu (un panneau admin consulté occasionnellement, un trafic qui reste modeste) rend
une agrégation à la volée largement suffisante en performance ; une table de compteurs aurait
ajouté de la complexité (cohérence à maintenir entre deux tables) sans bénéfice mesurable à cette
échelle. Un index sur `viewed_at` (`ix_page_views_viewed_at`) suffit à garder ces requêtes rapides.
