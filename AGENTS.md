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

## What the product is for, and how rules may change

The owner sells this to ÇAYKUR as a tool that **decides as many gardens and parcels as the evidence allows**. Two
outcomes count as success on a screen: "the two pruning methods agree" (combined class `confirmed`, shown as *uyumlu*)
and "the sources agree" (compliance `agreed`). The owner wants these numbers **as high as measurement supports**; a
change that shrinks them is a regression unless a measurement shows it removed false alarms.

Caution is already built in (review classes, DEMO labels, "preliminary assessment"). Adding more of it by tightening
a detection rule is not neutral: on 15–16 Nov 2026 a tightening of the combined pruning rule cut agreed gardens from
10 to 1 in 2025-26 and removed no false alarm (0 before, 0 after on the mirrored series); it was withdrawn.

Rules for any agent:

- **Do not change a detection or promotion rule, a threshold, or what counts as agreement / conflict on reasoning
  alone.** Measure it. Pruning: `node scripts/combined-validate.mjs … --season <y>` (mirrored series = false alarms,
  shared simulated cuts = detection). NDVI screening: `node scripts/ndvi-threshold-check.mjs` in `cayhesabim/apps/api`.
  Compliance certainty: report the class counts before and after.
- A rule change goes in **only with the before/after numbers in the commit message**, and only if it keeps or raises
  the agreed counts, or lowers measured false alarms. Otherwise leave the rule and tell the owner what you found.
- **Never drop a validation, history or accuracy output because rules changed. Regenerate it** with the new rules in
  the same change. A module without its measured numbers is worse than the old rule.
- **A DEMO register is not evidence.** It may not create conflicts, findings of disagreement, or block agreement.
- Weak notes (area gap from 10 m pixels, open building footprints, deed-area gap) stay in their own rule; they do not
  turn a parcel into a conflict.
- Presentation work (maps, exports, wording, layout) is welcome and needs none of this. Do not rename result classes or
  hide result cards the owner already uses without being asked.
- When unsure whether something is a rule change, ask the owner before touching it.

The rule details live in `../cay-envanter/AGENTS.md` (combined pruning, compliance certainty).

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
