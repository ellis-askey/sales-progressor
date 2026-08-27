# Three notes — distilled to plans

Captured 2026-08-26 from Ellis's raw notes. Each of the three is a **separate concern / separate PR** (Law 5). This doc distils each into: what you said → what's actually there today (verified against code) → proposed design → the decisions I still need from you. **Nothing is built yet.** Comment inline and I'll implement.

---

## Note 1 — Overdue exchange dates on the hub

### What you said
> On hub, when something's exchange date arrives, it shows as happening today, like a dead-cert (like completion). Once exchange is overdue, it never moves with the file. I think perhaps it should ask us to enter approx where we think it'll exchange, then work towards that on a loop. We'd have to inform clients, or at least have a task that says we've spoken to clients, then we can move the date. Need logic sorted.

### What's actually there today (verified)
- The "Exchange today" chip on the hub fires off `expectedExchangeDate`, which **defaults to created-date + 84 days** (the 12-week SLA placeholder). `lib/services/hub.ts` → `getHubDiary`.
- Exchange is **not** blindly treated like completion — there's already a placeholder guard so a bare 84-day default doesn't falsely fire. It only fires "today" if the readiness milestones (VM18/PM25) or exchange milestones (VM19/PM26) are done, or you've set a manual override date. **But:** the currently-live kinetic hub strip (`KineticDiaryStrip.tsx`) ignores that readiness nuance and just shows a flat "Exchange today" chip.
- **Your core complaint is exactly right and actually worse than "it never moves":** once the expected date is in the past and exchange hasn't been confirmed, the file **silently disappears** from every hub surface. Every hub query is bounded `gte: now`, so an overdue exchange drops out of the diary, "exchanging soon", the forecast — everything. The only place it's even counted is an aggregate number inside a hover popover. It doesn't nag; it vanishes.
- Nothing advances a stale `expectedExchangeDate` when exchange slips. It only changes if an agent manually overrides it, or exchange is confirmed.

### Seams we can reuse (don't build from scratch)
- **Enter-an-expected-date already exists:** `HeroExchangeCell` on the file → `saveOverrideDateAction` writes `overridePredictedDate`. That's your "enter approx where we think it'll exchange."
- **A "client has confirmed" gate already exists:** the exchange-day flow uses `exchangeAuthorityGivenAt` on the contact ("client has given authority"). Close cousin of your "we've spoken to the clients" task.

### Proposed design
1. **New "Exchange overdue" state on the hub.** When `expectedExchangeDate` (or override) is in the past and exchange isn't confirmed, the file stops silently vanishing and instead surfaces as an **amber attention item** ("Exchange date passed — needs a revised date"), not a green "happening today" chip. It stays visible and nagging until resolved.
2. **The revised-date prompt.** The attention item's action opens the existing expected-date entry (reuse `HeroExchangeCell` / `saveOverrideDateAction`) so we set a new approximate date. Once set, the file works toward the new date and drops off the overdue list — until *that* date also passes, at which point it re-surfaces (the "loop" you described).
3. **The client-comms gate.** Before the revised date is accepted, a lightweight confirmation — "We've spoken to the clients about the new date" — must be ticked. This is the honesty guard so we never quietly slide a date without telling anyone.

### ⚠️ Major reframe after investigating (2026-08-26) — most of this already exists

The "clever calculation" Ellis later described (a live date that recalculates from average durations + % through the milestones) **is already built and runs on every file render**: `calculatePhaseAwarePrediction()` in `lib/services/fees.ts:254-281`. It walks the remaining critical path (vendor + purchaser chains) through a per-stage duration table and self-adjusts as milestones complete, floored at the 12-week target.

Two reasons it doesn't feel present:
1. **The hub ignores it.** The hub/diary read the stored `expectedExchangeDate` (default createdAt+84, only overwritten on VM19/PM26 confirm), **not** the live prediction. The good prediction is invisible; the dumb default is what goes stale and vanishes.
2. **Durations are hardcoded conservative guesses, not learned.** The learning half is *also* built — `app/api/cron/medians-ready-check/route.ts` computes real per-stage medians from `MilestoneCompletion` and emails Ellis when trustworthy — but it's gated OFF (`MEDIANS_READY = false`, `lib/services/milestone-staleness.ts:29`) until **≥50 transactions / ≥30 samples per stage**. Pre-launch we're nowhere near that, so learned averages would swing wildly — which is exactly why the conservative fallback exists. This is a future switch-flip, not a build.

