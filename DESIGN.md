---
name: Çay Hesabım
description: Field and production management for tea producers — a trustworthy ledger in your pocket.
colors:
  tea-green: "#15803D"
  tea-green-hover: "#166534"
  tea-green-dark: "#22C55E"
  field-blue: "#1E3A8A"
  field-blue-hover: "#1E40AF"
  ink: "#0F172A"
  ink-secondary: "#475569"
  ink-muted: "#64748B"
  paper: "#F8FAFC"
  surface: "#FFFFFF"
  surface-sunken: "#F1F5F9"
  border: "#E2E8F0"
  border-strong: "#CBD5E1"
  success: "#15803D"
  warning: "#B45309"
  danger: "#B91C1C"
  info: "#1E3A8A"
  paper-dark: "#0F172A"
  surface-dark: "#111827"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "8px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.tea-green}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.tea-green-hover}"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Çay Hesabım

## 1. Overview

**Creative North Star: "The Field Ledger"**

Çay Hesabım is a record book you can trust, carried in a pocket and opened in a tea garden. Its job is to make the numbers that matter, harvest kilos, prices, and what a firm owes, plain, legible, and dependable. The visual system is built on a calm slate-neutral surface with a single working green that means *go, done, and growing*. Nothing decorates; everything reports. The interface is light by default because it is read outdoors in daylight, and it stays out of the way so the task, not the tool, holds attention.

This system explicitly rejects the look of cold, complex corporate ERP and accounting software: no crowded screens, no wall of menus, no intimidating density for its own sake. It equally rejects generic-template SaaS dressing, purple-to-blue gradients, cards nested in cards, a tracked uppercase eyebrow over every section. Identity here comes from being a focused, trustworthy field tool, not from ornament. Surfaces are sturdy and clear: solid fills, honest 1px borders, predictable states.

Depth is quiet. Surfaces are flat at rest and lift only when state demands it, a card on hover, a modal over the page, an input under focus. The green appears on actions and positive status, never as background filler. The result reads as serious without being severe, and familiar enough that a producer never has to *learn* it.

**Key Characteristics:**
- Light-first, slate-neutral surface tuned for outdoor daylight reading.
- One working green (`#15803D`) reserved for actions and positive state.
- Flat by default; shadow is a response to state, not a texture.
- One typeface (Inter) carrying every role through weight and size.
- 8px spatial grid; gently rounded corners (8px); honest 1px borders.
- Sturdy, predictable components with complete states.

## 2. Colors

A slate-neutral foundation carrying one decisive tea-garden green, with a deep field blue as the quiet secondary and a clear, standardized status set.

### Primary
- **Tea Green** (`#15803D`, hover `#166534`): the single working accent. Primary buttons, active navigation, focus rings, links, selected state, and the *success* status all speak through this green. In the optional dark theme it brightens to **Bright Tea Green** (`#22C55E`) to hold contrast on a slate-900 ground.

### Secondary
- **Field Blue** (`#1E3A8A`, hover `#1E40AF`): a restrained informational accent. Used for `info` messaging and secondary emphasis, never competing with the green for primary actions.

### Neutral
- **Ink** (`#0F172A`): primary text and the highest-contrast foreground. This is where the numbers live.
- **Ink Secondary** (`#475569`): labels, secondary copy, supporting text.
- **Ink Muted** (`#64748B`): hints, placeholders, metadata. Never used for the figures that carry meaning.
- **Paper** (`#F8FAFC`): the default page background; a near-white slate, not warm cream.
- **Surface** (`#FFFFFF`): cards, inputs, panels, and toolbars sit one step above Paper.
- **Surface Sunken** (`#F1F5F9`): tracks, wells, tab groups, recessed areas.
- **Border** (`#E2E8F0`) / **Border Strong** (`#CBD5E1`): dividers and resting strokes; the strong step on hover.

### Status
- **Success** (`#15803D`, same as Tea Green), **Warning** (`#B45309`), **Danger** (`#B91C1C`), **Info** (`#1E3A8A`). Each appears as text + a 1px border over a ~10% tint of itself in message boxes.

### Named Rules
**The Working-Green Rule.** Green is a verb, not a wallpaper. It marks what the user can *do* (primary action), what *is* (active / selected), and what *went right* (success). It is never a decorative background or a gradient. If a screen is more than a tenth green by area, something has turned the accent into ornament.

**The Numbers Stay Ink Rule.** Money and harvest figures are always rendered in **Ink** (`#0F172A`), never in muted gray "for elegance." Muting a number is muting the product's promise.

## 3. Typography

**Display / Body / Label Font:** Inter (with `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` fallback)

**Character:** One humanist-leaning sans carries the entire interface. Hierarchy comes from size and weight, not from a second face. This is the product permission of a working tool: familiarity over flourish, legibility over personality. Rendered with antialiasing on a 16px root.

### Hierarchy
- **Display** (700, `2.5rem` / 40px, line-height 1.25): the largest figures and page-defining headings; rare.
- **Headline** (700, `2rem` / 32px, line-height 1.25): page titles.
- **Title** (600, `1.625rem` / 26px, line-height 1.25): section and card headings; auth titles.
- **Body** (400, `1rem` / 16px, line-height 1.5): default reading text. Cap prose at 65–75ch; dense tables may run wider.
- **Label** (600, `0.875rem` / 14px): form labels, tab labels, metadata. Sentence case, not tracked uppercase.

### Named Rules
**The One Family Rule.** Inter does every job, heading, button, label, body, and data. No display pairing, no second sans. If a screen seems to need another typeface, it needs better weight and size contrast instead.

**The Plain Label Rule.** Labels are sentence-case Turkish at 14px/600. No all-caps, no letter-tracking, no eyebrow kickers. A label names a thing; it does not decorate a section.

