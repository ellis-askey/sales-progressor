# UI State Synchronisation Audit

**Type:** Forensic, read-only investigation. No application code, schema, migration, config, dependency or test was modified.
**Date:** 2026-09-07
**Scope:** Every user mutation across the agent app, buyer/seller portal, solicitor short-link, and Command Centre, and every visible piece of UI derived from the data those mutations change.
**Method:** Static tracing of actions, API routes, services, client components, contexts, layouts, and revalidation calls. Eight parallel investigators, one per domain, then reconciled. Findings that could not be proven statically are marked **NEEDS RUNTIME VERIFICATION**.

---

## 1. Executive summary

**The core question of this audit:** after a user performs an action successfully, is everything they can currently see truthful without a refresh? For a meaningful slice of the app, the answer is no. The database is correct; the browser is temporarily showing an old version of the truth.

- **Mutation entry points inspected:** ~160 across 47 server-action files plus several API route handlers (`/api/manual-tasks/*`, `/api/chains/**`, `/api/portal/documents`, `/api/transactions/[id]/documents`, `/api/agent/upload-avatar`, `/api/agent/agency-logo`).
- **Definitely safe (no observable sync gap):** the large majority, roughly 120. This includes the entire Command Centre (structurally immune, see below), the milestone file page body, the portal progress/next-action surface, and every action that already pairs an optimistic update with a correctly-scoped `revalidatePath`.
- **Confirmed synchronisation problems:** 6 clusters at P1, plus ~8 at P2 and a long P3 tail. Several P1s share a root cause, so the true number of distinct engineering fixes is far smaller than the number of symptoms.
- **Potentially problematic, needs runtime verification:** ~10, almost all in the "Category B" (other already-loaded page goes stale) class, whose severity depends on Next.js 16 router-cache behaviour.

### The main architectural reasons

1. **Layout-scoped shared state is never refreshed by page-scoped mutations.** The `/agent` layout computes the sidebar To-Do badge (`todoDueCount`), the Reminders/Auto-emails nav visibility (`hasSelfManagedFiles`), and the chain-decline banner (`chainDeclineNotif`). Almost every mutation calls `revalidatePath(pathname, "page")`, which revalidates the page segment but **not** the parent layout, and the shared layout is not re-executed on client-side navigation within it either. So these three shared elements stay stale until a hard reload, the top-bar refresh button (`router.refresh()`), or the one action family that uses `revalidatePath("/agent", "layout")`. **This is the exact mechanism behind the reported To-Do badge bug.**

2. **Two whole mutation surfaces run through API route handlers, not server actions, and call no revalidation at all.** The manual to-do CRUD (`/api/manual-tasks/*`) and the entire chain link/join/create/invite/cascade surface (`/api/chains/**`). Route handlers cannot auto-refresh a client, and these ones revalidate nothing. The component that called `fetch` re-fetches itself; every other surface stays stale until reload.

3. **Notifications have no server-side read model.** The `AgentBell` unread count is derived from a per-device `localStorage` timestamp and a 30-second poll, and the Updates page it links to is a different dataset that never clears the bell.

4. **Narrow / mismatched revalidate targets.** Many actions revalidate only the page they were invoked from, not the sibling surfaces (hub, All Files, the portal counterpart, the Updates timeline, the partner detail page) that render the same underlying data.

### Worst-affected areas

- **Chains** (root cause 2) is the single largest source of staleness: the drawer is always fresh, everything behind it is stale, including multi-file status changes from a cascade response.
- **The To-Do surface + sidebar badge** (root causes 1 + 2) is the reported flagship.
- **Notifications / Bell / Updates** (root cause 3).
- **Cross-surface aggregate views** (hub, All Files, analytics) are mostly saved today by a Next.js 16 default (see §4), so they are latent rather than active.

### Structurally safe: the Command Centre

`CommandSidebar` and the (fed-nothing) `AppShell` render **no** layout-computed counts or badges, and every CC list page is `force-dynamic` and computes its KPIs, tab counts, and empty states inside the page segment. So the layout-badge staleness class cannot occur there. No P0/P1 found in the Command Centre.

---

## 2. Primary findings table

Priority key: **P0** UI can materially mislead the user about whether an important action succeeded · **P1** clearly stale/broken UX · **P2** secondary/less visible · **P3** theoretical or edge.
Category: **A** current-view staleness (highest priority, user thinks the action failed) · **B** another already-loaded page is stale when next visited.

