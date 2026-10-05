# ADR 0027 — Résilience de l'interface et contrôle planifié

L'API et le site web tournent sur l'offre gratuite de Render : ils s'endorment après une période
d'inactivité, et le premier visiteur subit un réveil de 30 à 60 secondes pendant lequel les
requêtes échouent (erreur réseau, 502/503/504 du proxy). Avant cette décision, ces échecs
apparaissaient tels quels à l'écran.

## Décision

- **Client HTTP** (`src/api/resilience.ts`) : délai de 45 s par tentative et jusqu'à 5 nouvelles
  tentatives avec attente croissante (1,5 à 15 s) sur erreur réseau, délai dépassé, 502/504, ou 503
  sans `detail` JSON. Un 503 portant un `detail` (refus délibéré de l'application) et toute autre
  erreur applicative (404, 422…) ne sont jamais réessayés. Un 200 non JSON devient une `ApiError`.
- **Idempotence** : lectures et POST de recherche réessaient (ils ne modifient rien) ; les écritures
  d'administration et le ping de fréquentation tentent une seule fois.
- **Bandeau « le serveur se réveille »** (`role="note"`, flottant, sans effet sur la mise en page)
  tant qu'une requête réessaie.
- **Filets d'erreur** : garde-fou racine (`FailSafe` + `RootFallback`, bilingue, sans dépendance au
  contexte de langue) et message de repli dans `index.html` si rien n'est affiché après 12 s.
- **Cache** (`public/serve.json`) : `index.html` et `/admin` en `no-cache`, `assets/**` immuables
  (noms hachés). Un déploiement n'est donc jamais masqué par un ancien `index.html` en cache.
- **Contrôle planifié** (`.github/workflows/uptime.yml`, 4 fois par jour) : réveille les services,
  garde Supabase actif, et notifie en cas d'échec durable.

## Limites assumées

Le réveil reste lent ; l'interface l'explique au lieu de le supprimer. Une panne d'hébergeur ou une
base en pause n'est pas masquée. La CI et le contrôle planifié dépendent de GitHub Actions.
