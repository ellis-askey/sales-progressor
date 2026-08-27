# Demo showcase file ("Add a demo")

Status: build in progress, 2026-08-27. New arc (reopens onboarding; sits outside the free-agency-launch SPEC, which explicitly parked signup-funnel changes).

## The idea

When an agency has **no real sales yet**, the add-sale page offers **"Add a demo"**. It stands up ONE fully-populated, best-practice example file — a fake Hertfordshire sale, the product in all its glory — so a new agency can see how a sale runs before committing their own. It removes itself after a week, or the agent removes it whenever.

A real sale the agency adds themselves is never a demo and is untouched by any of this.

## Rules (confirmed with founder)

- **When the button shows:** only while the agency has zero real sales AND no existing demo. It reappears if the demo later expires and they still have not added a real sale. It hides the moment they have a real sale.
- **One demo at a time:** if a demo already exists, the button opens it rather than creating another.
- **Lifecycle:** flagged `isDemo` + `demoExpiresAt` (~1 week). Auto-removed by the daily `demo-cleanup` cron once expired, or removed manually by the agent.
- **Billing anchor unchanged:** the 14-day free clock stays on the first **real** sale (`Agency.firstSubmissionAt`). The demo never sets it, is never billed, and is excluded from real-sale metrics. We push agents to add a real sale on demo day, so in practice account creation and first real sale are the same day anyway.

## The showcase is a 3-link chain (enriched 2026-08-27)

"Add a demo" stands up a **chain of three fully-recorded demo files** so a new agency sees a working chain, not just one file. DB position 0 is the top (most to do); the highest position is the bottom (furthest along):

- **Top — 22 Rothamsted Avenue, Harpenden** (~25% done): Sarah's onward purchase, the most to do.
- **Middle — 14 Beaumont Rise, Harpenden** (~62%): the star file (MOS attached, full comms trail). The button opens this one.
- **Bottom — 3 Leyton Court, St Albans** (~90%): the first-time buyer, furthest along.

Each file is lived-in: milestones completed with **lifelike spread dates** and **varied confirmers** (agent / buyer's solicitor / seller's solicitor / client via portal), a **comms trail** of outbound client emails, phone/SMS/WhatsApp updates, **inbound replies** from the client, and **internal notes**. The middle file carries the fullest trail. All emails are `@example.com` so nothing sends. Takes ~10s to build (route `maxDuration` raised to 60s).

**Managing agent:** every demo file is owned, managed, and confirmed by a made-up staff member — **Charlotte Hayes** (`User.isDemo = true`, photo `avatars/demo-agent.png` from `Images/Agent.png`), find-or-created per agency. This keeps the demo from reading as the real user's own file or photo. She's excluded from team pickers via `isDemo`.

## The preset (one canonical showcase file)

`DEMO_PRESET` in `lib/services/demo-sale.ts`:

- **Address:** 14 Beaumont Rise, Harpenden, Hertfordshire, AL5 2RT
- **Price:** £625,000 · freehold · mortgage purchase
- **Photo:** shared storage object `demo/house.png` (from `Images/House.png`)
- **Vendor:** Sarah Whitfield — sarah.whitfield@example.com · 07700 900123
- **Purchaser:** Daniel Okafor — daniel.okafor@example.com · 07700 900456
- **Vendor solicitor:** Margaret Ellwood, Harpenden & Ellwood LLP — margaret.ellwood@example.com · 01582 900100
- **Purchaser solicitor:** Priya Nair, Verulam Legal — priya.nair@example.com · 01727 900200
- Backdated ~45 days, ~65% of milestones complete with spread dates (a live file approaching exchange).
- **MOS:** a memorandum of sale generated from these details, attached to the file (pending — founder supplies the document).

All `@example.com` (reserved, non-deliverable) so the demo never emails anyone.

## Build map

- `prisma/schema.prisma` + migration `20260827000000_add_demo_sale_markers` — `isDemo`, `demoExpiresAt`. Applied to staging.
- `lib/services/transactions.ts` — `createTransaction` takes `isDemo`; skips the payment block + trial stamp; stamps `demoExpiresAt`.
- `lib/services/demo-sale.ts` — `DEMO_PRESET`, `createDemoSale`, `cleanupExpiredDemos`, `removeDemoSale`.
- `app/actions/demo.ts` — `addDemoSaleAction` (guarded).
- `components/transactions-v2/AddDemoCard.tsx` + `app/agent/transactions/new/page.tsx` — the affordance.
- `app/api/cron/demo-cleanup/route.ts` + `vercel.json` — daily cleanup.

## Done

- Demo badge + "Remove now" banner on the file (removes the whole demo chain).
- Exclusions: billing-on-exchange, metrics rollup, revenue, adoption funnel, overview, activation events (trial anchor too).
- MOS attached (shared `demo/mos.pdf`).
- Prod: `house.png` + `mos.pdf` uploaded to prod storage.
- 3-link chain, party-attributed confirmations, comms trail + notes, lifelike dates.
