# syntax=docker/dockerfile:1

# ── build: full install + compile to dist/ ───────────────────────────────────
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY core ./core
COPY mizan/backend ./mizan/backend
COPY scripts ./scripts
COPY main.ts ./
RUN npm run build

# ── runtime: prod deps only + the compiled output ───────────────────────────
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Prisma's migration engine needs openssl at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# `npm run build` already staged prisma/ + prisma.config.ts inside dist/ so
# `prisma migrate deploy` (shelled from core/kernel/db/migrate.ts at boot)
# resolves them relative to dist/.
COPY --from=build /app/dist ./dist

# Drop privileges; `node:*` images ship a `node` user.
RUN mkdir -p /app/storage/files && chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.AURIC_PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