| Priority | Area | User action | Updates immediately | Stays stale | What should happen | What currently makes it correct | Root cause | Confidence |
|---|---|---|---|---|---|---|---|---|
| **P1 / A** | To-Do + sidebar | Complete / create / delete a to-do on `/agent/to-do` | The to-do row (local React state) | Sidebar **To-Do badge** (`todoDueCount`) and the To-Do page **header stat pills** ("N overdue", "N to-dos") | Badge and pills recount immediately | Only the top-bar refresh button or a hard reload | REST routes `/api/manual-tasks/*` call **no** revalidation; badge is layout-scoped (RC1+RC2) | **Confirmed** (matches the reported bug) |
| **P1 / A** | Chains workspace | Add/self-link/branch a chain node; send invites; create/remove/reorder a stub | The open ChainDrawer (refetches itself) | `/agent/chains` card counts (`needsInviteCount`, `ourFileCount`, length), the summary tiles ("In chains", "Agents to invite"), and **tab membership** ("Needs chain setup" row does not leave) | Counts + tab membership update | Reload / navigation only | `/api/chains/**` route handlers, no revalidation, drawer-only refetch (RC2) | High |
| **P1 / A** | Chains cascade | Respond to a chain notification (withdraw / remarket / break) | The ChainDrawer's own chain view | The responder's **own file status** everywhere else (now `withdrawn`/`on_hold`), hub holds widgets, other cascade-touched files, All Files buckets | All affected files reflect their new status | Reload | Route handler + fire-and-forget cascade; `putFileOnHold`'s server-side `revalidatePath` cannot push to the open client (RC2/RC4) | High (cascade partial-failure: needs runtime verification) |
| **P1 / B** | Notifications | (Any event that should notify) + reading updates | Nothing until the 30s poll | The **Bell badge** on a fresh device shows 0 for all pre-existing updates; the Bell is not cleared by reading the Updates page; read-state diverges per device | Server-backed, cross-device read-state; reading clears the bell | 30s poll partially heals the count; opening the bell zeroes it locally | Client `localStorage` timestamp + poll; no server read model; Bell and Updates are different datasets (RC3) | High |
| **P1 / A** | Profile / chrome | Change your **name** in `/agent/account/profile` | The profile card (local state) | The **top-bar + sidebar name** (and every `session.user.name` consumer, e.g. file-page sender identity) | Chrome shows the new name | Sign out and back in (JWT refresh) | Name is JWT-sourced; action does not refresh the token or revalidate the layout (RC1/RC5) | High (visible extent: runtime verify) |
| **P1 / A** | Portal documents | Client uploads a document (also delete/share) | The Documents tab (client `reload()`) | The **Updates tab timeline** and (for uploads) the **overview "Latest updates"** do not show the document | Timelines show the new/removed document | `PortalAutoRefresh` on next tab refocus | Upload API route calls no `revalidatePath`; delete/share revalidate only the overview page (RC2/RC4) | High (refocus masking window: runtime verify) |
| **P2 / B** | Hub / All Files / Analytics | Confirm/undo a milestone; withdraw/hold/complete a file from the file page | The file page body (fully consistent) | Hub pipeline buckets, WinsCard, forecast, All Files row status + which tab, analytics counts | Aggregates reflect the change | Latent: Next 16 `staleTimes.dynamic=0` refetches on soft-nav (see §4); breaks for an already-open/second tab or back-forward | `revalidateTx` targets only the file path, not the aggregate routes (RC4) | High on the gap; latency masking needs runtime verification |
| **P2 / A** | Sidebar nav | Create your first self-managed file, or switch a file to self-managed | The file page | The **Reminders + Auto-emails nav items** do not appear (`hasSelfManagedFiles` is layout-scoped) | The nav items appear | Hard reload | Layout-scoped value, page-only revalidate (RC1) | High (flip point: runtime verify) |
| **P2 / A** | Portal (client view) | Undo/reverse a milestone (agent side) | The agent file page | The **buyer/seller portal** still shows the step as done (confirm revalidates `/portal`, undo does not) | Portal reflects the reopened step | Portal's own next fetch / `PortalAutoRefresh` | Revalidate asymmetry: confirm has `/portal` layout revalidate, reverse/undo do not (RC4) | High |
| **P2 / B** | Team management | A negotiator accepts an invitation | Nothing on the director's open team page | Invite stays in **Pending**; the new member is absent from the active list | Row moves Pending to Joined | Director reloads | Cross-session; `acceptNegotiatorInvitation` runs as the invitee, cannot refresh the director; no polling | High |
| **P2 / A** | Portal documents | Client shares a document with the other side | The acting side's portal | The **counterparty's portal** does not show the shared document | Other side sees it | Their next load | Share action revalidates only the acting token's page (RC4) | High (runtime verify) |
| **P2 / A** | Reconciliation | Confirm an exchange/completion sweep (marks N steps done) | Only the **primary** milestone row ticks optimistically | The other swept rows do not tick until the page revalidation lands; no explicit rollback on a thrown error | All swept rows tick together; error rolls the primary row back | Page revalidate lands; `useOptimistic` auto-reverts on throw | Optimistic set covers one row; `doReconciliationConfirm` lacks the explicit `addOptimistic("reverse")` that the standard confirm has | High on code; visible stick: runtime verify |
| **P2 / A** | Agency fees | Admin flips an agency to a free tier in the CC | The CC agencies page | The **agent file sidebar** fee/free status | Agent sees the new fee status | Each file page reloads | Action revalidates only `/command/agencies` (RC4) | High |
| **P3** | Various | (see §5 and the dependency map) | — | — | — | — | — | — |

