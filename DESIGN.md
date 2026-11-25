---
name: Kratai
description: Modern minimal race discovery & storefront portal paired with a self-explanatory multi-tenant organizer dashboard
colors:
  brand: "#34495f"
  brand-hover: "#2a3b4d"
  mint: "#9be8c7"
  mint-soft: "#e9f9f1"
  mint-strong: "#5cc79c"
  shell-navy: "#34495f"
  shell-navy-elevated: "#3f566e"
  shell-border: "#546a81"
  shell-text: "#f8fafc"
  shell-text-muted: "#cbd5e1"
  bg-canvas: "#f7f8fa"
  bg-surface: "#ffffff"
  bg-subtle: "#f1f4f8"
  bg-selected: "#e9f9f1"
  ink-primary: "#34495f"
  ink-secondary: "#475569"
  ink-placeholder: "#52637a"
  vermilion: "#34495f"
  vermilion-hover: "#2a3b4d"
  vermilion-soft: "#e9f9f1"
  vermilion-border: "#9be8c7"
  vermilion-ink: "#2a3b4d"
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
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.5rem, 2.5vw, 2.125rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  display:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
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
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
  caption:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  publicHero:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2.5rem, 5.4vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 1.12
  publicHeroCompact:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
  publicPageTitle:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
  publicPageTitleSmall:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)"
    fontWeight: 700
  publicArtTitle:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2rem, 3.6vw, 3rem)"
    fontWeight: 700
  publicSection:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
  publicPrice:
    fontFamily: "'Anuphan', 'Sarabun', system-ui, -apple-system, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
rounded:
  none: "0px"
  sm: "6px"
  md: "10px"
  public-inner: "12px"
  public-card: "18px"
  public-shell: "24px"
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
2. **Self-Explanatory Multi-Tenant Organizer Dashboard:** A committed slate brand navigation rail (`#34495f`) locking Organization and Event context beside a structured workspace where every section states **what it is and what it is used for**, led by an Urgent Action Queue, a 4-stage Event Lifecycle stepper, and a traceable Quota & THB Payout Strip (`BibLedgerStrip`).

The visual system rejects generic SaaS decorative charts, eyebrow kickers above headings, thick side-stripe accents on rounded cards, and neutral grey text on colored surfaces.

## Colors

### Primary & Navigation Chrome
> Brand palette confirmed by the user on 20 Nov 2026: slate `#34495f` + mint `#9be8c7`. It replaced the earlier vermilion CTA (`#c23b1a`) and deep navy (`#0f172a`). The `vermilion*` CSS token names are kept as aliases of the brand so existing components follow automatically.

- **Kratai Slate** (`#34495f`, hover `#2a3b4d`): Primary conversion CTAs, brand mark, organizer context rail, primary ink, active underline tabs, and net payout figures. White text on slate is 9.3:1.
- **Kratai Mint** (`#9be8c7`, soft `#e9f9f1`, strong `#5cc79c`): Accent fills only — selected calendar days, selected cards and rows (`--bg-selected`), brand-mark glyph, cover-art sun, and distance swatches. **Never mint text on a light surface (1.45:1).** Slate text on mint is 6.2:1, on mint-soft 8.6:1.
- **Urgency stays red:** P1 priority chips and the urgent action queue use the Danger tokens, not the brand.

### LINE dark theme (optional, 25 Nov 2026)
> Added at the user's request ("theme เขียว/ดำ แบบสี LINE"; chosen mockup: dark mode, black page, LINE green, whole system). It is a second colour theme, switched by the user with the "ธีม LINE" button next to TH/EN (or in the phone menu, and in the console top bar). The slate/mint theme above stays the default. All values live in `src/theme-line.css` under `:root[data-theme='line']`; layout, type and shapes do not change.

