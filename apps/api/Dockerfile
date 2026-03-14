# ================================
# Stage 1: Build
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy backend package.json
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @cayhesabim/api

# Copy backend source
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Build
WORKDIR /app/apps/api
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ================================
# Stage 2: Production Runtime
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./

# Copy node_modules — pnpm hoists monorepo deps to the root, so both
# the workspace-level and the root node_modules are required at runtime.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api || exit 1

# Start application
CMD ["node", "dist/main.js"]
