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

### 3. Their own fee / earnings on the file — PENDING CONFIRM
**Decision (Ellis):** "same relationship TSP has with the agents who outsource —
confirm this one." **Status: blocked on confirmation.**
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

### 6. WhatsApp tab is a dead tab for them
**Decision (Ellis):** "we need to sort this." **Status: deferred here.**
The WhatsApp tab (gated `isInternalTeam`) shows for them but WhatsApp capture is
wired to TSP's WhatsApp number, so it's permanently empty.
Options:
- **Quick interim:** hide the WhatsApp tab for external-progressor viewers (gate it
  off when the file is a non-TSP progressor file). Low risk, improves UX now.
- **Proper:** let a progression business pair its own WhatsApp number into the
  capture pipeline. Large.

### 7. To-Do ownership / visibility permission model
**Decision (Ellis):** the **Main contact sees all**; extra progressors (their team)
**see only their own**. To be offered as a see-all / see-own option, the same way
agencies choose for their team members and files. **Status: deferred.**
Ties to #2 (assignment). Currently `showOwnership` is suppressed for progressors
(`ToDoPanel` L55), so a multi-person business can't see task ownership. Needs the
business-level permission model (owner = all; progressor = own; toggle option).

### 10. `agencyId = ""` fragility in tab badge counts
**Status: deferred (housekeeping).**
`layout.tsx` passes `agencyId={session.user.agencyId ?? ""}` into `TabBadgeCounts`.
It's currently correct (the fetchers treat `""` as "no agency filter", which is
right for internal staff), but it relies on `""` behaving like `null`. Proper fix:
pass the access scope instead of a coerced agency id. No behaviour change today; do
it as part of a scope-threading tidy-up.

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

### 9. "TSP" / "our team" wording fallbacks — VERIFIED SAFE, no change
An external progressor can only ever see their own files (business access scope),
and those always carry their business name, so they never hit the "Managed by TSP"
/ "Our team" fallback. Those words only appear on genuine TSP files, where they're
correct and must stay. Changing the TSP-file fallback would alter TSP's own view,
which must not change. Verified safe; no code change.
