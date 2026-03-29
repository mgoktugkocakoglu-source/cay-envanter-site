# Çay Üreticisi Platformu (Tea Producer Platform) - Project Context

This project is a digital platform for tea producers, built as a monorepo using **NestJS** for the backend and **Vue.js** for the frontend.

## 🏗️ Architecture & Technology Stack

### Core Infrastructure
- **Monorepo Management:** `pnpm` workspaces.
- **Containerization:** Docker and Docker Compose (PostgreSQL, Dev/Prod environments).
- **Environment Management:** `.env` files with strict validation.

### Backend (`apps/api`)
- **Framework:** NestJS 10 (TypeScript).
- **Database:** PostgreSQL with TypeORM.
- **Authentication:** JWT (Passport.js) with session/entity support.
- **Email:** Resend / Mailgun integration.
- **Validation:** `class-validator` and `class-transformer` with global `ValidationPipe`.
- **Documentation:** OpenAPI (Swagger) available at `/api/docs`.
- **Security:** Helmet, Throttler, and strict CORS policies.

### Frontend (`apps/web`)
- **Framework:** Vue 3 (Composition API + TypeScript).
- **Build Tool:** Vite.
- **State Management:** Pinia (modular stores).
- **Routing:** Vue Router.
- **Styling:** Vanilla CSS (Dark Theme focus).
- **Key Libraries:** Leaflet (maps), Tiptap (rich text editor).

---

## 🛠️ Key Commands

### Development
- `pnpm install`: Install all dependencies.
- `pnpm dev:api`: Start backend development server (with watch mode).
- `pnpm dev:web`: Start frontend development server (Vite).
- `docker-compose up -d`: Start local infrastructure (PostgreSQL).

### Build & Maintenance
- `pnpm build:api`: Build backend for production.
- `pnpm build:web`: Build frontend for production.
- `pnpm lint`: Run linting across all packages.
- `pnpm format`: Run Prettier across all packages.

---

## 📏 Development Conventions

### 1. Language & Naming
- **English-Only Codebase:** All code (variables, classes, functions), database schemas, API contracts, and comments **must be in English**.
- **Naming:** Use self-descriptive names. Avoid abbreviations.
  - Backend: PascalCase for classes/types, camelCase for functions/variables.
  - Frontend: PascalCase for Components, camelCase for composables/stores.

### 2. Backend (NestJS) Standards
- **Thin Controllers:** Business logic belongs in **Services**.
- **DTOs:** Mandatory for every input (`Create`, `Update`, `Query`). Never use Entities for request bodies.
- **Standardized Responses:** All successful responses should be wrapped via Interceptors.
- **Strict Typing:** No `any` or `unknown` without proper type guards.
- **Path Aliasing:** Use `@/` for internal `src/` imports.

### 3. Frontend (Vue) Standards
- **Composables:** Extract complex logic into `src/composables/`. Keep components "thin".
- **Pinia Stores:** Use feature-specific stores (e.g., `authStore.ts`). Actions should contain business logic.
- **Type Safety:** Use generic components for reusable UI elements. Define explicit interfaces for Props and Emits.
- **CSS:** Prefer descriptive English class names in Vanilla CSS.

### 4. Code Quality
- **DRY & SRP:** Avoid logic duplication. Every function/class should have a single responsibility.
- **Defensive Programming:** Use optional chaining (`?.`) and nullish coalescing (`??`).
- **Error Handling:** Centralized error handling via NestJS Exception Filters and Vue global error handlers.

---

## 📂 Directory Structure Highlights
- `apps/api/src/`: Backend source (auth, users, fields, harvests, etc.).
- `apps/web/src/`: Frontend source (pages, components, stores, composables).
- `.agent/`: Contains detailed rules and standards (NestJS, TypeORM, Vue, etc.).
- `packages/`: Potential shared utilities or types.
