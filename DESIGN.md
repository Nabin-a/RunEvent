---
name: Kratai
description: Modern minimal race discovery & storefront portal paired with a self-explanatory multi-tenant organizer dashboard
colors:
  shell-navy: "#0f172a"
  shell-navy-elevated: "#1e293b"
  shell-border: "#334155"
  shell-text: "#f8fafc"
  shell-text-muted: "#cbd5e1"
  bg-canvas: "#f7f8fa"
  bg-surface: "#ffffff"
  bg-subtle: "#f1f4f8"
  bg-selected: "#eef4fb"
  ink-primary: "#0f172a"
  ink-secondary: "#475569"
  ink-placeholder: "#52637a"
  vermilion: "#c23b1a"
  vermilion-hover: "#a12e11"
  vermilion-soft: "#fef0ec"
  vermilion-border: "#f2bfb1"
  vermilion-ink: "#7f210a"
  forest: "#157347"
  forest-soft: "#eaf7f0"
  forest-border: "#b6e2ca"
  forest-ink: "#0d4f30"
  amber: "#945606"
  amber-soft: "#fef5e6"
  amber-border: "#edd09d"
  amber-ink: "#6e3e03"
  danger: "#b42318"
  danger-soft: "#fef0ef"
  danger-border: "#f3bebe"
  danger-ink: "#7a160f"
  navy-soft: "#edf3fa"
  navy-border: "#c2d5eb"
  navy-ink: "#153559"
  line-light: "#e2e8f0"
  line-medium: "#cbd5e1"
  line-social-green: "#068a3c"
typography:
  hero:
    fontFamily: "'Plus Jakarta Sans', 'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.5rem, 2.5vw, 2.125rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  display:
    fontFamily: "'Plus Jakarta Sans', 'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Plus Jakarta Sans', 'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.32
    letterSpacing: "-0.012em"
  body:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  bodyDense:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  uiCompact:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
  caption:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  none: "0px"
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  xs: "0.35rem"
  sm: "0.6rem"
  md: "1rem"
  lg: "1.35rem"
  xl: "1.85rem"
components:
  button-primary:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.bg-surface}"
    rounded: "{rounded.sm}"
    padding: "0.52rem 0.95rem"
  button-primary-hover:
    backgroundColor: "{colors.vermilion-hover}"
    textColor: "{colors.bg-surface}"
  button-secondary:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.88rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "0.38rem 0.68rem"
  bib-strip-container:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "1rem 1.2rem"
---

# Design System: Kratai

## Overview

**Creative North Star: "Modern Minimal Course Atlas & Self-Explanatory Race Ledger"**

Kratai unites two modes inside one disciplined Thai-first interface:
1. **Modern Minimal Public Discovery & Storefront:** Airy `#f7f8fa` canvas, crisp `#ffffff` event cards with vector topographic/route cover illustrations, explicit net-price pills, a step-by-step registration wizard, and a standalone event merchandise shop for general customers who do not register to run.
2. **Self-Explanatory Multi-Tenant Organizer Dashboard:** A committed deep-slate navigation rail (`#0f172a`) locking Organization and Event context beside a structured workspace where every section states **what it is and what it is used for**, led by an Urgent Action Queue, a 4-stage Event Lifecycle stepper, and a traceable Quota & THB Payout Strip (`BibLedgerStrip`).

The visual system rejects generic SaaS decorative charts, eyebrow kickers above headings, thick side-stripe accents on rounded cards, and neutral grey text on colored surfaces.

## Colors

### Primary & Navigation Chrome
- **Start-Corral Vermilion** (`#c23b1a`, hover `#a12e11`, soft `#fef0ec`, ink `#7f210a`): Primary conversion CTAs, active runner actions, and net organizer payout figures.
- **Deep Slate Navy** (`#0f172a`, elevated `#1e293b`, border `#334155`, soft `#edf3fa`, ink `#153559`): Organizer context rail, top brand anchor, primary dark actions, and 10K category chips.

### Semantic Operational Signals
- **Verified Forest** (`#157347`, soft `#eaf7f0`, ink `#0d4f30`): Confirmed race slots, verified webhook payments, verified emails, and completed kit/merchandise handovers.
- **Marshal Amber** (`#945606`, soft `#fef5e6`, ink `#6e3e03`): Temporary atomic reservations (`pending_payment`), pending refund reviews, unverified emails, and partial merchandise pickups.
- **Void Danger** (`#b42318`, soft `#fef0ef`, ink `#7a160f`): Succeeded refund deductions, suspended/cancelled notices, email-collision security warnings, and duplicate BIB/pickup blocks.
- **LINE Brand Green** (`#068a3c`): Dedicated exclusively to the LINE Login button in unified account screens.

### Neutrals
- **Cool Minimal Canvas** (`#f7f8fa`), **Subtle Fill** (`#f1f4f8`), and **Crisp Surface** (`#ffffff`): Low-glare ground and clean card planes separated by `1px` hairlines (`#e2e8f0` / `#cbd5e1`).
- **Slate-Tinted Inks** (`#0f172a` primary, `#475569` secondary, `#52637a` placeholder): All text tokens maintain ≥4.5:1 WCAG AA contrast over light surfaces.

