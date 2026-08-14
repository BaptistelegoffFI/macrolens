# ADR 0008 — Panneau d'administration (mode maintenance, annonce)

Décision demandée directement par l'utilisateur (hors plan) : pouvoir fermer le site, le
bloquer, et poster des annonces, pour un déploiement partagé publiquement (voir aussi ADR 0007).

## 1. Un jeton porteur, pas un système de comptes

MacroLens n'a ni utilisateurs ni rôles — un seul opérateur (l'utilisateur lui-même) doit pouvoir
administrer un déploiement partagé. Construire un système de comptes (table `users`, hachage de
mot de passe, sessions) pour un seul administrateur aurait été disproportionné. Choix retenu : un
jeton porteur unique (`ADMIN_TOKEN`, variable d'environnement) comparé en temps constant
(`secrets.compare_digest`, jamais `==` — évite une attaque temporelle sur la longueur du jeton
correct). `POST /admin/login` valide le jeton pour l'écran de connexion du frontend ;
`PUT /admin/status` (la seule action mutante) l'exige en en-tête `Authorization: Bearer`.

Refus par défaut : si `ADMIN_TOKEN` n'est pas défini, tous les endpoints admin renvoient 503
plutôt que d'accepter n'importe quel jeton ou d'utiliser un mot de passe implicite. Un
avertissement est logué au démarrage de l'API si la variable est absente.

Valeur de repli en développement local (`docker-compose.yml` : `${ADMIN_TOKEN:-macrolens-dev-admin}`)
— jamais utilisée pour un déploiement exposé publiquement, qui doit fixer la variable
d'environnement lui-même (voir README § « Créer un lien solide et un accès administrateur »).
C'est un compromis assumé : le panneau ne contrôle qu'un bandeau d'annonce et un mode
maintenance (rien de destructif, aucune donnée utilisateur), donc le risque d'un mot de passe de
développement par défaut est jugé proportionné — mais reste un vrai risque si quelqu'un déploie
sans le changer, d'où l'avertissement au démarrage et la documentation explicite.

## 2. État persistant en base, pas en mémoire

Le mode maintenance et l'annonce vivent dans une nouvelle table à une seule ligne
(`site_status`, migration `0cc3ae70399f`) plutôt qu'une variable en mémoire du process API : un
redémarrage du conteneur (fréquent — rebuild après une modification, redémarrage du serveur)
ne doit pas silencieusement rouvrir un site que l'admin avait fermé.

## 3. Deux niveaux de blocage : frontend et API

Le frontend (`App.tsx`) sonde `GET /status` (public, jamais lui-même bloqué par le mode
maintenance — sinon personne ne pourrait jamais savoir pourquoi le site est fermé) toutes les
60 secondes et remplace l'application entière par une page de maintenance si
`maintenance_mode` est vrai. Ça ferme le site pour l'usage normal (navigateur), y compris un
onglet déjà ouvert, dans un délai d'une minute.

En défense en profondeur, `POST /analogs/search` (l'endpoint qui produit réellement du contenu)
refuse aussi avec 503 pendant la maintenance, au cas où quelqu'un appelle l'API directement en
contournant le frontend. Les endpoints de lecture pure (`/meta/*`, `/coverage`, `/sources`) ne
sont pas bloqués — consultables, aucun risque à les laisser ouverts pendant une maintenance.

## 4. Route `/admin` sans routeur

Le frontend n'a pas de bibliothèque de routing (aucune route côté client n'existait avant ce
panneau — toutes les vues F2-F8 sont des onglets d'un même état local, pas des URLs). Ajouter
`react-router` pour une seule route supplémentaire aurait été disproportionné. `main.tsx` fait un
simple aiguillage sur `window.location.pathname === "/admin"` avant de monter `<App>` ou
`<AdminView>` — un composant entièrement séparé, pas une vue de plus dans le système F2-F8.
`serve -s` (mode SPA du serveur frontend, déjà en place) redirige toute route inconnue vers
`index.html`, donc `/admin` fonctionne sans changement de configuration côté nginx/serve.