**Out of scope but surfaced (not a sync bug; flagged per Law 10):** `updateAgencyChasePolicy` (`app/actions/automation.ts:528-534`) edits **global** `ReminderRule` rows via `updateMany` keyed by `targetMilestoneCode`, not per-agency (the code comment admits "ReminderRule is currently global"). A director editing "their" chase cadence would rewrite cadence for **every agency**. This is potential cross-tenant write bleed and should be triaged separately from this audit. **NEEDS RUNTIME VERIFICATION** against the prod schema/data.

**Routing contradiction surfaced:** CLAUDE.md and `AppShell.tsx` assume an internal `/transactions/[id]` file view. It does not exist (`app/transactions/**` contains only `new/`). Consequently dozens of actions call `revalidatePath("/transactions/${id}")` against a route with no page (inert, harmless, misleading), and `ProposalReview.tsx:161` links proposals to a dead route. Not a state-sync bug; flagged for cleanup.

---

## 3. Mutation → UI dependency map

"Fully synced?" answers: does the user see a fully truthful screen with no refresh, everywhere the mutated data is shown?

| Mutation | Direct UI | Sidebar / global UI | Other dependent UI | Refresh mechanism | Fully synced? |
|---|---|---|---|---|---|
| Complete manual to-do (`PATCH /api/manual-tasks/[id]`) | Row moves to Completed (local state) | **To-Do badge stale** | To-Do page header pills stale; per-file tab badge patched locally (off-by-one risk) | Local `setTasks`, no revalidation | **No** |
| Create manual to-do | Row prepends (local) | **To-Do badge stale** (except via `TodoEmptyState`, which `router.refresh()`s) | Header pills stale | Local; `TodoEmptyState` alone refreshes layout | **No** (partial) |
| Complete chase-task / reminder (`completeTaskAction`) | Row exits (optimistic + rollback on `blocked`) | To-Do badge N/A (manual-task only) | Hub attention, All Files, file Reminders tab (Category B) | `revalidatePath(page)` + optimistic | Current view yes; elsewhere no |
| Snooze / wake / escalate / chase-now reminder | Row exits / label bumps (optimistic) | none | file counts (Category B) | `revalidatePath(page)` + optimistic sets | Current view yes |
| Confirm milestone (`confirmMilestoneAction`) | Row ticks (`useOptimistic`); progress %, strip, sidebar, health all recalc on revalidate | To-Do badge, Bell (30s) | Hub, All Files status, portal (revalidated), analytics (Category B) | `revalidatePath(page)` + `/portal` layout + optimistic | File page yes; sidebar/aggregates no |
| Reverse / undo milestone | Row + dependents relock (optimistic) | none | **Portal stale** (no `/portal` revalidate); aggregates | `revalidatePath(page)` only | File page yes; portal no |
| Mark not-required | Row hides + NR-cascade siblings hide (optimistic parity) | none | aggregates | `revalidatePath(page)` | File page yes |
| Change status: withdraw/hold/complete (`changeStatusAction`) | Status badge flips (manual `useState`) | none | **All Files tab bucket**, hub pipeline, completions, analytics | `revalidatePath(page)` only | File page yes; lists latent-stale |
| Switch service type / create first self-managed file | File page / list | **Reminders + Auto-emails nav hidden** (`hasSelfManagedFiles`) | hub bucketing | `revalidatePath(page)` / list paths | **No** (nav) |
| Save forecast/completion date | Hero/strip recalc | none | Hub overdue-exchange list (only `reviseOverdueExchangeDateAction` revalidates `/agent/hub`) | `revalidatePath(page)` (+hub for the revise path) | File page yes; hub asymmetric |
| Hub AttentionCard resume/extend/acknowledge/dismiss | Row filters out (local) + count/summary/all-clear derive live | To-Do badge (unrelated data) | siblings refresh (action revalidates `/agent/hub`) | local filter + `revalidatePath("/agent/hub")` | **Yes** (assign has no error toast) |
| Hub list card dismiss (`dismissHubCardAction`) | Row animates out, count updates | none | none | local filter + `/agent/hub` | **Yes** |
| Add/invite/remove chain node (`/api/chains/**`) | ChainDrawer refetches | To-Do badge; **chain-decline banner** unaffected here | **Workspace counts + tab membership**, hub chain-setup card, file chain widget | `setRefreshKey` → drawer refetch; no revalidation, no `router.refresh` | **No** |
| Respond to chain cascade | ChainDrawer view | none pushed | **Multiple files' status**, hub holds, All Files | route handler; server-side `revalidatePath` only | **No** |
| Dismiss chain-decline banner | The clicked copy hides (local) | **Layout banner instance stays** (drawer path) | — | local state; DB cleared; action has no `revalidatePath` | Banner's own X yes; drawer path no |
| Confirm/undo "no chain" (`chains.ts`) | Workspace tab move | none | Hub chain-setup card not revalidated | `revalidatePath("/agent/chains")` + `router.refresh()` | Workspace yes; hub no |
| `clearChainSetupPendingAction` | Hub card clears + file | none | — | `revalidatePath("/agent/hub")` + `revalidateTx` | **Yes** (model pattern) |
| Onward/related sale (agent side) | Card updates from returned `view` | none | chain widget (by design separate) | returned view + `revalidateTx` | **Yes** (model pattern) |
| Onward/related (portal, lifecycle) | Panel updates from returned `view` | portal greeting | Timeline self-note lags (deliberate no-revalidate) | returned view, no revalidate (documented) | Panel yes; timeline delayed |
| Broker add/remove (`brokers.ts`) | Partners list | none | **Partner detail page** not revalidated | `revalidatePath("/agent/partners")` | List yes; detail no |
| Invite negotiator / resend | Pending list (refetch/local) | none | — | `revalidatePath(team)` + local | Yes (cancel has no revalidate) |
| Negotiator accepts invite | (invitee page) | none | **Director's team page**: Pending→Joined stale | cross-session, no push | **No** (cross-session) |
| Save chain intel (`chain-intel.ts`) | Drawer refetches | none | file activity feed note lags | drawer refetch; **no** `revalidatePath` | Drawer yes; elsewhere no |
| Edit/add/delete contact (`contacts.ts`) | File panel refreshes; RoundChip buyer name | none | **All Files + hub row names stale** | `revalidateTx(page)` | File page yes; lists no |
| Save solicitors (`saveSolicitorsAction`) | File panel; activity line deferred 1 render | none | All Files `purchaserSolicitorFirmName` if firm changes | `revalidateTx` | File page yes |
| Property photo (`setPropertyPhotoAction`) | File hero re-signs | none | **Portal hero photo stale** (no `/portal` revalidate) | `revalidatePath(file)` | File yes; portal no |
| Change name (`updateProfileAction`) | Profile card (local) | **Top-bar/sidebar name stale** | file sender identity, welcome modal | `revalidatePath(profile)`, no layout/token refresh | **No** |
| Change brand colour (`updateBrandColor`) | Picker | **Whole shell re-themes, no relogin** | app-wide tokens | `revalidatePath("/agent","layout")` + `router.refresh()` | **Yes** (model pattern) |
| Avatar upload/remove | Local image + `router.refresh()` | Top-bar avatar updates (DB-sourced, layout refresh) | other pages' agent image (Category B) | route + client `router.refresh()` | **Yes** |
| Change agency name (`updateAgencyNameAction`) | Team page | none | **File hero + portal header + open file pages** | `revalidatePath(team)` only | Team page yes; elsewhere no |
| Automated-email toggle (`automation.ts`) | Settings page | none | list row / SendingTodayPanel (separate routes, refetch on nav) | `revalidatePath("/agent/settings/automation")` | Settings yes |
| Edit queued email (`updateEmailPayload`) | Feed + file page | none | — | revalidates **both** feed + file | **Yes** (model pattern) |
| Send/cancel queued email | SendingTodayPanel (`router.refresh`) | Bell N/A (not a notification) | file-page card if open in another tab | `revalidatePath("/agent/automated-emails")` | Acting surface yes |
| Add note / log comm (`comms.ts`) | File activity | none | **Updates page** (`/agent/comms`) not revalidated; Bell never shows notes | `revalidateTx(page)` | File page yes |
| Portal confirm milestone | Optimistic card + list, confetti | portal greeting | all three portal tabs revalidated | `revalidatePath` overview+progress+updates + optimistic | **Yes** |
| Portal upload document | Documents tab (`reload()`) | none | **Updates timeline + overview timeline** | route, no revalidation | Documents tab yes; timelines no |
| Portal edit identity/solicitor/chain agent | Drawer (`reload()` via event) | portal greeting (layout revalidate) | Team card | `revalidatePath("/portal/${token}","layout")` + event | **Yes** |
| Portal appearance settings | `<html>` attributes (provider) | none | — | **no revalidate** (correct, client-live) | **Yes** |
| Solicitor `/s/[token]` confirm/update | Local DoneBox | none | sibling hero ring (covered by `force-dynamic`) | `revalidatePath("/s/${token}")` + `force-dynamic` | Yes (path targeting fragile) |
| Command Centre: all list mutations | Page KPIs/tabs/lists/empty-states | **no CC layout badge exists** | list+detail paired where relevant | `revalidatePath("/command/...")`, `force-dynamic` pages | **Yes** |
| CC proposal approve/dismiss | Optimistic removal, counts + empty-state derive live | none | — | optimistic + `router.refresh()` + server re-check | **Yes** (model pattern) |