**So Note 1 becomes two cleaner pieces:**
- **1-Surface.** Wire the already-existing live prediction onto the hub so the exchange date is realistic and moves with the file automatically. Fixes "it never moves." Wiring, not build.
- **1-Stuck.** Only when the date has passed **and milestones aren't progressing** (genuinely stuck, nothing to recalculate from) do we nag for a manual revised date, behind the client-comms **hard block**.

### Decisions — updated
- **1a. Gate strength — LOCKED: hard block.** Can't save the revised date until "we've spoken to the clients" is ticked.
- **1b. RESOLVED: one tick, "we've spoken to both parties about the new date."** Confirms both sides regardless of tier.
- **1c. RESOLVED (recommended default, tunable): fire the amber flag 2 working days past the predicted date, only if no milestone confirmed in that window.** Short grace to avoid false alarms on files exchanging slightly late; the silence requirement means an actively-moving file never trips it. Single tunable constant — retune after watching it live.
- **1d. RESOLVED in principle:** the date auto-updates from the live prediction while the file moves; the manual entry + comms record is reserved for the stuck case. No auto-send to clients for now — the tick is an internal "we've spoken to them" record; actual comms happen off-platform until we decide otherwise.
- **1e. NEW — run the exact data count?** Offer to `SELECT COUNT(DISTINCT "transactionId") FROM "MilestoneCompletion" WHERE state='complete' AND "reconciledAtClaim"=false;` to state "X of 50" precisely.

---

## Note 2 — Enquiries: de-escalate when the ball moves to the other side's court

### What you said
> When enquiries are stalled, they go into needs-attention/escalated. But it should be brought down a level or two when I click the tab that puts it into the other side's court. It should only stay stalled until it's moved, if that makes sense.

### What's actually there today (verified) — this one's already mostly done
- Stalled is a **single on/off flag** (`escalatedAt` on `EnquiryTracker`). There is **no multi-level ladder** to "drop a level or two" through — a tracker is either stalled or it isn't. The spec (`docs/active/enquiries-stage-rework-SPEC.md`) confirms this is deliberate: a binary flag, not a severity ladder.
- The "put it in the other side's court" tab is the `EnquiryCourtChip` slider, which fires `mode: "handover"`. **Handover already sets `escalatedAt = null`** — it fully clears the stall and the file drops straight out of the hub attention list on next load.
- So in the strongest possible sense, **"it only stays stalled until it's moved" is already true today.** One tap on the other side's court removes the stall entirely.

### RESOLVED (2026-08-26): already working as intended
Ellis confirmed the model is correct as-is: not moving the ball → stalled → we check in; moving the ball (handover) → resets, because a handover *means* we/they have updated/spoken. **No graduated ladder wanted (2b dropped).** The binary flag is the design.

### The one real action: align the docs to 13, not code to 15
Ellis confirmed **13 working days is the intended number** ("just before 2 weeks"). So the discrepancy is a *documentation* bug, not a code bug — my earlier "fix code to 15" was backwards. The action is to update the stale artefacts to match the code:
- `lib/enquiries/chase.ts` header comment (says 15) → 13
- `docs/active/enquiries-stage-rework-SPEC.md` (says 15 working days / 3-week ceiling) → 13
- `lib/enquiries/__tests__/chase-decision.test.ts:31` (asserts 15) → 13

No behaviour change; the running code stays at 13. Tiny standalone PR.

---

## Note 3 — Demo redesign: "add your first real sale" onboarding + auto-wiping demo sale

### What you said
> Change demo to them adding a sale — they add a sale, or we send demo MOS for them to upload then wipe, so get their first sale on. Then talk them through when things flag in reminders. Better flow, then they're signed up. Then, same as already set up, 14 days anything added is free until they choose to outsource — which runs from account creation, which is demo day. Need to make it clear this is how the demo works upon booking. If an agent has no sales: demo button? Creates a demo sale that wipes after 24 hours automatically. Good for organic users and to clean up after a demo if they don't want to add their own sale.

### What's actually there today (verified)
- **There is no coherent "demo mode" and no "book a demo" flow in code at all.** What exists is fragmented: a "Load sample data" button (on the *old* `/dashboard`, not the live `/agent` surface) that writes **2 permanent, unmarked, never-wiped** sample sales; and internal staging-only "reset Fairview demo" tooling for *you* to demo to prospects.
- **The MOS upload → AI parse → prefill → create pipeline is production-ready** (`/api/agent/memo-parse` + `NewSaleFlow.tsx`). "We send demo MOS docs for them to upload" flows through the exact same machinery that a real sale does. The only missing piece is the wipe.
- **The 14-day free window is anchored to the first sale, not account creation.** `firstSubmissionAt` is stamped on the agency's first-ever transaction; `Agency.signupAt` (set at account creation) exists but the trial logic ignores it. Your "run it from account creation / demo day" is a real change to `lib/services/trial.ts` + `lib/billing/trial-state.ts`.
- **No 24h auto-wipe pattern exists anywhere.** The nearest is a *weekly* GDPR anonymisation cron operating on 3-years-inactive users. A short-TTL demo wipe is net-new: a marker field on the transaction + a new frequent cron.
- The live `/agent` empty state ("Add your first sale") has **no demo button** — that's exactly where yours would go.

