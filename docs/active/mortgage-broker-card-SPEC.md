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
