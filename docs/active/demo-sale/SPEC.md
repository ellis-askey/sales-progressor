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

## Still to do

- **Demo badge + "remove now"** banner on the file so it's never mistaken for a real sale and can be removed on demand (`removeDemoSale` service exists; needs an action + banner, and `isDemo` added to the file-page fetcher).
- **Exclusions sweep:** confirm demo files are excluded from billing-on-exchange and Command Centre adoption/real-sale metrics (trial anchor already excluded).
- **MOS document** attach once supplied.
- **Prod:** upload `House.png` to prod Supabase storage at `demo/house.png` (see ELLIS_MANUAL_TODO).
