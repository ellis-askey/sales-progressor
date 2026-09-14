# Mortgage broker card — SPEC

Status: design agreed with founder 2026-08-21. Artifact pending approval before build.
One concern: a client-facing mortgage-broker referral surface on the buyer portal.

## Goal

Give mortgage buyers a portal card that connects them to a mortgage broker — the
agent's own broker where one exists (so the agent keeps their referral), otherwise
the Sales Progressor default broker on outsourced files (so TSP monetises files the
agency hasn't). Cash buyers never see it. The card is dismissable.

## Who sees the card

Purchaser portal only, and only when ALL of:

- `transaction.purchaseType === "mortgage"` (cash_buyer / cash_from_proceeds excluded —
  they already auto-NR PM5/PM6/PM11, see lib/milestone-auto-nr.ts).
- Solicitor instructed (PM1 done) and `PM5` (full mortgage application submitted) NOT done.
- Not exchanged, not completed.
- A broker resolves (see hierarchy).
- The card key is not in the buyer's `overviewLayout.hidden`.
- No purchaser on the file has `brokerCallbackRequestedAt` set (per-FILE requested state —
  once one joint buyer requests, the card hides for the co-buyer too).

## Broker resolution hierarchy (server-side, portal page)

1. File has `brokerFirmId` + `brokerContactId` → **agent source** (any file, self-managed or outsourced).
2. Else, file is outsourced (`serviceType !== "self_managed"`) → `ProviderFirm` where
   `kind = mortgage_broker AND tspDefault = true` → **TSP source**.
3. Else → no card (self-managed with no agent broker shows nothing).

## Interaction

Card (prompt state) → tap → **request-callback drawer**, pre-filled from the contact
(name, email, phone) and their `portalSettings` (contact method / window / WhatsApp opt-in).
One button: "Request a call back". On submit → toast "The broker will be in touch" → card
switches to the acknowledgment state ("Requested — the broker will be in touch").

### Routing on submit (differs by source)

- **Agent source:** email the assigned agent/negotiator ("your client {name} has asked your
  broker to call them back"). The agent follows up; the broker wins the business. Stamp
  `brokerCallbackRequestedAt` on the requesting contact. No QuoteRequest (no ProviderFirm to link).
- **TSP source:** create a `QuoteRequest` (kind `mortgage_broker`) so it lands in the Command
  Centre inbox at /command/providers/quotes; email the broker FROM `updates@thesalesprogressor.co.uk`,
  reply-to the buyer, **CC `updates@thesalesprogressor.co.uk`** (we sit on the thread like we do
  for provider quotes). Stamp `brokerCallbackRequestedAt`.

## Dismiss

Explicit X on the card writes the card key `"mortgage-broker"` into `Contact.overviewLayout.hidden`
via the existing `portalSaveOverviewLayout` path. Reversible from the "Customize overview" sheet.
Distinct from the requested state.

## Team-at-bottom (secondary surface)

Extend `getPortalTeam` with a broker slot, shown only when the referral is **confirmed**:

- **Agent's broker:** `purchaserBrokerReferral === true` AND broker firm/contact set.
- **TSP broker (outsourced):** a `QuoteRequest` (kind `mortgage_broker`) for this file is marked
  **won** in the Command Centre.

## Data model (staging migration first — Law 3)

1. `ProviderKind` enum: add `mortgage_broker` (was `surveyor` only).
2. `ProviderFirm.tspDefault Boolean @default(false)` — the "TSP Default" tick.
3. `Contact.brokerCallbackRequestedAt DateTime?` — buyer's callback request stamp.
4. Seed one `ProviderServiceType` for the broker (e.g. "Mortgage advice") so a broker
   QuoteRequest has a valid service type.

## Command Centre

Providers create/edit gains kind `mortgage_broker` + a "TSP Default" toggle (only meaningful
for broker-kind). The existing quotes inbox filters by `kind`, so broker requests appear there;
marking one **won** is what surfaces the broker in the buyer's Team.

## Agent-side gap being closed

Today a broker can only be attached at new-sale time or on relist; the live-file `BrokerSection`
only edits the fee and hides when no broker is set. This build adds a **"set broker" control on
the live file** (directors/negotiators; `sales_progressor` stays blocked from commercial fee data)
so agents can attach their broker to existing files and light up the card.

## Downwind / open risks

- **FCA / regulated.** A fee-bearing mortgage-broker recommendation is financial-promotion
  territory. No compliance handling exists today. Needs an FCA sanity check + disclosure wording
  before go-live. Add to docs/active/ELLIS_MANUAL_TODO.md.
- Joint buyers handled by the per-file requested state (decision: hide for co-buyer once requested).
- Buyers who already applied (PM5 done) never see it.

## Build order

1. Schema migration (staging) — enum + tspDefault + brokerCallbackRequestedAt + broker serviceType seed.
2. Command Centre — broker provider + TSP Default toggle.
3. Portal card + request-callback drawer + routing service.
4. Team-at-bottom slot.
5. Live-file broker attach control.
6. Compliance copy + manual TODO.

---

# Live behaviour (updated 2026-09-14) — broker card + providers card

This section is the living reference for how the two portal cards actually
behave in the shipped code. It supersedes the stage assumptions in the original
spec above where they differ (notably: the broker card is now **de-conflated**
from the providers card — see the note at the end).

The two cards are **independent** and live at **different points** in the
journey: the broker card is an early offer (instructed → lender valuation); the
providers card is later (after the survey is settled). A buyer usually sees them
at different times, not together.

## The broker card

### How a broker gets "resolved" (the offer)

- **Self-managed file:** only if the agency has set their own broker on the file. No fallback.
- **Outsourced file:** the agency's own broker if set, otherwise our TSP-default broker (if one is configured in Command Centre). Agency broker always wins over the default.
- **"Confirmed"** = the referral is done: agent ticks it (`purchaserBrokerReferral`, agency broker) or our default's mortgage-broker QuoteRequest is marked **won** (TSP). Confirmed → broker moves to Your team and the offer card stops.

### When the broker card shows, by stage

Assuming a broker is resolved, not confirmed, not dismissed:

| Stage | Broker card |
|---|---|
| Before solicitor instructed (PM1) | Hidden |
| **Instructed (PM1) → lender valuation booked (PM6)** | **Shows** |
| Valuation booked (PM6) onward | **Hidden — for good** |
| Exchanged / completed | Hidden |

Why PM6 is the cutoff: once the lender has booked its valuation the mortgage is
effectively secured and the offer follows shortly, so a "find a broker" prompt
past that point serves no purpose. (Founder call, 2026-09-14.)

Any time within that window: buyer taps it → "Request sent" acknowledgment; buyer taps the X → dismissed (stored in `overviewLayout.hidden`).

### Broker card by setup

**Self-managed files:**

| Broker setup | Broker card | Copy | In "Your team" | Buyer can add own? |
|---|---|---|---|---|
| No agency broker, buyer has none | Never | — | "Add your mortgage broker" | Yes |
| No agency broker, buyer added own | Never | — | Their broker + "Edit" | Already has |
| Agency broker set, not confirmed, buyer has none | Shows (early window) | "Speak to a mortgage broker · Recommended by [agency]" | "Add your mortgage broker" | Yes (even while card shows) |
| Agency broker set, not confirmed, buyer added own | Shows | "Compare mortgage deals" · Recommended by [agency] | Their broker + "Edit" | Already has |
| Agency broker set, referral confirmed | Hidden | — | Agency broker (confirmed) | No |

**Outsourced files** (assumes a TSP-default broker exists; if none, "no agency broker" rows behave like self-managed):

| Broker setup | Broker card | Copy | In "Your team" | Buyer can add own? |
|---|---|---|---|---|
| No agency broker, TSP default, not won, buyer has none | Shows | "Speak to a mortgage broker" (no "recommended by") | "Add your mortgage broker" | Yes |
| No agency broker, TSP default, buyer added own | Shows | "Compare mortgage deals" (our default) | Their broker + "Edit" | Already has |
| No agency broker, TSP default, quote won | Hidden | — | Our default broker (confirmed) | No |
| Agency broker set, not confirmed, buyer has none | Shows | "Speak to a mortgage broker · Recommended by [agency]" | "Add your mortgage broker" | Yes |
| Agency broker set, not confirmed, buyer added own | Shows | "Compare mortgage deals" · Recommended by [agency] | Their broker + "Edit" | Already has |
| Agency broker set, referral confirmed | Hidden | — | Agency broker (confirmed) | No |

## The providers card ("Need anything else?")

A re-entry into the `/quote` marketplace for **local trades** (surveyors,
structural engineers, future kinds). Buyer-only. Any purchase type (mortgage and
cash). It never contains the broker.

**Rule:** once the survey is **booked** (PM9 complete or a surveyor firm name is
on the file) **or** the buyer **opts out** of a survey (PM9 not-required), show
*"Need anything else?"* **if** a local surveyor/structural firm covers the
postcode. Hidden before the survey is settled (the "Get a survey quote" card is
showing instead), hidden if nothing local covers the area, hidden after
exchange, and the buyer can hide it via Customize overview.

Copy: always titled *"Need anything else?"*; the sub-line lists only the local
trades that actually cover the area ("Surveys and more…", "Surveys, structural
reports and more…").

## Scenarios (both cards, all eventualities)

The providers card follows the rule above in every scenario; only the broker
card changes with setup.

1. **Self-managed, agency has not set a broker.** Broker card: never. Team shows "Add your mortgage broker"; buyer can add their own anytime. Providers: per rule.
2. **Self-managed, agency set their own broker.** Broker card (early): "Speak to a mortgage broker · Recommended by [agency]". Buyer adds own → "Compare mortgage deals". Agent confirms → card gone, broker in team. Valuation → gone. Providers: per rule.
3. **Outsourced, agency has not set a broker (our default).** Broker card (early): "Speak to a mortgage broker" (no recommended-by). Buyer adds own → "Compare". Quote won → card gone, our broker in team. Valuation → gone. Providers: per rule. Caveat: no TSP default configured → behaves like scenario 1.
4. **Outsourced, agency set their own broker.** As scenario 2 (agency broker wins over the default). Providers: per rule.
5. **Uncovered postcode.** Broker card: unaffected (behaves per 1–4). Providers card: never shows (nothing local).
6. **Cash buyer.** Broker card: never (mortgage-only), and no "Add your mortgage broker" prompt. Providers card: still applies per rule.

## De-conflation note (2026-09-14)

The broker card previously reappeared late by riding inside the providers-card
slot in uncovered postcodes. That gave the broker offer a postcode dependency it
should not have. The two are now fully separate: the providers card is
local-trades only; the broker card is its own early-window offer with no postcode
dependency. Brokers still appear in the `/quote` marketplace page (unchanged), so
that route is preserved. If a late "compare your rate" broker nudge for everyone
is wanted later, it's a clean addition to the broker card's own gating.
