# External sales-progression company — backlog

A running to-do list for making the product correct for an **external independent
sales-progression business** (not TSP's own team). Defer items here so they're not
forgotten.

Last updated: 2026-10-02.

---

## Who this is about

An external progression business logs in with role `sales_progressor`
(`agencyId = null`, `progressionBusinessRole = owner | progressor`) and belongs to
a non-TSP `ProgressionBusiness`. The files they manage have
`progressionBusinessId = <their business>` and `serviceType = "outsourced"`.

They open the **same property-file page** as everyone else
(`/agent/transactions/[id]`), scoped to their own book. The page was built
assuming "internal staff = TSP", which is what these items correct.

## The hard rule for every item here

**Nothing changes for TSP's own outsourced sales, for the agencies TSP works with,
or for agents who sign up free (not by an external-progressor invite).** Every
change gates on the file being managed by a *non-TSP* progression business
(`fileProgressorLabel(transaction.progressionBusiness) != null`). TSP files have a
null/`isTsp` business, so they always fall through to the existing behaviour.

The whole external-progressor surface is behind the `PROGRESSION_BUSINESSES_ENABLED`
flag and is pre-launch.

---

## Shipped

- **Agent-facing file audit (items 1-8):** badge, assignee wording, hand-over,
  rate-card fee, team-time row, To-Do note author, chase-history sender, intro
  call. (Commits `a39b92fd`, `f0f953ec`.)
- **Progressor-view #1 — Chase timeline.** The external progressor (and an admin
  overseeing them) now gets the Chase-timeline tab on files they progress. Gated on
  `isInternalStaff && fileProgressor` so TSP files and TSP's own team are unchanged.
  `getChaseTimeline` already scopes by transaction for internal (null-agency)
  viewers, so the data is correct.