- **Theme button (25 Nov 2026, user request):** a 36px round, raised power button next to TH/EN (and on the console's top bar), after a tactile power-button design by Jon Kantner, rebuilt in our own code: off = an unlit slate button with a sun; on = pressed in, a crescent moon (with a small star) and the inner rim glow LINE green. The icons swap with a quarter turn and the press recoils a little (no motion under reduced motion). The phone menu keeps its text pill.
- **Ground:** page `#111111`, cards `#1b1b1b`, subtle fills `#232323`, insets `#262626`, hairlines `#2a2a2a` / `#3a3a3a`. Top bar, footer and the organizer rail are black `#000000`.
- **Ink:** primary `#f2f2f2` (15.6:1 on cards), secondary `#b8b8b8` (9.0:1), placeholder `#8f8f8f` (5.4:1).
- **LINE Green** (`#06c755`, hover `#05b04b`): primary buttons, current nav item and tabs, selected chips and days, progress. **Text on LINE green is black** (9.4:1); white on it is only 2.3:1. Green text on the dark page is 8.6:1. Selected rows use `#0f2b1c`.
- **Status tones re-tuned for dark:** forest `#3ddc84`, amber `#f2b24c`, danger `#ff6f61`, info ink `#b5d2ee`, each on its own dark soft fill.
- **Pictures for the LINE theme (25 Nov 2026, user requests).** Scenes and profile rabbits come from the supplied set in `output/line-night` (not committed; `tools/build-line-night-assets.py` copies them in): the moonlit night landscape with glowing green lanes replaces `hero-running-track` on every banner (home hero, calendar head, sign-in / sign-up scene, profile banner; sky fill `#05130c`), the three night covers replace the painted cover fallbacks, and the eight profile menu rabbits are fitted into the usual canvas sizes. The animated rabbits (home hero, calendar, sign-in scene and the other `MascotAnim` clips) keep their usual slate and mint outfit in the LINE theme (user request, 25 Nov 2026; an earlier green/charcoal recolour was dropped). The registration stepper sprites still switch to green/charcoal copies made by `tools/recolor-mascot-line.py` (yellow to green, blue to charcoal). All twins live in `src/assets/mascot-line` and `src/assets/illustrations/*-night.webp`; `themedArt()` in `src/components/mascotArt.ts` picks them when the theme is on. Uploaded event covers are never changed.

### Semantic Operational Signals
- **Verified Forest** (`#157347`, soft `#eaf7f0`, ink `#0d4f30`): Confirmed race slots, verified webhook payments, verified emails, and completed kit/merchandise handovers.
- **Marshal Amber** (`#945606`, soft `#fef5e6`, ink `#6e3e03`): Temporary atomic reservations (`pending_payment`), pending refund reviews, unverified emails, and partial merchandise pickups.
- **Void Danger** (`#b42318`, soft `#fef0ef`, ink `#7a160f`): Succeeded refund deductions, suspended/cancelled notices, email-collision security warnings, and duplicate BIB/pickup blocks.
- **LINE Brand Green** (`#068a3c`): Dedicated exclusively to the LINE Login button in unified account screens.

### Chart data colors
> Added 24 Nov 2026 with the organizer event home charts (mockups approved by the user). Brand slate fails the data-color chroma floor, so charts use their own pair and slate stays for chrome.

- **Chart Blue** (`#2a78d6`, `--chart-blue`): registrations and other primary series (confirmed seats, sign-ups over time, shirts reserved, organizer share in the fee preview).
- **Chart Aqua** (`#1baf7a`, `--chart-aqua`): the organizer payout total and the platform fee slice in the fee preview.
- Checked with the dataviz palette validator: lightness, chroma, colorblind and normal-vision separation pass. Aqua is under 3:1 against white, so every aqua mark carries a visible value label or sits in a chart with a table view.
- Pending or held amounts are a 45° hatch of Chart Blue, never a third hue. Status colors (forest, amber, danger) are not used as series colors.

### Neutrals
- **Cool Minimal Canvas** (`#f7f8fa`), **Subtle Fill** (`#f1f4f8`), and **Crisp Surface** (`#ffffff`): Low-glare ground and clean card planes separated by `1px` hairlines (`#e2e8f0` / `#cbd5e1`).
- **Public Mint Page (21 Nov 2026, user request).** Runner-facing pages (event search, event detail, registration, calendar, profile, account, sign-in) sit on a mint-tinted page `#e6f2ec` (`--bg-page`, set on `.app-root.is-public`) instead of near-white. Inner fills there re-tint to `#f3f8f5` / `#eef5f1` / `#e3ede8`, kept lighter than the page so card footers keep their edge. Organizer and platform-admin screens keep the neutral `#f7f8fa` canvas. Text on `#e6f2ec`: ink-primary 8.1:1, secondary 6.6:1, placeholder 5.3:1, forest 5.1:1, amber 5.1:1, danger 5.7:1.
- **Public redesign (21 Nov 2026, user-confirmed: match the concept boards in `output/ui-preview`).** Runner-facing pages (search, calendar, event detail, results/albums, sign in / sign up / forgot password, my entries and orders, profile and account) follow the boards; the registration form and the shop are excluded. Rules live in `src/public-theme.css`, scoped to `.app-root.is-public`, so organizer and admin screens are untouched.
  - **Display face:** Anuphan 700, upright (the boards' slanted headings are not reproduced: italic headings are banned). Sizes are the `public*` entries in the typography block above.
  - **Shapes:** cards 18px, inner panels 12px, the sign-in shell 24px; filter chips, search bar, nav highlight and primary pills use 999px.
  - **Pills are allowed on public pages:** distance chips, filter chips, status badges on covers and the TH/EN switch use filled mint pills as on the boards. This overrides the Frameless Status Rule for these pages only; organizer screens keep frameless statuses.
  - **Nav:** existing menu items only (no shop or "my list" link); the active item has a 4px mint underline.
  - **Imagery:** painted mint scenes (`src/assets/illustrations/`) as cover fallbacks and page backdrops; the rabbit is the supplied Kratai mascot (`กระต่าย_KraTai`), outfit recoloured to slate/mint and animated from the supplied clips (`src/components/MascotAnim.tsx`, still frame under reduced motion).
