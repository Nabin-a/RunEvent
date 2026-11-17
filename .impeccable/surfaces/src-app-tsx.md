---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# RunEvent Local Interactive Mockup Brief

## Scope & Mode
- **Surface:** `src/App.tsx` (Multi-surface web application: Public Event Directory, Role/Tenant Login Switcher, and Multi-Tenant Organizer Dashboard)
- **Visitor Mode:** Operate (primary operational shell for organizers & race staff, paired with direct event discovery & net-price checkout preview for runners)

## Task & Constraints
- Let users switch seamlessly between Public Event Directory (ThaiRun-inspired race discovery + post-race photo album links + transparent net price preview), Demo Login (multi-organization & role switcher: Org Owner, Event Manager, Finance Officer, Kit-Pickup Staff, Runner), and Organizer Dashboard (RunSignup-inspired self-serve event setup, tiered pricing, atomic quota visualization, separated registration/payment/refund/fulfillment statuses, and fee-bearer payout model).
- Clearly label all data as synthetic demo data stored in browser memory/`localStorage` only; no real payments or backend calls.
- Preserve accessibility: keyboard operable, visible focus rings, status never conveyed by color alone, tabular numerals, mobile check-in responsiveness, and empty/loading/error/no-permission/suspended states.

## Direction contract

THESIS: An operational race-control workspace built on the instant legibility of a Thai race-day Tyvek BIB header strip—refusing the generic grey SaaS KPI card grid by putting urgent organizer actions, tenant/event context, and traceable quota-to-payout mechanics first.

OWN-WORLD: Committed track-navy shell (`#102538`) over warm limestone Tyvek ground (`#F5F4EE`) and crisp stock (`#FFFFFF`), with ink (`#13202C`) tinted from navy rather than neutral black, start-corral vermilion (`#D84A24`) for primary actions and active category markers, verified forest green (`#1B734E`), and caution amber (`#B87414`); pairing Sarabun/Anuphan Thai-Latin workhorse UI typography with JetBrains Mono tabular figures on BIB codes, quotas, and THB satang-accurate breakdowns, anchored by the signature BIB Header Strip across every event and financial ledger.

STORY: Organizers and runners immediately see which organization and race context is active, what urgent operational tasks require action, how tiered pricing and fee-bearer rules (runner-paid, organizer-absorbed, or split) translate into runner net price and organizer net payout, and can drill from any headline metric directly into its pre-filtered source records.

FIRST VIEWPORT: Top global mode & demo-session bar showing synthetic-data provenance and instant role/tenant switching, above a committed track-navy navigation rail (`#102538`) locking active Organization + Event context, while the main limestone canvas opens directly with the Urgent Action Queue, the signature BIB Quota & Payout Breakdown Strip (Confirmed vs Reserved vs Open slots + Gross Paid → Refunds → Platform Service Fee → Net Organizer Payout with time-basis badge), and clickable active event rows with primary "สร้างงานวิ่งร่างใหม่" / "สลับดูหน้ารวมงานวิ่ง" controls in immediate reach.

FORM: Race-Day Tyvek BIB & Course Marshal System, position 1 on the ordered grounded list (chosen via IMPECCABLE'S PICK over assigned index 6), seed key `7d611425`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
