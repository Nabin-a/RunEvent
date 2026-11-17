---
name: RunEvent
description: Multi-tenant running event management dashboard and transparent net-price race directory
colors:
  vermilion-corral: "#bf3b19"
  vermilion-deep: "#a32f11"
  vermilion-soft: "#fdede8"
  track-navy: "#102538"
  track-navy-deep: "#0b1a28"
  track-navy-surface: "#18344e"
  navy-badge-soft: "#e6eef6"
  navy-badge-ink: "#13314d"
  forest-verified: "#166544"
  forest-soft: "#e5f4ec"
  forest-ink: "#0f4d33"
  amber-caution: "#8a5207"
  amber-soft: "#fdf2de"
  amber-ink: "#693d04"
  crimson-danger: "#a32424"
  crimson-soft: "#fce8e8"
  crimson-ink: "#7d1818"
  tyvek-limestone: "#f5f4ee"
  crisp-stock: "#ffffff"
  tyvek-warm-tint: "#eceae0"
  ink-primary: "#13202c"
  ink-secondary: "#354a5e"
  ink-placeholder: "#475e73"
  shell-text-primary: "#f4f7fa"
  shell-text-secondary: "#c4d5e6"
  line-subtle: "#d6d4c8"
  line-strong: "#b8b5a6"
typography:
  display:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.38rem, 2vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.08rem, 1.4vw, 1.25rem)"
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.28
  body:
    fontFamily: "'Sarabun', 'Anuphan', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.82rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
rounded:
  none: "0px"
  sm: "4px"
  md: "6px"
spacing:
  xs: "0.35rem"
  sm: "0.55rem"
  md: "0.95rem"
  lg: "1.25rem"
  xl: "1.6rem"
components:
  button-primary:
    backgroundColor: "{colors.vermilion-corral}"
    textColor: "{colors.crisp-stock}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.95rem"
  button-primary-hover:
    backgroundColor: "{colors.vermilion-deep}"
    textColor: "{colors.crisp-stock}"
  button-secondary:
    backgroundColor: "{colors.crisp-stock}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "0.48rem 0.85rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.navy-badge-ink}"
    rounded: "{rounded.sm}"
    padding: "0.34rem 0.65rem"
  bib-strip-container:
    backgroundColor: "{colors.crisp-stock}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.none}"
    padding: "1rem 1.2rem"
---

# Design System: RunEvent

## Overview

**Creative North Star: "The Race-Day Tyvek BIB & Course Ledger"**

RunEvent's visual system translates the split-second legibility of Thai road-race Tyvek BIB headers and start-corral coding into an operational multi-tenant dashboard and public event directory. Built for organizers managing quotas and satang-accurate payouts under office light as well as kit-pickup staff working on phones under outdoor expo tents, the interface prioritizes active tenant/event context, urgent operational tasks, and traceable numerical equations over decorative SaaS charts.

Surfaces pair a committed deep track-navy shell with a warm limestone Tyvek ground so long participant tables and financial ledgers remain glare-free during extended sessions. The system rejects generic neutral-grey SaaS card grids, thick side-stripe alerts, faux skeuomorphic holes, and eyebrow kickers above headings.

**Key Characteristics:**
- Committed track-navy context shell framing a warm limestone operational canvas
- Square-cut Tyvek BIB header strips uniting atomic quota progress with balanced THB payout equations
- Distance-corral color coding (`vermilion`, `navy`, `forest`, `amber`) paired with explicit text and icon badges
- Tabular monospace numerals across every quota ratio, BIB assignment, and satang-accurate financial figure

## Colors

A committed dual-plane palette contrasting deep early-morning track navy in navigation chrome against warm limestone stock in working areas, accented by high-contrast race-marshal signal inks.

### Primary
- **Start-Corral Vermilion** (`#bf3b19`, hover `#a32f11`, soft wash `#fdede8`): Reserved for primary actions, active surface switches, 21.1K corral markers, and the net organizer payout callout.

### Secondary
- **Track Navy** (`#102538`, deep header `#0b1a28`, hover surface `#18344e`, soft chip `#e6eef6`, chip ink `#13314d`): Anchors the global top bar, organization/event navigation rail, BIB top bands, and 10K corral badges.

### Tertiary
- **Verified Forest** (`#166544`, soft `#e5f4ec`, ink `#0f4d33`): Confirmed registrations, succeeded webhook payments, completed kit pickups, active price tiers, and 5K corral chips.
- **Marshal Amber** (`#8a5207`, soft `#fdf2de`, ink `#693d04`): Temporary quota reservations (`pending_payment`), pending refund reviews, and trail category chips.
- **Void Crimson** (`#a32424`, soft `#fce8e8`, ink `#7d1818`): Succeeded refund deductions, suspended event notices, and duplicate-BIB or duplicate-pickup blocks.

