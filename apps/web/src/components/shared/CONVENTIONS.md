# Web UI conventions (shadcn-vue + Tailwind v4)

Every page in `apps/web` is built from the same kit. No page ships its own
`<style scoped>` block for layout, cards, buttons, badges, tabs, modals,
tables, forms or spinners. Page-specific CSS is allowed only for things the
kit cannot express (map canvases, chart drawings, keyframe art).

Reference implementation: `src/pages/FieldsPage.vue`.

## Building blocks

| Need | Use | Import |
|---|---|---|
| Page body | `<PageContainer>` (`size="narrow"` for forms, `"wide"` for tables) | `@/components/shared` |
| Title row | `<PageHeader title description back-to>` + `#meta` (Badges) + `#actions` (Buttons) | `@/components/shared` |
| KPI tile | `<StatCard label value hint :icon to>` | `@/components/shared` |
| Search + filters row | `<ListToolbar>` default slot = `<SearchInput v-model>`; `#filters` = Select / ToggleGroup | `@/components/shared` |
| Empty | `<EmptyState title description :icon>` with action buttons in default slot | `@/components/shared` |
| Loading | `<LoadingState text>` for blocks, `<Spinner>` inside buttons, `<Skeleton>` for dashboards | `@/components/shared`, `@/components/ui/skeleton` |
| Confirm | `<ConfirmDialog v-model:open title description confirm-text :loading @confirm>` or `useConfirm().confirm({...})` (global) | `@/components/shared` |
| Any other modal | `Dialog` + `DialogContent/Header/Title/Description/Footer` | `@/components/ui/dialog` |
| Side panel / mobile picker | `Sheet` | `@/components/ui/sheet` |
| Section container | `Card` + `CardHeader/CardTitle/CardDescription/CardAction/CardContent/CardFooter` | `@/components/ui/card` |
| Content switching (panels) | `Tabs` + `TabsList variant="line"|default` + `TabsTrigger` + `TabsContent` | `@/components/ui/tabs` |
| Filter / mode / view toggle (no panels) | `ToggleGroup type="single"` + `ToggleGroupItem` | `@/components/ui/toggle-group` |
| Status chip | `<Badge variant="success|warning|info|danger|muted|secondary|outline">` | `@/components/ui/badge` |
| Button | `<Button variant="default|outline|secondary|ghost|destructive|link" size="default|sm|icon">` with class `h-11 md:h-9` (icon: `size-11 md:size-9`) | `@/components/ui/button` |
| Inputs | `Input`, `Textarea`, `Label`, `Checkbox`, `Switch`, `RadioGroup/RadioGroupItem`, `Select/SelectTrigger/SelectValue/SelectContent/SelectItem` | `@/components/ui/*` |
| Inline message | `<Alert variant="destructive|success|warning|info">` + `AlertTitle/AlertDescription` | `@/components/ui/alert` |
| Data table | `Table/TableHeader/TableRow/TableHead/TableBody/TableCell/TableEmpty` wrapped in `rounded-lg border bg-card overflow-hidden` | `@/components/ui/table` |
| Progress | `<Progress :model-value>` | `@/components/ui/progress` |
| Dropdown actions | `DropdownMenu*` | `@/components/ui/dropdown-menu` |
| Tooltip | `Tooltip*` | `@/components/ui/tooltip` |
| Toast | `useToast().success/error/warning/info` (global `AppToaster` already mounted) | `@/composables/useToast` |
| Icons | Lucide via `import { X } from '@lucide/vue'` — never inline `<svg>` paths, never emoji as icons | |

## Rules

- **Layouts:** `/tea/*` pages wrap in `<TeaBusinessLayout>`; admin pages use `<AdminLayout>`; Çaykur pages use `<CaykurLayout>`. All three render `ShellLayout` (shadcn sidebar + navbar).
- **Touch targets:** interactive controls are 44px on mobile, 36px on desktop: `h-11 md:h-9`, `size-11 md:size-9`, `min-h-11 md:min-h-9`.
- **Typography:** page title = `PageHeader` (text-2xl bold). Section title = `CardTitle` (text-base semibold). Body `text-sm`. Money and kg values: `font-semibold text-foreground tabular-nums`.
- **Color:** only tokens (`bg-card`, `text-muted-foreground`, `border`, `bg-primary`, `text-destructive`, `bg-success/10` …). No hex, no `rgba()`, no `var(--color-*)` legacy variables, no gradients, no decorative green. Green is for primary actions, active state and success only.
- **Surfaces:** flat. `rounded-lg border bg-card`. No box-shadow except overlays (`Dialog`, `DropdownMenu`) and `shadow-xs` on outline controls.
- **Spacing:** 8px grid — `gap-2/3/4/6`, `p-4 md:p-6`. Vertical rhythm on a page comes from `PageContainer` (`gap-6`).
- **Grid:** `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` for card lists, `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` for KPI rows.
- **Tables on mobile:** hide secondary columns with `hidden md:table-cell` and stack the info in the first cell (see `RecentDeliveriesTable.vue`); or show a card list under `md:hidden` and the table under `hidden md:block`.
- **Forms:** `<div class="space-y-2"><Label for=id>…</Label><Input id=id class="h-11 md:h-9" /><p class="text-xs text-muted-foreground">hint</p><p class="text-xs text-destructive">error</p></div>`; group fields with `grid gap-4 md:grid-cols-2`.
- **Dark mode:** automatic through tokens. Never add `[data-theme=dark]` rules.
- **Accessibility:** icon-only buttons carry `aria-label`; decorative icons carry `aria-hidden="true"`; lists of toggles use `ToggleGroup` (roving tabindex built in); dialogs use `Dialog`/`ConfirmDialog` (focus trap built in).
- **No legacy:** do not import `AppButton`, `AppInput`, `AppSelect`, `AppModal`, `ConfirmModal`, `AppEmptyState`, `AppToast`, `.btn*`, `.form-input`, `.card`, `.app-tabs`, `.ck-*` classes. They are being deleted.
- **Vue:** `<script setup lang="ts">`, 4-space indent, single quotes, trailing commas, English identifiers/comments, Turkish UI text.
