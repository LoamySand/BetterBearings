# syntax=docker/dockerfile:1

# 1. Build the React client
FROM node:24-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# 2. Install server production dependencies only
FROM node:24-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# 3. Runtime image: no build tools, no dev dependencies, runs as the non-root "node" user
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
# app.js serves ../client/dist, so dist must sit next to server/
COPY --from=client-build /app/client/dist ./client/dist
WORKDIR /app/server
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:5000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]