### Neutral
- **Tyvek Limestone** (`#f5f4ee`) and **Warm Tint** (`#eceae0`): Primary page ground and table header/stat-cell fill.
- **Crisp Stock** (`#ffffff`): Working panels, BIB ledger strips, and form inputs.
- **Navy-Tinted Primary Ink** (`#13202c`), **Secondary Ink** (`#354a5e`), and **Placeholder Ink** (`#475e73`): Tinted from the track-navy hue rather than neutral grey, maintaining ≥4.5:1 contrast across body and placeholder text.
- **Shell Text Primary** (`#f4f7fa`) and **Shell Text Secondary** (`#c4d5e6`): High-contrast light inks on dark track-navy chrome.
- **Hairline Subtle** (`#d6d4c8`) and **Hairline Strong** (`#b8b5a6`): 1px structural rules and input strokes.

### Named Rules
**The Tinted-Ink Rule.** Secondary text, placeholders, and scrollbars are tinted from track navy or warm limestone, never pure neutral grey.
**The Icon-Plus-Label Status Rule.** Signal colors never carry state alone; every status pill pairs a 1.75px stroke SVG icon with an explicit Thai status label.

## Typography

**Display Font:** Anuphan (with Sarabun and system-ui fallback)
**Body Font:** Sarabun (with Anuphan and system-ui fallback)
**Label/Mono Font:** JetBrains Mono (with ui-monospace and Consolas fallback)

**Character:** Clean contemporary Thai-Latin geometric headings (Anuphan) establish crisp section landmarks, looped high-legibility Thai body copy (Sarabun) sustains dense operational reading without eye strain, and tabular monospace (JetBrains Mono) locks every currency, date, and BIB code into strict vertical alignment.

### Hierarchy
- **Display** (700, `clamp(1.38rem, 2vw, 1.75rem)`, line-height 1.28, tracking `-0.015em`): Page-level operational titles and public directory header.
- **Headline** (700, `clamp(1.08rem, 1.4vw, 1.25rem)`, line-height 1.28, tracking `-0.015em`): Panel titles, event row titles, and drawer headings (`margin: 1.1rem 0 0.5rem` so top space exceeds bottom space).
- **Title** (600, `1rem`, line-height 1.28): Zone subheadings inside the BIB ledger strip and runner ticket rows.
- **Body** (400–600, `1rem` / `0.94rem` muted, line-height 1.55): Operational descriptions, constrained to `65–72ch` max width.
- **Label / Mono** (600–700, `0.82rem` codes to `1.38rem` figures, tracking `-0.02em`, `font-variant-numeric: tabular-nums`): Organization/event/order codes, THB satang figures, quota ratios, and QR check-in tokens.

### Named Rules
**The Self-Sufficient Heading Rule.** Headings never carry an eyebrow or uppercase kicker label above them; metadata codes sit inline beside or below the heading.
**The Tabular Money & Quota Rule.** Every THB amount, quota count, date range, and BIB identifier uses `tabular-nums` so figures never jitter when filters change.

## Layout

Desktop Organizer views use a persistent two-column shell (`grid-template-columns: 272px minmax(0, 1fr)`) pairing the locked Organization/Event context rail on the left with a `1380px` max-width operational canvas (`padding: 1.15rem 1.6rem 2.5rem`) on the right. Public event discovery splits into an event BIB directory list and a sticky net-price checkout drawer (`1.35fr 1fr`).

At `≤1080px` and `≤680px`, all multi-column grids collapse to `minmax(0, 1fr)` with `min-width: 0; max-width: 100%` enforced across rails, canvases, and form controls. On mobile check-in screens (`390px`), the context rail condenses into horizontal scroll-tabs and full-width context selects so the QR token scanner and first participant card appear immediately inside the first viewport with zero horizontal page overflow.

## Elevation & Depth

RunEvent relies primarily on high-contrast surface stepping (`#102538` rail → `#f5f4ee` limestone ground → `#ffffff` crisp stock) reinforced by 1px hairlines (`#d6d4c8` / `#b8b5a6`) and a single soft, offset ambient shadow on top-level panels. Inner rows divide with 1px horizontal rules rather than nesting cards inside cards.

### Shadow Vocabulary
- **Panel Lift** (`box-shadow: 0 6px 18px -6px rgba(16, 37, 56, 0.09)`): Applied to primary stock panels, the BIB ledger strip, and event rows.
- **Primary CTA Hover** (`box-shadow: 0 4px 12px -2px rgba(191, 59, 25, 0.28)`): Applied on `:hover` for primary vermilion buttons.

### Named Rules
**The Single-Layer Container Rule.** Working panels never nest shadowed cards inside shadowed cards; interior collections use flat `#f5f4ee` cells or 1px hairline table rows.

## Shapes

