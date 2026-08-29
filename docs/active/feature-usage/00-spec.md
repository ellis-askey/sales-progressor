# Feature usage hub — arc spec

Last updated: 2026-08-29. Status: build in progress (Command Centre review arc).

## Why

The Command Centre page at `/command/followup-usage` was built to track a single
feature (the client "email your conveyancer" follow-up). Ellis wants it turned
into a whole-platform **feature usage** hub: every distinct product feature, on
surface tabs, ranked most-used to least-used, with the informative depth behind
each one. Renamed to **Feature usage**.

## The constraint that shaped the design

There is no single "a feature was used" stream. Usage lives in three disconnected
places:

1. The generic `Event` table (`lib/command/events/write.ts` → `recordEvent`) — but
   only ~17 event types are actually emitted, all agent/back-office lifecycle
   actions. No portal-feature events.
2. Bespoke per-feature tables — `FollowupTap`, `PortalMessage`, `QuoteRequest`,
   `MilestoneCompletion` (client/solicitor confirms), `ChaseSend`,
   `OnwardStepConfirmation`, `TransactionDocument`, `MilestoneProposal`,
   `EnquiryMovement`, plus one-shot stamps on `Contact`
   (`exchangeAuthorityGivenAt`, `overviewLayout`, `image`,
   `brokerCallbackRequestedAt`, `portalSettings`, push subscriptions).
3. PostHog — fully wired but **dormant** (no key + consent-gated). Cannot build
   on it.

So the hub reads each feature from exactly one source (no double counting): a
**feature registry** where every feature declares metadata + a loader that knows
which table backs it and normalises to a common metric shape.

## No duplication (arc rule)

The Growth section already owns adjacent turf: App adoption (portal install /
push / visit / engaged time), Agencies & agents + Activity (agent activity, quiet
accounts, raw event stream + heatmap), Repeat use (retention), Trends (activation
funnel + cohorts), Getting started (signup activation), Chain invites (that one
funnel). This hub's unique job: **per-feature uptake across the whole product** —
a feature league table + per-feature deep dive. It deliberately does NOT re-plot
raw portal visits / engaged-time (links to App adoption instead).

## Shape

- Four **surface tabs**: Client portal, Agent app, Solicitor, Internal. (Ellis:
  "by surface, don't forget solicitors.")
- **League table** per tab, ranked most→least (sortable): feature, adopters
  (headline, unit varies by surface: clients / agents / firms / files), uses
  (volume, secondary), 12-week sparkline, last used, a cold flag for tracked-but-
  unused features (the "we built it, nobody uses it" insight).
- Scope filter (All / SP / PM / agency) reused from the CC layout; period toggle
  (all-time / 30d / 90d).
- **Per-feature drill-down**: funnel where one exists (follow-up opened→sent,
  quote requested→booked→won, solicitor chase sent→opened→responded), by-agency
  split, recent activity.
- `InfoTip` + `event-labels` reused for consistency.

## Two builds, one arc

- **Build 1 (shipped, commit c37890a2)** — registry + page + nav rename over
  features that already record usage. 24 features across the four surfaces.
- **Build 2 (built)** — a unified `FeatureEvent` stream (one table, one
  `recordFeatureUse` writer, migration `20260829130000_feature_event`) so any
  future feature reports the same way. Instrumented the genuinely-blind
  downloads: calendar `.ics` export (`calendar_export`) and vCard contact card
  (`contact_card`), both now registry features. Migration is staging-first (Law
  3): it applies on the next deploy via `prisma migrate deploy`. Portal
  reading-pages and agent page-views are deliberately left to App adoption /
  Activity / PostHog, not duplicated here. Theme turned out already-tracked via
  `Contact.portalSettings` (the `appearance_settings` feature), so it wasn't
  blind.

## Adopter units by surface

- Client portal → distinct clients (Contacts). Doc uploads counted per file.
- Agent app → distinct agents (Users), or files where no user is attributable.
- Solicitor → distinct firms / files.
- Internal → distinct internal users.
