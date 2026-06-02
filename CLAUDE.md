# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Çay Üreticisi Platformu" — a digital platform for tea (çay) producers. pnpm-workspace monorepo: a NestJS API (`apps/api`) and a Vue 3 web app (`apps/web`) that is also packaged as a native mobile app via Capacitor. Product UI/content is Turkish; **all code, DB schema, API contracts, and comments must be English** (see Conventions).

> `AGENTS.md` in the repo root is an unrelated n8n-MCP agent prompt — ignore it for this codebase. `GEMINI.md` and the `.agent/` rules are the relevant project guidance.

## Commands

Run from the repo root (commands proxy into the workspace via `pnpm --filter`):

```bash
pnpm install            # install all workspaces
pnpm dev:api            # NestJS in watch mode (http://localhost:3000, Swagger at /api/docs)
pnpm dev:web            # Vite dev server (http://localhost:5173)
pnpm build:api          # nest build → apps/api/dist
pnpm build:web          # vue-tsc -b && vite build  (this is also the web typecheck)
pnpm lint               # eslint --fix across all packages
pnpm format             # prettier across all packages

docker-compose up -d    # Postgres + api + web, all hot-reloading
```

Web/mobile-specific (run with `pnpm --filter @cayhesabim/web <script>` or from `apps/web`):
- `build:mobile` — `vite build --mode mobile` (relative asset base for the Capacitor WebView)
- `cap:sync` / `cap:ios` / `cap:android` / `cap:build:ios` / `cap:build:android`
- `generate:assets` — regenerate app icons/splash via `scripts/generate-assets.mjs`

### Gotchas that will waste your time
- **No tests exist.** There is no test runner, no `test` script, and no `*.spec.ts` files, despite what `.agent/rules` say about Vitest/Jest. Don't assume a test command works.
- **No ESLint/Prettier config is checked in.** The `lint`/`format` scripts exist but no `.eslintrc`/`.prettierrc` is present in the repo — verify config before relying on them. Match the surrounding code style (4-space indent, single quotes, trailing commas).
- **Migrations are not wired up.** TypeORM runs with `synchronize: true` in *all* environments (`app.module.ts`), so the schema auto-syncs from entities. The `migration:*` npm scripts point at `dist/data-source.js`, but no `data-source.ts` exists in `src/` — they will not work as-is. Schema changes happen by editing entities.

## Backend architecture (`apps/api`)

NestJS 10 + TypeORM + PostgreSQL. Bootstrap (`src/main.ts`) sets: global `/api` prefix, Helmet, permissive CORS (`origin: true`, credentials), Swagger at `/api/docs`, and a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). `app.module.ts` validates **all env vars with a Joi schema** on startup and registers a global `ThrottlerGuard` (30 req/min default).

- **Path alias:** `@/` → `src/` (configured in `apps/api/tsconfig.json`). Use it for all internal imports; no `../../`.
- **Feature modules** under `src/<feature>/`: `auth`, `users`, `mail`, `geo`, `fields`, `firms`, `harvests`, `payments`, `reports`, `uploads`, `health`. Each follows `*.controller.ts` (thin, routing + Swagger only) + `*.service.ts` (business logic) + `dto/` + `entities/` + `enums/`.
- **Auth:** JWT access + refresh tokens via Passport. Access tokens are short-lived (`JWT_EXPIRES_IN`, default 30m); refresh tokens (`JWT_REFRESH_*`) are separate with their own secret. Strategies: `jwt.strategy.ts`, `refresh-token.strategy.ts`. Guards in `auth/guards/`: `JwtAuthGuard`, `JwtRefreshGuard`, `OptionalJwtAuthGuard`, `RolesGuard`. Use `@CurrentUser()` and `@Roles()` decorators. `Role` enum = `user|admin|moderator`; `UserType` enum = `land_owner|worker|self_farmer`. A `Session` entity backs sessions.
- **Uploads:** Cloudflare R2 (S3-compatible) via `@aws-sdk/client-s3` in `uploads/r2-storage.service.ts`; Multer handles multipart. All `R2_*` env vars are optional (uploads degrade gracefully if unset).
- **Mail:** uses **Resend** (`mail.service.ts`, env `RESEND_API_KEY` / `RESEND_FROM`); sending is silently disabled if no key is set.

### Pagination contract (enforced — see `.agent/standards/api-pagination.md`)
All list endpoints **must** return `{ data: T[], meta: { total, page, limit, totalPages } }` — the keys are `data`/`meta`, never `items`/`results` or a flat structure. Query DTOs accept `page` (default 1) and `limit` (default 20, max 100). Implement with TypeORM `findAndCount()` / `getManyAndCount()`. The frontend mirrors this with `PaginatedResponse<T>` and stores that split `data`/`meta`.

