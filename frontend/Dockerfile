# Contexte de build = racine du dépôt, pour la même raison que backend/Dockerfile
# (une seule définition de build, locale et déploiement — voir ADR 0009).
FROM node:20-slim AS build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
