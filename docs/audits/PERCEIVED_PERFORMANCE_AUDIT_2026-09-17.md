# Perceived Performance & Interaction-Speed Audit

**Date:** 2026-09-17
**Scope:** Agent app, property files, Hub, Command Centre, Tasks, Chains, Documents, Activity. Client portal explicitly out of scope.
**Status:** AUDIT ONLY. No product code was changed. No timings were instrumented (read-only constraint); every number quoted below comes from the codebase's own comments and logged production/staging evidence, and is cited as such.

---

## 1. Executive summary — why TSP feels slow

TSP's backend is not fundamentally slow, and its functionality is sound. The clunky feel comes from **six architectural decisions that expose backend processing time to the user**:

1. **Mutations don't return until secondary engines finish.** The milestone confirm action commits the milestone write early, then *awaits* the reminder-rule engine (self-documented in code as the "6–10 seconds of the click"), the exchange-prediction refresh, and two advisory reads — before the user gets control back. Undo is worse: it re-runs the reminder engine over **all ~40 rules** with no anchor filter. ([app/actions/milestones.ts:202](../../app/actions/milestones.ts#L202), [:213](../../app/actions/milestones.ts#L213), [:825](../../app/actions/milestones.ts#L825))

2. **The pending state covers the refetch, not just the save.** The dominant client pattern is `startTransition(async () => { await action(); router.refresh(); })`. One shared `isPending` flag stays true through the mutation **plus** the full server re-render of the page. Even where optimistic UI exists (milestones), the row shows "Confirming…" and disables its buttons for the entire round trip because the transition doesn't end until the RSC payload lands.

3. **Every small mutation invalidates the whole property-file page — often twice.** Nearly every action calls `revalidateTx()` (page-scope invalidation of the whole file page and its 12 streamed panels), *and* many client components then also call `router.refresh()`. Editing one hero field re-fetches the entire file twice.

4. **Every navigation is a full server render.** All agent routes are dynamically rendered (auth cookies), the Next client router cache has default `staleTimes` (0 for dynamic pages), and `<Link>` prefetch can therefore only pre-warm the `loading.tsx` fallback — never the data. So every click on the nav rail, every Hub → file jump, and every *return* to a page you were just on replays the full-page loading bubble.

5. **The property-file page holds its full-viewport loading bubble open behind a serial query tail.** After two parallel fan-outs, the page still serially awaits `getFileSetup`, `getExchangeDayState`, and `getExchangeDayAuthority` before returning any JSX — while `loading.tsx` shows a `minHeight: 100vh` bubble. A global `PageFadeIn` then adds a ~280–360 ms fade on top of every navigation.

6. **The write paths do far more round trips than they need.** One milestone confirm re-reads the same `PropertyTransaction` row ~8–12 times, `completeMilestone` fans out 6–10 serial queries (doubled for bilateral exchange/completion pairs — the `$transaction` timeout had to be raised to 30 s because the fan-out blew the 5 s default in staging), and the reminder engine runs a serial per-rule loop of 2–6 queries each. Hot list filters (`PropertyTransaction.agencyId/assignedUserId/status`, `ChaseTask.reminderLogId`) have no indexes.

