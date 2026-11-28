---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets:
  - "src/components/CustomerPortalView.tsx"
  - "src/components/AuthViews.tsx"
  - "src/components/OrganizerDashboardView.tsx"
  - "src/components/BibLedgerStrip.tsx"
  - "src/styles.css"
---

# Kratai Local Interactive Mockup Brief (v2 Rebuild)

## Scope & Mode
- **Surface:** `src/App.tsx` (Unified multi-surface web application: Modern Minimal Customer Portal & Event Storefront, Unified Email/Google/LINE Mock Auth + Account Security, and Self-Explanatory Multi-Tenant Organizer Dashboard)
- **Visitor Mode:** Operate + Discover (Modern Minimal discovery & checkout flow for runners and general merchandise buyers, paired with an immediately understandable operational race-control shell for organizers and staff)

## Task & Constraints
- Deliver realistic end-to-end client-side flows (`localStorage` key `kratai_v2_mock_system`) covering:
  1. **Customer & Runner Flows:** Modern minimal race discovery grid with SVG route covers, net-price fee-bearer transparency, 3-step race registration with optional add-on merchandise, standalone event storefront for general customers buying shirts/medals without registering to run, custom club/company production quote requests, and separated "My Tickets & Orders".
  2. **Unified Auth & Security (Blueprint §16):** Email + password login/signup/reset, simulated Google & LINE login in one unified `UserAccount` (including LINE-without-email prompt and email-collision ownership proof instead of auto-merge), Account & Security screen (email verification, password setup/change, link/unlink providers while guarding the last login method, revoke other sessions, accept team invite, request new organizer org), plus a clearly separated Demo Preset Switcher.
  3. **Self-Explanatory Organizer Dashboard (Blueprint §1–15):** Every screen states what it is and what it is used for; separates Organization vs Event context; leads with Urgent Action Queue, 4-stage Event Lifecycle stepper, and satang-accurate `BibLedgerStrip` (with separated merchandise sales); includes storefront & non-duplicated shirt production calculator (`package + store + buffer − stock`) and mobile-ready split BIB vs Merchandise handover check-in.
- Label all synthetic demo data and mock auth/payment simulations honestly; zero real backend, OAuth, or payment gateway connections.
- Enforce WCAG AA contrast, `tabular-nums`, single-line interactive affordances (`white-space: nowrap`), and zero horizontal overflow at `375px–390px` mobile width.

## Direction contract

THESIS: A Modern Minimal Thai race discovery and merchandise portal paired with a self-explanatory multi-tenant Organizer Dashboard—making net runner pricing, separated race-vs-storefront entitlements, and satang-accurate organizer payouts effortless to understand at a glance.

OWN-WORLD: Airy cool-minimal public canvas (`#f7f8fa`) and crisp cards (`#ffffff`) framed by a committed deep-slate operational rail (`#0f172a`), slate-tinted inks (`#0f172a` / `#475569`), start-corral vermilion (`#c23b1a`) for primary conversions and net payout callouts, verified forest (`#157347`), and marshal amber (`#945606`); pairing Plus Jakarta Sans + Anuphan headings and Thai UI copy with JetBrains Mono tabular figures across every quota counter, BIB code, and THB ledger equation.

STORY: General customers and runners discover events in a clean modern-minimal directory, see exact net prices or buy commemorative shirts/medals without registering to run, sign in with one unified account (Email, Google, or LINE) returning directly to their in-progress action, while organizers switch into a clearly explained workspace where urgent tasks, lifecycle readiness, storefront production quotes, and traceable payouts are immediately actionable.

FIRST VIEWPORT: Sticky minimal top navigation bar with clear mode switching (ค้นหางานวิ่ง, สั่งผลิตเสื้อ/เหรียญองค์กร, ตั๋วและคำสั่งซื้อ, ระบบผู้จัดงาน, เข้าสู่ระบบ / เครื่องมือทดสอบ), opening onto a clean discovery header with inline search + province/distance filters above a 3-column modern minimal event card grid showing custom route artwork, distance chips, quota ratios, storefront availability, and transparent net starting price.

FORM: Race-Day Tyvek BIB & Course Marshal System evolved with Modern Minimal Discovery Atlas discipline, position 1 on the ordered grounded list, seed key `7d611425`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
