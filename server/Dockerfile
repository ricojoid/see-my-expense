# ---- API: Express + SQL Server (SQL authentication via tedious) ----
# Build context: the repository root (see docker-compose.yml), so ../shared is available.
FROM node:20-alpine

ENV NODE_ENV=production \
    TZ=Asia/Jakarta

RUN apk add --no-cache tzdata

WORKDIR /app/server

# msnodesqlv8 (Windows auth) is optional and not needed in Linux containers.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

COPY shared/ /app/shared/
COPY server/src ./src
COPY server/db ./db

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Create / migrate the database, then start the API.
CMD ["sh", "-c", "node db/setup.js && exec node src/server.js"]
