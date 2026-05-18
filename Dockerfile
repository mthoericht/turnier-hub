# syntax=docker/dockerfile:1.7

# ---------- Build stage (all deps, builds shared + client + server) ----------
FROM node:22-alpine AS build

WORKDIR /app

# Install all workspaces deps (incl. devDeps for vite/tsc/prisma).
# Use `npm install` (not `npm ci`) so platform-specific optional deps
# (e.g. @rolldown/binding-linux-arm64-musl, only present on Linux) get
# resolved at install time even though the lockfile was generated on macOS.
# See https://github.com/npm/cli/issues/4828
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
# The `shared` workspace runs `tsc` from a `prepare` script when installed
# (it's a `file:` workspace dep of client/server), so its sources must be
# present at install time. Copy the whole workspace up front.
COPY shared ./shared
# The lockfile was generated on macOS so it pins macOS-only optional deps
# of `rolldown`/`vite` (#4828). Removing it forces npm to resolve the
# Linux variants for the build platform. `--legacy-peer-deps` matches the
# resolution local installs use to satisfy @vitejs/plugin-vue against vite 8.
RUN rm -f package-lock.json \
    && npm install --include=optional --legacy-peer-deps --no-audit --no-fund

# Copy remaining sources.
COPY client ./client
COPY server ./server

# Build client (Vite -> client/dist).
RUN npm --workspace client run build

# Generate Prisma client (MySQL) + compile server (tsc -> server/dist).
RUN npx --workspace server prisma generate --schema prisma/schema.prisma
RUN npm --workspace server run build

# ---------- Runtime stage ----------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
# server/src/config.ts resolves STATIC_DIR relative to the server root, so
# the default "../client/dist" already maps to /app/client/dist. Setting
# the env explicitly makes the contract obvious for ops.
ENV STATIC_DIR=/app/client/dist

WORKDIR /app/server

# Reuse the build stage's node_modules so the generated Prisma client and any
# hoisted packages are wherever npm placed them. (Trades a slightly larger image
# for build-time simplicity / reliability.)
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/server/node_modules /app/server/node_modules

# Server build output + package.json + Prisma schema + operational scripts
# (the Nomad migrate task runs Prisma's compiled demo seed from dist).
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/server/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/scripts ./scripts

# Built shared workspace (server imports compiled JS from shared/dist).
COPY --from=build /app/shared/dist /app/shared/dist
COPY --from=build /app/shared/package.json /app/shared/package.json

# Root package.json so `node` resolves the workspace root correctly.
COPY --from=build /app/package.json /app/package.json

# Client build output served as static files via STATIC_DIR.
COPY --from=build /app/client/dist /app/client/dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
