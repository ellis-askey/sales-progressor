# Mortgage Advisor Portal — scope

Status: **design agreed, awaiting build approval** (2026-10-09)
Owner: Ellis
Pattern source: the solicitor portal (`app/s/[token]`, `lib/solicitor-confirm/*`)

---

## What we're building

A login-free portal for a buyer's (and seller's onward) mortgage advisor, modelled on the
solicitor portal. The advisor opens a signed link, sees where the sale is up to, confirms the
mortgage steps, and gets updates (incl. a real unread bell). We can chase advisors on an
on/off toggle, independently of the solicitor chase.

This is ~70% reuse. The broker directory, agency-vs-file model, mortgage milestones, and the
offer-expiry tracker already exist. The solicitor portal is the template for token, portal
shell, confirm actions, chase engine and settings.

---

## Decisions (agreed with Ellis, 2026-10-09)

1. **Updates surface:** token portal **plus a new visitor bell** (first token-based unread
   bell — net-new; the solicitor portal deliberately shipped without one).
2. **Who gets a portal:** the **agency's own brokers only** (`BrokerContact` directory). The
   TSP referral/marketplace broker keeps the existing call-back + quote flow, out of scope here.
3. **Confirmable steps:** advisor confirms **PM5, PM6, PM11**. The solicitor flow is left
   exactly as-is — **both** advisor and solicitor are chased for PM11; whoever confirms the
   shared step first completes it and the other's chase stops. Neither party is aware of the other.
4. **Sides:** **buyer + seller-onward advisor** (two-sided), scoped like solicitors —
   `broker*` fields for the buyer, `onwardBroker*` for the seller's onward purchase.

---

## "Recommended branch advisor" vs "added to this file"

Not two systems — one mechanism, already built (mirrors solicitors):

- **Recommended (branch):** `AgencyPreferredBroker` — one saved default per agency, configured
  at `/agent/partners`, auto-attached to new mortgage files.
- **Added to this file:** the per-file `brokerContactId` / `onwardBrokerContactId` on the sale.

Both draw from one shared `BrokerFirm` / `BrokerContact` directory. The portal, chases and
confirmations all key off "does this file have a broker contact on this side" — regardless of
how it got there. "Recommended" is just a convenience default.

**Behaviour change to note:** today an agency's broker is NOT emailed (the agent is emailed
instead). The portal emails the advisor directly. `BrokerContact.email` already exists, so this
is a behaviour change, not a schema one.

---

## What the portal shows (all data already available)

- **Sale progress / readiness %** — the milestone-weighted figure (`sidePercent`,
  `lib/services/milestones.ts`), same number the client portal shows.
- **EPC** — live lookup by address (`lib/services/property-enrichment.ts`), read-only.
- **Mortgage milestones** — PM5 application → PM6 valuation → PM11 offer, with confirm buttons.
- **Mortgage-offer expiry** — the existing 6-month tracker (`ClientMoveInfo.mortgageOfferExpiry`,
  auto-set on PM11).
- **Survey booked** — surfaced when PM9 is confirmed (hook: `maybeSendBookingDiaryEmail`).
- Point-of-contact card, key dates, chain shape — reused from the solicitor portal.

---

## Reuse vs new

**Reuse directly**
- Token scheme — copy `lib/solicitor-confirm/token.ts` → `lib/advisor-confirm/token.ts`
  (HMAC, `{transactionId, side}`, 30-day expiry, reissued per email). `side` = `purchaser`
  (buyer's own mortgage) or `vendor` (seller's onward purchase).
- Portal shell, hero, cards, appearance/menu, updates feed, QR/stop/avatar routes.
- Chase engine shape — `findDue…` → digest → state bump → escalation (copy
  `lib/solicitor-confirm/chase.ts`), working-day cadence, per-code rules, `ChaseEmailOverride`
  (new `targetKey` `advisor:purchaser` / `advisor:vendor`).
- Settings recipe — agency boolean → director-gated setter in `app/actions/automation.ts` →
  toggle on `app/agent/settings/automation/page.tsx` → flag in the `findDue` `where`.
- Broker identity + picker — `BrokerFirm` / `BrokerContact` / `AgencyPreferredBroker` +
  `brokerContactId` / `onwardBrokerContactId`.
- Milestone write-back — `completeMilestone` chokepoint.

