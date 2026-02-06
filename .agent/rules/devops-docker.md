---
trigger: always_on
---

# Senior DevOps: Monorepo Dockerization Rules

## 1. Multi-Stage Build Strategy
- **Efficiency:** Every Dockerfile must use **Multi-stage builds**. Separate the "build" environment from the "runtime" environment to minimize the final image size.
- **Production-Ready Images:** The final runtime image must only contain production dependencies and compiled assets (e.g., `dist` folder for NestJS, `dist` or `build` folder for Vue via Nginx).

## 2. Docker Context & Monorepo Pathing
- **Root Context:** When building images in a monorepo, always set the **Docker Context to the root directory**. This allows the Dockerfile to access shared packages or `package.json` workspaces if needed.
- **Explicit Copying:** Do not use `COPY . .`. Explicitly copy `package.json`, `pnpm-lock.yaml`/`package-lock.json`, and the specific service folder to leverage Docker layer caching effectively.

## 3. Image Security & User Management
- **Non-Root User:** Never run applications as the `root` user. Use the `node` user (provided by official Node images) or create a custom system user to execute the application.
- **Base Images:** Use official, slim, or alpine-based images (e.g., `node:20-alpine`) to reduce the attack surface and image footprint.

## 4. Environment Variable Injection
- **Build-time vs. Runtime:** - For **Frontend (Vue)**: Use `ARG` for variables needed at build-time (like API URLs for static bundling).
  - For **Backend (NestJS)**: Use `ENV` for runtime variables. Sensitive data must be injected via GitHub Secrets or a Secret Manager, never hardcoded in the Dockerfile.

## 5. Optimized Layer Caching
- **Dependency Isolation:** Copy the lockfiles and install dependencies as a separate step before copying the source code. This prevents re-installing all `node_modules` every time a single line of code changes.

## 6. Service-Specific Rules

### Backend (NestJS)
- Use a dedicated `Dockerfile` inside `apps/backend/`.
- Ensure `node_modules` are pruned to only include `production` dependencies in the final stage.
- Expose the specific port (default 3000) and implement a `HEALTHCHECK` instruction.

### Frontend (Vue.js)
- Use a dedicated `Dockerfile` inside `apps/frontend/`.
- The final stage must use **Nginx** (alpine version) to serve static files.
- Include a custom `nginx.conf` to handle Single Page Application (SPA) routing (redirecting all paths to `index.html`).

## 7. Local Development (Docker Compose)
- Provide a `docker-compose.yml` at the root for local orchestration.
- Use **Volumes** for hot-reloading during development.
- Ensure the backend service has a `depends_on` relationship with the database (e.g., PostgreSQL).