# Progressor Network — spec & build plan

**Status:** P0 shipped to staging branch (founder-gated, not pushed). P1–P4 planned below.
**Owner:** Ellis. **Last updated:** 2026-11-26.
**Surface:** Agent app, `/agent/progressor-network`, founder-gated via `lib/security/founder.ts`.

---

## 1. What this is

A marketplace where an estate agency's directors discover independent sales-progression
businesses and **connect** to one. Built first for **Boardwalk** to connect with
**Annalise**. Initially visible only to `ellis@thesalesprogressor.co.uk`.

### The shrinking insight (why this is smaller than it looks)

Once connected, it is **no different** from how external progression businesses connect
to agencies today. The marketplace is a **new front door** onto machinery that already
exists and ships:

- The agency↔business link is `ProgressionBusinessClient` (`prisma/schema.prisma:376`),
  a management-only join row (`feeModel`, soft-archive `removedAt`,
  `@@unique([progressionBusinessId, agencyId])`).
- The "join" handshake already exists: `ProgressionConnectionRequest`
  (`schema.prisma:440`) → on accept, `respondToConnectionRequest`
  (`lib/services/progression-clients.ts:224`) **upserts the link row**.
- **Access is never granted by the link.** A business only sees a sale when that sale is
  tagged `PropertyTransaction.progressionBusinessId` (`schema.prisma:766`), resolved by
  the `business` access scope (`lib/security/access-scope.ts`). The marketplace touches
  **none** of this — Law 7 stays clean.
- Monetization rides the existing per-sale rail: `lib/progression/business-billing.ts`
  (£59 base + £39/member + £5/sale, keyed on `PropertyTransaction.businessPerSaleChargedAt`),
  currently dark behind `PROGRESSION_BILLING_COLLECT`.

So the genuinely new work is three layers on top: a **public profile** per business, the
**discovery + connect UI**, and an **attribution flag** marking a connection as sourced
via the network (what we monetize).

---

## 2. The three open decisions (recommended defaults — confirm or redirect)

These are carried as **proposals** in the build. None is locked.