- **Progressor-view #3 — Own earnings.** The business OWNER
  (`progressionBusinessRole = owner`) now sees a "Your fee" row on files their
  business progresses, showing their rate-card fee for that agency
  (`progressorRateCardFeePence`). Gated on `isBusinessOwnerOfFile` (owner of THIS
  file's business). Regular team progressors don't see it; TSP staff / TSP files
  unchanged. Kept as a distinct line, NOT the agency income waterfall (which stays
  agency-facing).
- **Progressor-view #6 — WhatsApp tab hidden.** The WhatsApp tab (and its route) is
  hidden on an external progression-business file, where TSP's WhatsApp capture
  never applies. Gated on `!fileProgressor`, so TSP files keep the tab exactly as
  before. (Pairing an external business's own WhatsApp number remains a future
  "proper" option.)

---

## Open / deferred (from the progressor-view audit, 2026-10-02)

### 2. Assign a file to their own team — via the Main contact's hub
**Decision (Ellis):** it should appear in the **Main contact's hub**, the same way
unassigned files appear for TSP. **Status: deferred — not a file-page change.**
Needs:
- The hub "needs assigning" widget scoped to the progression business (note:
  `getHubUnassignedFiles` was already generalised to business scope — verify it
  surfaces for the owner).
- Who is the "Main contact" for a progression business — assumed to be the
  `owner` (`progressionBusinessRole = owner`). **Confirm.**
- `assignUserAction` (`app/actions/transactions.ts`) currently throws unless
  `scope.kind === "all"` (TSP admin only). It already contains the correct
  forward-safety logic to restrict a business-owned file to members of THAT
  business — so the gate needs widening to let the business owner assign within
  their own business, nothing more.

### 3. Their own fee / earnings on the file — DONE (confirmed 2026-10-02)
**Decision (Ellis):** confirmed — owner sees their rate-card earnings, team does
not. **Status: shipped (see "Shipped" above).**
My read of "same as TSP": on the file, TSP earnings are hidden from regular
progressors (`hideCommercialFields = isProgressor && !isAdminRole`) and only an
admin/director sees "Our fee" (`showOurFee = isDirectorRole || isAdminRole`). So to
mirror TSP for an external business:
- The business **owner** sees their earnings on the file (like a TSP admin does);
  regular team **progressors** do not.
- The figure is their rate-card fee for that agency (already computed in
  `SidebarPanel` as `progressorRateCardFeePence`, currently suppressed).
**Confirm this is the intended behaviour before building.**

### 4. Email sender identity on the file — client-facing vs CRM
**Decision (Ellis):** client-facing / white-label sends (to buyer, seller, agent,
solicitor) should go out as **the progression company**, the same way TSP
white-labels for its agents. The "CRM" / platform emails that currently send as
"Sales Progressor" (reset password, system notifications) **stay as TSP/Sales
Progressor**. **Status: deferred — sensitive (bulletproof sender).**
Needs:
- The file compose/send paths (`app/agent/transactions/[id]/activity/page.tsx`
  `spSenderIdentity`, and `resolveSenderForTransaction` in the send route) resolve
  the progression business's identity via `clientFacingIdentity` /
  `progressorSenderAddress` instead of the hardcoded TSP fallback.
- Respect the bulletproof-sender policy: only send from a **verified** address.
  Progression businesses need their own domain-verification flow (like agencies'
  `quoteSenderEmail`/`quoteSenderVerified`). **Open question:** until a business
  verifies its own domain, what's the client-facing fallback — a neutral platform
  address (not TSP's personal one)? Decide before building.
- Do NOT touch CRM/system email paths (reset password etc.) — those stay TSP.

### 6. WhatsApp tab is a dead tab for them — DONE (hidden, 2026-10-02)
**Decision (Ellis):** hide it now. **Status: shipped (see "Shipped" above).**
The tab and its route are now hidden on an external progression-business file.
Future "proper" option (not done): let a progression business pair its own WhatsApp
number into the capture pipeline so the tab becomes useful rather than hidden.

### 7. To-Do ownership / visibility permission model
**Decision (Ellis):** the **Main contact sees all**; extra progressors (their team)
**see only their own**. To be offered as a see-all / see-own option, the same way
agencies choose for their team members and files. **Status: deferred.**
Ties to #2 (assignment). Currently `showOwnership` is suppressed for progressors
(`ToDoPanel` L55), so a multi-person business can't see task ownership. Needs the
business-level permission model (owner = all; progressor = own; toggle option).

### E1. Improve the invite email an external progressor sends to an agent
**Status: deferred (entrance flow).**
The email a progression business sends to invite one of its client agents in needs
a copy/branding pass so it reads as coming from that business (and sells the value),
rather than the generic setup email. Revisit when polishing the entrance flow.

### 10. `agencyId = ""` fragility in tab badge counts
**Status: deferred (housekeeping).**
`layout.tsx` passes `agencyId={session.user.agencyId ?? ""}` into `TabBadgeCounts`.
It's currently correct (the fetchers treat `""` as "no agency filter", which is
right for internal staff), but it relies on `""` behaving like `null`. Proper fix:
pass the access scope instead of a coerced agency id. No behaviour change today; do
it as part of a scope-threading tidy-up.

---

## Phase 1 — Hub + file list (audited + actioned 2026-10-02)

Shipped (commit 2838d91e), all gated to non-TSP external progressors:
- **Assignment:** the business OWNER can assign a file to their own team (including
  themselves), scoped strictly to their business; the picker is now business-scoped
  (previous agencyId=null cross-business leak closed). Owner-only.
- **Wording:** file list title "All Files", subtitle "Every sale your business is
  progressing"; hub subtitle + pipeline + exchange-forecast cards say "your book".
  A TSP progressor keeps the "assigned files" wording.
- **"Assigned to" column** restored on the file list for an external progressor.

Deferred from Phase 1:
- **P1-e (TOP PRIORITY) — Progressor "new sale" entry + agency selection.** The
  server already supports a progressor creating a sale for a client
  (`?clientAgencyId`), but there is no generic "New sale" entry for a progressor and
  no in-flow agency selector. Intended model (founder): progressor clicks New sale →
  if they have no clients, routed to add a client first; if they have clients, they
  pick which agency the sale is for. Build: a New-sale entry for progressors + a
  client/agency selector in the flow + the add-a-client redirect when none.
- **P1-a — Per-member "see all vs see own" visibility option.** Let the business
  owner choose, per team member, whether they see the whole book or only their own
  files (like agencies' `canViewAllFiles`). Ties to #7.
- **P1-b — Hide the "Assign" button from non-owner members.** Assignment is
  owner-only and secure (action rejects non-owners; picker is business-scoped), but
  a non-owner still sees the button and gets a "forbidden" toast. Gate the button to
  the owner for clean UX (thread isBusinessOwner to the hub AttentionCard).
- **P1-c — Agency context on hub cards.** Most hub cards show an address but not the
  agency. Founder decision: leave it — the progressor knows, and it's on the file.
  NOT DOING.
- **P1-d — Forecast "fees" shows THEIR figure.** The hub exchange-forecast "£X in
  fees" shows the agency's commission; show the progression business's own rate-card
  fee instead. Founder: yes. Build: compute the business's own fee in
  `getHubWeeklyForecast` for a business viewer (per-file rate card by agency).

Shipped follow-up (commit after 2838d91e):
- **Wording "book" → "pipeline"** across the hub strings (founder: "book" is
  gimmicky). Final strings: hub subtitle "Here's what's happening across your
  pipeline today."; pipeline card "Your pipeline at a glance."; exchange forecast
  "Exchange forecast across your pipeline."; list subtitle "Every sale your business
  is progressing." (unchanged).
- **Team-member empty states (Option B)** shipped — hub: "No active sales yet / When
  your business takes on sales, you'll see them here."; list: "No active sales yet /
  Sales your business is progressing will show up here." Owner states unchanged.

Pending founder decision:
- **P1-f — "Your clients" card (NEW, replacement).** Founder clarified: an external
  progressor only cares about THEIR outsourced sales per client agency — they are
  NOT measuring the agencies' self-progressed sales (that self-progress is the
  agents' own use). So the TSP ServiceSplitCard (self-vs-outsourced split, fee
  income across everything) does NOT fit. Recommendation: build a NEW card for the
  external progressor — per client agency, the active sales they're progressing,
  with a metric per row. **Metrics (founder, 2026-10-02):** team members see active-
  sales count + pipeline value; the OWNER additionally sees their own fee income per
  agency (fee is owner-only, consistent with #3). Ready to build.

---

## Phase 1 — round 2 (2026-10-02, after founder review of the build plan)

Shipped (commit 195e8abf):
- **Needs-assigning is owner-only** (supersedes P1-b). A non-owner team member no
  longer sees the "needs assigning" queue on the hub. They add a sale and it's
  theirs; they aren't responsible for assigning agent-added files.
- **"Your clients" hub card** (was P1-f). Per client agency: active-sales count +
  pipeline value for all members; the owner also sees their fee income per client.

Refined scope / still to build:
- **P1-e (TOP) — New-sale flow (refined by founder).** Entry rules: the OWNER always
  has a New-sale entry (routes them to add a client if they have none, since only
  the owner manages Clients). A TEAM MEMBER only sees the New-sale entry once the
  business has ≥1 client (they can't add clients). In the flow, both owner and team
  pick which client agency the sale is for (team members can see the client list in
  the picker even though they don't manage the Clients page). A progressor-added
  sale is assigned to its creator (they take it on; owner can reassign). Security:
  the server must validate the chosen agency is genuinely one of the business's
  clients for the actor.
- **P1-d — Forecast fee (split by founder).** OWNER: show their own business fee
  income on the hub exchange forecast (build). TEAM MEMBER: show THEIR pay, which
  needs a team-member-pay model that doesn't exist yet → see P1-h; until then the
  fee figure is hidden for team members (don't show the agency's commission).
- **P1-a — See-all vs see-own (refined).** Mirror the agency team UI/flow exactly:
  the owner sets, per team member, whether they see the whole pipeline or only their
  own (reuse User.canViewAllFiles; make a business member's visibility honour it).

New deferred item:
- **P1-h — Team-member pay.** Let the owner set what each team member earns per sale
  (e.g. £80 per exchange). The member sees their own pay; the owner sees the full
  client fee (e.g. £350) AND what's paid out to team members. Feeds P1-d's
  team-member figure and the "Your clients" card's member view. Not started.

---

## Data isolation — TSP ↔ external businesses (CRITICAL — shipped 2026-10-02)

Founder principle: **TSP must see NOTHING of an external progression business** —
not their sales, reminders, fees, needs-assigning, nothing — on any TSP surface.
External data is confined to a future Command Centre page (separate `commandDb`
path). Two separate businesses; TSP is only the primary/platform.

Shipped (commit 114641f3): TSP's "see everything" scope (admin/superadmin "all",
and resolveInternalVisibility admin_all) now matches only TSP's own files
(progressionBusinessId null / the TSP row). Applied at both scope systems + the
hand-rolled admin queries (hub service-split / unassigned / relists / chain-setup,
reminders, reviews, work-queue, analytics) and the inline "all" delete/edit guards
(comms, contacts, transaction-notes). New `TSP_ONLY_TX_WHERE` primitive +
regression test `__tests__/progression/tsp-isolation.test.ts`.

- **P1-i — Chain-intel cross-business: DONE (read-only, commit 1cfc57bb).** Founder
  decision 2026-10-03: in a shared chain, TSP keeps VIEW on an external business's
  node (read-only, to coordinate the chain) but can no longer EDIT it.
  ChainNodeOwnership now carries txProgressionBusinessId; canEditNodeIntel "all"
  returns false for an external node. Test added.

The isolation boundary is now complete: every TSP "see everything" query excludes
external files, canReadTransaction excludes them in-memory, and chain intel is
view-only for TSP on external nodes.

---

## P1-a / #4 — See-all vs see-own per team member (investigated 2026-10-03)

Founder target: the OWNER sees the whole book; a team member sees ONLY their own
assigned files by DEFAULT; the owner can grant a member see-all. Mirror the agency
team UI/flow (User.canViewAllFiles).

This touches the auth session and the access-scope BOUNDARY we just hardened, so it
must be done carefully + tested (a mistake here leaks data). Two parts:

Part A — visibility mechanism (backend):
- Add `canViewAllFiles` + `progressionBusinessRole` to the session (auth.ts jwt +
  session callbacks already query dbUser; add to that select + the type decls).
- `getAccessScope`: a business member resolves to `{kind:"business"}` only when
  owner OR canViewAllFiles; otherwise `{kind:"assigned", userId}` (their own files).
- `resolveInternalVisibility`: same — set `businessId` only for owner/see-all; else
  fall through to `assignedUserId`.
- Default is see-own for team members (canViewAllFiles defaults false), which is the
  intended behaviour change. Owner always sees all.
- Add scope unit tests (owner → business; member see-own → assigned; member
  see-all → business). Extends __tests__/progression/tsp-isolation.test.ts style.

Part B — owner team UI (new surface; none exists for the business's own team):
- A "Your team" page for the owner: list business members (owner + progressors)
  with a per-member see-all / see-own toggle. Mirror /agent/account/team +
  TeamManagementPlain, but business-scoped (progressionBusinessId, not agencyId).
- An owner-gated action setBusinessMemberViewAll(memberId, canViewAll), validated to
  the owner's business. New data function listBusinessTeam(businessId).

Status: NOT built — deferred for a focused session rather than rushed at the tail of
a long one, because it modifies the access-scope boundary.

---

## P1-e — Progressor new-sale flow (investigated 2026-10-03, ready to build)

Founder decisions: team members have NO "New sale" entry until the owner has added
≥1 client; the owner always has it (routes to add-a-client if they have none).
Both owner and team members can add a sale and **choose which client agency** it is
for (a dropdown, best at the end of the add flow — reuse the control agents already
use to assign a sale). A progressor-added sale is **assigned to its creator by
default**, with the option to **choose a team member** (owner picking for the team).

Build pieces (all gated to non-TSP external progressors):
1. **Entry gating** — show "New sale" to a progressor when: owner (always), or team
   member AND the business has ≥1 client. Currently hidden for all sales_progressor
   on hub (`hub-view.tsx` canCreateSale) + list (`(list)/page.tsx`).
2. **In-flow client-agency picker** — a dropdown listing the business's client
   agencies, setting `clientAgencyId` (today that only comes from `?clientAgencyId`
   in the URL when launched from inside a client). Needs a "my business's client
   agencies" data function (reuse getClientsOverview).
3. **Generalise the create path** — `createTransactionAction` `clientCreate` is
   OWNER-only (`resolveBusinessOwner`). Generalise to ANY business member: validate
   the chosen agency is a client of the ACTOR'S business (owner or member), via a
   new `resolveBusinessMember(session)` helper. Security boundary stays: the agency
   must be the business's client; assignee must be a member of the business.
4. **Assign control** — reuse `assignToUserId` + `assignableAgents` (the director
   assign-to-colleague control), populated with the BUSINESS's members; default to
   the creator (self-assign). Validate assignToUserId ∈ business server-side.

---

## Decided — no change (recorded so they're not re-raised)

### 5. "Managed by {their own business}" hero badge — KEEP
Ellis: keep it showing. The progressor sees "Managed by {their business}" on their
files; no change.

### 8. Broker details read-only for the progressor — KEEP (recommendation)
Recommendation taken: leave broker-referral editing read-only for external
progressors, mirroring how TSP's own team is treated (`canEdit = role !==
"sales_progressor"`). Broker referral fees are the agency's commercial arrangement;
this keeps the external progressor consistent with TSP and changes nothing for TSP.

### P1-g. Browser-tab title "Sales Progressor" — KEEP (founder, 2026-10-02)
The hub/list browser-tab title ("… · Sales Progressor") shows only in the browser
tab/bookmarks, never on the page. Founder: keep it — it's the platform, TSP belongs
somewhere. No change.

### 9. "TSP" / "our team" wording fallbacks — VERIFIED SAFE, no change
An external progressor can only ever see their own files (business access scope),
and those always carry their business name, so they never hit the "Managed by TSP"
/ "Our team" fallback. Those words only appear on genuine TSP files, where they're
correct and must stay. Changing the TSP-file fallback would alter TSP's own view,
which must not change. Verified safe; no code change.

---

## Phase 2 — Clients CRM gaps + business settings + email sender identity (audited 2026-10-03)

Audit map (what already exists): the Clients CRM is ~80% built (landing, per-client
workspace with Overview/Branding/Sales/People/Access tabs, add-client + invite,
rate-card editor, people management). The genuinely-missing work is (A) two small
CRM gaps, and (B) the business's own settings area — which does not exist at all —
with the email sender identity as its security-sensitive core. Full map in session
2026-10-03; key file refs: `components/progression/{ClientsWorkspace,AgencyWorkspace}.tsx`,
`lib/services/progression-clients.ts`, `lib/progression/identity.ts`,
`lib/email/agency-sender.ts`, `lib/services/verified-emails.ts`,
`ProgressionBusiness` (`schema.prisma:206-233`).

**Hard rule unchanged:** everything gates on a non-TSP business. TSP files keep
`ellis@` / `updates@`; agencies keep their existing `quoteSenderEmail` flow
untouched; free self-signup agents unaffected.

### Founder decisions (2026-10-03)

**P2-1 — Remove client (CRM gap).** Build it. Owner-only, flag-gated. **Blocked
with a clear message if the client still has active (non-completed) sales** — never
orphan live files. Removal unlinks the `ProgressionBusinessClient` relationship only;
the agency row and any completed historical files remain (access is by the file's
`progressionBusinessId`, not the link). Reversible by re-adding. Word is "remove",
never "delete" (Law 21).

**P2-2 — Edit client name (CRM gap).** The client is a real `Agency` row (same one
the agency edits once it logs in). Single source of truth. **Progressor can edit the
name only while the client is PENDING** (invited, no director password yet). Once the
agency activates, the name is theirs and shows **read-only** on the progressor side.

**P2-3 — Business settings area (NEW surface).** Build an owner-only settings area
modelled on the agent account area (`app/(account)/agent/account/*`), reusing the
existing UI but **repointing the data layer from `agencyId` to `progressionBusinessId`**
(the real work — the screens are done, the plumbing is not). Tab disposition:
- **Profile** (name/email/phone/photo/writing style) — keep; reword "managed by your
  director" → "managed by your business owner".
- **Security** (password) — keep as-is.
- **Connections** (connect own mailbox) — keep as-is.
- **Email branding + identity** — keep; becomes the home for the business sender
  domain (P2-4).
- **Team** — link to the existing `/agent/team` (built in #4); do not duplicate.
- **Client portal** — **hidden at business level** (per-client for a progressor;
  lives in the per-client workspace).
- **Billing** — **kept as a visible tab AND a main-nav dropdown item**, but the page
  renders an honest empty state (no agency billing data). Clicking Billing in the
  main menu routes to that empty settings tab. **TODO (founder, later): design what a
  progression business↔TSP billing view should contain.** Deliberate placeholder, not
  a dead control — real empty state with real copy (Law 13 compliant).

**P2-4 / P2-5 / P2-6 — Email sender identity + verification (the core).** Confirmed
two-tier model with fallback:
1. **Business main settings:** owner sets + verifies their OWN domain
   (e.g. `sarahprogression.co.uk`) → default client-facing sender
   `sarah@sarahprogression.co.uk`.
2. **Per client (in that client's workspace):** owner can ALSO connect the CLIENT
   AGENCY's own address (on the agency's domain, e.g. `sarah@janesestateagents.co.uk`)
   → files for that client send fully as the agency.
3. **Resolution order per email:** verified client-agency address → verified business
   address → neutral platform `updates@thesalesprogressor.co.uk`.
4. **From-NAME is always white-labelled** to the client's agency:
   `"{progressor first name} at {client agency name}"` (e.g. "Sarah at Jane's Estate
   Agents") across ALL tiers — confirmed acceptable even where the display name and
   sending domain differ at the business/fallback tiers.
- **Verification is non-negotiable and ships WITH the "set your sender" UI** — the
  bulletproof-sender hard rule. `identity.ts:clientFacingIdentity` currently trusts
  `business.senderEmail`/`senderDomain` blindly with no verified gate; that is only
  safe today because no UI sets them. Must add a `senderVerified` field on
  `ProgressionBusiness` (mirroring `Agency.quoteSenderVerified`), reuse the agency
  verification flows (DNS domain-auth + emailed-code single-sender) pointed at the
  business, bring the business into the nightly `check-domains` cron, and gate
  `clientFacingIdentity` on verified. Build + explain fully once done (founder: "do
  what you need to, just explain once built").

**P2-7 — Invite email branding (was E1).** Brand the client-agency invite email as
coming from the progression business. **Partially-done flag:** do a first pass now,
but mark it as needing a founder content/branding review later (founder asked for a
reminder).

### Sequencing (one concern per PR, Law 5)
1. **PR1 — CRM gaps:** remove client + edit-name (pending-only). Small, no schema.
2. **PR2 — Business settings shell:** new owner-only account area, tabs repointed to
   the business, Billing/Client-portal disposition, short-name moved in.
3. **PR3 — Sender identity + verification:** schema field + reused verify flows +
   cron + verified gate + resolver changes + per-client sender. Careful + tested.
4. **PR4 — Invite email branding** (part-done, flagged for review).
