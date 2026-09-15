# Immediate UI State & Interaction Feedback Audit

**Type:** Forensic, READ-ONLY investigation. No application code, schema, migration, config, dependency, or test was modified.
**Date:** 2026-09-15
**Scope:** Every meaningful state-changing interaction across the agent app, the buyer/seller portal, the solicitor short-link portal, the internal dashboard, and the Command Centre, and every visible surface derived from the data those interactions change.
**Method:** Static tracing of server actions, API route handlers, client components, layouts, contexts, and revalidation calls. Eight parallel domain investigators, then reconciled. The two reported examples were traced by hand end to end. Behavioural claims that cannot be proven from source alone are marked **NEEDS RUNTIME VERIFICATION**.
**Relationship to the prior audit:** This supersedes `docs/UI_STATE_SYNCHRONISATION_AUDIT.md` (2026-09-07). That document is now materially stale. Several of its flagship P1s have since been fixed (see "What changed since the last audit" below). Where this report and that one disagree, this one reflects current code.

---

## Executive summary

**Overall verdict: the product is in good shape.** The core principle being tested here, "when I do something, the interface should immediately make it obvious that what I did has happened," is met for the large majority of interactions. There are **no P0 findings** (nothing shows the wrong state or invites a genuinely destructive duplicate action) and **no P1 state-feedback findings** (nothing succeeds while looking permanently broken until a manual refresh). The two examples you flagged are both real, but they are **P2 feedback-latency**, not broken state: the action does take effect and the screen does eventually repaint itself without a manual browser refresh; what is missing is the *instant* optimistic response, so during the server round-trip the UI looks like nothing happened.

**How responsive it feels today:** Snappy where the team used optimistic local state (milestones, portal confirms, hub attention cards, status badge, solicitor edits, most Command Centre and account toggles). Sluggish-but-correct in a cluster of places that skipped the optimistic step and lean on a server round-trip to repaint (contact edits, confirm-no-chain, several hero fields, quote status). Genuinely stale only in a small number of *sibling-surface* cases where a mutation refreshes the page it was fired from but not another page that shows the same data (agency name/logo on file heros and the portal; hub/All-Files counts after a status change; the sidebar To-Do badge after a hold-review action).

**Finding counts (state-feedback):**
- **P0:** 0
- **P1:** 0 (two P1-severity *correctness/security* bugs were surfaced incidentally and are logged separately below; they are not state-feedback issues)
- **P2:** 16
- **P3:** ~30

**Biggest recurring underlying causes:**
1. **Missing optimistic UI on server-action mutations.** The action succeeds and the page does repaint via `revalidatePath`, but there is no instant local state change and often no loading state on the control, so the round-trip is a visible dead window. This is the single most common theme and it is exactly what your two examples are.
2. **Narrow revalidate targets (sibling-surface staleness).** `revalidateTx(id)` and most actions revalidate only the page they fired from. A second surface showing the same data (hub, All Files, the client portal, a file hero, the layout To-Do badge) is not invalidated. Mostly masked today because pages are dynamic and refetch on soft-navigation, but active for a left-open page, a second tab, or browser back/forward, and always active for layout-scoped chrome.
3. **API route handlers never call `revalidatePath`.** All of `/api/chains/**`, `/api/command/**`, `/api/manual-tasks` (GET only now), and the portal/avatar/logo upload routes rely entirely on the calling component to `router.refresh()`. This works today but is a latent architectural gap: any consumer page made static/ISR would silently go stale.

**Strongest areas:** the buyer/seller portal (optimistic + correctly-scoped revalidation + `PortalAutoRefresh` focus safety net), the milestone engine, the Command Centre (structurally immune to layout-badge staleness; consistent optimistic + `router.refresh()`), the hub attention/list/booking cards (counts derived live from local state), and the account/integration-connect flows (IMAP inline re-fetch, WhatsApp live poll, brand colour, avatar, profile name).

**Areas needing the most work:** the file page's contact card and a few hero fields (add optimistic state, matching their own siblings), the chains confirm-no-chain link (add optimistic/loading), and the sibling-surface revalidation gaps (agency name/logo, status-change to hub/All-Files, hold-review to the layout badge).

### What changed since the last audit (2026-09-07)

Verified fixed in current code, so do **not** re-report these:
- **To-Do badge / manual-task CRUD (was the flagship P1).** Manual-task mutations moved from REST routes to server actions (`app/actions/manual-tasks.ts`) that call `revalidatePath("/agent","layout")`; the `PATCH/DELETE /api/manual-tasks/[id]` route is gone. The sidebar badge and header pills now update immediately.
- **Chains drawer surface (was P1).** `ChainView` now wraps every route-handler mutation in `fetchChainAndRefresh()` (drawer refetch + `router.refresh()`), so workspace counts, tab membership, and the file chain tab stay in sync after in-drawer edits.
- **Portal document upload (was P1).** `POST /api/portal/documents` now calls `revalidatePath("/portal/${token}","layout")`; uploads propagate to the Updates timeline and overview.
- **Agent notification Bell (was P1).** Rebuilt with a server-backed read model (`agentPreferences.agentBellClearedAt` + `markAgentBellReadAction`). The localStorage/fresh-device/cross-device divergence is gone.
- **Profile name in chrome (was P1).** Chrome name is DB-sourced (`resolveAgentSession().userName` from `prisma.user.name`), and `updateProfileAction` revalidates the `/agent` layout. Name updates immediately, no re-login.

---

## Known examples

### Example 1 — Editing contact details on a property file

**Verdict: P2. Real, and it is a missing-optimistic-UI problem, not permanent staleness.**

**What the user does:** On a file, expands a contact, taps the kebab → Edit, changes the phone or email, taps Save.

