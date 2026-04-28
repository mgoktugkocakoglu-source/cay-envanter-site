# ================================
# Stage 1: Build
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy frontend package.json
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @cayhesabim/web

# Copy frontend source
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Build arguments for environment variables
ARG VITE_API_URL=/api

# Build
WORKDIR /app/apps/web
RUN pnpm build

# ================================
# Stage 2: Production Runtime (Nginx)
# ================================
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Ensure nginx-owned runtime directories are writable.
# The master process stays root so it can bind 80/443 and read mounted TLS keys;
# nginx workers run as the nginx user from the base image config.
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port
EXPOSE 80
EXPOSE 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
