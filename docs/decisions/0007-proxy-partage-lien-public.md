# ADR 0007 — Reverse-proxy unique + chemins API relatifs, pour le partage d'un lien public

Décision demandée directement par l'utilisateur (hors plan) : pouvoir envoyer un lien à des
personnes extérieures à la machine locale, qui peuvent alors ouvrir et utiliser l'application,
sans renoncer à la boucle de développement locale habituelle.

## 1. Le bug latent que ça a révélé

`docker-compose.yml` fixait `VITE_API_URL: http://localhost:8000` comme variable d'environnement
du service `web`. Or `web` sert un build Vite statique (`serve -s dist`), et Vite fige
`import.meta.env.VITE_API_URL` **au moment du `npm run build`**, pas à l'exécution du conteneur —
cette variable n'a donc jamais eu le moindre effet sur l'image Docker ; le frontend appelait déjà
en dur `http://localhost:8000` par repli codé dans `api/client.ts`. Sans conséquence tant que le
frontend et l'API tournent sur la même machine que le navigateur (le cas de tous les usages
testés jusqu'ici) — mais fatal dès qu'un tiers ouvre l'app depuis un tunnel public : son
navigateur résout `localhost:8000` vers **sa propre machine**, pas la mienne.

## 2. Solution retenue : une origine unique, des chemins API relatifs

Plutôt que de générer une image frontend différente par URL de partage (fragile : une URL de
tunnel « quick » change à chaque relance sans compte Cloudflare), le frontend appelle
désormais l'API en chemin relatif par défaut (`api/client.ts` : repli de `VITE_API_URL` passe de
`"http://localhost:8000"` à `""`). Un nouveau service `proxy` (nginx, `proxy/nginx.conf`)
regroupe le frontend (`web:5173`) et l'API (`api:8000`) sous une seule origine, port `8080`.
Résultat : le même conteneur `web`, sans rebuild, fonctionne correctement qu'on y accède par
`http://localhost:8080`, par une IP locale, ou par n'importe quelle URL de tunnel — le navigateur
résout toujours les chemins relatifs contre l'origine réellement chargée.

`npm run dev` (développement local avec rechargement à chaud) n'est pas affecté :
`.env.development` fixe explicitement `VITE_API_URL=http://localhost:8000`, qui prend le pas sur
le nouveau repli à chaque démarrage de `vite dev`.

Effet de bord découvert en testant : `apiGet` (`api/client.ts`) construisait l'URL avec
`new URL(...)` sans argument `base` — accepte une URL absolue, rejette une chaîne relative avec
`TypeError: Invalid URL`. Corrigé en passant `window.location.origin` comme base explicite ;
sans effet sur le cas où `VITE_API_URL` est déjà absolu (le second argument de `URL()` est
ignoré si le premier l'est déjà).

## 3. Partage : tunnel Cloudflare « quick », pas d'hébergement persistant

`cloudflared tunnel --url http://localhost:8080` (sans compte Cloudflare) plutôt qu'un
déploiement cloud (Vercel/Render/Fly...). Correspond exactement à la demande : « garder la
main » (rien ne quitte la machine locale, aucun compte tiers à gérer) et continuer à développer
normalement (le tunnel pointe sur un port stable ; rebuild/redémarrage du conteneur `web` ne
casse pas le lien). Contrepartie assumée et documentée dans le README (§ Partager un lien
public) : le lien ne survit pas à l'extinction de la machine, à l'arrêt de `docker compose`, ou à
l'arrêt du process `cloudflared` ; l'URL change à chaque relance de `cloudflared tunnel` (pas de
nom de tunnel réservé) ; aucune authentification n'est ajoutée devant l'application partagée.