The system intentionally contrasts two corner geometries grounded in physical vs. digital roles:
- **Square-Cut BIB Sheets (`0px` radius):** Used on `.bib-strip-shell`, `.event-bib-row`, and `.checkin-card-row` to echo die-cut Tyvek race bibs, paired with full-width interior header bands rather than thick outer accent borders on rounded corners.
- **Standard Controls & Utility Panels (`4px`–`6px` radius):** Buttons, inputs, selects, status pills, and standard data panels use crisp `4px` (`--radius-sm`) and `6px` (`--radius-md`) corners with uniform 1px borders.

## Components

### Buttons
- **Shape:** Crisp small radius (`4px`) with 1px solid border and inline 1.75px stroke SVG icon support.
- **Primary:** Start-Corral Vermilion (`#bf3b19`) fill with `#ffffff` bold text (`0.5rem 0.95rem`), darkening to `#a32f11` with soft offset shadow on hover.
- **Hover / Focus:** `0.18s cubic-bezier(0.16, 1, 0.3, 1)` transition; keyboard `:focus-visible` renders a `2px solid #bf3b19` outline at `2px` offset.
- **Secondary & Ghost:** Secondary uses `#ffffff` fill with `#b8b5a6` border shifting to `#eceae0` on hover; Ghost uses transparent fill with `#d6d4c8` border shifting to `#e6eef6`.

### Chips & Status Pills
- **Style:** `4px` radius, `0.2rem 0.55rem` padding, 1px tinted border over soft semantic fill (`badge-forest`, `badge-amber`, `badge-danger`, `badge-navy`, `badge-neutral`), plus distance-corral `.category-bib-chip` variants (`tone-vermilion`, `tone-navy`, `tone-forest`, `tone-amber`).
- **State:** Active price tiers render `.tier-active-dot` with a 7px `#166544` indicator circle and `[ใช้อยู่]` label.

### Cards / Containers
- **Corner Style:** `0px` on BIB strips and event/check-in BIB sheets; `6px` on standard operational tables and forms.
- **Background:** Crisp Stock (`#ffffff`) over Tyvek Limestone (`#f5f4ee`).
- **Shadow Strategy:** Single-level Panel Lift (`0 6px 18px -6px rgba(16, 37, 56, 0.09)`).
- **Border:** Uniform `1px solid #d6d4c8` or `#b8b5a6`.
- **Internal Padding:** `1.1rem 1.25rem` on desktop, tightening on `≤680px`.

### Inputs / Fields
- **Style:** `1px solid #b8b5a6`, `#ffffff` background, `4px` radius, `min-height: 38px` (`34px` in compact mobile rail), `#475e73` accessible placeholder ink; range and checkbox controls use `accent-color: #bf3b19`.
- **Focus:** `2px solid #bf3b19` outline with `2px` offset and vermilion text caret.
- **Error / Disabled:** `0.55` opacity with `not-allowed` cursor when disabled; validation and duplicate-BIB errors surface in `#fce8e8` alert callouts with icon and recovery instructions.

### Navigation
- **Global Top Bar & Context Rail:** Deep navy (`#0b1a28` / `#102538`) with `#c4d5e6` inactive links, `#18344e` hover, vermilion (`#bf3b19`) active surface tab, and `#f5f4ee` active rail pill with `#13202c` bold text. Collapses horizontally into a compact scrollable strip below `1080px`.

### Signature Component: Tyvek BIB Quota & Ledger Strip (`BibLedgerStrip`)
- Full-width square-cornered sheet (`0px` radius) topped by a `#102538` header band with a `2px solid #bf3b19` bottom rule, scope code, and active time-window badge. Splits into a left Atomic Quota progress track + interactive count triggers and a right balanced THB equation (`Gross Paid − Succeeded Refunds − Platform Revenue = Net Organizer Payout`), where clicking any figure drills directly into its matching source records under the same scope and time window.

## Do's and Don'ts

### Do:
- **Do** place the Urgent Action Queue and locked Organization/Event context above summary metrics on operational views.
- **Do** keep square corners (`0px`) on BIB strips and event BIB sheets while using `4px`–`6px` corners on standard controls and tables.
- **Do** format every price, fee, refund, payout, and quota counter with `font-variant-numeric: tabular-nums` and satang-accurate arithmetic.
- **Do** use `minmax(0, 1fr)` on responsive grid columns so `390px` mobile check-in views never scroll horizontally.

### Don't:
- **Don't** place kickers or eyebrow labels above `h1`, `h2`, or `h3` headings.
- **Don't** apply thick (`>1px`) colored `border-left`, `border-right`, or `border-top` accents onto rounded containers.
- **Don't** use Unicode glyphs or emoji in place of the unified `1.75px` stroke SVG icon set, or rely on color alone to communicate status.
- **Don't** render faux physical holes, bevels, or unlabelled synthetic business claims.
