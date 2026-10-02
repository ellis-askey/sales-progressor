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
  with a metric per row. **Decide the metric(s):** active-sales count only, +
  pipeline value, and/or their own fee income per agency. Then build.

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