### Named Rules
- **The Slate-Tinted Ink Rule.** Muted text, borders, and placeholders derive from `#0f172a` slate rather than pure neutral grey.
- **The Icon-Plus-Label Status Rule.** Every status pairs a `1.75px` stroke SVG icon (tinted with the base hue, e.g. `#157347`) with an explicit Thai status phrase in the matching ink (e.g. `#0d4f30`); color never carries meaning alone.
- **The Frameless Status Rule (20 Nov 2026, user-confirmed).** Statuses, tags, category labels, and ID codes (`.mono-code`, e.g. `USR-104`, `EVT-CMI-2601`) render without capsule or box frames: no pill radius, no border, no tinted fill. Text-only statuses get a small leading dot; distance/category labels get a small square swatch. The only exception is a status laid over imagery (event cover), which sits on a plain `#ffffff` plate with `6px` radius and a soft shadow for legibility.

## Typography

- **Display / Headings:** `Plus Jakarta Sans` + `Anuphan`
- **Thai-First UI & Reading Body:** `Anuphan` + `Sarabun`
- **Tabular Codes & Money:** `JetBrains Mono` (`font-variant-numeric: tabular-nums`)

### 8-Step Type Scale
1. **Hero** (`clamp(1.5rem, 2.5vw, 2.125rem)`, 700): Public discovery title and event detail header.
2. **Display** (`1.375rem`, 700): Organizer page headers, modal titles, and primary payout figures.
3. **Headline** (`1.125rem`, 700): Card titles, section titles, and step headers.
4. **Body** (`1rem`, 400): Base document reading copy (`65–72ch` max measure).
5. **Dense Body** (`0.9375rem`, 400–600): Form inputs, lead descriptions, and drawer items.
6. **Compact UI** (`0.875rem`, 600): Buttons, navigation items, and dense table cells (`white-space: nowrap` on interactive affordances).
7. **Label / Mono** (`0.8125rem`, 600): Status labels, filter labels, table headers, and tabular ratios.
8. **Caption / Code** (`0.75rem`, 600): Inline IDs, BIB prefixes, and micro-badges.

### Named Rules
- **The Self-Sufficient Heading Rule.** Never stack uppercase kickers or eyebrow labels above `h1`, `h2`, or `h3`.
- **The Single-Line Affordance Rule.** Buttons, nav tabs, and filter tabs enforce `white-space: nowrap` so Thai/English labels never wrap awkwardly mid-phrase.
- **The Underline Selection Rule.** Top navigation, filter bars, detail tabs, and wizard steps are text tabs: inactive in `#475569`, active in `#0f172a` with a `2px` bottom rule. The language switch is a `TH | EN` text toggle with the active code underlined. The account trigger is avatar + name + chevron with no outline.

## Layout & Responsive Discipline

- **Public Portal:** Centered `1240px` container (`padding-inline: clamp(1rem, 3vw, 2rem)`) with clean filter bar, 3-column responsive event grid (`repeat(auto-fill, minmax(min(100%, 330px), 1fr))`), and sticky summary column on event detail/checkout pages.
- **Organizer Workspace:** Persistent two-column operational shell (`276px minmax(0, 1fr)`) where the left rail locks Organization + Event context and groups navigation into *Organization Level* vs *Selected Event Level*.
- **Zero Horizontal Overflow (`375px–390px` Mobile):** `html, body` use `overflow-x: clip`, every grid column uses `minmax(0, 1fr)`, and below `1060px` the organizer rail condenses into a compact context bar + horizontal scroll tabs.

## Elevation, Shapes & Components

- **Single-Layer Containers:** Cards use `#ffffff` over `#f7f8fa` with `1px solid #e2e8f0` and a subtle offset shadow (`0 4px 14px -4px rgba(15, 23, 42, 0.06)`). Nested sections inside panels use flat `#f7f8fa` / `#f1f4f8` fills with `1px` rules instead of nested drop shadows.
- **Radii:** `6px` (`--radius-sm`) for buttons, inputs, and status chips; `10px` (`--radius-md`) for cards, modals, and the `BibLedgerStrip` shell (with an interior `#0f172a` header band rather than thick outer accent borders).
- **Self-Explanatory Purpose Headers:** Every Organizer Dashboard view opens with a clear title, a one-sentence operational explanation ("ส่วนนี้ใช้ทำอะไร"), and direct action buttons.

## Do's and Don'ts

### Do
- **Do** explain every Organizer section in plain Thai so first-time users immediately know what each screen controls.
- **Do** keep race registration entitlements separate from standalone storefront merchandise orders and custom production quotes.
- **Do** render every THB amount, fee breakdown, and quota counter in `JetBrains Mono` with `tabular-nums` and satang-accurate integer math.

### Don't
- **Don't** place eyebrow kickers above headings or thick (`>1px`) side/top borders on rounded cards.
- **Don't** wrap statuses, tags, or navigation items in pill/capsule frames (bordered or tinted rounded chips); use icon + tinted text or underline tabs instead.
- **Don't** auto-merge accounts on email collision or allow unlinking a user's last remaining login method.
- **Don't** imply real server persistence, real Google/LINE OAuth, or live payment processing in demo copy.