### 2.1 Direction & vocabulary of "connect"
Today the *business* requests the *agency* (`requestConnectAgency`). The marketplace
reverses it: the *agency* initiates toward the *business*.
**Proposal:** add an agency→business request reusing `ProgressionConnectionRequest`
(same table, opposite initiator). Vocabulary: agency sends a **connection request**
("Request to connect"), the business **accepts**, they are **connected**. ("Request
intro" implies a human broker; "invite" is backwards.)
**Alternative for v1:** because you control both sides of Boardwalk↔Annalise, the first
connection could be made directly from the Command Centre with no request/accept dance.
→ *Decision needed: agency-initiated request/accept, or founder-made direct connect for v1?*

### 2.2 Who authors the profile
Profile fields (bio, specialisms, regions, availability) **do not exist** on
`ProgressionBusiness` today — all net-new.
**Proposal:** founder curates Annalise's profile in the Command Centre for P1. Business
self-serve profile editing is a later phase (P4).
→ *Decision needed: confirm founder-curated for launch.*

### 2.3 Attribution → money
**Proposal:** add a provenance column (e.g. `source: "network"`) to the link row
**now**, but **defer billing**. It rides the existing dark per-sale rail, so recording it
early is free and bills when you flip the switch.
→ *Decision needed: is a per-connection/per-sale network fee the model, and when does it
switch on? (Not required to build P1/P2.)*

---

## 3. Card stats (what's real vs mock)

Mock card = Exchange rate %, Exchanged files (12mo), ~~Typical fee~~, Team size.

| Stat | Source |
|---|---|
| Exchange rate % | **Computable** — `lib/services/solicitor-metrics.ts` pattern re-scoped to `progressionBusinessId` (≥5-round guard) |
| Exchanged files (12mo) | **Computable** — count `exchangedAt >= now-12mo` |
| Team size | **Direct count** — `User.progressionBusinessId` members (`business-billing.ts:106`) |
| **Avg. time to exchange** (replaces Typical fee) | **Computable** — trend in `solicitor-metrics.ts`; fee is per-agency + confidential (`ProgressionBusinessClient.feeModel`), unfit for a public card |
| Specialism/region chips, availability, bio, logo | **Net-new** (P1 profile fields) |

Low-volume businesses return `null` for the computed metrics (under ~5 resolved sales) and
need a graceful "building track record" state; counts (team size, lifetime sales) have no
floor and are safe fallbacks.

---

## 4. Phases

### P0 — Discover page (SHIPPED, founder-gated) ✅
Built against a typed **mock** service in the production data shape (real seam, mocked
source — Law 13). Rendered inside the real agent chrome, gated to the founder.

**Files added:**
- `lib/services/progressor-network.ts` — types + `getProgressorNetwork(agencyId)`, mock catalogue of 6 businesses mirroring the approved mock.
- `lib/security/founder.ts` — `isFounderEmail()` gate (server-safe, reused by page + nav).
- `app/agent/progressor-network/page.tsx` — founder-gated server page.
- `components/agent/progressor-network/*` — `ProgressorNetwork` (orchestrator), `ProgressorCard`, `NetworkValueStrip`, `HowItWorksRail`, `ProgressorProfileDrawer`, `shared.ts`, `README.md`.
- `components/layout/AgentShell.tsx` — founder-gated nav item (secondary rail).

**Working now:** tabs (Discover / My progressors / Introductions / Saved), search, filters
(availability, specialism, sort), save (in-session), "Request to connect" (optimistic
→ Request sent), "View profile" drawer. All against mock data.

**Deliberate deviations from the mock** (flagged for your call):
- Typical fee → **Avg. time to exchange** (fee is confidential).
- Filter row trimmed to functional facets (Availability, Specialism, Sort); the mock's
  Fee model / Experience / Capacity dropdowns were dropped rather than ship dead controls.
- CTA wording "Request to connect" (vs mock "Request intro").
- "Team of 4 / Team size" tidied to "4 / Team size".
- Added a save bookmark + representative content in every tab.

### P1 — Real profiles + stats

**2. Stats service — BUILT** ✅ `lib/services/progressor-network-stats.ts` →
`getNetworkStatsFor(businessIds)` returns the four card stats per business,
computed from its transactions. Mirrors `solicitor-metrics.ts` exactly (same
migrated/claimed/demo exclusions, round-based exchange rate with the ≥5-resolved
guard, avg offer→exchange in weeks). New/low-volume businesses come back with
null metrics (the "building track record" state) + their real team size. Uses
only existing transaction fields — no schema change needed. tsc-clean; data
verification happens when wired to the page (step 4).

**1. Schema — DRAFTED, not yet applied.** Additive fields on `ProgressionBusiness`,
all nullable/defaulted so the staging `db push` is non-destructive and existing
un-`select`ed queries are unaffected. Applied as ONE coordinated step (edit
schema → verify staging target → `db push` → `generate` → wire) when we have
Annalise's details, to avoid a generated-client / DB mismatch:
```prisma
networkListed       Boolean  @default(false)  // appears in the Progressor Network
networkTagline      String?                   // strapline, e.g. "Independent sales progression business"
networkBlurb        String?                   // 1–2 line pitch on the card
networkLogoPath     String?                   // Supabase storage; monogram fallback until set
networkBrandColor   String?                   // hex for the brand tile
networkRegions      String[] @default([])     // coverage chips, e.g. ["Nationwide"]
networkSpecialisms  String[] @default([])     // specialism chips, e.g. ["Leasehold","Chain management"]
networkAvailability String?  @default("accepting") // accepting | limited | closed
```

**3. Annalise's real profile** — her `ProgressionBusiness` row set `networkListed`
+ the fields above (founder-curated for v1, decision 2.2). Needs her business
name + pitch from Ellis.

**4. Swap the page to live data** — `getProgressorNetwork(agencyId)` reads
`networkListed` businesses + folds in `getNetworkStatsFor`, replacing the mock
catalogue. Discover then shows real businesses to Boardwalk.

**5. (optional) Profile route** `/agent/progressor-network/[id]` — promote the
drawer to a full page. Deferrable; the drawer covers v1.

### P2 — Connect funnel + attribution
1. Agency→business **connection request** wired to `ProgressionConnectionRequest`
   (decision 2.1), accept path reuses `respondToConnectionRequest`.
2. **Provenance flag** (`source`/`viaMarketplace`) on `ProgressionBusinessClient`
   (and/or the request row) — the monetization anchor.
3. Business-side **accept/decline** surface (owner view), or founder-mediated for v1.
4. Introductions tab becomes real (pending requests); My progressors reads real links.

### P3 — Promote
Move the nav item to `main`, widen the gate (per-agency flag or broader allowlist),
keep founder-only until Boardwalk↔Annalise is proven.

### P4 — Monetize & open up
Flip the network fee on (rides `business-billing.ts`), business self-serve profile
editing, and open discovery to more agencies.

---

## 5. Open questions
- [ ] Connect direction: agency request/accept, or founder direct-connect for v1? (§2.1)
- [ ] Founder-curated profiles for launch? (§2.2)
- [ ] Network monetization model + switch-on timing? (§2.3)
- [ ] Which facets make the final filter row? (we have availability/specialism/region/stats)
- [ ] Does Annalise's business have a name/logo to use, or a monogram for now?
- [ ] Standalone profile page vs drawer-only for P1?
