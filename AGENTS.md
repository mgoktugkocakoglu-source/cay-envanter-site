# AGENTS.md

Guidance for coding agents working in this repository. **`CLAUDE.md` in this folder is the full project guide**
(architecture, commands, conventions, design context); read it first. This file adds what an agent needs on top of it.

## Project in one paragraph

"Çay Üreticisi Platformu": pnpm-workspace monorepo with a NestJS API (`apps/api`) and a Vue 3 web app (`apps/web`).
Product text is Turkish; code, identifiers, DB schema, API contracts and comments are English. The ÇAYKUR institution
panel (`/caykur/*`, `apps/api/src/tea-inventory`, `apps/web/src/components/caykur`) displays data produced by the
analysis engine in the sibling checkout `../cay-envanter`; see `../cay-envanter/AGENTS.md` for the engine and for the
flow that brings its bundles here.

## Commands that work here

```bash
corepack pnpm@8.15.0 --filter @cayhesabim/web <script>   # pnpm is run through corepack on this machine
npx vue-tsc --noEmit        # in apps/web: the web type-check
npx nest build              # in apps/api: build to dist
SEED_DEMO=true node dist/main.js   # in apps/api: run the API (imports seed bundles whose generatedAt changed)
node start-db.mjs           # in ../lokal: local embedded Postgres
```

- There is no test runner and no lint config; do not invent a `test` step. Type-check and build are the checks.
- The API reads its seed bundles from `dist`: after `../cay-envanter/scripts/sync-site.mjs` copies a new bundle,
  rebuild and restart, or nothing is imported.
- TypeORM runs with `synchronize: true`: schema changes are made by editing entities. Large module blocks are `jsonb`
  columns with `select: false`; read only the parts you need (see `executive-summary.service.ts`).
- Credentials live in `apps/api/.env`. Never print them, never type them into a browser, never commit them.

## Rules that are not negotiable

- **Nothing is pushed, merged or deployed unless the owner asks.** Work on `feat/tea-inventory`, commit locally.
  Do not merge to `main` of the shared remote (`origin`). Do not run `vercel --prod`.
- **Preliminary assessment only.** ÇAYKUR screens never present a result as an administrative decision.
- **DEMO records stay labelled** on every screen that rests on them (licence and producer registers are demo data).
- **Never fabricate evidence**: no invented detections or accuracy figures, no sharpened or super-resolved imagery.
- **Modules stay separate**: a new module gets its own service, controller, types and component; it reads other
  modules' blocks and does not change them.
- No purchases, no paid services, no new accounts.

## Conventions most often missed

- `@/` alias for every internal import; thin controllers, logic in services; a DTO for every input; Swagger decorators.
- List endpoints return `{ data, meta: { total, page, limit, totalPages } }`.
- Web pages are built from the shadcn-vue kit in `apps/web/src/components/ui` and `components/shared`
  (`apps/web/src/components/shared/CONVENTIONS.md`); touch targets ≥ 44 px; colours from tokens.
  Add shadcn-vue components by hand, not with the CLI.
- `PRODUCT.md` and `DESIGN.md` govern UI decisions.
- Files are CRLF on this machine; keep line endings when patching. Comments say what the code does or why.

## Two agents work on this code

Claude Code and Codex both work in this checkout and in `../cay-envanter`, at different times, for the same owner.
Neither sees the other's conversation; the repositories are the only shared state.

- Before starting, run `git status` and `git log --oneline -10` in both checkouts and read what changed.
- Uncommitted changes you did not make belong to the other agent or the owner: leave them; do not revert, stash or reformat them.
- Commit your own work in small commits with a message that says what the change does.
- Do not rewrite history (no amend of others' commits, no rebase, no force push).
- When you change how something is run or a standing rule, update this file or `CLAUDE.md` in the same commit.
- The database, API or Vite may already be running: check the port before starting a second copy.

The n8n automation prompt that used to be in this file is now `n8n-workflows/n8n-agent-prompt.md`.
