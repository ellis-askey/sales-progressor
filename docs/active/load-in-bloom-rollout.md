# Load-in bloom rollout — agent nav pages

**Goal:** apply the smooth top-to-bottom, left-to-right load-in (the one shipped on **My Files** / `/agent/transactions` and the **Hub**) to every page in the agent left-nav, so each page's blocks bloom in document order instead of popping all at once.

Spec written 2026-10-18 from a full structural audit. Reference implementations already live: files list (`app/agent/transactions/(list)/page.tsx` + `components/transactions/*`) and Hub (`app/agent/hub/hub-view.tsx`).

---

## The pattern (how to apply it)

1. **Wrap the page's content container in `<BloomStage>`** (`components/agent/BloomStage.tsx`), replacing any existing `PageReveal` / `BrandedReveal` wrapper (never nest them — both animate, you'd get a double entrance).
2. **Tag each block that should bloom with `data-bloom`.** On mount BloomStage does a deep `querySelectorAll("[data-bloom]")` in **document order** and staggers them (50ms step, capped at the 14th). Tags can be any depth below the stage — they do **not** need to be direct children.
3. **`GlassCard` and `Card` both spread `{...rest}`** onto their root `<div>`, so `data-bloom` passes straight through as a prop. For plain `<div>` blocks, add the attribute directly.
4. **The `PageHeader` stays outside the stage** (paints instantly). Every page already does this (except Focus — see below).
5. **Granularity:** tag at the most granular level that doesn't fight an existing animation — individual cards/rows where safe (like the files-list rows), the section wrapper where a list already animates itself.

### Hard rules / gotchas (learned on the hub + files list)
- **No streaming needed here.** Unlike the hub, *none* of these pages use per-section `<Suspense>` — they're single-pass server components. So BloomStage's collect-on-mount catches every block; no streaming-shuffle, no settle-stutter. These are simpler than the hub was.
- **Don't tag rows that already FLIP/auto-animate** — the transforms fight. Affected: **Focus** (manual FLIP on `.ck-card`), **Enquiries** (`useAutoAnimate` on `.enq-card`), **Partners** (`.partner-card-in` staggered CSS). On those, tag the *section/list wrapper* as one block, or remove the existing animation first.
- **Sticky elements** (Reminders filter bar, `position:sticky`) — a transform mid-bloom can break stickiness for the ~520ms; BloomStage ends at `transform:none` so it recovers. Tag a child wrapper, or accept the transient.
- **loading.tsx is already quiet** on every in-scope page (RailPageSkeleton → title-only). No loading changes needed — except Focus, which has none.
- **Verify per page:** `tsc` clean + hard-refresh the route and watch it flow top-to-bottom. Glass frost must survive the settle (it does when the transition ends at `transform/filter:none`).

---

## Per-page plan

Order = rollout order (cleanest first). "Wrap" = the element to make/replace with `<BloomStage>`. "Tag" = elements to give `data-bloom`.

### 1. Completions — `app/agent/completions/page.tsx` · EASY (reference-identical)
- **Wrap:** `div.px-4…space-y-7` (page.tsx:229) — replace `<PageReveal>`.
- **Tag (direct children, most are GlassCards → prop passes through):** CompletionsMomentum (GlassCard), CompletingTodayCard (GlassCard), CompletionsTimeline (plain div), each CompletionsGroupList group (`GlassCard id=section-*`, `CompletionsGroupList.tsx:66`), CompletedSection (GlassCard). Empty-state fragments: tag their hero + setup blocks.
- **Notes:** closest match to the files-list drop-in. Optionally also tag the per-file rows inside each group (`CompletionsGroupList.tsx` `<div key={f.id}>`) for a richer cascade — no FLIP conflict.

### 2. Auto emails — `app/agent/automated-emails/page.tsx` · EASY
- **Wrap:** the `PageReveal` at page.tsx:150 → `<BloomStage>` (its children are already discrete blocks, no intermediate div).
- **Tag:** AutomationBanner (GlassCard); the three panels in the `grid-cols-3` row individually — NeedsAttentionPanel / SendingTodayPanel / AutomationCoveragePanel (all GlassCards) for left-to-right; AutomationActivityPanel (GlassCard); AutomatedEmailsListView (tag its root `div.space-y-3`, or the per-day groups / `CompactRow` buttons for row cascade — no conflict).

