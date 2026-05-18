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