## 4. Elevation

Flat by default. Surfaces rest without shadow and rely on the tonal step from Paper → Surface → Surface Sunken to convey layering. Shadow is reserved for state and true overlay: a card that lifts on hover, a modal above the page, the focus glow under an input. The shadow vocabulary is soft and slate-tinted (low opacity over `rgba(15, 23, 42, …)`), never the hard, dark drop shadow of a 2014 app.

### Shadow Vocabulary
- **sm** (`box-shadow: 0 1px 2px 0 rgba(15,23,42,0.04)`): resting cards that need just enough separation (`.card-elevated`), tab groups.
- **md** (`box-shadow: 0 1px 3px 0 rgba(15,23,42,0.08)`): the active tab, low hover lift.
- **lg** (`box-shadow: 0 4px 10px -2px rgba(15,23,42,0.10)`): dropdowns, popovers.
- **xl** (`box-shadow: 0 8px 18px -6px rgba(15,23,42,0.14)`): modals and the highest overlays.

### Named Rules
**The Flat-By-Default Rule.** A surface earns a shadow only by changing state or floating above the page. If a card carries `shadow-lg` while sitting still in the content flow, the elevation is decorative; remove it and let the tonal step do the work.

## 5. Components

Sturdy and clear: solid fills, honest 1px borders, 8px corners, and a complete, predictable set of states on every interactive element.

### Buttons
- **Shape:** gently rounded (8px, `--radius-md`), `min-height: 40px`, horizontal padding 24px, medium weight (500), single-line.
- **Primary:** solid Tea Green fill, white text, 1px green border. Hover darkens to `#166534`.
- **Secondary:** Surface fill, Ink text, 1px Border. Hover fills Surface Sunken and strengthens the border.
- **Danger:** solid Danger fill (`#B91C1C`), white text; hover `#DC2626`.
- **Link:** transparent, Tea Green text, underline on hover.
- **Disabled:** opacity 0.6, `not-allowed` cursor. **Large:** `.btn-lg`. **Full-width:** `.btn-block`.

### Inputs / Fields
- **Style:** Surface background, 1px Border-strong stroke, 8px corners, `height: 40px`, 16px horizontal padding.
- **Focus:** border turns Tea Green and a 3px green glow appears (`box-shadow: 0 0 0 3px var(--color-primary-light)`); default outline removed (handled by the focus ring).
- **Error:** `.has-error` turns the border Danger; focus glow shifts to a red tint.
- **Support text:** `.form-label` (14px/600, Ink Secondary), `.form-hint` (Ink Muted), `.form-error` (Danger).

### Cards / Containers
- **Corner Style:** 8px (`--radius-lg`).
- **Background:** Surface (`#FFFFFF`) on a Paper page.
- **Border:** 1px Border (`#E2E8F0`).
- **Shadow Strategy:** none at rest; opt into `.card-elevated` (shadow-sm) only when separation is needed. See Elevation.
- **Internal Padding:** 24px (`--space-6`).

### Tabs (signature)
- A segmented control in a Surface-Sunken track with a 1px border and `shadow-sm`.
- **Tab button:** `min-height: 44px`, 14px/600 label, Ink Secondary at rest.
- **Active:** Ink-on-Surface with a strengthened border, `shadow-md`, and a 2px Tea Green underline bar; the count chip tints to green.

### Message Boxes / Alerts (signature)
- Four intents (success / warning / danger / info), each a ~10% tint of its status color with a matching 1px border and text in that color. Icon + message in a row, 8px corners.

### Navigation
- A two-hub app shell (Tea Business `/tea/*` and Social `/social/*`) with dedicated layouts. Navigation uses the same tab/button vocabulary above and respects mobile safe-area insets (`env(safe-area-inset-*)`), since the primary surface is a Capacitor native app.

## 6. Do's and Don'ts

### Do:
- **Do** render money and harvest figures in **Ink** (`#0F172A`) at full contrast. The numbers are the promise.
- **Do** reserve **Tea Green** (`#15803D`) for primary actions, active/selected state, focus, and success, ≤10% of any screen by area.
- **Do** keep surfaces flat at rest; add shadow only on hover, focus, or true overlay (modal/dropdown).
- **Do** verify text contrast ≥ 4.5:1 (large ≥ 3:1) in **both** light and dark themes; light is the default and the daylight case.
- **Do** make touch-critical controls reach **≥ 44 × 44px**. Tabs already do; the 40px `--control-height` is a floor, pad primary tap targets up to 44px.
- **Do** give every `@media (prefers-reduced-motion: reduce)` a crossfade or instant alternative; transitions are 150–250ms `ease` and convey state, not choreography.
- **Do** write labels, errors, and empty states in plain, sentence-case Turkish that teaches the next step.
- **Do** keep one typeface (Inter); build hierarchy with size and weight.

### Don't:
- **Don't** let the interface drift toward **cold, complex corporate ERP / accounting software**: no crowded screens, no wall of menus, no density without a reason. (PRODUCT.md anti-reference.)
- **Don't** apply generic-template SaaS dressing: no **purple-to-blue gradients**, no **gradient text**, no **cards nested in cards**, no **tracked uppercase eyebrow** over every section. (PRODUCT.md anti-reference.)
- **Don't** use a colored `border-left`/`border-right` greater than 1px as a side-stripe accent. Use a full border or a background tint.
- **Don't** mute a number to gray "for elegance." Ink only.
- **Don't** use Tea Green as a decorative background or fill large areas with it; it is an accent, not a wallpaper.
- **Don't** introduce a second font family or all-caps tracked body/labels.
- **Don't** ship a card floating on `shadow-lg` while at rest; flat is the resting state.
- **Don't** invent custom scrollbars, exotic form controls, or modal-first flows where an inline/progressive pattern serves the task.