---

## 4. The Next.js 16 nuance that decides Category B severity

The app runs **Next 16** with **no `staleTimes` override** (`next.config.ts` has none), so the default `staleTimes.dynamic = 0` applies. Every aggregate surface (hub, analytics, All Files, completions) is a dynamic server component (it reads the session cookie) that stores **no** denormalised data and recomputes every figure from the DB on each render.

Consequence, and it cuts two ways:

- **Page-scoped aggregate staleness is largely LATENT.** A soft navigation to a dynamic page refetches fresh server data, so confirming a milestone and then clicking "All Files" or "Hub" generally shows correct numbers **even though no mutation revalidated those routes**. The missing `revalidatePath` on the aggregates is a latent hole that becomes an active Category B bug the moment (a) a page is left mounted, (b) a second tab is open, (c) the user uses browser back/forward, or (d) any of these routes is switched to static/ISR or a `staleTimes` override raises `dynamic`.
- **Layout-scoped staleness is ACTIVE regardless.** On a client-side navigation *within* the `/agent` layout, the shared layout segment is preserved and **not** re-executed, and page-only `revalidatePath` never touches it. So the To-Do badge, `hasSelfManagedFiles` nav, and chain-decline banner stay stale across soft navigation and only a `router.refresh()` or hard reload fixes them. This is precisely why the reported To-Do badge bug is real and reproducible while the aggregate bugs mostly are not (today).