> Note: `.agent/rules/backend-nestjs.md` prescribes a global response-wrapping Interceptor, a global Exception Filter, a structured `LoggerService`, and `src/shared|core|utils` folders. **These are target standards, not yet implemented** — most controllers return raw service results and `main.ts` uses `console.log`. Treat them as direction, not current reality.

## Frontend architecture (`apps/web`)

Vue 3 (Composition API + TS), Vite, Pinia, Vue Router. Path alias `@/` → `src/` (in `vite.config.ts`). Key libs: Leaflet (maps), Tiptap (rich text). Styling is hand-written CSS (dark theme).

- **Single hub (Tea Business).** Authenticated app routes live under `/tea/*` — dashboard, fields, firms, harvests, payments, reports, ai-agent, settings. (The former Social Hub — job-listings, community, equipment, marketplace — has been removed.) Route `meta` carries `hub: 'tea'`, plus `requiresAuth`, `requiresAdmin`, `guest`. Login lands on `/tea/dashboard`; `/hub` and legacy flat paths (`/fields`, `/settings`, …) redirect to their `/tea/*` equivalents. Layouts in `src/layouts/` (`TeaBusinessLayout`, `AppLayout`).
- **Auth/token model** (`stores/authStore.ts`): only the **refresh token** is persisted (`localStorage['refresh_token']`); the access token lives in memory. On boot, `initialize()` exchanges the refresh token for an access token. `router/guards/authGuard.ts` enforces `requiresAuth`/`requiresAdmin`/`guest` and waits for `initialize()` when a refresh token is present.
- **API client** (`services/api.ts`): a `fetch` wrapper that auto-attaches the Bearer token and, on a `401`, refreshes the token **once** then retries (with a single-flight lock); a failed refresh redirects to `/login`. `API_BASE = VITE_API_BASE_URL || '/api'`. In dev, Vite proxies `/api` → `localhost:3000`; **Capacitor builds need an absolute `VITE_API_BASE_URL`** because there's no proxy in the native WebView.
- **State:** feature Pinia stores (`authStore`, `fieldsStore`, `harvestsStore`, `firmsStore`, `paymentsStore`, `geoStore`, `themeStore`). Extract reusable logic into `composables/`.

## Conventions (from `.agent/rules/`)

- **English-only** for all identifiers, TypeORM table/column names, REST paths, JSON keys, and comments — even though the product is Turkish.
- Use the `@/` alias everywhere; no relative `../../` imports.
- Thin controllers, logic in services (SRP, ~20–30 line functions). **DTOs for every input** (`Create`/`Update`/`Query`) — never use Entity classes as request bodies. Decorate controllers and DTOs with `@nestjs/swagger`.
- No `any`. Interfaces are **not** `I`-prefixed (`User`, not `IUser`). Enums are `PascalCase`. Vue component names must be multi-word. Use optional chaining / nullish coalescing defensively.
- Don't leave commented-out code; rely on git history.

## Infrastructure

- `docker-compose.yml` — local dev (Postgres 16 + api + web, source-mounted hot reload). `docker-compose.prod.yml` — production build. Dockerfiles: `apps/{api,web}/Dockerfile` (prod) and `Dockerfile.dev` (dev).
- `.env.example` is the env template (DB, JWT, mail, R2). The Joi schema in `app.module.ts` is the source of truth for which API env vars are required vs. optional.
- `n8n-workflows/` and `cloudflare/` hold automation/edge config; not part of the app build.

## Design Context

Frontend design is governed by two root files (written via `/impeccable init`); read both before designing or changing UI in `apps/web`:

- **`PRODUCT.md`** — strategy: register `product`; users are tea producers + workers, **mobile-first**; purpose is **field & production management**; personality **reliable, simple, practical**; anti-reference **cold/complex corporate ERP**; accessibility **WCAG AA, ≥44px touch targets, full reduced-motion, plain Turkish**.
- **`DESIGN.md`** — visual system (Google Stitch format): tokens, palette, typography, components. North Star **"The Field Ledger."** Machine-readable extensions + drop-in component snippets live in `.impeccable/design.json`.

Core visual rules: working green `#15803D` for primary actions / active / success only (≤10% of a screen, never decorative); money & harvest numbers always in Ink `#0F172A` at full contrast; flat by default (shadow on state/overlay only); one typeface (**Inter**); honest 1px borders; 8px grid. The `/impeccable` skill commands (`audit`, `critique`, `polish`, `layout`, …) load these automatically.