**One important negative finding:** property-file **tab switching is already instant**. Tabs are client-side `useState` show/hide ([components/transaction/PropertyFileTabs.tsx:203-294](../../components/transaction/PropertyFileTabs.tsx#L203-L294)); no route change, no refetch, no remount. The "tabs feel slow" perception is actually (a) the heavy initial file load, and (b) the full-file re-render every mutation triggers.

---

## 2. The "10-second milestone" trace

Client: [components/milestones/MilestoneRow.tsx](../../components/milestones/MilestoneRow.tsx). Server: `confirmMilestoneAction` in [app/actions/milestones.ts:62](../../app/actions/milestones.ts#L62).

### What happens when you click Confirm

**Client (instant, already good):**
- `doComplete()` (MilestoneRow.tsx:251) wraps the call in `startTransition` and immediately calls `addOptimistic("complete")` (line 274) — the row visually flips to done and the hero % moves via `FileProgressContext`.
- **But** `isPending` from that same transition disables the row's Confirm/Undo/Change-date buttons and shows "Confirming…" (line 781) until the *entire* server round trip — action + revalidation re-render — resolves. This is the blocked window you feel.

**Server action — every awaited step in order:**

| # | File:line | Operation | Needed before ack? |
|---|---|---|---|
| 1 | milestones.ts:71 | `requireSession()` | Yes |
| 2 | :74 | Ownership guard (`propertyTransaction.findFirst` via access scope) | Yes |
| 3 | :80, :97 | Milestone def lookup + bilateral counterpart def lookup | Yes |
| 4 | :119–169 | **`prisma.$transaction` — the critical write.** `completeMilestone` fans out **6–10+ serial queries** (def read, round-scope read, prereq guard ×2, gate check, summary-text reads, existing-row check, write, `unlockDirectDependents`, reminder auto-complete, chase-state update, exchange-gate unlock, proposal update, enquiry sync, out-of-order resolution, `maybeStampExchange`, event records — [lib/services/milestones.ts:979-1443](../../lib/services/milestones.ts#L979)). **Doubled for VM19/PM26 & VM20/PM27 bilateral pairs.** Timeout raised to **30,000 ms** because staging hit P2028 at 5,333 ms (comment at :161-168, Vercel log digest 1190048595). | Yes (the write itself) — but the internal fan-out is oversized |
| 5 | :202 | **`await evaluateTransactionReminders(...)`** — the reminder engine. Its own comment ([lib/services/reminders.ts:465](../../lib/services/reminders.ts#L465)) describes the unoptimised version as "6-10 seconds of the click"; even with `anchorCodes` it runs a **serial per-rule loop** (reminders.ts:565) of 2–6 queries per rule. | **No** — post-write engine work |
| 6 | :213 | **`await refreshExpectedExchangeDate(...)`** — prediction recompute + write. Code comment says "best-effort … must not break the confirm", yet it is awaited. | **No** |
| 7 | :218–219 | `revalidateTx()` + `revalidatePath("/portal","layout")` | (triggers the re-render below) |
| 8 | :235–277 | VM20/PM27 only: completion-date sync read+write, `maybeAutoCompleteTransaction` (own reads/writes) | Partially (status flip is user-visible) |
| 9 | :338 | **`await isBilateralCounterpartComplete(...)`** — a read whose only purpose is to parametrise a **fire-and-forget** email | **No** |
| 10 | :415–426 | **`await` notifications-status `findUnique`** (contacts + users) — builds the advisory "queued" list for the toast | **No** (advisory only) |
| 11 | — | The same POST response then carries the **full RSC re-render of the invalidated file page** (see §3 for what that costs) before the client transition ends | No — the UI already shows the optimistic state |

**What is already right:** every email, push notification, SP bell, completion pack, and retention send is fire-and-forget (`.catch(() => {})`) — steps :314–:483. Emails are not the problem; most go through `enqueueEmail` (5-minute batch queue) anyway.

**Why you can't carry on working:** the write commits at step 4, but steps 5, 6, 9, 10 and the full-page re-render all sit between the commit and the moment `isPending` clears. Steps 5 and 6 are also **serial although fully independent** of each other.

**Undo / reverse are worse:** `executeUndoMilestoneAction` (:825) and `reverseMilestoneAction` (:668) await `evaluateTransactionReminders` with **no `anchorCodes`** — the full ~40-rule pass, the expensive branch the confirm path was specifically optimised away from.

**The only defensible timings** (not measured in this audit; from code comments and logged incidents): the write transaction alone exceeded 5,333 ms in staging for a bilateral pair; the reminder engine was measured by the team at 6–10 s before the `anchorCodes` narrowing; the transaction timeout is set to 30 s. Local/staging/prod will differ (DB proximity, cold starts); no fabricated figures are given.

---

## 3. Navigation trace — why the loading bubble appears

1. **Every agent route is dynamic.** [app/agent/layout.tsx:51](../../app/agent/layout.tsx#L51) awaits `resolveAgentSession()` → `getServerSession` (cookie read). Reading cookies opts every route out of static rendering. The Command Centre goes further: `export const dynamic = "force-dynamic"` ([app/command/layout.tsx:6](../../app/command/layout.tsx#L6)).
2. **Prefetch therefore can't fetch data.** For dynamic routes, Next's `<Link>` prefetch only warms the route shell down to the nearest `loading.tsx`. Click → instant fallback (the bubble) → wait for the full server render.
3. **No client-router cache reuse.** [next.config.ts](../../next.config.ts) sets no `experimental.staleTimes`; the default stale time for dynamic segments is 0. Navigating *back* to a page you saw two seconds ago re-renders it from the server in full.
4. **The file page's critical path is partly serial.** [app/agent/transactions/[id]/page.tsx](../../app/agent/transactions/[id]/page.tsx): two `Promise.all` fan-outs (:131–140, :158–216 — the second contains a 2-round-trip serial sender-identity chain) followed by **serial** awaits of `getFileSetup` (:313), `getExchangeDayState` (:420), `getExchangeDayAuthority` (:423), and a demo-tour lookup (:444) — none Suspense-wrapped, all holding the `minHeight:100vh` bubble open. The 12 tab panels stream in parallel after first paint (good), but they *all* fetch on load, not just the visible tab.
5. **A global fade delays every arrival.** [components/loading/PageFadeIn.tsx:36-50](../../components/loading/PageFadeIn.tsx#L36-L50) is keyed on `usePathname()` and replays a 280–360 ms opacity/translate animation on every navigation, on top of server time.
6. **Some navigations skip prefetch entirely.** Global search (AgentGlobalSearch.tsx:96), Hub chart click-throughs (HubCharts.tsx), and diary rows (DiaryEventRow.tsx:56) use `router.push()` — no prefetch at all.

Hub → file, file → Hub, Property A → Property B: all follow this cycle — bubble, full dynamic render, fade-in. Nothing is remembered between visits.

**Tab switching inside a property file is NOT part of this cycle** — see §1 point on tabs, and §5.

---

## 4. Performance map

| Workflow | Actual work | User-blocking work | Unnecessary blocking | Main cause | Severity |
|---|---|---|---|---|---|
| Confirm milestone | Write fan-out + reminder engine + prediction + emails | All of it except emails, + full-page re-render | Reminder engine, prediction refresh, 2 advisory reads, re-render (row is already optimistic) | Awaited post-write engines; transition covers refetch | **Critical** |
| Undo/reverse milestone | Cascade write + full 40-rule reminder pass + prediction | All of it | Full-rule engine pass (no anchorCodes) + prediction | milestones.ts:825/:668 | **Critical** |
| Edit hero field (price/address/date/fee) | 1 small write | Write + **two** full file-page refetches | Both refetches (server revalidate + client refresh) | `revalidateTx` + `router.refresh()` double invalidation | **High** |
| Add/delete note | 1 write (optimistic UI exists) | Write + full file-page refetch | The refetch — optimistic state already correct | ActivityNotesCard.tsx:111/126 `router.refresh()` | High |
| Complete task (Hub/queue) | Milestone write + notifications | Write + notification fan-out + whole Hub page refetch | Notification await (tasks.ts:141), hub-page revalidate for one row | tasks.ts:141, :183 `revalidatePath(pathname)` | High |
| Open property file | ~10 critical-path queries + 12 streamed panels | Critical path (incl. serial tail) under a 100vh bubble | The serial tail (file setup, exchange-day ×2, demo) and sender-identity serial pair | page.tsx:313–447 | High |
| Navigate anywhere | Full dynamic RSC render | Whole render + 280–360 ms fade | Cache reuse is disabled by default staleTimes; fade is pure delay | Dynamic rendering + no staleTimes + PageFadeIn | High |
| Hub load | 30–40 queries across ~20 streamed sections (~14 are counts) | Sections stream (good), but slowest sections gate their slots | Unbounded scans, unindexed count filters | hub.ts:140–284, 1766, 1863 | Medium |
| Tab switch in file | None (CSS show/hide) | None | None | — | **None (already good)** |
| Enquiry actions | Small writes | Write + file page + enquiries list refetch ×2 | Double refetch | enquiries.ts:90–92 + EnquiryCourtChip.tsx:83 | Medium |
| Chain edit | Per-link serial updates + full chain re-read | Write + full workspace refresh | Serial link loop (bounded), full re-read | chains.ts services :1170–1193 | Medium |
| Status change / hold | Write + activity write | Write + activity + layout-wide invalidation | `/agent` **layout** revalidate for a hold toggle | automation.ts:475–480 | Medium |
| Send chase (AI) | LLM round-trip | The whole generation | None (inherent — content must exist) | generate-chase route | Low (inherent) |
| Upload document | Storage + write | Write + full file-page refetch | The refetch | AgentDocumentUpload.tsx:50 | Medium |

---

## 5. Global loading audit

Every route-level loader renders the same `LoadingCard` glass bubble ([components/loading/LoadingCard.tsx:16](../../components/loading/LoadingCard.tsx#L16)):

| Loader | Covers | Blocks whole app? | Verdict |
|---|---|---|---|
| [app/agent/transactions/[id]/loading.tsx](../../app/agent/transactions/[id]/loading.tsx) | Property file | Replaces entire content area, `minHeight:100vh` | Exists because the page is dynamic + has a serial critical path. Does **not** need to be a whole-viewport bubble; a file-shaped skeleton (hero + tab bar + panel placeholders) would preserve spatial continuity. |
| app/agent/loading.tsx | Any `/agent` segment without its own loader | Content area | Same. |
| app/dashboard/loading.tsx, app/tasks/loading.tsx | Internal surfaces | Content area (keeps `SpLoadingShell` sidebar skeleton — better) | Reasonable pattern; still a card bubble for content. |
| Hub/comms/to-do/completions/partners/analytics loaders | Their pages | Near-empty `PageHeader` shells (deliberate) | Fine. |
| Command Centre | **No loading.tsx at all** | Falls back to nearest ancestor/blank | Navigations there show nothing until render completes. |

**Key facts:** the sidebar/nav rail live in the persistent `app/agent/layout.tsx` and **stay mounted and clickable** during page loads — navigation is never actually locked. Nothing intercepts pointer events globally; there is no NProgress/overlay. The *feeling* of being blocked during navigation comes from content replacement (old page vanishes → bubble → new page + fade), not from genuine input blocking. During **mutations**, blocking is per-component (`isPending` disabling), with two exceptions: `ActivityNotesCard` disables delete on *every* note while one note mutates (:181–189), and the exchange celebration overlay occupies the full viewport at `z-[200]` after exchange confirms (post-success, deliberate).

---

## 6. Refresh / revalidation audit

The shared helper (identical in transactions.ts:462 and milestones.ts:5):

```ts
function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
```

`"page"` scope invalidates the **entire file page**: the critical-path queries (§3.4) plus all 12 Suspense panels (Overview, Steps, Chain, Reminders, Chase, To-Do, Documents, Activity, WhatsApp, Sidebar, Enquiries, MortgageExpiry — page.tsx:579–707). The page header comment describes its pre-refactor cost as a ~21-query fan-out.

### Problematic patterns, with evidence

**(a) One field → whole page.** `revalidateTx` is called from ~20 field-level mutations in transactions.ts (:500, :879, :921, :999, :1052, :1133, :1234, :1289, :1387, :1511, :1548, :1610, :1631, :1658, :1712, :1765, :1789, :2544, :3558) and 14 sites in milestones.ts. Price edit → full file re-render.

**(b) Double refetch (server revalidate + client refresh).** Confirmed pairs where the action already revalidates AND the component calls `router.refresh()`:
- Hero fields: HeroSaleFields.tsx:263/325/350/385, HeroAddressEdit.tsx:78, HeroExchangeCell.tsx:56, AgentFeeInline.tsx:82, CompletionDateInline.tsx:36
- Milestones: NextMilestoneWidget.tsx:142 (+ milestones.ts:218)
- Enquiries: EnquiryCourtChip.tsx:83, EnquiryTrackerPanel.tsx:67 (+ enquiries.ts:90–92)
- Exchange day: ExchangeDayControl.tsx:81/89
- Chains: ChainsWorkspace.tsx:308/318 (+ chains.ts:29–32/51–54)
- Diary: DiaryEventRow.tsx:84
- Notes: ActivityNotesCard.tsx:111/126 — refreshes even though optimistic state already shows the result

**(c) Broadest blast radius.** Hold/reactivate ([app/actions/automation.ts:475-480](../../app/actions/automation.ts#L475-L480), :519–524) revalidates the file page + Hub + **the entire `/agent` layout** — every badge, every page under /agent.

**(d) Task completion invalidates the caller's whole page.** tasks.ts passes `pathname` and revalidates it as `"page"` (:162–:447) — completing one chase row from the Hub re-renders the whole Hub.

**(e) Legitimate exception:** chain node mutations go through `/api/chains` route handlers which *cannot* call `revalidatePath`, so `router.refresh()` in use-chain-add-node.ts:52 is the only invalidation available — not a double.

**(f) No agent-side polling of full pages.** `AutoRefresh` (interval `router.refresh`) is Command-Centre-only (activity/overview). Agent pollers (AgentBell 30 s, ConfirmReviewTray, OnboardingChecklist 15 s) hit targeted APIs. Post-mutation `redirect()`s exist only in demo flows and auth guards.

---

## 7. Waterfall audit — serial work that could be concurrent

**Server-side:**
1. `confirmMilestoneAction`: `evaluateTransactionReminders` (:202) then `refreshExpectedExchangeDate` (:213) then `isBilateralCounterpartComplete` (:338) then notifications read (:415) — four independent operations, fully serial. Same trio in reverse (:668/:681), undo (:825/:831), reinstate (:746/:751), reconciliation (:1122/:1213).
2. `completeMilestone` internals: the post-write side-effect chain (`unlockDirectDependents` → `autoCompleteRemindersForMilestone` → `clientChaseState.updateMany` → `maybeUnlockExchangeGate` → `milestoneProposal.updateMany` → `syncEnquiryTracker` → `syncRaiseChase` → out-of-order resolution → `maybeStampExchange` → `recordEvent`) is ~10 serial awaits of mutually independent writes sharing one `ptx` ([lib/services/milestones.ts:1234-1443](../../lib/services/milestones.ts#L1234)).
3. `completeTaskAction` ([app/actions/tasks.ts:87-149](../../app/actions/tasks.ts#L87)): date syncs, auto-complete check, and the notification send are independent, awaited in series.
4. File page: sender-identity chain (verifiedDomain → userVerifiedEmail, page.tsx:177–182) is serial by design, and the `getFileSetup`/`getExchangeDayState`/`getExchangeDayAuthority` tail (:313/:420/:423) is serial and could be one `Promise.all` (or streamed).
5. Reminder engine: the per-rule loop (reminders.ts:565) awaits 2–6 queries per rule sequentially; rules are independent of each other.
6. `loadActiveRoundIds` recomputed 2–3× with identical args per request ([lib/services/work-queue.ts:109/:131](../../lib/services/work-queue.ts#L109), agent.ts:100/:188/:211).

**Client-side:** widgets fetch as parallel siblings (no deep nesting). The notable chains are SolicitorPicker (mount fetch → selection fetch of handlers) and ChaseDrawer (firm lookup → AI generate → comms log → send — inherent sequence). The good counter-example already in the codebase: `transaction-summary.ts:47-53` gathers five reads with `Promise.all`.

---

## 8. Database hot paths (evidence-based)

1. **Same-row re-reads.** One milestone confirm reads the same `PropertyTransaction` row ~8–12 times (milestones.ts:74, :129, :235, :415; inside completeMilestone :1001 ×2; inside reminders.ts:491; inside prediction refresh, auto-complete, counterpart check). The `findUnique({ select: { activeBuyerRoundId } })` micro-query alone recurs at milestones.ts:129/:900/:973/:1065/:1290 and reminders.ts:515.
2. **Reminder engine per-rule loop.** reminders.ts:565 — 2–6 serial queries × rule count, on every confirm/undo/reverse/reconcile. Undo/reverse pass no `anchorCodes` → full ~40-rule pass.
3. **Missing indexes on hot filters** ([prisma/schema.prisma](../../prisma/schema.prisma)):
   - `PropertyTransaction` (model at :375) has **one** index: `@@index([serviceType, createdAt])`. Yet `agencyId`, `assignedUserId`, `agentUserId`, and `status` are the filters used by every list, Hub count (~14 filtered counts per Hub load), work-queue scan, and access-scope query. Evidence-backed gaps: `[agencyId, status]`, `[assignedUserId, status]`, `[agentUserId, status]`.
   - `ChaseTask.reminderLogId` — unindexed FK, filtered once per rule per confirm (reminders.ts:775/:795, milestones.ts:1043) and by the Hub attention query. Gap: `[reminderLogId, status]`.
4. **Unbounded scans.** `reminderLog.findMany` with no `take` in Hub attention (hub.ts:1766); `propertyTransaction.findMany` with no `take` in hub.ts:1863, work-queue.ts:84, list services. Bounded today by data volume (~pre-launch), will grow linearly with usage.
5. **Hub aggregate cost.** `getHubPipelineStats` + `getHubWins` issue ~14 `propertyTransaction.count` calls; ~30–40 queries per Hub load across ~20 streamed sections (concurrent, not serial — mitigated but index-sensitive).
6. **Chain mutations** run per-link serial `update` loops inside `$transaction` then re-read the whole chain (chains.ts:1170–1193 and siblings). Bounded (chains are 2–6 links) and low-frequency — real but not a top path.
7. **Ruled out:** `getAccessScope`/`scope*Where` are pure functions — zero queries. Sessions are JWT — no per-request user lookup. The main transaction fetch is bounded (no activity/documents/milestones in its includes). Activity feeds are properly capped (`take: 150/120/50`).

---

## 9. Optimistic UI map

**Already optimistic (keep, fix the pending-scope):** milestone confirm/not-required (MilestoneRow + MilestonePanel cascade unlock), task complete/snooze (WorkQueue per-row), status change (StatusControl manual-optimistic), notes add/delete (ActivityNotesCard), chain no-chain confirm/undo (ChainsWorkspace with manual revert).

### Safe for full optimistic UI
(deterministic local outcome; server failure is rare and rollback is honest)

| Action | Why safe | Note |
|---|---|---|
| Milestone confirm (non-bilateral) | Already optimistic; prereq failure already returns a structured `prereqs_missing` that rolls back with a message | The remaining work is ending the pending state at server-ack, not at re-render |
| Milestone not-required / skip | Lean action, cascade preview known client-side | Already optimistic |
| Task complete / snooze / reassign | Row-level state, already optimistic | Stop refreshing the whole Hub after |
| Note add/delete | Already optimistic with temp-row + revert | Drop the redundant `router.refresh()` |
| Hero field edits (price, address, dates, fee, tenure) | Client knows the new value exactly; action returns success/failure | Reconcile from action return instead of refetch |
| Enquiry chip/tracker moves | Deterministic state transition | |
| Hub card dismiss, banners, toggles (portal email toggle, automation toggles) | Local boolean flips | |

### Safe for immediate acknowledgement + quiet reconcile
(outcome has server-computed consequences the client can't predict — show "saved", let dependent data catch up)

| Action | Server-computed part |
|---|---|
| Bilateral exchange/completion confirms (VM19/PM26, VM20/PM27) | Counterpart completion, reconciliation sweep, status auto-flip, celebration payload — ack the click instantly, reconcile the cascade when the action returns |
| Undo with cascade | Downstream reversal set comes from `getUndoImpact` (already previewed in the modal — so the client *does* know the cascade; borderline safe-optimistic) |
| Status change / hold / reactivate | Chase pausing, layout badges |
| Chain node add/edit | Recomputed chain graph returns from the API |
| Document upload | Progress is inherent; ack per-file, list updates on completion |
| New sale creation | Redirect target needs the created id |

### Must remain blocking
| Action | Why |
|---|---|
| AI chase generation / memo parse / draft update | The content *is* the output; nothing to show until the model returns (streaming would improve feel, but that's a different change) |
| Sending a chase/email the user is reviewing | Truthfulness: never show "sent" before the send API accepts it (bulletproof sender policy) |
| Exchange-day irreversible confirmations where money/legal state is asserted | Agent must see real success |
| Claim/reconciliation wizard final submit | Multi-write correctness the user is explicitly waiting on |

---

## 10. Background-work candidates

The safe mechanisms **already exist in this codebase**: `after()` from `next/server` (used once, [app/api/ai/generate-chase/route.ts:683](../../app/api/ai/generate-chase/route.ts#L683)), the `OutboundEmailQueue` + ~40 cron drains, and the 04:00 reminder cron that already backstops the reminder engine.

| Work currently in the request path | Candidate mechanism | Safety analysis |
|---|---|---|
| `evaluateTransactionReminders` after confirm/undo/reverse | **`after()`** (post-response, same invocation — Vercel keeps the function alive) | Fire-and-forget is NOT acceptable long-term-durability-wise on its own, but the 04:00 cron already guarantees eventual evaluation (the sync call was added purely so chases wake *today* instead of tomorrow — code comment at milestones.ts:183-193). `after()` keeps the immediacy (runs seconds later) without the user paying for it. Failure mode = identical to today's `.catch(console.error)`. |
| `refreshExpectedExchangeDate` | `after()` | Already declared best-effort in its own comment; prediction history writes are idempotent per movement. |
| `isBilateralCounterpartComplete` + notifications-status read (milestones.ts:338/:415) | Move inside the fire-and-forget email helper / drop from the return | The toast's "queued" list is advisory; compute it where it's used. |
| `sendMilestoneConfirmationNotifications` await in completeTaskAction (tasks.ts:141) | `void`/`after()` — the same file already `void`s the reminder engine (:182) | Sends are internally queued/best-effort already. |
| Activity/`logActivity` writes after primary writes (chains.ts:28/:50, transactions.ts:808) | Keep awaited **or** move into the same `$transaction` | These are audit records — do NOT fire-and-forget; they're cheap single inserts, fine to keep. Flagged only for completeness. |
| SendGrid send in send-quote-link.ts:84 | `OutboundEmailQueue` | Queue already provides durability + retry; a "link sent" ack would then be truthful as "queued", copy should say so. |
| `maybeAutoCompleteTransaction` status flip | Keep awaited | User-visible state (file moves to Completed tab) — worth the one extra query. |
| Chain cascade after status change | Already `void`-detached (transactions.ts:830) — no change needed | |

**Not safe to defer:** the milestone write itself, ownership checks, anything the returned UI state depends on, and any send the UI reports as already-sent.

---

## 11. Navigation / prefetch opportunities (specific to this architecture)

1. **`experimental.staleTimes` in next.config.ts** — the single highest-leverage navigation change. `{ dynamic: 30 }` (seconds) would make back/forward and repeat visits within a working burst instant from the client router cache. Risk: staleness window — mitigated because every mutation already `revalidatePath`s its targets, which purges the client cache entry.
2. **File-shaped skeletons instead of the bubble** — keep `loading.tsx` but render the file chrome (hero skeleton, tab bar, panel blocks) so navigation reads as "the file is arriving" not "the app went away".
3. **Move the serial tail into Suspense** — `getFileSetup`/`getExchangeDayState`/`getExchangeDayAuthority` belong inside streamed sections (or one `Promise.all`) so first paint isn't gated on them.
4. **Convert `router.push` hotspots to `<Link>`** (global search results, Hub chart drill-ins, diary rows) so default prefetch warms them.
5. **Hover/intent prefetch for Hub rows and file links** — `router.prefetch` on pointerenter; the portal already has a hand-rolled precedent (PortalMenuDrawer.tsx:84).
6. **Command Centre `loading.tsx`** — currently blank fallbacks.
7. **PageFadeIn**: shorten/remove on route changes (keep for first load). 300 ms of pure aesthetic delay per navigation compounds the dynamic-render cost.
8. Longer term: Next 16 supports partial prerendering of the static shell around dynamic holes — worth a spike, not a Phase-1 dependency.

---

## 12. Findings

| ID | Sev | Area | Files | Root cause → user impact | Recommended architecture | Risk of change |
|---|---|---|---|---|---|---|
| **PERF-01** | Critical | Milestone confirm | app/actions/milestones.ts:202,213,338,415 | Reminder engine + prediction refresh + 2 advisory reads awaited after the committed write → the ~10 s "Confirming…" | Move engine + prediction to `after()`; compute advisory data inside the fire-and-forget email path; return immediately after commit | Low — 04:00 cron backstops reminders; all four calls already wrapped in `.catch` |
| **PERF-02** | Critical | Milestone undo/reverse | milestones.ts:668,825 (+746) | Full 40-rule reminder pass (no anchorCodes) awaited → undo slower than confirm | Pass anchorCodes (cascade set is known) + `after()` | Low |
| **PERF-03** | Critical | All file mutations | transactions.ts (~20 sites), milestones.ts (14), enquiries.ts, + client `router.refresh()` in 15+ components (§6b) | Whole-page invalidation, often doubled → every small edit re-renders the file twice | Drop client `router.refresh()` where the action revalidates; reconcile from action return values; keep `revalidateTx` as the single invalidation | Low-medium — must verify each component's data source before removing its refresh |
| **PERF-04** | High | Pending-state scope | MilestoneRow.tsx:115,781; the `startTransition(action + refresh)` pattern in EnquiryTrackerPanel:64, NextActionCardConsumer:100, ActivityNotesCard:106, etc. | `isPending` covers action + full RSC re-render → controls disabled long after the visible state is correct | End local pending at server ack; let revalidation land outside the user-visible pending window | Medium — needs per-component care to keep error rollback honest |
| **PERF-05** | High | Navigation | app/agent/layout.tsx:51, next.config.ts, all loading.tsx | Dynamic-everything + staleTimes 0 → bubble on every nav, including back-nav | `staleTimes.dynamic ≈ 30s`; skeletons; hover prefetch | Low-medium — 30 s staleness window on badge counts etc. |
| **PERF-06** | High | File open | app/agent/transactions/[id]/page.tsx:313,420,423,444; :177–182 | Serial critical-path tail under a 100vh bubble | `Promise.all` or Suspense the tail; file-shaped skeleton | Low |
| **PERF-07** | High | completeMilestone fan-out | lib/services/milestones.ts:979–1443; $transaction timeout milestones.ts:161–168 | 6–10+ serial queries per call ×2 bilateral inside one transaction (30 s timeout as evidence) | Batch independent side-effect writes (`Promise.all` on ptx / consolidated queries); pass the tx row down instead of re-reading | Medium — inside the critical transaction; needs careful test coverage |
| **PERF-08** | High | Reminder engine | lib/services/reminders.ts:565–820 | Serial per-rule loop, 2–6 queries each | Batch reads up front, parallelise per-rule writes | Medium — engine correctness is chase-critical |
| **PERF-09** | Medium | Task actions | app/actions/tasks.ts:141,162–447 | Notification fan-out awaited; `revalidatePath(pathname)` re-renders whole Hub per row | `void`/`after()` the send; targeted reconcile for the row | Low |
| **PERF-10** | Medium | Layout-wide invalidation | automation.ts:475–480,519–524 | Hold toggle revalidates the entire /agent layout | Revalidate file + hub only; badge refresh via targeted fetch | Low |
| **PERF-11** | Medium | DB indexes | prisma/schema.prisma :375 (PropertyTransaction), :1620 (ChaseTask) | Hot filters unindexed (`[agencyId,status]`, `[assignedUserId,status]`, `[agentUserId,status]`, `[reminderLogId,status]`) | Add composite indexes; staging first (Law 3) | Low — additive migration |
| **PERF-12** | Medium | Repeated reads | milestones.ts:74/129/235/415; reminders.ts:491/515; round-scope re-reads; loadActiveRoundIds ×2–3 (work-queue.ts:109/131, agent.ts:100/188/211) | Same rows re-read 8–12× per confirm | Thread fetched rows through call chains; memoise round-ids per request | Medium — touches many signatures |
| **PERF-13** | Medium | Hub queries | lib/services/hub.ts:140–284,1049–1172,1766,1863 | ~14 filtered counts + unbounded scans | Consolidate counts (groupBy), add `take` caps; depends on PERF-11 | Low-medium |
| **PERF-14** | Medium | Client data layer | No React Query/SWR; raw fetch-in-useEffect widgets (ChainWidget:28, PropertyIntelCard:65, SolicitorSection:95, …) | Every widget refetches on every mount; no cache | Current architecture *can* deliver the target feel without a new dependency (server components + optimistic + returns); a client cache is a Phase-5+ consideration, not a prerequisite | N/A (assessment) |
| **PERF-15** | Low | Fade animation | components/loading/PageFadeIn.tsx:36–50 | +280–360 ms per navigation | Skip on route change or cut to ≤120 ms | Trivial; visual sign-off needed (Law 9/12) |
| **PERF-16** | Low | No-prefetch navs | AgentGlobalSearch.tsx:96, HubCharts.tsx, DiaryEventRow.tsx:56 | router.push → cold loads | `<Link>` or router.prefetch on intent | Trivial |
| **PERF-17** | Low | Ignored return values | NextActionCardConsumer.tsx:103–108, WorkQueue.tsx:52, ActivityNotesCard.tsx:109–126 | Actions return structured results; clients discard and refetch | Use returns for local reconcile | Low |
| **PERF-18** | Low | Cross-row disabling | ActivityNotesCard.tsx:181–189 | One note mutating hides delete on all notes | Row-scoped pending | Trivial |
| **PERF-19** | Low | Command Centre | app/command (no loading.tsx; layout.tsx:6 force-dynamic) | Blank fallback during nav | Add loaders/skeletons | Trivial |
| **PERF-20** | Low | Chain writes | lib/services/chains.ts:1170–1193 etc. | Per-link serial updates + full re-read per mutation | Batched $transaction array (pattern already used at :1605) | Low; low frequency |

---

## 13. Recommended target interaction model

**Milestone confirmation**
- Current: click → optimistic tick but row disabled "Confirming…" → 5–10 s (write fan-out + reminder engine + prediction + advisory reads + full-page RSC re-render) → row re-enables.
- Target: click → optimistic tick, row controls re-enable at server ack of the committed write (sub-second on a warm function) → agent navigates away freely → reminder/prediction engines run post-response → panels reconcile via the single revalidation. Failure → row rolls back with the existing structured message.

**Milestone undo**
- Current: modal → cascade preview → confirm → full 40-rule engine pass → wait.
- Target: cascade already previewed; apply optimistically on confirm, engines post-response.

**Hero field edit / note / enquiry / toggle**
- Current: edit → save → page-scope revalidate + client refresh (whole file, twice).
- Target: edit → field shows saved value immediately from the action's return → single background revalidation, no client refresh, nothing else re-renders visibly.

**Task completion from Hub**
- Current: click → notification fan-out awaited → whole Hub re-render.
- Target: row completes optimistically (already does) → action returns after the milestone write → sends and engine post-response → no Hub-wide refetch.

**Navigation (Hub ↔ file, file ↔ file, tabs)**
- Current: every nav = bubble + full dynamic render + 300 ms fade; back-nav identical to first visit.
- Target: recently-visited pages restore instantly from the router cache (staleTimes); first visits show a file-shaped skeleton with the shell intact; fade removed from route changes; tab switches stay as-is (already instant).

**Sends and AI generation** stay explicit and truthful: a chase send shows real pending until accepted; AI generation shows progress. No change to gating, milestone truth, or send guarantees.

---

## 14. Implementation plan

**Phase 1 — Remove structural blocking (small diffs, biggest win)**
1. `confirmMilestoneAction` + undo/reverse/reinstate/reconcile: move `evaluateTransactionReminders` and `refreshExpectedExchangeDate` to `after()`; fold the counterpart-check + notifications reads into the fire-and-forget email path (PERF-01, -02).
2. `completeTaskAction`: stop awaiting `sendMilestoneConfirmationNotifications` (PERF-09).
3. Delete the redundant client `router.refresh()` where the server action already revalidates — hero fields, notes, enquiries, exchange-day, diary, milestones (PERF-03). One component at a time (Law 16).
4. End pending at server-ack in MilestoneRow / NextActionCardConsumer / WorkQueue (PERF-04, first pass).

**Phase 2 — Optimistic interaction**
5. Reconcile-from-return for hero fields and notes (PERF-17); scoped pending in ActivityNotesCard (PERF-18).
6. Immediate-ack + quiet-reconcile for bilateral confirms, status/hold, uploads (§9 middle tier).

**Phase 3 — Navigation & data loading**
7. `staleTimes.dynamic` (PERF-05), file-shaped skeletons (PERF-06 UI half), PageFadeIn cut (PERF-15), Link/prefetch conversions (PERF-16), Command loaders (PERF-19).
8. Parallelise/Suspense the file page's serial tail (PERF-06 data half).

**Phase 4 — Backend hot paths**
9. Composite indexes via staging-first migration (PERF-11).
10. `completeMilestone` fan-out batching + threaded tx row (PERF-07, -12); reminder-engine loop batching (PERF-08).
11. Hub count consolidation + `take` caps + loadActiveRoundIds dedupe (PERF-13, -12).

**Phase 5 — Polish**
12. Remaining skeleton/pending refinements, chain write batching (PERF-20), evaluate whether a client data layer is still warranted (PERF-14 — expected answer after Phases 1–3: no new dependency needed).

Order rationale: Phase 1 is where the seconds are; Phase 3 before 4 because perceived navigation cost dwarfs query cost at current data volumes; Phase 4 matters increasingly as data grows.

---

## 15. Expected impact (what you should FEEL)

- **Phase 1:** Confirming a milestone visually completes immediately (it already does) and — the real change — the row re-enables and you can click anywhere within roughly the time of the core write instead of the full engine chain. Undo stops being the slowest click in the product. Completing tasks from the Hub no longer freezes the queue. Field edits stop making the whole file flicker twice. (No fabricated ms targets: the write fan-out itself is untouched in Phase 1, so bilateral exchange confirms will still take a few seconds of *background* time — you just won't be waiting on it.)
- **Phase 2:** Every high-frequency edit acknowledges instantly; failures roll back visibly with a message. You can confirm a step and immediately open another tab, another file, or the Hub.
- **Phase 3:** Moving back to a page you were just on is instant. First visits show the page's shape, not a bubble replacing the app. The ~300 ms fade tax on every click is gone. Hub → file feels like opening a record, not loading a website.
- **Phase 4:** Cold loads of Hub and files get faster and stay fast as data grows; exchange confirms' background settle-time shrinks; the 30 s transaction-timeout safety margin stops being load-bearing.
- **Phase 5:** Remaining loading moments look intentional and local.

---

## 16. Risks & protections

| Risk | Where | Protection |
|---|---|---|
| Reminder/chase rules not waking after confirm if post-response work is lost | Phase 1 `after()` moves | `after()` runs within the same invocation (Vercel keeps the function alive); the 04:00 cron remains the durability backstop, exactly as it was before the 2026-07-13 sync-eval change. Do NOT use bare `void` for these — use `after()`. |
| Optimistic state shown, mutation actually failed | Phase 2 | Keep the existing rollback contract (MilestoneRow's `prereqs_missing` pattern); every optimistic flip must have a revert + user-visible message. Never mark sends "sent" before acceptance. |
| Double-click / duplicate confirms once rows re-enable sooner | Phases 1–2 | The prereq gate + existing idempotent already-done checks (milestones.ts:134) already absorb repeats; keep buttons disabled until server-ack (not until re-render). |
| Stale badges/lists inside the staleTimes window | Phase 3 | Mutations already `revalidatePath` their targets, which purges the client cache; badge counts tolerate 30 s staleness (they already only refresh on layout re-render today). |
| Removing a `router.refresh()` that was actually load-bearing (e.g. API-route mutations that can't revalidate) | Phase 1.3 | Audit each site before removal — the chain add-node case (use-chain-add-node.ts:49–51) is a documented example that MUST keep its refresh. One component per change, behavioural baseline per Law 17. |
| Index migrations | Phase 4 | Additive only, staging first (Law 3). |
| Reordering work inside completeMilestone's `$transaction` | Phase 4 | Highest-care change in the plan; needs the milestone-engine test suite green plus a staging soak. Everything stays inside the transaction — only sequencing/batching changes, no semantics. |
| Command Centre freshness (AutoRefresh) | Phase 3 | Command polling untouched; changes are agent-surface-scoped. |
| Portal impact | All | All Phase 1–2 changes are in agent actions/components; `revalidatePath("/portal","layout")` calls are preserved. Shared services (`portal.ts` helpers) are only *called differently* (post-response), not modified. |

---

## Plain-English verdict

1. **Why does TSP feel slow?** Because after almost every click, the user is made to wait for work the click didn't need: reminder-engine re-evaluation, prediction refreshes, advisory reads, and a full re-render of the biggest page in the app — sometimes twice. And every navigation is a full server round trip with a bubble and a fade, even going back to a page you just left.

2. **Is the backend genuinely slow?** Mostly no. The critical writes are fine; the write *fan-out* is chattier than it should be (dozens of serial round trips, a 30-second transaction timeout as a monument to that), and a few indexes are missing — but the dominant cost is that the architecture makes the user experience all of it. An operation taking 5 seconds in the background was always acceptable; today those 5 seconds happen in the user's face.

3. **Smallest changes, biggest perceptual difference?** Three: (a) stop awaiting the reminder engine and prediction refresh in the milestone actions (`after()`), (b) delete the double `revalidate + router.refresh()` pattern and end pending at server-ack, (c) set `staleTimes` and replace the bubble with in-place skeletons. Together these are a handful of files and transform the feel.

4. **Can TSP feel substantially more instant without changing business logic?** Yes — emphatically. Every gating rule, audit write, notification guarantee, and tenant check stays exactly where it is. The changes are about *when the user is released*, not *what work gets done*. The durability mechanisms needed (email queue, crons, `after()`) already exist in the codebase.

5. **Which phase first?** Phase 1. It is the smallest diff, carries the least risk (everything it defers is already best-effort with a cron backstop), and directly attacks the single worst experience in the product — the 10-second milestone confirm.