**This distinction is the single most important framing of the whole audit.** Fix the layout-scoped class first; the aggregate class is real but currently masked.

---

## 5. Walkthroughs for the confirmed P1 issues

### Issue 1 - To-Do badge (and header pills) do not update after completing a to-do

**Starting state:** The sidebar shows "To-Do 4". The To-Do page header shows "2 overdue · 4 to-dos".
**Action:** The user confirms a due to-do as done.
**Immediately afterwards:** The to-do row moves into the "Completed" disclosure (local React state in `AgentTodoList` / `ManualTaskList`).
**What incorrectly remains:** The sidebar badge still reads "4"; the header pills still read "2 overdue · 4 to-dos".
**After refresh:** Both recount to "3" / "1 overdue · 3 to-dos".
**Why:** The toggle is a `PATCH /api/manual-tasks/[id]` route handler that calls **no** `revalidatePath` and the client never calls `router.refresh()`. The badge (`todoDueCount`, `app/agent/layout.tsx:62-64` via `countAgentDueOrOverdue`) is computed in the **layout**, which a page-only revalidate never reaches and a soft navigation never re-runs. The header pills are server-computed in `app/agent/to-do/page.tsx:33-54` and the page is likewise never revalidated. The only create path that gets this right is the empty-state (`TodoEmptyState.tsx:38`), which calls `router.refresh()`.
**Recommended fix (do not implement here):** Either (a) convert the manual-task REST routes to server actions that call `revalidatePath("/agent", "layout")` (which refreshes both the layout badge and the page pills), or (b) have the client callers call `router.refresh()` after a successful `fetch` (cheapest, matches `TodoEmptyState`), or (c) lift the badge into a small client store/context that the mutation updates directly. Option (a) is the most robust and matches the proven `updateBrandColor` pattern.
**Affected files:** `app/api/manual-tasks/route.ts`, `app/api/manual-tasks/[id]/route.ts`, `components/agent/AgentTodoList.tsx`, `components/todos/ManualTaskList.tsx`, `app/agent/to-do/page.tsx`, `app/agent/layout.tsx`, `lib/services/manual-tasks.ts`.

### Issue 2 - Chain workspace counts and tab membership do not update after setting up a chain

**Starting state:** `/agent/chains` shows a sale under "Needs chain setup", and the tiles read "In chains 3 · Agents to invite 5".
**Action:** The user opens that sale's chain drawer, adds the links, and sends the invites.
**Immediately afterwards:** The drawer refetches and shows the new nodes and "invite sent" states.
**What incorrectly remains:** The sale is still listed under "Needs chain setup"; the tiles still read "3 / 5"; the card's "needs invite" badge is unchanged.
**After refresh:** The sale moves to "In chains", the tiles recompute, the invite tile drops.
**Why:** The chain surface goes entirely through `/api/chains/**` route handlers. Route handlers cannot auto-refresh a client, and these call no `revalidatePath`. The drawer refreshes itself via `setRefreshKey` → `fetchChain()`, but nothing tells the parent `ChainsWorkspace` (whose counts and tab membership are server-computed) to re-render, and there is no `router.refresh()` anywhere in the flow.
**Recommended fix:** Convert the chain mutation routes to server actions with correctly-scoped `revalidatePath("/agent/chains")` (plus the file path and `/agent/hub` where the chain-setup card is affected), or, as a minimum, have the drawer callers call `router.refresh()` after each successful mutation in addition to their local refetch. The onward-tracker actions (`onward.ts` + `OnwardPurchaseCard`) already demonstrate the correct return-view + `revalidatePath` shape.
**Affected files:** `app/api/chains/**`, `components/chain/ChainDrawer.tsx`, `components/chain/ViewChainButton.tsx`, `components/chain/ChainsWorkspace.tsx`, `app/actions/chain-intel.ts`.

