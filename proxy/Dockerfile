# Contexte de build = racine du dépôt (voir ADR 0009) — mêmes raisons que
# backend/Dockerfile et frontend/Dockerfile : une seule définition de build,
# locale et déploiement, jamais deux qui pourraient diverger.
FROM nginx:alpine
COPY proxy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
