# syntax=docker/dockerfile:1

# Development: the source is mounted from ../team-ops-web by team-ops/compose.yaml.
# Runs as root so it can write node_modules into the named volume on any host.
FROM node:22-alpine AS dev
WORKDIR /app
EXPOSE 5173
CMD ["sh", "-c", "npm ci && npm run dev"]

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image: nginx serves the app and forwards /api to the API on the same origin.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
ENV API_UPSTREAM=http://api:8000
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