### 3. Chains — `app/agent/chains/page.tsx` · MEDIUM
- **Wrap:** `div.px-4…py-4` (page.tsx:72) → `<BloomStage>` (single child `ChainsWorkspace`; BloomStage reaches into it).
- **Tag (inside `ChainsWorkspace.tsx`):** summary `GlassCard glassId="chains-summary"` (:448); tab/search bar `div` (:486); each card in `.chains-card-grid` — `ChainCard` (`ChainCard.tsx:118`, GlassCard) + `NoChainSetupCard` (`NoChainSetupCard.tsx:71`, GlassCard) for left-to-right card cascade.
- **Notes:** `export const dynamic = "force-dynamic"`.

### 4. Reminders — `app/agent/work-queue/page.tsx` · MEDIUM
- **Wrap:** `div.px-4…space-y-6` (page.tsx:192) → `<BloomStage>` (replace `PageReveal`).
- **Tag (inside `AgentRemindersList.tsx`):** filter bar `GlassCard glassId="reminders-filter-bar"` (:1421, STICKY — tag a child or accept transient); each `#section-*` group div (`:1534`, keys needs-you/coming-up/chased/autopilot); optionally each file card `SplitFileCard` (`:595`, GlassCard) for row cascade. No FLIP lib (optimistic exit classes only — no conflict).

### 5. Enquiries — `app/agent/enquiries/page.tsx` · MEDIUM
- **Wrap:** `div.hub-content-pad` (page.tsx:48) → `<BloomStage>` (replace `PageReveal`).
- **Tag (inside `EnquiriesTriageList.tsx`):** summary `GlassCard glassId="enquiries-summary"` (:279); toolbar `.enq-toolbar` (:292); **list container `.enq-list` (:311) as ONE block** — do NOT tag the `.enq-card` rows (they use `useAutoAnimate` — would conflict).

### 6. Updates — `app/agent/comms/page.tsx` · MEDIUM
- **Wrap:** `div.px-4…space-y-4` (page.tsx:127) → `<BloomStage>` (replace `PageReveal`).
- **Tag:** empty-state blocks; inside `CommsActivityFeed.tsx` tag the filter rail `.cf-side` (:472) + the feed `.cf-feed` (:515) for left-to-right, or the per-day buckets `div.agent-glass` (:552) for a row cascade. No FLIP conflict.

### 7. To-Do — `app/agent/to-do/page.tsx` · MEDIUM
- **Wrap:** `div.px-4…py-4` (page.tsx:98/102) → `<BloomStage>` (replace `PageReveal`; single child reaches into `AgentTodoList`).
- **Tag (inside `AgentTodoList.tsx`/`TodoTabs.tsx`):** the tab bar (`TodoTabs.tsx:44`); the section; each `TaskGroup` card (`AgentTodoList.tsx:407`, `Card`→GlassCard, prop passes through). Optionally each `TaskRow` (`:465`, plain div) for row cascade.

### 8. Partners — `app/agent/partners/page.tsx` · MEDIUM (two code paths)
- **Wrap:** agent/director path `div.space-y-4` (page.tsx:197, replace `PageReveal`); internal-staff path `div.space-y-4` (page.tsx:105, currently NOT wrapped — add `<BloomStage>`).
- **Tag:** the director settings grid's two `Card`s (broker + solicitors, left-to-right); the directory. **Firm cards already animate** via `.partner-card-in` (staggered `animationDelay`, `PartnersDirectory.tsx`) — either **remove that CSS animation and tag the firm cards** for a consistent bloom, or tag `PartnersDirectory` as one block and leave its animation. Recommend removing `.partner-card-in` and tagging the cards (consistent with files-list rows).

