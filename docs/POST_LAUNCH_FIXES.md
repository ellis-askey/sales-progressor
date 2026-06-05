# Post-Launch Fix Log

---

## OPEN FOLLOW-UPS (filed during the demo system build, 2026-06-05)



### Gate `/agent/polish/*` and `/agent/audit/*` from production agents
Both subtrees ship live and are agent-reachable through the middleware allow-list ([middleware.ts:161](middleware.ts#L161) permits the whole `/agent` prefix). `/agent/polish/*` contains 12+ design previews (transaction-detail, hub, work-queue, transaction-list, new-sale-v2, comms, analytics, claim-flow, completions, to-do, chain-bottleneck-demo, chain-walkthrough, predicted-exchange-demo, slowness-demo, staleness-demo) and `/agent/audit/*` carries three designer audit galleries (before-after, icons, overlays). PAGE_LIST.md does not mention either. Surfaced in [docs/DEMO_FEATURE_INVENTORY.md](docs/DEMO_FEATURE_INVENTORY.md) Docs gaps section.
**Suggested options:** (a) move both subtrees under `/agent/system-preview/*` to keep them out of the agent-prefix net; (b) add an explicit middleware deny-list for `/agent/polish` and `/agent/audit` that 404s for non-internal roles; (c) feature-flag them on `process.env.NEXT_PUBLIC_SHOW_DEV_PAGES==="true"` and unset in production. Decision deferred — not blocking the demo.

### Confirm nothing links to bare `/agent/settings`
The file `app/agent/settings/page.tsx` no longer exists; [next.config.ts:33-36](next.config.ts#L33-L36) issues a 301 redirect `/agent/settings → /agent/account/profile`. So any stale link still resolves cleanly — but PAGE_LIST.md still lists "Settings" as position 13 and the path may appear in marketing emails, retention emails, or old chase templates. Grep email templates + retention copy for `/agent/settings` and either update the link to `/agent/account/profile` or document that the redirect is permanent and the link is safe.

---

## LOGGED BUNDLED CHANGES (billing-logic changes that didn't get their own commit)

Going forward, billing-logic changes get their own commits — never folded into a UI/migration commit — so they stay independently revertable once payments are live. The entries below predate that rule and are logged here for traceability.

### 2026-05-25 — /agent/billing cutover surfaced post-Stage-5 (Stage 6 bundle)
**The miss:** Stage 5 of the Account-area arc retired /agent/settings but left the analogous V1 /agent/billing hub serving. The user noticed the symptom while walking the staging build — the "Billing" entry in the AgentShell user-dropdown was still landing on the legacy V1 glass-card hub instead of the v2 /agent/account/billing surface.
**The gap:** Six runtime references to /agent/billing, not just the dropdown. Every "do something with payment" path in the app was still funneling into the V1 hub. The dropdown was the most visible offender; the rest were quieter (Stripe SetupIntent return URL, two PaymentBlockBanner CTAs, PaymentMethodNudge CTA, BillingNegotiatorModal post-promotion reload).
**The fix (bundled in Stage 6):** Single atomic commit, mirrors the Stage 5 pattern.
- All 6 runtime refs repointed to /agent/account/billing (with #payment-method anchor where applicable):
  - components/layout/AgentShell.tsx — director dropdown Billing entry
  - components/billing/BillingNegotiatorModal.tsx — post-promotion window.location.href reload
  - components/billing/CardCaptureForm.tsx — Stripe SetupIntent return_url
  - components/billing/PaymentBlockBanner.tsx — blocked-state CTA
  - components/billing/PaymentBlockBanner.tsx — warning-state CTA (also normalised from /agent/billing/payment-method to the anchor form)
  - components/billing/PaymentMethodNudge.tsx — trial-end nudge CTA
- next.config.ts gains a 302 redirect /agent/billing → /agent/account/billing (exact source — does NOT cascade to /agent/billing/payment-method).
- app/agent/billing/payment-method/page.tsx retargeted to redirect directly to /agent/account/billing#payment-method (single hop, not chained).
- AgentShell dropdown label renamed Settings → Account (desktop + mobile-sidebar bottom) at the user's direction — "Settings" was narrower than what's inside the area now.
- V1 page file (app/agent/billing/page.tsx) kept as rollback reference, same posture as the Stage 5 settings file.
**Why bundled with the dropdown UX change rather than its own commit:** the user noticed the symptom AND wanted the dropdown redesign at the same time; doing two commits would have meant the dropdown commit pointing the new label at the old hub for a few minutes, then a follow-up cutover. Bundling kept the cutover atomic. This entry exists so the bundle is traceable.
**Why it's revertable in isolation despite the bundle:** the 6 repoints are simple href / window.location.href / return_url string changes. Each can be reverted to its /agent/billing form individually. The next.config redirect can be removed in one line. The dropdown label rename is a one-string edit (Account ↔ Settings).

---

### 2026-05-25 — Building-invoice Subtotal display changed from ex-VAT to gross-before-credits (commit `9e5b5b1`)
**Bundled with:** Stage 2 of the Account-area arc (Profile tab migration) — not its own commit.
**The bug:** After the prior VAT sweep stripped the VAT row, the totals block read `Subtotal £848.34 / Credits −£350 / Total £668` on the Hartwell polish preview. The eye reads £848.34 − £350 = £498.34 ≠ £668. Production unaffected (no VAT-on agencies), but real for any VAT-on agency that ever has credits.
**Root cause:** `running-total.ts` computes `subtotalPence` as the ex-VAT split (£1018 ÷ 1.20 = £848.34) for VAT-on agencies. The VAT row that used to bridge ex-VAT → gross was removed, but the renderers kept reading the (now-stale-for-display) ex-VAT field.
**Fix:** Three renderers compute the displayed Subtotal as `totalPence + creditsAppliedPence` instead of reading `props.subtotalPence` / `input.subtotalPence`. The dormant data-layer field stays untouched.
- [lib/billing/invoice-pdf.ts](lib/billing/invoice-pdf.ts) — `drawTotals`
- [components/billing/v2/BuildingInvoiceHero.tsx](components/billing/v2/BuildingInvoiceHero.tsx)
- [components/billing/hub/BuildingInvoice.tsx](components/billing/hub/BuildingInvoice.tsx) — still in use by legacy `/agent/billing` until Stage 4
**Worked examples post-fix:**
- **Hartwell preview (VAT-on, 5 lines + £350 credit):** Subtotal £1018.00, Credits −£350.00, **Total £668.00** ✓
- **VAT-off agency, no credits:** Subtotal row hidden (only renders when `creditsAppliedPence > 0`), **Total £X.XX** ✓
- **VAT-off agency, £59 + £59 + £100 credit:** Subtotal £118.00, Credits −£100.00, **Total £18.00** ✓
- **VAT-on agency, no credits:** Subtotal row hidden, **Total = sum of gross fees** ✓
**Why it's revertable in isolation despite the bundle:** the three renderer edits are pure display-layer changes inside `drawTotals` / the totals JSX. They can be reverted by restoring the three `fmt(props.subtotalPence)` lines without touching anything else in commit `9e5b5b1`.

---

## STANDING ODDITIES (not bugs — known divergences to track)

### Prod DB is ahead of prod code (as of 2026-05-23)
The production database has the `20260524_grammar_voice_fixes_b8` and `20260523140000_automation_controls` migrations applied, but the master branch (= prod code) does NOT reference any of the new columns yet. This came from the env trap: `.env` had prod URLs and `prisma migrate deploy` silently targeted prod for both migrations. Fixed the env trap on 2026-05-23 (see entry below) — but the prod schema is now ahead of prod code until staging code promotes to master.

**Why it's safe in the meantime:**
- The new columns (`Agency.chaseEmailsEnabled`, `PropertyTransaction.clientEmailsPaused`, etc.) all have non-null defaults — existing reads/writes from master code are unaffected.
- The client-chase cron isn't deployed on prod (returns 404), so the "fallbackKind = client_emails_paused" logic isn't running anywhere that could touch prod data.

**When staging promotes to master:** nobody should be surprised that the columns are already there. `prisma migrate status` against prod will simply show "Database schema is up to date".

---

## FIXED

### B-ENV — Prisma CLI silently targeted prod instead of staging
**Symptom:** Two migrations in May 2026 (`20260524_grammar_voice_fixes_b8` and `20260523140000_automation_controls`) were applied to PRODUCTION when "staging-first" had been claimed.
**Root cause:** Prisma CLI reads `.env` (not `.env.local`), and `.env` had prod DATABASE_URL + DIRECT_URL. Every `npx prisma migrate deploy` resolved to prod by default. Compounded by shell env vars also set to prod URLs in the dev terminal.
**Fix (2026-05-23):**
- `.env` now points at **staging** by default. Prod URLs moved to `.env.production` (already gitignored).
- New npm scripts: `db:migrate:status:staging`, `db:migrate:staging`, `db:migrate:status:prod`, `db:migrate:prod`. All use `dotenv-cli --override` to defeat shell-env precedence.
- `db:migrate:prod` runs `scripts/migrate-prod.mjs` which: (a) validates `.env.production` project ID against the expected prod ID (hard abort otherwise), (b) prints the resolved DATABASE_URL with masked password, (c) requires an interactive `"yes"` before exec'ing `prisma migrate deploy`.
- Verified parity: both DBs at 60 migrations, "Database schema is up to date!" on 2026-05-23.

---

## FIXED

### B1 — Duplicate transaction on submit
**Symptom:** Clicking Create Transaction did nothing visibly, so clicking again created a duplicate.
**Root cause:** React state updates are asynchronous — the button wasn't re-rendering as disabled fast enough to block a rapid double-click.
**Fix:** Added a `useRef` guard in `NewTransactionForm.tsx` that blocks any second submission before the first resolves. On failure, the ref resets so the user can try again.

### B2 — Exchange target mismatch (dashboard 70 days vs file 12 weeks)
**Symptom:** Dashboard exchange forecast showed ~10 weeks; property file correctly showed 12 weeks.
**Root cause:** `createTransaction()` was setting `expectedExchangeDate` to +70 days (10 weeks). The dashboard reads this field. The sidebar reads `twelveWeekTarget` which was already correct at +84 days.
**Fix:** Changed the auto-set exchange date from +70 to +84 days in `lib/services/transactions.ts`. Both the dashboard and the file now agree on 12 weeks.

### B3 — "File may be behind schedule" shown on brand new files
**Symptom:** Opening a transaction created minutes ago showed the amber warning banner.
**Root cause:** `FileHealthBanner` received `onTrack={progress.onTrack === "on_track"}`. For a new file with no milestones completed, `onTrack` is `"unknown"`, which evaluates to `false`, triggering the banner.
**Fix:** `FileHealthBanner` now accepts the full `onTrack` string value. The banner only shows when onTrack is explicitly `"at_risk"` or `"off_track"` — not when it's `"unknown"`.

### B4 — Reminder logs not created on file creation (silent crash)
**Symptom:** Reminders tab empty on new files; tasks never appeared.
**Root cause:** `autoSetNotRequired()` was building a `communicationRecord` audit entry with `createdById: ""` (empty string) when the transaction had no `assignedUserId`. This caused a Prisma foreign-key constraint error that silently killed the entire `createTransaction` call — meaning reminder evaluation never ran.
**Fix:** `autoSetNotRequired` now skips the audit log if there's no valid `assignedUserId`, instead of passing an empty string. The reminder engine error is now also console-logged rather than swallowed silently.

### B5 (partial) — Predicted exchange date not recalibrating in week 1
**Symptom:** Completing milestones on the day of creation or within the first few days didn't update the predicted exchange date.
**Root cause:** The velocity calculation required `weeksElapsed > 0` (i.e., a full 7-day week). Anything completed in the first 6 days produced `weeksElapsed = 0` and fell back to the 12-week default.
**Fix:** Velocity now kicks in after 1 day (not 7). If 1+ day has elapsed and progress > 0%, the predicted date is extrapolated from actual pace.

### B6 — Admin side always shows "self-managed" regardless of actual `progressedBy` value
**Symptom:** The service type badge in the agent card always showed "Self-managed" even for outsourced files.
**Root cause:** `createTransaction()` never set `serviceType` — it relied on the Prisma schema default which is `self_managed`.
**Fix:** `createTransaction()` in `lib/services/transactions.ts` now sets `serviceType` based on `progressedBy`: agent → `self_managed`, progressor → `outsourced`.

### B8 — Can't edit contact cards on the property file overview
**Symptom:** Contacts could only be added or removed, not edited.
**Fix:** Added a PATCH endpoint to `app/api/contacts/route.ts` (agency-scoped). Added inline Edit form to `ContactsSection.tsx` — clicking Edit on a contact shows name/phone/email fields in place; saves normalise phone to +44 and title-case the name.

### U2 — Completion date field editable before exchange is confirmed
**Symptom:** The sidebar showed an Edit button for completion date even on active pre-exchange files.
**Fix:** `TransactionSidebar` now accepts an `exchangeConfirmed` prop (computed from VM12/PM16 milestone state in the page). The Edit button and input are hidden until exchange is confirmed; a "Set once exchange is confirmed" hint is shown instead.

### U3 — No prompt for completion date when exchange milestone confirmed
**Symptom:** Completing the "Exchanged" milestone (VM12/PM16) gave no opportunity to record the completion date.
**Fix:** After a successful VM12 or PM16 confirmation in `MilestoneRow.tsx`, a modal prompts for completion date. The date is saved via the existing `/api/transactions/price` endpoint. The user can skip if the date isn't known yet.

### M1 — "Unassigned" shown but no UI to assign a file to a user
**Symptom:** Files showed "Unassigned" in the meta strip with no way to change it.
**Fix:** Added `AssignControl` component to the Assigned-to field. Clicking "Assign" or "Change" opens a dropdown fetching progressors from the new `/api/agency/users` endpoint, then PATCHes the transaction. The PATCH endpoint in `app/api/transactions/[id]/route.ts` now accepts `assignedUserId`.

### M3 — "Our fee" on agent view has no input field for agent fee
**Symptom:** Agent fee could be stored in the DB but there was no UI to set it from the sidebar.
**Fix:** Added an edit form in `TransactionSidebar.tsx` that lets users set agent fee as either a fixed £ amount or a percentage, plus VAT-inclusive/exclusive toggle. Saves via the existing `/api/transactions/price` endpoint.

### M4 — Agent can submit a file with no vendor/purchaser/solicitor details
**Symptom:** The "Send to progressor" flow had no minimum field requirement.
**Fix:** When an agent selects "Send to progressor", the submit button stays disabled until at least one vendor name and one purchaser name are filled in. The hint text explains what's missing.

### M6 — Agent side needs a proper left sidebar
**Symptom:** Agent area used a simple top header/horizontal nav — inconsistent with the progressor's left sidebar layout.
**Fix:** Created `AgentShell` client component in `components/layout/AgentShell.tsx` with a left sidebar matching the progressor layout style. Nav items: My Files, Completions, Analytics, Updates, New File. `app/agent/layout.tsx` now uses `AgentShell`.

### D1 — Internal notes exist in two places (Overview tab + Comms internal notes)
**Symptom:** Notes added on the Overview tab were invisible in the Comms/Activity tab, and vice versa.
**Root cause:** Overview tab wrote to `TransactionNote` model; Comms tab wrote to `CommunicationRecord` with `type: "internal_note"`.
**Fix:** `TransactionNotes.tsx` now reads from and writes to `CommunicationRecord` (via `/api/comms`). The page extracts `internal_note` entries from `activityEntries` and passes them to the component. Both tabs now show the same data.

### U4/U5 — Names and phone numbers not normalised
**Symptom:** Contact names could be entered in any case; phone numbers stored as-typed without +44 prefix.
**Fix:** `NewTransactionForm.tsx` applies `titleCase()` to vendor/purchaser names and `normalizePhone()` (07xxx → +447xxx) to phone numbers at submission. `ContactsSection.tsx` applies the same normalization when editing a contact. `normalizePhone()` added to `lib/utils.ts`.

---

## REMAINING / DEFERRED

### Polish — agent-btn press-down (Task 5 audit, deferred from transaction-detail polish pass)
One button in inventory-touched components still uses raw `bg-blue-500` instead of `agent-btn-color-primary`. No press-down state (`:active` transform). Fix is mechanical — swap class, verify color is acceptable (coral vs blue is a visual decision):
- `components/todos/AddManualTaskForm.tsx:184` — Add task submit button

(CommsEntry.tsx Continue/Save buttons fixed in Commit 6 — entries above removed.)

### Polish — agent-reveal-out exit animation (two component sites, five call sites)
`agent-reveal-out` requires the element to remain mounted during its exit animation, then be removed via an `onAnimationEnd` callback. Pure conditional-render components cannot use it as a className-only addition. Deferred from Stage 4.

**Call sites:**
- `components/milestones/MilestoneRow.tsx` — counterpart notice dismiss, event-date form cancel, N/R reason form cancel (3 sites)
- `components/transaction/EditSaleDetailsDrawer.tsx` — PropSaveStage delta preview, Save/Cancel conditional div (2 sites)

**Fix:** Apply the two-step pattern per `ANIMATION_STANDARDS.md §3` at each site: keep element mounted, add `agent-reveal-out` class on exit trigger, remove from DOM in `onAnimationEnd`. Standalone follow-up commit. Low priority.

### AgentRequestsPanel — render path removed, awaiting `/agent/to-do` redesign (2026-05-12)

**Context.** During the `/agent/dashboard` → `/agent/transactions` merge, the requests panel was removed from the dashboard render tree. The dashboard was the only surface rendering it, so the panel is currently not visible to any user.

**State of the code:**
- `components/agent/AgentRequestsPanel.tsx` — **file preserved in codebase, only render path removed.** Component still imports cleanly and remains a valid React component; it simply has no caller.
- Write paths still functional. `AgentFlagButton` (now in the transaction-list PageHeader and on every transaction-detail page) and `AddManualTaskForm` continue creating `ManualTask{ isAgentRequest: true }` rows. The data keeps accumulating in production with no visible reader.
- DB snapshot column (row count of `ManualTask` rows where `isAgentRequest = true`) left blank — Ellis to fill in post-merge if a paper trail is wanted before the future redesign.

**Future home.** The `/agent/to-do` two-column redesign brief (pending, owned by Ellis) is where these rows surface again. The redesign should pick up the existing component as-is or rebuild against the same data contract — both options remain open because the file is preserved.

**No urgency.** This is a deliberate parking of a feature, not a bug. The data integrity is intact; only the UI affordance is paused.

### Token system — `--agent-info-rgb` missing in all themes (2026-05-17)
The `--agent-info` family header comment in `app/agent/styles/themes.css` listed `--agent-info`, `--agent-info-bg`, `--agent-info-border` but omitted `--agent-info-rgb`. The value was never defined in any theme block (light or night), meaning any `rgba(var(--agent-info-rgb), X)` usage would fail silently. Discovered during to-do polish Stage 2. Fixed in the same commit: added `--agent-info-rgb: 61, 122, 184;` to all 6 light theme rgb blocks and `--agent-info-rgb: 96, 165, 250;` to the night base block; also added `--agent-info-bg` and `--agent-info-border` to night (previously only `--agent-info` existed there). **Follow-up audit:** check other `--*-rgb` tokens listed in family header comments to confirm all are actually defined in every theme block.

### Data consistency
- **D2** — Self-managed files appear in main pipeline analytics. Should be fully separated. (Requires analytics query audit — lower priority.)

### Missing features / UX
- **M2** — Hold / withdraw flow is already implemented in `StatusControl` — it's a discoverability issue only. Consider adding a hint or surfacing it more prominently.
- **U1** — Clicking milestones rapidly fires multiple pop-ups. Lower priority; milestone `loading` state already guards within a single row.
- **M5** — Upload memo of sale with auto-populate. Complex feature, lowest priority.

### Duplicate UK phone formatters — consolidation required

`lib/utils.ts::normalizePhone()` and `lib/utils/address.ts::formatUKPhone()` implement similar UK phone formatting with different output formats. The first produces E.164 (`+44xxxxxxxxxx`, no spaces) for mobiles; the second produces space-separated (`+44 xxxx xxxxxx`). Both are actively imported by different callers, so the same phone number can render in two different formats depending on the page.

Consolidate into a single formatter. Agree on canonical output format (likely the space-separated human-readable format for display, with a separate `parseUKPhone` helper for storage normalisation if needed). Update all callers.

Surfaced during local-vs-production drift audit on 2026-05-15.

### C1 — completeMilestone server action: defensive Prisma `connect` syntax
`completeMilestone` (and related milestone actions) set `completedById: input.completedById` directly. If the user ID from the JWT doesn't exist in the connected database (stale session after a DB re-seed or env switch), the FK constraint fires as a raw Prisma error with an opaque constraint name (`MilestoneCompletion_completedById_fkey`), not a readable message.

**Fix:** Change `completedById: input.completedById` to the Prisma `connect` syntax:
```typescript
completedBy: input.completedById
  ? { connect: { id: input.completedById } }
  : undefined,
```
Prisma will throw a typed `P2025 Record not found` error rather than a raw FK violation, making stale-session failures debuggable without a DB query.

**Affects:** `lib/services/` — verify exact file path before applying (likely `milestone-service.ts` or inline in `app/actions/milestones.ts`).
**No urgency.** The user-facing fix is Option A (clear cookies, re-login). This is an observability improvement only.

### C2 — isSolid + night-mode tablet overlap (768–1024px)

`useSolidMode` activates the `SolidModeToggle` at `≥768px` (the toggle is `hidden md:block`). Night mode activates via `@media (max-width: 1024px)`. These two ranges overlap at 768–1024px: a user on a large tablet can have solid mode ON while night mode CSS is also applied, resulting in white-background components receiving night-mode variable overrides (dark text tokens on a white surface — generally legible but not designed for this combination).

**Scope:** Pre-existing at time of Commit D (2026-05-16). All `isSolid` glass branches in new-v2 carry an inline comment documenting this. Not fixed because solid mode at the tablet breakpoint is itself a low-traffic edge case.

**Fix when addressed:** Scope `useSolidMode` to `≥1024px` only (remove the 768–1024px overlap), or add a third CSS selector branch for `isSolid+night`. Whichever is chosen, remove the inline comments.

### C3 — new-v2 box shadows not night-mode-aware (Category E, deferred)

Several components in `components/transactions-v2/` use `box-shadow` values with dark rgba (`rgba(15,23,42,...)`) hardcoded. On a dark background these appear as dark-on-dark and render invisible. Examples: `HeroCard` box shadow, `DraftPanel` box shadow.

**Deferred reason:** Box shadows on glassmorphic surfaces are a visual-polish concern only. Dark-on-dark shadows are simply invisible (not wrong), so the UI is usable. The correct fix is a Category E token (`--nv2-shadow-*`) that inverts to a glowing-outward shadow in night mode. Deferred until the new-v2 form ships and night-mode fidelity becomes a priority.

### Polish — "Updates" → "Activity" page rename (comms page, deferred 2026-05-17)

The `/agent/comms` page is titled "Updates" (matching the AgentShell sidebar nav label at `AgentShell.tsx:44`). "Activity" is more precise — the feed shows completed steps only, not general updates. Rename deferred because it requires a simultaneous change to the sidebar nav label; touching AgentShell is outside the comms polish pass scope.

**Fix when addressed:** Change `PageHeader title` in `app/agent/comms/page.tsx` from `"Updates"` to `"Activity"`, and update `{ href: "/agent/comms", label: "Updates" }` → `label: "Activity"` in `components/layout/AgentShell.tsx`. Two-line change.

### Polish — VOICE_GUIDELINES.md translation table: context-specific sales_progressor mapping

During completions Stage 3 voice pass (2026-05-17), `sales_progressor` in a card-meta context was rendered as "Handled by: [name]" rather than the table's current "Progressor / Our team". The table entry is context-dependent but doesn't document the card-label variant.

**Fix when addressed:** Add a second row (or sub-note) to the `sales_progressor` translation table entry in `docs/polish-pass/VOICE_GUIDELINES.md`: `sales_progressor (with name on a card)` → `"Handled by [name]"`. Deferred until two or more additional pages surface a similar context-specific pattern — abstract once there's enough surface to nail the wording.

---

### Polish — Analytics "All-time" referral section headings under period filter (theoretical)

Two sections — "Referral income · Conveyancers" and "Referral income · Brokers" — display all-time totals regardless of which period tab is active. Their headings say "All-time solicitor referral fees by firm" and "All-time mortgage broker referral fees" which is accurate but potentially confusing when the user is looking at "This week" data everywhere else on the page.

Classified **theoretical** — no user has flagged this as confusing. No copy change warranted until confirmed real.

**Fix if confirmed real:** Change headings to include an explicit scope annotation, e.g. "Referral income · Conveyancers — all time" or add a parenthetical "(lifetime total, not filtered by period)". Two-character copy change per heading, no structural shift.

---

### Bug — manual comms inherit wrong channel/purpose/status defaults for inbound entries

**File:** [lib/services/comms.ts:140-194](../lib/services/comms.ts#L140-L194) (`createCommunicationRecord`)

**Symptom:** Every manually-logged inbound comm (Inbound (received) toggle in CommsEntry) currently writes the wrong values for three fields because `createCommunicationRecord` doesn't set them explicitly — it inherits the schema defaults on [`prisma/schema.prisma:539-541`](../prisma/schema.prisma#L539-L541):
- `channel: "email"` — wrong when method is whatsapp / sms / phone
- `purpose: "chase"` — wrong for an incoming reply (it's not a chase, it's an inbound)
- `status: "sent"` — semantically wrong for inbound (it was received, not sent)

**Data impact:** Every manually-logged inbound row in the DB today is mislabeled on those three fields. Any analytics or reporting that filters on `status`, `channel`, or `purpose` for inbound entries is reading wrong data. No user-facing impact today because no UI reads those fields for inbound rows (`method` is the canonical filter and that's set correctly) — but if/when reports come to depend on them, every existing inbound row is junk.

**Why this came to light:** Building the WhatsApp chat bulk-import feature (2026-05-21) forced explicit per-direction field-setting; the bulk path uses `status: "delivered"` for inbound, `purpose: "other"` and `channel: "other"` for WhatsApp — done correctly. The same fix needs to apply to the single-comm path.

**Fix shape:** In `createCommunicationRecord`, set `channel`, `purpose`, and `status` explicitly based on `input.type` and `input.method` (mirroring the bulk-import logic in `importWhatsAppChat`):
- `channel`: derive from method — email/sms have matching values; whatsapp/phone/voicemail/post → `"other"`
- `purpose`: `"other"` for manual logs (not chase)
- `status`: `"sent"` if type=outbound, `"delivered"` if type=inbound, `"sent"` if type=internal_note

**One-time backfill (optional):** UPDATE OutboundMessage SET status='delivered' WHERE type='inbound' AND status='sent' — but only if anything ever starts reading the field. Until then, leaving the existing bad data is harmless.

---

### Polish — empty-state ghost convention (document as structural standard)

The polish pass has established a pattern across comms (Stage 2, 2026-05-17) and completions (Stage 2, applied by precedent) but it isn't written down anywhere.

**Convention:** Empty-state ghosts use abstract `.agent-skeleton` bars in the same structural shape as a real entry group — no fake addresses, no fake copy, no hardcoded hex colours. Opacity 0.3–0.4, `pointerEvents: "none"`. The ghost conveys "content will live here" without inventing real-looking fake data.

**Fix when addressed:** Write up as an explicit standard — either a new `§6` in `docs/polish-pass/ANIMATION_STANDARDS.md` or a new `docs/polish-pass/STRUCTURAL_STANDARDS.md` for non-animation conventions. Wait for at least one more page to apply the pattern before abstracting (three instances gives enough surface to nail the wording). Until then the precedent lives in the comms and completions ghost blocks.
