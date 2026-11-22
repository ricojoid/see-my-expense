# Build context: the repository root (see docker-compose.yml), so ../shared is available.

# ---- 1. Build the React app ----
FROM node:20-alpine AS build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY shared/ /app/shared/
COPY client/ ./
RUN npm run build

# ---- 2. Serve it with nginx, proxying /api to the API container ----
FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