### Issue 3 - Chain cascade response leaves other files' status stale

**Starting state:** A file is Active; a chain-cascade notification is pending in its drawer.
**Action:** The user responds (e.g. "we've withdrawn").
**Immediately afterwards:** The drawer's pending card clears.
**What incorrectly remains:** The responder's own file card elsewhere still shows Active (it is now `withdrawn`/`on_hold`); the hub holds/expired widgets, the All Files buckets, and every other file the cascade touched are unchanged.
**After refresh:** All affected files show their new status.
**Why:** `POST /api/chains/notifications/[id]/respond` sets `PropertyTransaction.status`, runs `cascadeChainWithdrawal`/`cascadeChainRemarketing` (fire-and-forget), and `putFileOnHold` (which calls `revalidatePath("/agent/hub")` *server-side inside the route*, invalidating the cache for the next request but pushing nothing to the open client). Only the drawer refetches.
**Recommended fix:** Move to a server action and revalidate the affected file paths and `/agent/hub`; consider a per-transaction `revalidateTag` so a cascade can invalidate every affected file with one call. Confirm the fire-and-forget cascade handles partial failure (no half-applied neighbour state).
**Affected files:** `app/api/chains/notifications/[notificationId]/respond/route.ts`, `components/chain/ChainDrawer.tsx`, `lib/services/*` (cascade), `app/actions/automation.ts` (`putFileOnHold`).

### Issue 4 - The notification Bell is unreliable and disconnected from the Updates page

