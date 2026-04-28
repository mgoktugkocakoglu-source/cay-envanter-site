# ================================
# Stage 1: Build
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Use hoisted node_modules layout for Docker compatibility.
# pnpm's default symlinked structure breaks when copied between
# Docker stages. Hoisted layout produces a flat node_modules
# identical to npm/yarn, which Node.js resolves without issues.
RUN echo "node-linker=hoisted" > .npmrc

# Make hoisted binaries (nest, tsc, etc.) available in PATH
ENV PATH="/app/node_modules/.bin:$PATH"

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy backend package.json
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @cayhesabim/api

# Copy backend source
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Build — run nest build directly (bypasses pnpm's binary resolver
# which doesn't find hoisted binaries from workspace subdirectories)
WORKDIR /app/apps/api
RUN nest build

# ================================
# Stage 2: Production Dependencies
# ================================
FROM node:20-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Same hoisted layout for production deps
RUN echo "node-linker=hoisted" > .npmrc

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/

# Install ONLY production dependencies (no devDependencies)
RUN pnpm install --frozen-lockfile --filter @cayhesabim/api --prod

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Writable upload directory for Multer. The app runs as the non-root
# nestjs user, so this must exist with the correct ownership.
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./

# Copy production-only node_modules (flat/hoisted, no symlinks)
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
