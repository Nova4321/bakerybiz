# =============================================================================
# BakeryBiz API Server — Multi-stage Docker Build
# =============================================================================
# Stage 1: Install all workspace deps and build the API server bundle
# Stage 2: Slim production image with only the built output
# =============================================================================

# ---------- Stage 1: Build ----------
FROM node:22-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

# Copy all workspace package.json files (for install resolution)
COPY lib/db/package.json lib/db/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-zod/package.json lib/api-zod/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/bakerybiz/package.json artifacts/bakerybiz/
COPY scripts/package.json scripts/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all source files
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY scripts/ scripts/

# Build the API server
RUN pnpm --filter @workspace/api-server run build

# ---------- Stage 2: Production ----------
FROM node:22-slim AS production

WORKDIR /app

# Copy the built output and node_modules needed at runtime
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-server/package.json ./package.json

# Install only production deps for any externalized packages
RUN corepack enable && corepack prepare pnpm@latest --activate

# We need node_modules for externalized packages (pg, pino workers, etc.)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server/node_modules ./api-node_modules 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:${PORT}/api/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
