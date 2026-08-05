FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ── Install dependencies ─────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=packages/shared --workspace=apps/server

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
# Root package.json is required for npm workspaces commands
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

# ── Production image ─────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

# Copy built server + shared dist that it imports at runtime
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./package.json

EXPOSE 4000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
