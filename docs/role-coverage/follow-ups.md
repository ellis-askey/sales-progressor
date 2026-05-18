# Role-Coverage Follow-Ups

Items surfaced during inventory/implementation that are out of scope for the current pass but should be revisited.

---

## FU-01 — SP→Agent task push

**Source:** /agent/to-do inventory, Item 4 open question  
**Summary:** No mechanism exists for a sales_progressor to push a task *to* an agent (e.g. "Chase your solicitor on this file"). The current model is agent→SP only. SP to-do page is scoped to self-notes + inbox only for now.  
**When to revisit:** When two-way progressor↔agent task routing is needed (likely post-launch, once outsourced workflow is operational).

---

## FU-02 — Notification when SP completes an agent request

**Source:** /agent/to-do inventory  
**Summary:** When a sales_progressor marks an agent's request as done (`isAgentRequest = true`, `status → done`), the agent receives no notification. The agent only finds out by checking their to-do list. This is likely a gap — the agent probably wants to know their request was actioned.  
**When to revisit:** When notification infrastructure is built out. Likely needs a new notification type (`task_completed_by_progressor`) and possibly an email/in-app alert.

---

## FU-03 — `loading.tsx` subtitle is not role-conditional

**Source:** /agent/to-do inventory, Item 13  
**Summary:** `app/agent/to-do/loading.tsx` contains a skeleton subtitle. Server components can receive role from session, but loading.tsx runs before the page resolves and cannot access session — so the subtitle cannot be role-conditional without additional architecture (e.g. a client wrapper with session context). Accepted limitation for v1. Loading states are brief and the subtitle is low-stakes.  
**When to revisit:** If loading skeletons get a more thorough role-aware treatment across the app.

---

## FU-05 — `getHubFlags` latent agencyId bug

**Source:** /agent/hub inventory  
**Summary:** `lib/services/hub.ts:343` — `getHubFlags(vis)` queries `{ agencyId: vis.agencyId, ... }`. For internal staff, `vis.agencyId = ""` so this returns empty. The function is **not called from the hub page** (page uses `getHubAttentionItems`), so no production impact today. If ever wired up for internal staff, it will silently return empty. Needs the same `internalMode` branching as other hub functions.  
**When to revisit:** When/if `getHubFlags` is wired up to a page internal staff can access.

---

## FU-06 — Momentum ring for SP: metric validity

**Source:** /agent/hub inventory  
**Summary:** SP momentum (`getHubMomentum`) counts exchanges in assigned files this month vs last. If SP is new or assigned to files with few exchanges, `percent = null` → ring doesn't render. Technically correct but visually confusing. Consider a different SP-relevant metric (e.g. files with outstanding reminders vs files clear) once SP workflow matures.  
**When to revisit:** Post-launch when SP workflow is operational and we have real usage to assess.

---

## FU-07 — loading.tsx role-conditional elements (hub)

**Source:** /agent/hub inventory  
**Summary:** `app/agent/hub/loading.tsx` always renders the "New sale" button and flag-button skeleton regardless of role. SP sees "New sale" for ~1s before data loads (then disappears). Not fixable without adding session to loading.tsx, which defeats the skeleton's purpose. Accepted limitation.  
**When to revisit:** If loading skeletons get a more thorough role-aware treatment across the app.

---

## FU-04 — Admin to-do page (URL still live, no nav entry)

**Source:** /agent/to-do inventory, Q2 answer  
**Decision:** To-Do removed from admin sidebar nav. Page at `/agent/to-do` remains live at the URL (additive discipline — no removal of existing code paths).  
**If admin navigates directly:** They see their own null-agencyId tasks in "My notes" with correct copy. The page is functional; it just isn't surfaced in nav.  
**When to revisit:** If admin use of the to-do page becomes a real workflow need.

---

## FU-08 — Sub-fetch agencyId fragility on transaction detail

**Source:** /agent/transactions/[id] inventory  
**Summary:** `app/agent/transactions/[id]/page.tsx` lines 60–64 pass `session.user.agencyId` (= `""` for internal staff) to five service functions. Works today because `""` is falsy and service functions use `agencyId ? {...} : {...}` guards. Fragile: any change making internal `agencyId` truthy would silently return empty data for all sub-fetches. Correct call would pass `null` explicitly for internal staff.  
**When to revisit:** When doing a general service-function cleanup pass. Low risk until then.

---

## FU-09 — `deleteCommAction` has no UI role gate on transaction detail

**Source:** /agent/transactions/[id] inventory  
**Summary:** `ActivityTimeline.tsx` renders a delete button on every communication entry for any authenticated user with file access. SP and admin can delete any comm on any file they can view. Backend `deleteCommAction` server action must enforce role/ownership restriction. Recommend: SP can delete their own logged comms only; admin can delete any. Current backend enforcement state unknown.  
**When to revisit:** Security/permissions audit pass.

---

## FU-10 — `confirmMilestoneAction` has no UI role gate

**Source:** /agent/transactions/[id] inventory  
**Summary:** `NextMilestoneWidget` and `MilestonePanel` expose milestone confirm buttons to all roles. SP managing their assigned outsourced files SHOULD confirm milestones (that's their job). Admin confirming is acceptable as override access. Backend action must check auth. No UI gating needed if backend is correct — verify backend enforces auth.  
**When to revisit:** Security audit pass. Likely not a bug in practice since SP and admin both have legitimate need.

---

## FU-11 — `EditSaleDetailsDrawer` exposes agent fee editing to SP

**Source:** /agent/transactions/[id] inventory  
**Summary:** `TransactionSidebar` contains an edit button that opens `EditSaleDetailsDrawer`, which includes `saveAgentFeeAction`, `savePriceAction`, `saveReferralAction`, and others. SP editing the customer agency's agent fee or referral fee is likely wrong. Open question for Ellis: hide the edit drawer entirely for SP, or hide only the fee sections within it? Recommend: hide the edit button for SP entirely in TransactionSidebar (`isInternal` or `isProgressor` guard). Admin keeps full access.  
**When to revisit:** On Ellis's answer to Open Question 4 in transaction-detail.md inventory.

---

## FU-12 — `ComposeEmail` for SP: no verified sender configured

**Source:** /agent/transactions/[id] inventory  
**Summary:** `ComposeEmail` component is visible on the Activity tab for all roles. SP accounts almost certainly have no verified SendGrid sender identity configured. Component will render but email send fails at API level (no verified email returned from `/api/agent/verified-emails`). Not a crash, but SP sees a dead-end compose UI. Ops fix (configure SP verified sender) OR code fix (hide `ComposeEmail` for SP if no verified emails exist). Recommend code fix: already check verified emails at render time, or gate entirely for `isInternal`.  
**When to revisit:** When SP workflow goes live and SP starts managing outsourced files.