**Starting state:** The Bell shows a red "3".
**Action:** The user opens the Updates page (`/agent/comms`) and reads everything; separately, they open the app on a new device.
**Immediately afterwards:** On the Updates page, nothing about the Bell changes. On the new device, the Bell shows "0".
**What incorrectly remains:** The Bell still shows "3" after the user has read every update on the Updates page. On the new device, every genuinely-unread historical update is treated as read and will never raise a badge.
**After refresh:** No change from reading (the Bell only clears when the Bell itself is opened).
**Why:** The Bell derives its count from `GET /api/agent/notifications?after=<localStorage timestamp>` polled every 30s. `getCleared()` writes "now" on first read of a device with no stored key, so a fresh device silently zeroes all history. The Updates page is a different dataset (`getAgentUpdatesFeed` vs the Bell's `getAgentMilestoneActivity` + allowlisted `Notification`s) and never writes the Bell's read stamp or marks anything read. There is no server-side read model.
**Recommended fix:** Adopt a server-backed read model (the internal `SPBell` already uses DB-backed `Notification.readAt` and `POST /api/sp/notifications` to mark read - mirror that for `AgentBell`), and have the Updates page mark items read so the two surfaces share one source of truth. Reconcile the two feeds so "View all updates" is a superset of the Bell.
**Affected files:** `components/layout/AgentBell.tsx`, `app/api/agent/notifications/route.ts`, `app/agent/comms/page.tsx`, and the read model in `lib/services/*`. Reference the working `components/layout/SPBell.tsx`.

### Issue 5 - Changing your name leaves the old name in the chrome

**Starting state:** The top-bar and sidebar show "Jane Smith".
**Action:** The user changes their name to "Jane Doe" and saves.
**Immediately afterwards:** The profile card shows "Jane Doe" (local state).
**What incorrectly remains:** The top-bar dropdown, sidebar identity, welcome modal, and the file-page sender identity all still show "Jane Smith".
**After refresh:** Still "Jane Smith" (a plain refresh does not help) until the user signs out and back in.
**Why:** `AgentShell` renders `session.user.name` from the **JWT**, not the DB. `updateProfileAction` writes `prisma.user.update` but does not refresh the token or revalidate the layout. (The email field is explicitly warned about; the name field is not, yet is equally stale.)
**Recommended fix:** After a name change, update the NextAuth session/token (`useSession().update()` or a token refresh) and `revalidatePath("/agent", "layout")`, or source the display name in the layout from the DB (as brand colour and avatar already are) rather than the JWT.
**Affected files:** `app/actions/profile.ts`, `components/account/v2/ProfileFormPlain.tsx`, `components/layout/AgentShell.tsx`, `lib/agent-session.ts`, the NextAuth JWT callback.

### Issue 6 - Uploaded portal documents do not appear in the client's timelines

**Starting state:** The buyer's Updates tab lists recent activity.
**Action:** The buyer uploads a document in the Documents tab.
**Immediately afterwards:** The Documents tab shows the new file (client `reload()`).
**What incorrectly remains:** The Updates tab timeline and the overview "Latest updates" do not list the upload.
**After refresh:** On the next tab refocus, `PortalAutoRefresh` fires `router.refresh()` and the timelines catch up.
**Why:** `POST /api/portal/documents` calls no `revalidatePath`; delete/share (`portal.ts:538/558`) revalidate only the overview page, not `/updates`. Uploads rely entirely on the client `reload()` of the Documents tab.
**Recommended fix:** Have the upload finalise path revalidate the portal pages (or call it from a thin server action), and add `/updates` to the delete/share revalidate set.
**Affected files:** `app/api/portal/documents/route.ts`, `app/actions/portal.ts`, `components/portal/PortalDocumentsTab.tsx`, `app/portal/[token]/updates/page.tsx`, `app/portal/[token]/page.tsx`.

---

## 6. Systemic root causes

Grouping the symptoms above by cause. The count in brackets is the rough number of findings each cause drives.

- **RC1 - Layout-scoped shared state is never revalidated by page-scoped mutations.** [To-Do badge, `hasSelfManagedFiles` nav, chain-decline banner] The `/agent` layout computes shared chrome that page-only `revalidatePath` and soft navigation both miss. Only `agent-preferences.ts` uses `revalidatePath("/agent", "layout")`.
- **RC2 - Whole mutation surfaces run as API route handlers with no revalidation.** [manual to-do CRUD, all of `/api/chains/**`, document uploads, avatar/logo] Route handlers cannot auto-refresh a client; these call no `revalidatePath`; the calling component refetches itself and nothing else updates.
- **RC3 - No server-side notification read model.** [Bell count, Bell vs Updates divergence, cross-device read-state] Read-state is a per-device `localStorage` timestamp; the Bell polls; the Updates page is a separate dataset that never clears the Bell.
- **RC4 - Narrow / mismatched revalidate targets.** [contact rename on lists, agency name on file heros/portal, undo not revalidating `/portal`, portal doc share to the other side, forecast-date not revalidating hub, partner detail page, agency-fee to file sidebar, `/agent/comms` after notes] Actions revalidate only the acting page, not sibling surfaces that render the same data.
- **RC5 - JWT-sourced identity not refreshed on edit.** [profile name in chrome] The name is read from the token; the profile action does not refresh it.
- **RC6 - Aggregates recomputed live but not revalidated after cross-page mutations.** [hub/All Files/analytics/completions] Correct-by-refetch today under Next 16 `staleTimes.dynamic=0`, but latently stale for open/second-tab/back-forward, and fragile against any caching config change.

---

## 7. Highest-leverage fixes

Ranked by (1) confirmed issues solved, (2) risk, (3) duplicated patching eliminated. **None implemented here.**

1. **Standardise a "layout is dirty" refresh for the three shared elements (RC1).** Either make the to-do/self-managed/chain-banner mutations call `revalidatePath("/agent", "layout")`, or lift the three shared values into a small client store the mutations update, or (cheapest, immediate) have the relevant client callers `router.refresh()` on success. *Solves:* the reported To-Do badge bug, the self-managed nav gap, and the chain-decline banner. *Risk:* low. *Model to copy:* `updateBrandColor` (`agent-preferences.ts:69`).

2. **Convert the two API-route mutation surfaces to the server-action + revalidate pattern (RC2).** Manual to-do CRUD and the chain surface. This is the largest single reduction in staleness because chains currently refreshes nothing but its own drawer. *Solves:* Issues 1, 2, 3 and a family of P3 chain findings. *Risk:* medium (the chain surface has many callers; do it one consumer at a time per Law 16). *Model to copy:* `onward.ts` + `OnwardPurchaseCard` (return-view + `revalidateTx`), and `clearChainSetupPendingAction` (revalidates both hub and file).

3. **Adopt tag-based revalidation keyed by `transactionId` and `agencyId` (RC4 + RC6).** Tag the transaction/agency reads (hub, All Files, analytics, portal, file page, name/fee consumers) and have every mutation call `revalidateTag(tx:<id>)` / `revalidateTag(agency:<id>)`. This replaces the scattering of narrow, easy-to-forget `revalidatePath` calls with one consistent invalidation per entity, and future-proofs the aggregates against any caching-config change. *Solves:* the contact-rename, agency-name, undo-to-portal, forecast-to-hub, agency-fee, and the whole latent RC6 class. *Risk:* medium-high (broadest change; stage behind the warn-only rollout). *Highest breadth.*

4. **Give the agent Bell a server-backed, shared read model (RC3).** Mirror the internal `SPBell` (DB-backed `readAt`), have the Updates page mark items read, and reconcile the two feeds. *Solves:* Issue 4 in full. *Risk:* medium.

5. **Refresh the session token + layout on profile name change (RC5).** *Solves:* Issue 5. *Risk:* low. Smallest, fully self-contained.

---

## 8. Patterns implemented correctly (copy these)

- **`updateBrandColor` (`app/actions/agent-preferences.ts:69`)** - `revalidatePath("/agent", "layout")` + client `router.refresh()`, with the value DB-sourced in the layout. Re-themes the whole shell with no relogin. The reference for any layout-scoped change.
- **`OnwardPurchaseCard` + `onward.ts`** - action returns the fresh `view`, the card renders from it optimistically, `revalidateTx` reconciles, and the error path returns the authoritative server view so there is no diverging optimistic flip.
- **`ProposalReview` (CC)** - optimistic local list removal, counts and empty-state derived from local state, `router.refresh()` to reconcile, and a server-side `status !== "pending"` re-check that prevents a double-click re-firing client emails.
- **The milestone file page** - the whole body renders under one page-segment revalidate, and progress is always recalculated from milestone weights, never delta-adjusted. Prereq gates return a discriminated failure and the row rolls its optimistic tick back.
- **`AgentRemindersList`** - two-step optimistic exit with result-driven rollback on `blocked`, and a `[logs]` effect that resets all optimistic sets when fresh server data arrives (prevents optimistic drift).
- **`StatusControl`** - deliberately uses manual `useState` optimistic instead of `useOptimistic` to avoid the post-transition flicker back to a stale prop.
- **`PortalAutoRefresh`** - `router.refresh()` on window focus/visibilitychange, a genuine safety net that heals most portal cross-tab staleness.
- **Portal identity edits** - correctly scoped to `revalidatePath(..., "layout")` because the greeting name lives in the portal shell, plus a `portal:details-updated` event to refresh the drawer's own state.
- **`clearChainSetupPendingAction`** - revalidates both `/agent/hub` and the file view. The model the rest of the chain surface should follow.
- **`updateEmailPayload`** - revalidates both the automated-emails feed and the file page. The model for any mutation whose data shows on two surfaces.
- **`SPBell`** - DB-backed read-state (`Notification.readAt`), the model `AgentBell` should adopt.
- **Command Centre generally** - `force-dynamic` list pages compute KPIs/tabs/empty-states in the page segment and keep no live counts in the shared layout, which is why the layout-badge staleness class cannot occur there.

---

## 9. NEEDS RUNTIME VERIFICATION

Static analysis proved the mechanisms; these behavioural questions need a running app to confirm severity:

1. **Layout non-refresh across soft navigation.** Confirm the To-Do badge genuinely stays stale when navigating hub → to-do → hub (no hard reload), i.e. that the shared `/agent` layout is not re-executed on soft navigation (static reading says it is not).
2. **Next 16 aggregate refetch.** Confirm that a soft `<Link>` navigation to the hub / All Files / analytics after a milestone confirm shows fresh data without a hard reload (masking RC6), and that browser back/forward does the same.
3. **Left-open / second-tab staleness.** None of the aggregate surfaces poll, so confirm whether an already-open hub/All Files page updating only on refocus is acceptable product behaviour.
4. **Completed/withdrawn file leaving the All Files "Active" tab** without a manual refresh (Findings in §2, milestone/status).
5. **Reminders/Auto-emails nav appearing** after creating a first self-managed file or switching a file to self-managed.
6. **Reconciliation primary row** visibly "sticking" ticked on a thrown error before `useOptimistic` auto-reverts.
7. **Portal document upload → timeline** lag and how quickly `PortalAutoRefresh` masks it; portal document **share to the other side**; portal **hero photo** after `setPropertyPhotoAction`.
8. **Bell first-load zeroing** on a fresh browser profile, and cross-device read-state divergence.
9. **Chain cascade partial-failure** (fire-and-forget `cascadeChainWithdrawal`): confirm neighbours are notified and no half-applied state persists on throw.
10. **Negotiator team page** Pending → Joined: confirm there is no polling that would auto-surface an accepted invite.
11. **`/s/[token]` sub-tab** actions: confirm the `SolicitorHero` ring/percent updates after a confirm from the `/updates` sub-tab (path-vs-render mismatch, expected to work via `force-dynamic`).
12. **Out-of-scope, high stakes:** confirm `ReminderRule` is genuinely global in prod so `updateAgencyChasePolicy` really does write cross-agency (`automation.ts:528-534`).

---

*End of audit. Read-only: no application code, schema, migration, configuration, dependency, or test was changed in producing this report.*
