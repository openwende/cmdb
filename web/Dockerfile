# Builds the web UI and serves it with nginx, proxying API requests to the
# `server` and `ai` containers. See deploy/nginx.conf.
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec vite build

FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