**What happens in code:**
- `ContactsSection` ([components/contacts/ContactsSection.tsx](components/contacts/ContactsSection.tsx)) renders every contact **only from the `contacts` prop** (page → `OverviewPanel` → `clientContacts`). It keeps **no local optimistic copy** of the contacts and **never calls `router.refresh()`**.
- `handleEdit` ([ContactsSection.tsx:671-704](components/contacts/ContactsSection.tsx#L671-L704)) runs `updateContactAction` inside `startTransition` and awaits it. The edit form stays open showing your typed values under a "Saving…" button for the whole round-trip, then closes 150 ms later.
- `updateContactAction` ([app/actions/contacts.ts:82-132](app/actions/contacts.ts#L82-L132)) writes the row and calls `revalidateTx(id)` → `revalidatePath("/agent/transactions/${id}","page")`.

**Why the UI behaves as it does:** `revalidateTx` alone *does* repaint the current page — the milestone engine depends on exactly this mechanism ([app/actions/milestones.ts:57](app/actions/milestones.ts#L57) states it repaints "without a client-side router.refresh()"), and `getTransaction` is wrapped only in `React.cache` (per-request), so every re-render re-queries fresh. So after the round-trip the new phone/email **does** appear with no manual browser refresh and no reopening the file. The problem is twofold: (1) there is **no optimistic feedback**, so nothing visibly changes until the round-trip completes; and (2) that round-trip is **the heaviest on the page** — `revalidateTx` re-renders the whole `OverviewPanel`, which awaits ~9 parallel queries plus ~6 serial onward/signal calls plus a fresh signed photo URL ([OverviewPanel.tsx:376-382](components/transaction/OverviewPanel.tsx#L376-L382)). On a busy file the "nothing happened" window is long enough to read as "it didn't save."

**The smoking gun (why this card specifically):** its sibling in the same `PeoplePanel`, `SolicitorSection` ([SolicitorSection.tsx:480-543](components/transaction/SolicitorSection.tsx#L480-L543)), keeps **local optimistic state** synced from props, so a solicitor edit shows instantly; `ActivityNotesCard` uses optimistic + `router.refresh()`. `ContactsSection` uses neither. This is an inconsistency between siblings, not a framework limitation. Add/delete/generate-portal-token in the same component share the identical weakness.

**NEEDS RUNTIME VERIFICATION:** confirm whether, on a slow file, the row ever appears to *not* update at all (which would indicate the revalidation is not landing on this segment). Either way the fix is the same.

### Example 2 — Confirming "no chain" from the Chains page

**Verdict: P2. Real, and again a missing-optimistic-UI problem, not permanent staleness.**

**What the user does:** On `/agent/chains`, in the "Needs chain setup" tab, clicks the "No chain" / "Confirm no chain" text link on a sale card.

**What happens in code:**
- The link ([NoChainSetupCard.tsx:121,125,131](components/chain/NoChainSetupCard.tsx#L121)) calls `handleConfirmNoChain` ([ChainsWorkspace.tsx:295-304](components/chain/ChainsWorkspace.tsx#L295-L304)), which awaits `confirmNoChainAction` then `toast.success(...)` and `router.refresh()`.
- `confirmNoChainAction` ([app/actions/chains.ts:13-30](app/actions/chains.ts#L13-L30)) sets `noChainNeededAt` and calls `revalidatePath("/agent/chains")`.
- The page is `force-dynamic` and `ChainsWorkspace` derives all counts, tiles, and tab membership from server props, so after `router.refresh()` the card correctly moves from "Needs chain setup" to "No chain" and every count recomputes.

**Why the UI behaves as it does:** there is **no optimistic update** and the `LinkAction` button ([NoChainSetupCard.tsx:24-35](components/chain/NoChainSetupCard.tsx#L24-L35)) has **no pending/disabled/spinner state**. So for the full duration of `confirmNoChainAction` + `router.refresh()` the card sits fully interactive and unchanged. It self-heals once the refresh lands, so this is a feedback/latency gap, not a stale-forever bug. Secondary: rapid clicks can re-fire the action (harmless, the action is server-side idempotent). Note the hub entry point (`ChainSetupPendingView`) is a *different* flag (`chainSetupPending`, not `noChainNeededAt`) and is correctly built with optimistic removal, so it is not part of this issue.

**Both examples share one root cause:** a server-action mutation with correct revalidation but **no immediate optimistic response and no loading state on the control**, so the server round-trip is a visible dead window. Fixing that pattern is the highest-leverage change in this report.

---

## Full findings

Priority: **P0** UI misleads about success / invites a bad duplicate action · **P1** succeeds but looks permanently broken until manual refresh · **P2** eventually correct but a visible dead window, stale sibling, or active layout staleness · **P3** works, could feel more immediate.

### P2 — State feedback

---

**F1 · Contact add / edit / delete / generate-portal-token — no optimistic UI, heaviest round-trip**
- **Area:** Property file page, Contacts card.
- **User action:** Add, edit, or remove a contact; generate a portal token.
- **Currently sees:** the edit form sits on "Saving…" (or the delete modal closes) with no visible change until the whole `OverviewPanel` re-renders.
- **Backend:** `createContactAction` / `updateContactAction` / `deleteContactAction` / `generatePortalTokenAction` ([app/actions/contacts.ts](app/actions/contacts.ts)) write the row and call `revalidateTx(id)`.
- **Why stale/unclear:** `ContactsSection` renders from the `contacts` prop with no local mirror and no `router.refresh()`; the only repaint is the heaviest re-render on the page. Delete is worst-feeling: the modal closes but the row lingers until the round-trip, so the user may think it failed.
- **Refresh fixes it?** No manual refresh needed; it self-heals after the round-trip.
- **Recommended behaviour:** the row/card reflects the new details (or disappears on delete) instantly.
- **Technical approach:** hold a local optimistic copy of `contacts` (mirror the sibling `SolicitorSection`), or `useOptimistic`, applied before the await; add a `router.refresh()` fallback so it never depends solely on segment revalidation.
- **Optimistic appropriate?** Yes.
- **Related UI to update together:** none on-page beyond the card; contact names also appear on hub/All-Files rows (sibling-stale, see F6).
- **Rollback:** on throw, restore the previous copy and re-open the form with the error (the duplicate-field error path already exists).

---

**F2 · Confirm / undo "no chain" — no optimistic UI, no loading state**
- **Area:** Chains workspace.
- **User action:** Click "No chain" / "Confirm no chain" / "Set up chain instead".
- **Currently sees:** nothing changes on the card for the full action + refresh; no spinner.
- **Backend:** `confirmNoChainAction` / `undoNoChainAction` revalidate `/agent/chains`; caller `router.refresh()`.
- **Why stale/unclear:** no optimistic move between tabs, no pending state on the link.
- **Refresh fixes it?** Self-heals via `router.refresh()`.
- **Recommended behaviour:** card animates out of the current tab and counts tick immediately; link shows a brief pending state.
- **Technical approach:** optimistic list transition in `ChainsWorkspace` (it already holds the derived lists in `useMemo`; lift to state or filter optimistically), plus a disabled/spinner state on `LinkAction`.
- **Optimistic appropriate?** Yes.
- **Related UI:** the summary tiles ("Need chain setup", tab counts) recompute from the same lists, so they move with the card.
- **Rollback:** on throw, re-insert the card and toast the error (already toasts).

---

**F3 · Hold-review actions do not refresh the sidebar To-Do badge (active layout staleness)**
- **Area:** Reviews section (surfaced on `/agent/to-do` and file review rows).
- **User action:** "Take off hold" (resume) or "Extend / change review date" on a held file.
- **Currently sees:** the review row is removed locally with a toast.
- **Backend:** `reactivateFile` revalidates only the tx paths ([app/actions/automation.ts:516-517](app/actions/automation.ts#L516)); `extendHoldAction` revalidates tx + `/agent/hub`. Neither revalidates the `/agent` layout.
- **Why stale/unclear:** the sidebar To-Do badge = `countAgentDueOrOverdue + countReviewsDue` ([app/agent/layout.tsx:66-69](app/agent/layout.tsx#L66-L69)); hold-reviews feed `countReviewsDue`. Because the badge is **layout-scoped**, a page-only revalidate never touches it and soft-navigation never re-runs the layout, so it over-counts until a hard reload. This is the same class as the (now-fixed) manual-task badge bug.
- **Refresh fixes it?** Only a hard reload or a later layout-revalidating action.
- **Recommended behaviour:** badge decrements immediately.
- **Technical approach:** have `reactivateFile` / `extendHoldAction` call `revalidatePath("/agent","layout")` (the proven manual-task fix), or the client caller `router.refresh()`.
- **Optimistic appropriate?** Optional; the row already removes locally. The badge just needs the layout revalidate.
- **Related UI:** To-Do header "N to review" pill (page-scoped, masked on nav).
- **Rollback:** n/a.

---

**F4 · Automated email "Send now" / "Skip" does not revalidate the file page**
- **Area:** Automated emails hub + email detail drawer.
- **User action:** Send a queued email now, or skip it.
- **Currently sees:** row flips to "Sent"/"Skipped" and drops off the hub (correct there).
- **Backend:** `sendPendingEmailNow` / `cancelPendingEmail` revalidate only `/agent/automated-emails` ([app/actions/automated-emails.ts](app/actions/automated-emails.ts)); the component sets a local pill and `router.refresh()`.
- **Why stale/unclear:** the same email/activity card on `/agent/transactions/[id]` is never revalidated, so a send/cancel from the hub leaves the file's email card wrong until that route reloads.
- **Refresh fixes it?** Yes, on the file page's next load (masked by soft-nav).
- **Recommended behaviour:** file page email card reflects the send/skip.
- **Technical approach:** revalidate the file path too, mirroring `updateEmailPayload` which already revalidates **both** feed and file ([app/actions/automation.ts:767-770](app/actions/automation.ts#L767-L770)) — the correct template.
- **Optimistic appropriate?** Not required; a second revalidate target is the fix.
- **Related UI:** file email card.

---

**F5 · `markEnquiriesSatisfiedAction` omits tx-path revalidation**
- **Area:** Enquiries triage → "Mark satisfied".
- **User action:** Satisfy an enquiry loop from the triage list.
- **Currently sees:** row leaves the triage list; "all clear" state can appear.
- **Backend:** `markEnquiriesSatisfiedAction` ([app/actions/enquiries.ts:147-169](app/actions/enquiries.ts#L147-L169)) revalidates only `/agent/enquiries` and delegates the milestone to `confirmMilestoneAction`. Its sibling movement actions explicitly revalidate `/agent/enquiries` **and** both tx paths; this one relies on the delegate to cover the file page.
- **Why stale/unclear:** if `confirmMilestoneAction`'s revalidation does not cover `/agent/transactions/[id]`, the file's enquiry chip/tracker stays stale until reload.
- **Refresh fixes it?** Yes.
- **Recommended behaviour:** file enquiry surfaces reflect the satisfied loop.
- **Technical approach:** add the tx-path revalidation directly, matching the sibling actions.
- **NEEDS RUNTIME VERIFICATION:** confirm `confirmMilestoneAction`'s current revalidate set.

---

**F6 · Status change / hero field edits revalidate the file only, not hub / All Files (Category B)**
- **Area:** File page StatusControl (withdraw/hold/complete) and hero fields (price, fee, exchange date, completion, tenure).
- **User action:** Change status or a hero field.
- **Currently sees:** on-page badge/field updates instantly (StatusControl uses manual optimistic; hero fields use `router.refresh()`).
- **Backend:** `changeStatusAction` and hero actions call `revalidateTx` (file path only).
- **Why stale/unclear:** `/agent/hub` attention cards, the `/agent/transactions` All-Files status column and tab bucket, analytics, and completions all show the same data and are not revalidated. Evidence this is a known gap: `reviseOverdueExchangeDateAction` *does* add `revalidatePath("/agent/hub")` and `reassignAgentAction` adds the list path, but status/price/fee/date changes do not.
- **Refresh fixes it?** Masked by Next 16 `staleTimes.dynamic=0` on soft-navigation; **active** for a left-open page, a second tab, or back/forward.
- **Recommended behaviour:** aggregate surfaces reflect the change.
- **Technical approach:** ideally tag-based revalidation keyed by `transactionId` / `agencyId` so one call invalidates every surface; short term, add `/agent/hub` and `/agent/transactions` to these actions' revalidate set.
- **Optimistic appropriate?** On-page already is; the gap is sibling revalidation.

---

**F7 · Agency name rename is stale on file heros and the client portal**
- **Area:** Account → Team → agency name.
- **User action:** Rename the agency.
- **Currently sees:** Team page updates; the form even says the name is "shown across Sales Progressor".
- **Backend:** `updateAgencyNameAction` revalidates only `/agent/account/team` ([app/actions/agency.ts:37](app/actions/agency.ts#L37)).
- **Why stale/unclear:** the agency name rendered on file heros and in the client portal header is not revalidated, so it lags there until those routes reload. The copy promises it is global, which sharpens the perceived bug.
- **Refresh fixes it?** Yes, on those routes' next load.
- **Technical approach:** tag-based revalidation on `agencyId`, or add the file and `/portal` layout paths to the revalidate set.

---

**F8 · Agency logo upload is stale on the file-hero logo band and portal**
- **Area:** Account → email branding studio.
- **User action:** Upload a new agency logo.
- **Currently sees:** in-studio preview updates immediately (cache-busted URL).
- **Backend:** `/api/agent/agency-logo` route handler, no `revalidatePath`.
- **Why stale/unclear:** the logo band on file heros and the client portal is not revalidated.
- **Refresh fixes it?** Yes. Same class as F7.
- **Technical approach:** revalidate the relevant paths/tags from a thin server action or after the upload.

---

**F9 · Portal onward-lifecycle actions deliberately skip revalidation**
- **Area:** Buyer/seller portal, onward/related-sale.
- **User action:** Abandon, reactivate, reset, skip-survey, or change the onward place (often via the edit drawer).
- **Currently sees:** the onward panel updates instantly (`setView`).
- **Backend:** `portalAbandonOnwardAction` etc. ([app/actions/portal-onward.ts:173-208](app/actions/portal-onward.ts#L173-L208)) intentionally do not `revalidatePath` (to avoid a heavy overview re-render leaving a button spinning).
- **Why stale/unclear:** the overview page's onward-derived cards (e.g. "Get a survey for your onward", onward tracker) are server-computed and are not refreshed when the change is made via the drawer over the still-mounted overview. After closing the drawer, the overview shows stale onward context until the client navigates away and back.
- **Refresh fixes it?** Self-heals on any tab switch (fresh render) or on refocus via `PortalAutoRefresh`. Narrow window.
- **Technical approach:** fire the existing `portal:onward-updated` event to also nudge the overview's onward cards, or scope a lightweight revalidate.

---

**F10 · Portal "Message your team" compose surface is unwired (product gap)**
- **Area:** Buyer/seller portal, Updates.
- **Finding:** `PortalMessageCompose` is not rendered anywhere; the Updates page is read-only, yet copy elsewhere implies a two-way channel ("your progressor will reply … here"). `portalSendMessageAction` exists but is dead, and if wired would revalidate only `/updates`, not the overview "Latest updates" card.
- **Severity:** P2 product / P3 staleness. Note per project memory two-way portal messaging was previously **declined** — so this may be intentional dead code, in which case the fix is to remove the misleading copy, not to wire the surface.
- **Recommended:** decide explicitly; either remove `PortalMessageCompose` + the implying copy, or wire it with both revalidate targets.

---

**F11 · `/api/notifications/portal` is unauthenticated and cross-tenant (security/correctness)**
- **Area:** Notifications (PortalBell, currently only mounted on `/admin/migrate`).
- **Finding:** [app/api/notifications/portal/route.ts:4-20](app/api/notifications/portal/route.ts#L4-L20) has no `requireSession`, no tenant filter; it counts all `outboundMessage` rows platform-wide by content-string match. Any caller gets a global cross-tenant count.
- **Severity:** P2 (blast radius limited because PortalBell is barely mounted), but the route is public and should be gated/scoped regardless. Not a state-feedback bug; flagged per Law 10.

---

**F12 · Latent: API route handlers never revalidate (`/api/command/**`, `/api/chains/**`, upload routes)**
- **Area:** Command Centre, chains, portal/avatar/logo uploads.
- **Finding:** grep confirms zero `revalidatePath`/`revalidateTag` across `app/api/command/**` and `app/api/chains/**`. Cross-surface freshness depends entirely on (a) the client calling `router.refresh()` and (b) consumer pages being dynamic. Correct today; silently breaks if any consumer is ever made static/ISR.
- **Severity:** P2 latent (architectural).
- **Technical approach:** adopt tag-based revalidation so mutations invalidate by entity regardless of the calling mechanism.

---

**F13-F15 · Latent Category B aggregates (masked today)**
- **F13** Completions (set date / complete file) do not directly revalidate All Files / hub pipeline for the completed file. Masked by soft-nav; active for second/left-open tab.
- **F14** All Files list row status + tab counts go stale after any external status/milestone/contact change (`revalidateTx` targets file only). Masked by soft-nav.
- **F15** Completing a VM20/PM27 reminder flips file status and touches hub/All-Files/completions, not revalidated on those routes. Masked by soft-nav.
- **Severity:** P2/B latent. Same remediation as F6 (tag-based revalidation).

---

### P3 — Polish / immediacy

- **P3-1 Chase-neighbour send** ([ChaseNeighbourDrawer.tsx:143-144](components/chase/ChaseNeighbourDrawer.tsx#L143)) closes on success with no parent refresh; the chain activity feed lags until the drawer is reopened. `sendNeighbourChaseAction` also has no `revalidatePath`.
- **P3-2 Chain drawer missing loading states:** "Create chain" ([ChainDrawer.tsx:419-428](components/chain/ChainDrawer.tsx#L419)) and Move up/down ([:493-502](components/chain/ChainDrawer.tsx#L493)) have no per-control pending state (rapid clicks can double-fire before refetch); bulk-invite is a sequential awaited loop (slow for many stubs).
- **P3-3 Reading the Updates page does not clear the Bell.** Only opening the bell dropdown advances `agentBellClearedAt`; `/agent/comms` never calls `markAgentBellReadAction`. Arguably by design.
- **P3-4 Bell feed ≠ Updates-page feed.** They are neither a subset nor superset of each other, so the bell's "View all updates" can be a dead-end for the item that alerted you (the primary per-row deep-link is fine).
- **P3-5 `Notification.readAt` read-model is vestigial** — only `SPBell` consumes it, and SPBell is only mounted on `/admin/migrate`; the live bell for SPs is `AgentBell`, which uses the timestamp baseline and never sets `readAt`. Two parallel read models; maintenance trap.
- **P3-6 AgentBell client/server timestamp drift + non-atomic `agentPreferences` JSON merge** ([agent-preferences.ts:185-198](app/actions/agent-preferences.ts#L185-L198)) — concurrent pref writes (e.g. theme toggle while bell marks read) can clobber on last-write-wins. General pattern risk.
- **P3-7 Logged internal notes never surface on Updates/bell** (by design: `internal_note` without `visibleToClient`), so "did my note broadcast?" has only per-file confirmation.
- **P3-8 Enquiry court chip tone lag** — the slider position is optimistic but the colour/caption read `data.status` (not optimistic), so there is a momentary position/colour mismatch until refresh.
- **P3-9 Enquiry tracker outstanding-note / snooze** do not revalidate `/agent/enquiries` (movement/date actions do), so the triage page lags if open in another tab.
- **P3-10 Solicitor step confirm** uses default "page" scope on `revalidatePath("/s/${token}")`, so the `/progress` and `/updates` sub-tabs are stale until nav/refocus (force-dynamic + `PortalAutoRefresh` mitigate).
- **P3-11 Milestone confirm page-derived UI lag** — `MilestoneRow` flips instantly via `useOptimistic`, but the hero % ring, sidebar progress, and timeline strip are page-level server-computed and lag until `revalidateTx` lands. Brief window.
- **P3-12 Portal document share toggle** ([PortalDocumentsTab.tsx:186-190](components/portal/PortalDocumentsTab.tsx#L186)) has no optimistic flip — it awaits a round-trip plus a second `reload()` before the switch visibly moves, unlike every other portal toggle.
- **P3-13 Add-contact "Adding…" never seen** — `handleAdd` closes the form before the action starts ([ContactsSection.tsx:630](components/contacts/ContactsSection.tsx#L630)); on failure it re-opens with the error.
- **P3-14 ManualTaskList off-by-one badge** — optimistic tab badge computed against the pre-update `tasks` closure; can drift by one under rapid edits, reconciled by revalidation.
- **P3-15 AttentionCard assign / acknowledge / dismiss-chain** remove the row optimistically with only `try/finally` and no error toast / re-insert on throw (inconsistent with the hold path and BookingsToConfirmCard, which do handle errors).
- **P3-16 Command Centre non-optimistic "waits for refetch"**: ProspectPipeline status move (card jumps column post-refresh), CalendarBoard, quote StatusControls, ServiceTypeList — laggy but correct.
- **P3-17 ServiceTypeList `toggleActive` silent failure** — checks `r.ok` but has no error branch; a failed toggle produces no feedback.
- **P3-18 provider-service-types revalidation inconsistency** — `updateServiceType` revalidates both service-types and providers; `create`/`delete` revalidate only service-types; the client-facing `/quote/[token]` picker is never revalidated (relies on dynamic).
- **P3-19 Quote status controls** revalidate quotes list/detail but not `/command/revenue`, though they set fees feeding revenue KPIs (recomputes on nav).
- **P3-20 Photo uploads** (AgentPhotoManager, file PhotoUploadButton) POST to API routes with no `revalidatePath`; other avatar renders (incl. client portal) rely on being dynamic.
- **P3-21 ExperimentActions abandon uses `window.prompt`** for the reason — crude but internal.
- **P3-22 MilestoneUpdatesEditor / MilestoneEmailsMatrix** save/reset with no revalidation and local-state-as-truth; a stale second tab wouldn't know.
- **P3-23 DomainAuthFlow has no inline success branch** — relies on the parent swapping steps on `onVerified`; a future caller that renders it standalone would show nothing on a successful check.
- **P3-24 Outlook Connect button has no pending state** during the redirect (fast double-click possible).
- **P3-25 Automation chase-policy form has no dirty tracking** — Save is always enabled and "Saved at HH:MM" persists after you start re-editing.
- **P3-26 Director's pending-invite / join-request list is stale cross-session** until nav (a negotiator accepting elsewhere does not push to the director's open page). Inherent to no-realtime.
- **P3-27 Portal counterparty / agent-side staleness** — portal mutations that matter to the other party fire bells/notifications but the counterparty's live tab (masked by `PortalAutoRefresh`) and the agent's file page (no focus-refresh) lag until reload. Inherent.
- **P3-28 Portal skip-survey (`portalMarkNotRequiredAction`) swallows errors silently**, relying on revalidate to correct; no user-facing error.
- **P3-29 Portal Updates unread badge is layout-computed** and won't recompute on a page-scope confirm revalidate; the count can trail the client's own just-confirmed item until a layout refresh. Cosmetic.
- **P3-30 TodoEmptyState double refresh** — calls `router.refresh()` after `createManualTaskAction` already revalidated the layout; two RSC fetches, harmless.

### Logged separately — correctness/security, not state-feedback (per Law 10)

- **C1 (P1 correctness) `updateAgencyChasePolicy` writes the global `ReminderRule`** via `updateMany` on `targetMilestoneCode` with no agency scope ([app/actions/automation.ts:562-573](app/actions/automation.ts#L562-L573); the comment admits it). One agency's chase-timing edits rewrite cadence platform-wide. This was flagged in the prior audit and is still present. Triage as a multi-tenancy bug (Law 7), separately from this audit.
- **C2 (P2 security) `/api/notifications/portal`** unauthenticated + cross-tenant (F11 above).

---

## Interaction inventory

Every meaningful state-changing interaction inspected, including those where no issue was found. "Immediate UI update" = does the acting surface reflect the new truth without waiting on a full server round-trip (i.e. optimistic or instant local). "Success reflected correctly" = the acting surface eventually shows the truth without a manual browser refresh.

| Area | Interaction | Immediate UI update? | Loading feedback? | Success reflected correctly? | Failure handled? | Finding |
|---|---|---|---|---|---|---|
| File · milestones | Confirm / not-required / reverse | Yes (useOptimistic) | Yes (disabled) | Yes | Yes (auto-revert) | FINE |
| File · milestones | Unlock / relock / NR-cascade | Yes (optimistic sets) | Yes | Yes | Yes | FINE |
| File · milestones | Confirm → hero ring / sidebar / strip | No (page-derived) | n/a | Yes (after revalidate) | n/a | P3-11 |
| File · status | Withdraw / hold / complete (badge) | Yes (manual optimistic) | Yes | Yes on-page | Yes | FINE on-page |
| File · status | Withdraw/hold/complete → hub/All Files | No | n/a | Masked (soft-nav) | n/a | F6 |
| File · contacts | Add / edit / delete contact | No (Pattern C) | Partial ("Saving…") | Yes (after heavy round-trip) | Partial | F1 |
| File · contacts | Generate portal token | No | No | Yes | n/a | F1 |
| File · contacts | Send / resend portal invite | Yes (local pill) | Yes | Yes | Yes (toast) | FINE |
| File · contacts | Copy portal link | Yes (✓ + log) | n/a | Yes | Silent-safe | FINE |
| File · solicitors | Edit firm / handler | Yes (optimistic) | Yes | Yes | Yes | FINE |
| File · notes | Add / delete activity note | Yes (optimistic + refresh) | Yes | Yes | Yes | FINE |
| File · hero | Price / type / tenure | No (router.refresh) | Yes (disabled) | Yes | Yes (delta guard) | P3 (no optimism); F6 sibling |
| File · hero | Address / exchange date / completion / fee | No (router.refresh) | Yes | Yes | Yes | P3 (no optimism); F6 sibling |
| File · hero | Photo upload | Yes (optimistic) | Yes | Yes | Yes (rollback) | FINE |
| File · hero | Enquiry court chip (one-tap) | Yes (optimistic) | n/a | Yes | n/a | P3-8 (tone lag) |
| File · exchange | Start / cancel exchange day | No (router.refresh) | Yes | Yes | Yes | FINE |
| File · enquiries | Tracker move/touch/relabel/snooze/note | No (router.refresh) | Yes (disabled) | Yes on-page | Yes | P3-9 (triage sibling) |
| File · assign | Reassign owner | No (Pattern C) | Modal await | Yes | n/a | P3 |
| File · banners | Revise exchange / reconcile-later | No (router.refresh) | Yes | Yes (+hub) | Yes | FINE |
| File · docs | Agent document upload | No (router.refresh) | Yes (disabled) | Yes | Yes | P3 (no optimistic row) |
| Chains | Confirm / undo no chain | No | No | Yes (router.refresh) | Yes (toast) | F2 |
| Chains | Add node / self-link / insert-between / edit stub | Yes (refetch+refresh) | Yes | Yes | Yes (toast) | FINE |
| Chains | Delete / reorder stub | Partial | Partial | Yes | Yes | P3-2 (move) |
| Chains | Send / bulk invite | Yes (state) | Yes | Yes | Yes | P3-2 (bulk perf) |
| Chains | Copy / revoke share, upload photo, save intel | Yes | Yes | Yes | Yes | FINE |
| Chains | Respond to cascade notification | Yes (drawer) | Yes ("Saving…") | Yes on-surface | Yes (inline) | FINE (P3 cross-file) |
| Chains | Chase neighbour send | No | Yes | Feed lags to reopen | Yes (toast) | P3-1 |
| Chains | Create chain | No | No | Yes | Yes | P3-2 |
| Hub | Attention: dismiss chain-setup / acknowledge relist | Yes (optimistic) | Yes | Yes | P3-15 (no error toast) | Mostly FINE |
| Hub | Attention: assign | Yes (optimistic) | Yes | Yes | No error toast | P3-15 |
| Hub | Gone-quiet / mortgage dismiss | Yes (optimistic) | Yes | Yes | Yes | FINE |
| Hub | Bookings confirm | Yes (optimistic) | Yes | Yes | Yes (toast) | FINE |
| Hub | Diary confirm exchange/completion | No (router.refresh) | Yes | Yes | Yes | FINE |
| To-Do | Complete / reopen / reschedule / add | Yes (optimistic) | Yes | Yes (badge+pills) | Yes | FINE (fixed) |
| To-Do | Empty-state add | Yes | Yes | Yes | Yes | P3-30 |
| Reviews | Complete / reopen / reschedule manual | Yes (local) | Yes | Yes (badge) | Yes | FINE |
| Reviews | Take off hold (resume) | Yes (local) | Yes | Badge over-counts | Yes (result.ok) | F3 |
| Reviews | Extend / change hold date | Yes (local) | Yes | Badge edge-stale | Yes | F3 |
| Reminders | Complete / snooze / wake / escalate / chase-now | Yes (optimistic) | Yes | Yes on-page | Yes (rollback) | FINE (P2/B latent aggregates) |
| Completions | Set date / complete file | No (router.refresh) | Yes | Yes on-route | Yes | F13 latent |
| All Files | Row status / tab after external change | No | n/a | Masked (soft-nav) | n/a | F14 latent |
| Automated emails | Send now / skip (hub + drawer) | Yes (local pill) | Yes | Yes on-hub; file stale | Yes (toast) | F4 |
| Automated emails | Edit queued email | Yes (optimistic + refetch) | Yes | Yes (both surfaces) | Yes | FINE (model) |
| Automated emails | Tab / filter / load-more | No (nav) | n/a | Yes | n/a | FINE |
| Enquiries triage | Row action (replies/raise/still/wrong-side) | No (refetch) | Yes (list lock) | Yes | Yes (toast) | FINE (P3 list-wide lock) |
| Enquiries triage | Mark satisfied | No | Yes | File page may lag | Yes | F5 |
| Solicitor /s | Confirm / update step | Local DoneBox | Yes | Yes (overview) | Yes | P3-10 (sub-tabs) |
| Solicitor /s | Enquiries satisfied / reply / date | Local DoneBox | Yes | Yes (overview) | Yes | P3-10 |
| Solicitor /s | Raise panel confirm / date | Local DoneBox | Yes | Yes | Yes | FINE |
| Solicitor /s | Pause / stop emails | Yes (optimistic) | n/a | Yes | Yes (rollback) | FINE |
| Portal | Confirm milestone step | Yes (useOptimistic + confetti) | Yes | Yes (3 tabs) | Yes | FINE (model) |
| Portal | Onward step confirm / undo / type-facts | Yes (setView) | Yes | Yes (panel) | Yes | FINE |
| Portal | Onward abandon / reactivate / reset / change place | Yes (panel) | Yes | Overview lags under drawer | Yes | F9 |
| Portal | Appearance / accessibility settings | Yes (sync DOM) | Yes (tick) | Yes | Yes | FINE (exemplary) |
| Portal | Information tab autosave | Yes (optimistic) | Yes (tick) | Yes | Yes | FINE |
| Portal | Costs / stamp-duty save | Yes (local) | Yes (tick) | Yes | Yes | FINE |
| Portal | Customize overview layout | Yes | Yes | Yes | Yes | FINE |
| Portal | Document upload / delete | Yes (reload+refresh) | Yes | Yes (+timelines) | Yes | FINE (fixed) |
| Portal | Document share toggle | No | Dim only | Yes | Yes (busy) | P3-12 |
| Portal | Broker callback request | Yes (local) | Yes | Yes (persists) | Yes (toast) | FINE |
| Portal | Identity / solicitor / chain-agent / broker edit | Yes (event refetch) | Yes | Yes | Yes | FINE |
| Portal | Notification opt-out / pause chases | Yes (local) | Yes | Yes | Yes | FINE |
| Portal | Respond deep-link confirm / date / note | Yes (pill + collapse) | Yes | Yes | Yes | FINE |
| Portal | "Message your team" | n/a (unwired) | n/a | n/a | n/a | F10 |
| Account | Profile save (name → chrome) | Yes (action revalidate) | Yes | Yes (no re-login) | Yes | FINE (fixed) |
| Account | Avatar upload / remove | Yes | Yes | Yes | Yes | FINE |
| Account | Brand colour | Yes | Yes | Yes | Yes | FINE (model) |
| Account | Email signature / writing style | Yes (autosave) | Yes | Yes | Yes | FINE |
| Account | Theme / aurora / notif toggles | Yes (optimistic) | n/a | Yes | Yes | FINE |
| Account | Email address change | No | Yes | Needs re-login (warned) | Yes | P3 (correctly surfaced) |
| Team | Invite / resend / cancel negotiator | Yes (local + refetch) | Yes | Yes (own session) | Yes | FINE (P3-26 cross-session) |
| Team | Member manage drawer (photo/details) | No (refetch) | Yes | Yes | Yes (dirty-gated) | FINE |
| Team | Agency name rename | On Team page | Yes | Heros/portal stale | Yes | F7 |
| Integrations | Outlook connect / disconnect | Yes (fresh mount) | Partial | Yes | Yes | P3-24 |
| Integrations | IMAP / Gmail connect / sync / disconnect | Yes (inline refetch) | Yes | Yes | Yes | FINE (model) |
| Integrations | WhatsApp pair | Yes (3s poll → connected) | Yes | Yes | Yes | FINE (model) |
| Integrations | DNS detect / check now | Yes (step swap) | Yes | Yes | Yes (amber) | P3-23 |
| Branding | Agency logo upload | In-studio only | Yes | Heros/portal stale | Yes | F8 |
| Automation | Chase policy save | No | Yes ("Saving…") | Yes | Yes | P3-25; C1 correctness |
| Automation | Weekly / chain-neighbour toggles | Yes (optimistic) | Yes | Yes | Yes (rollback) | FINE |
| Notifications | Agent bell open / mark read | Yes (local + server) | n/a | Yes (cross-device) | Silent-safe | FINE (fixed) |
| Notifications | Reading Updates page | No | n/a | Bell not cleared | n/a | P3-3 / P3-4 |
| Notifications | Push subscribe / revoke / per-event | Yes (optimistic) | Yes | Yes | Yes (rollback) | FINE |
| CC | Proposal approve / dismiss | Yes (optimistic) | Yes | Yes | Yes (race-safe) | FINE (model) |
| CC | Prospect drawer mutations | Yes (refetch+refresh) | Yes | Yes | Yes | FINE |
| CC | Prospect pipeline status move | No (refetch) | Dim | Yes | Yes | P3-16 |
| CC | Signal ack / snooze / dismiss / promote | Yes/action-revalidate | Yes | Yes | Yes | FINE |
| CC | Experiment start/abandon/conclude/hypothesis | Yes (action revalidate) | Yes | Yes | Yes | FINE (P3-21 prompt) |
| CC | AI-outreach review / launch / generate | Yes (local + refresh) | Yes | Yes | Yes | FINE |
| CC | Agency chase / WhatsApp / weekly toggles | Yes (optimistic) | Yes | Yes | Yes (revert) | FINE (P3 agent-side behavioural) |
| CC | Agency fee tier save | On CC page | Yes | Agent-side dynamic | Yes | P3-19-class |
| CC | Quote status controls | No (refetch) | Yes | Yes; revenue on nav | Yes | P3-19 |
| CC | Service type create / update / delete / toggle | No (refetch) | Yes | Inconsistent revalidate | Partial | P3-17 / P3-18 |
| CC | Agent / file photo upload | Yes (optimistic) | Yes | CC yes; others dynamic | Yes | P3-20 |
| CC | Milestone updates / emails editor | Local (edited badge) | Yes | Self-contained | Yes | P3-22 |
| CC | Prospect import | Yes (drain + refresh) | Yes | Yes | Yes (retry) | FINE |

---

## Cross-cutting patterns

1. **Missing optimistic UI on server-action mutations (drives F1, F2, and most P3 "no optimism" rows).** The dominant pattern for "feels broken." The action is correct and the page repaints via `revalidatePath`, but nothing changes on screen until the round-trip completes, and the control often has no loading state. The team already has the antidote in-house: `MilestoneRow` (`useOptimistic`), `SolicitorSection` (local mirror), `StatusControl` (manual optimistic), the portal confirm, and the hub cards. The inconsistent siblings are the outliers.

2. **Narrow / mismatched revalidate targets — sibling-surface staleness (drives F3, F4, F5, F6, F7, F8, F13-F15).** Actions revalidate the page they fired from, not the other pages that render the same entity. Layout-scoped chrome (To-Do badge) is the always-active sub-case (F3); aggregate pages (hub, All Files, analytics, completions) are the soft-nav-masked sub-case (F6, F13-F15); cross-object renders (agency name/logo on heros and portal) are the always-eventually-stale sub-case (F7, F8).

3. **API route handlers never invalidate cache (drives F11-F12).** `/api/command/**`, `/api/chains/**`, and the upload routes push nothing server-side; freshness rests entirely on client `router.refresh()` plus consumer pages staying dynamic.

4. **Two read models / two feeds for notifications (drives P3-3 to P3-5).** The bell timestamp model and the `readAt` row model coexist, and the bell feed and Updates feed are not aligned.

5. **`server-state-not-copied-into-local-state` is largely absent, deliberately.** Most list components seed `useState` once and treat local optimistic state as the source of truth, reconciling via revalidation. This is a valid choice and is why the app is not riddled with stale-prop bugs; the cost is the occasional cross-tab lag (P4-class) and the off-by-one badge (P3-14).

---

## Recommended remediation plan

### 1. Highest-priority fixes (visible, low-risk, resolve the reported examples)
- **R1 — Add optimistic UI + loading state to the contact card (F1) and the confirm-no-chain link (F2).** These are your two examples and the same pattern. For contacts, mirror `SolicitorSection`'s local-state approach; for chains, optimistically move the card between tabs and add a pending state to the link. **Blast radius:** two components. **Implementation risk:** low. **Regression risk:** low (optimistic + revalidate fallback). **Tests:** no current E2E covers "row reflects edit immediately"; add a Playwright assertion for each.
- **R2 — Add the layout revalidate to hold-review actions (F3).** One-line change to `reactivateFile` / `extendHoldAction` (`revalidatePath("/agent","layout")`), matching the proven manual-task fix. **Blast radius:** tiny. **Risk:** low. **Tests:** assert the sidebar badge count after resume.
- **R3 — Add the file-path revalidate to automated-email send/cancel (F4) and the tx-path to `markEnquiriesSatisfiedAction` (F5).** Copy the `updateEmailPayload` two-target template. **Blast radius:** tiny. **Risk:** low.

### 2. Shared infrastructure / pattern fixes (resolve several findings at once)
- **R4 — Adopt tag-based revalidation keyed by `transactionId` and `agencyId`.** Tag the transaction/agency reads (file page, hub, All Files, analytics, portal, heros, name/logo/fee consumers); have every mutation call `revalidateTag(tx:<id>)` / `revalidateTag(agency:<id>)`. **Solves:** F6, F7, F8, F13-F15, and future-proofs against any caching change. **Blast radius:** broad. **Implementation risk:** medium-high. **Regression risk:** medium — stage behind the warn-only rollout and do it one consumer at a time (Law 16). **Tests:** the existing multi-tenant list test should be extended to assert tag invalidation.
- **R5 — Give API route handlers a revalidation backstop (F12).** As routes are touched, add `revalidateTag` so freshness does not depend on consumers staying dynamic. Pairs naturally with R4.

### 3. Individual component fixes (P3 tail, do opportunistically)
- Error toasts + re-insert on the AttentionCard optimistic paths (P3-15) and ServiceTypeList toggle (P3-17); parent refresh after chase-neighbour send (P3-1); loading states on Create-chain / Move / Outlook-connect (P3-2, P3-24); optimistic portal share toggle (P3-12); add-contact "Adding…" ordering (P3-13); dirty tracking on the automation form (P3-25); enquiry court-chip tone optimism (P3-8).

### 4. Polish / product decisions
- Decide the portal "Message your team" surface (F10) — wire it or remove the implying copy (note: two-way messaging was previously declined).
- Reconcile the bell/Updates feeds and retire the vestigial `readAt` model, or make the Updates page clear the bell (P3-3 to P3-5).

### Separate tickets (not this audit)
- **C1** global `ReminderRule` write (P1 multi-tenancy, Law 7).
- **C2 / F11** unauthenticated `/api/notifications/portal` (security).

---

## Final verdict

**"If we fixed everything in this report, would every meaningful action in the application feel immediate, obvious, and trustworthy to the user?"**

**Largely YES — with two honest caveats.**

Fixing R1-R5 plus the P3 tail would close every confirmed dead-window and sibling-staleness finding, and the app would feel immediate and trustworthy across the board. The caveats are inherent to the current architecture rather than defects this report can "fix":

1. **Cross-user / cross-session immediacy** (a change one person makes appearing on another person's already-open screen — counterparty portals, the director's pending-invite list, a progressor watching a file) cannot be made instant without realtime (websockets/polling), which is out of scope. The portal already mitigates this with `PortalAutoRefresh`; the agent app has no focus-refresh equivalent, so a left-open agent page still needs a nav/reload to catch a change made elsewhere. If "trustworthy" must include this, it requires a realtime layer that is a separate project.
2. **NEEDS RUNTIME VERIFICATION items** (listed inline: contact-edit stick duration, `confirmMilestoneAction`'s revalidate set, and the Next 16 soft-nav masking behaviour for the Category B aggregates) should be confirmed on a running instance before the aggregate work is scoped, because their severity depends on runtime router-cache behaviour this static pass could not exercise.

Everything else — the instant, obvious, "what I did just happened" feel for single-user actions — is fully achievable within this report.

---

*End of audit. READ-ONLY: no application code, schema, migration, configuration, dependency, or test was changed in producing this report.*