### 9. Analytics — `app/agent/analytics/page.tsx` · BIGGER (highest-value, most cards)
- **Wrap:** **inside `AnalyticsClientShell.tsx`** — the `div.flex.flex-col.gap-[18px]` at :332 → `<BloomStage>`. At the page, drop `<BrandedReveal>` (redundant once BloomStage owns the entrance) and just render `<AnalyticsClientShell>`.
- **Tag (14 blocks, document order, mostly GlassCards):** period-tabs row (div); counts card (GlassCard); funnel+speed row — tag the two inner GlassCards for left-to-right; values card; fees card; fee-forecast card; charts row — tag the two inner GlassCards L-R; solicitor-performance / referral / broker-referral list cards; referral-income pair (tag the two inner cards); missing-fees card; FilesAtRiskPanel (add `data-bloom` to the GlassCard inside `FilesAtRiskPanel.tsx:75`); leaderboard card.
- **Notes:** the richest cascade in the app. Side-by-side grid rows (funnel/speed, charts, values, fees) should tag inner cards so they flow left-to-right.

### 10. Focus — `app/agent/focus/page.tsx` · BESPOKE / DEFER
- **Odd one out:** no `PageHeader` (title lives *inside* `FilesCockpit`), **no loading.tsx**, and the file list uses a **manual FLIP reorder** on `.ck-card`. Centered cockpit, inline `<style>` components.
- **Founder-gated** (404 unless `ellis@thesalesprogressor.co.uk`) → low priority / internal only.
- **If done:** wrap `.ck-wrap` or `.ck-list` inside `FilesCockpit.tsx`; tag the cockpit's eyebrow/h1/sub/coverage/list-wrapper/counts blocks — **do NOT tag `.ck-card` rows** (FLIP conflict); tag `.ck-list` as one block. Needs bespoke care; schedule separately.

### — Admin — OUT OF SCOPE
Nav "Admin" routes to **`/command/overview`** (Command Centre, a separate dark surface); `app/agent/admin/page.tsx` is a pure redirect. Not an agent-app page — excluded. Blooming the Command Centre is a separate design decision.

---

## Rollout order & verification

1. **Completions**, **Auto emails** (easy, prove the pattern on prod)
2. **Chains**, **Reminders**, **Enquiries**, **Updates**, **To-Do** (medium, tag deeper)
3. **Partners** (reconcile `.partner-card-in`)
4. **Analytics** (14 blocks, highest-value)
5. **Focus** (bespoke, optional, internal-only)

Per page: one commit, `tsc` clean, push staging→master, hard-refresh the route to confirm the top-to-bottom flow + glass frost survives the settle. Keep each page a separate reviewable change.

---

## Quick reference table

| Page | Route | Difficulty | Wrap target | Replace | Row-level bloom? |
|---|---|---|---|---|---|
| Completions | /agent/completions | Easy | page.tsx:229 `space-y-7` | PageReveal | optional (no conflict) |
| Auto emails | /agent/automated-emails | Easy | page.tsx:150 PageReveal | PageReveal | optional (CompactRow) |
| Chains | /agent/chains | Medium | page.tsx:72 → into ChainsWorkspace | PageReveal | yes (card grid) |
| Reminders | /agent/work-queue | Medium | page.tsx:192 `space-y-6` | PageReveal | yes (file cards) |
| Enquiries | /agent/enquiries | Medium | page.tsx:48 `hub-content-pad` | PageReveal | **no** (autoAnimate) |
| Updates | /agent/comms | Medium | page.tsx:127 `space-y-4` | PageReveal | yes (day buckets) |
| To-Do | /agent/to-do | Medium | page.tsx:98/102 | PageReveal | optional (TaskRow) |
| Partners | /agent/partners | Medium | page.tsx:197 + :105 | PageReveal | yes (remove .partner-card-in) |
| Analytics | /agent/analytics | Bigger | AnalyticsClientShell:332 | BrandedReveal | inner cards L-R |
| Focus | /agent/focus | Bespoke | FilesCockpit `.ck-wrap` | (none) | **no** (manual FLIP) |
| Admin | → /command/overview | Out | — | — | — |
