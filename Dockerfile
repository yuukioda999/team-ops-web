# syntax=docker/dockerfile:1

# Development: the source is mounted from ../team-ops-web by team-ops/compose.yaml.
# Runs as root so it can write node_modules into the named volume on any host.
# Node 24 (LTS). Keep it the same as setup-node in CI and @types/node (team-ops-web#5 review)
FROM node:24-alpine AS dev
WORKDIR /app
EXPOSE 5173
CMD ["sh", "-c", "npm ci && npm run dev"]

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image: nginx serves the app and forwards /api to the API on the same origin.
# 1.30 is the nginx stable line (odd minor versions such as 1.31 are mainline). The images are
# published as nginx/nginx-unprivileged; nginxinc/nginx-unprivileged is the old name.
FROM nginx/nginx-unprivileged:1.30-alpine AS prod
ENV API_UPSTREAM=http://api:8000
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