### ⚠️ Scope flag (Law 6)
The active `docs/active/free-agency-launch/SPEC.md` **explicitly excludes** "marketing site / signup funnel changes" and declares onboarding "already good — reinforcement only." Your redesign **reopens onboarding and touches the signup funnel.** That's fine, but it means this is a **new arc**, not part of the free-launch arc — I'd spec it separately rather than smuggle it into that one. Flagging so we don't blur two scopes.

### Proposed design (broken into shippable pieces)
This is the biggest of the three and naturally splits into independent PRs:

- **3A — Auto-wiping demo sale + demo button.** Add an `isDemo` + `demoExpiresAt` marker to `PropertyTransaction`. Add a "Try it with a sample sale" button to the live `/agent` empty state (shown only when the agency has zero sales). It creates a clearly-marked demo sale (visually badged so it's never mistaken for real), and a new frequent cron wipes any demo sale past its 24h expiry. Serves both organic explorers and post-demo cleanup.
- **3B — Demo-as-MOS-upload.** A curated demo MOS pack (PDFs) we hand over, that they upload through the real `memo-parse` flow to stand up their first sale — same as 3A's marker so it auto-wipes if they don't keep it, or converts to a real sale if they do.
- **3C — Reminder walkthrough.** After the first (demo or real) sale exists, a guided "here's when this will flag to you" pass over the reminder timeline — so they *see* the chase cadence rather than being told about it.
- **3D — Trial anchor moves to account creation.** Flip the 14-day free window from `firstSubmissionAt` to `Agency.signupAt`. **This is a billing-behaviour change — see decision 3b.**

### Decisions I need from you
- **3a. Demo sale: real-data-first or sample-first?** Two philosophies fighting in your note: (i) the demo *is* them adding their own real first sale (which then just... stays, because it's real), vs (ii) a throwaway sample that auto-wipes in 24h. I think you want **both, for different people**: a *prospect on demo day* adds their real sale (kept); an *organic tyre-kicker* hits the demo button for a throwaway. Confirm that's the split, because it changes what auto-wipes.
- **3b. Trial anchor — does moving it to account creation change billing for real users?** Today the 14-day free clock starts when they add their **first sale** (generous — an idle signup burns no clock). Moving it to **account creation** means someone who signs up, sits for 14 days, *then* adds a sale gets billed on that sale's exchange immediately. For a demo-day signup (account + sale same day) it's identical. For organic signups it's meaningfully less generous. Is that intended, or do you want the anchor to be `max(signupAt, firstSale)` / whichever protects the user? This is the one with money attached, so I want it explicit.
- **3c. Does the demo sale auto-wipe if they've engaged with it?** If a prospect adds their real sale on demo day and it's marked demo-for-24h, we must not wipe their real data. Proposal: demo sales are wiped *only* if untouched (no milestone confirmed, no client invited) — any real engagement converts it to a permanent real sale and cancels the wipe. Agree?
- **3d. "Make it clear at booking this is how the demo works."** There's no booking flow in code today. Is that copy going on the marketing site (out of this repo / separate), or is there a booking step you want built here? For now I'd scope 3A–3D as in-app and treat booking copy as a separate marketing task.

---

## Suggested build order (revised 2026-08-26)

1. **Note 2 doc-alignment** — update comment/spec/test to 13. Trivial, standalone, no behaviour change.
2. **Note 1-Surface** — wire the existing live prediction onto the hub so the date is realistic and self-adjusts. High daily value, mostly wiring.
3. **Note 1-Stuck** — overdue nag + manual revised date behind the client-comms hard block, for the genuinely-stuck case only.
4. **Note 3** (demo redesign) — biggest; needs the billing decision (3b) locked before I touch `trial.ts`. Build 3A (auto-wipe demo) first as it's the most self-contained. Flag: new arc, sits outside the free-launch SPEC scope.

Note 2 ladder (2b) dropped. Learned-median activation is a future switch-flip once ≥50 real files exist — no build.

Comment on the remaining open decisions (1b, 1c, 1e, 3a–3d) and I'll start implementing in that order.