**Net-new**
- Advisor token + portal routes (`app/a/[token]`, two-sided).
- Advisor confirm actions + broker confirmer attribution on `MilestoneCompletion`.
- Advisor chase engine + cron (`app/api/cron/advisor-chase`) + `vercel.json` entry.
- `advisorChaseEnabled` flag on `Agency` (+ `ProgressionBusiness` mirror) + toggle.
- **Visitor bell** — a token-based unread notification surface (new, see below).
- Schema parity on the broker side (see below).

---

## Schema additions (migrations → staging first, Law 3)

- `BrokerContact`: `secondaryEmail` (CC), `image` (avatar), to reach `SolicitorContact` parity.
- `BrokerContactAgencyOverride` — per-agency CC override (copy `SolicitorContactAgencyOverride`).
- `PropertyTransaction`: per-side broker email-pause flags
  (`buyerBrokerEmailsPaused[/Until]`, `onwardBrokerEmailsPaused[/Until]`).
- `MilestoneCompletion`: broker confirmer attribution (`confirmedByBrokerFirmId`,
  `confirmedByBrokerContactId`), mirroring the solicitor columns.
- `AdvisorChaseState` — copy `SolicitorChaseState` (`@@unique [transactionId, side, milestoneCode]`).
- `Agency.advisorChaseEnabled` (+ `ProgressionBusiness.chaseAdvisorsEnabled`).
- **`BrokerNotification`** (new) — the visitor bell store, keyed `[transactionId, side]`
  (the token's scope): `type`, `payload Json`, `createdAt`, `readAt`. Not keyed to a `User`
  (advisors have no account), which is why the existing `Notification` table can't hold these.

Advisor-confirmable set: new `BROKER_CODES = {PM5, PM6, PM11}` (single set; buyer-side plus the
seller's onward purchase uses the same mortgage codes on the onward tracker). Solicitor code sets
are untouched.

---

## The visitor bell (the one genuinely new surface)

- `BrokerNotification` rows written when something advisor-relevant happens: **survey booked**
  (PM9 confirmed), a step the advisor owns is confirmed/updated, chase escalation, etc.
- New feed endpoint `GET /api/notifications/advisor?token=…` — token-authenticated, returns
  rows for that `{transactionId, side}`, unread = `readAt IS NULL`.
- A token-aware bell component in the advisor portal shell (the solicitor shell's "decision D:
  no bell" is replaced here). Read-state stamped on open.
- Survey hook: fire a `BrokerNotification` next to the existing `maybeSendBookingDiaryEmail`
  call sites (`app/actions/milestones.ts`, `lib/services/portal.ts`).

---

## Phased plan (one concern per PR, Law 5)

- **Phase 0 — schema parity.** All migrations above, staging first. No behaviour change yet.
- **Phase 1 — portal (read-only).** Advisor token + `app/a/[token]` shell + overview: readiness
  %, EPC, mortgage milestones (read-only), offer expiry, point of contact, key dates, chain.
  Two-sided tokens.
- **Phase 2 — confirmations.** Advisor confirm actions for PM5/PM6/PM11 + broker attribution,
  via `completeMilestone`. Solicitor flow untouched.
- **Phase 3 — chases + toggle.** Advisor chase engine + cron + `advisorChaseEnabled` toggle on
  Settings → Automation. Chases both advisor and solicitor for PM11 independently.
- **Phase 4 — visitor bell.** `BrokerNotification` + advisor feed endpoint + bell component +
  survey-booked hook.
- **Phase 5 — polish.** CC/secondary email, pause-emails toggle, QR/stop, appearance, digest
  copy voice-pass.

---

## Open questions / risks

- **Advisor email identity / sender.** Chases to the advisor send via
  `resolveAgencySenderForTransaction` (replyable agency sender), same as solicitor chases. Confirm
  that's the desired from/reply-to for advisor mail.
- **Two brokers, two shapes.** Agency brokers (`BrokerFirm`, no email/logo) vs TSP brokers
  (`ProviderFirm`, with email/logo) stay separate; the portal is agency-broker only, so no
  reconciliation needed in v1.
- **Per-file bell scope.** The token is per-file+side, so the bell shows that file's updates. An
  advisor on many files gets a link per file (same as solicitors). A cross-file advisor inbox
  would need logins — deferred.
- **PM9 on cash files.** Survey-booked notifications only matter on mortgage files; cash files
  auto-NR the mortgage steps, so the advisor portal won't attach there anyway.
