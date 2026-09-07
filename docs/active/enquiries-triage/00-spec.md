# Enquiries triage page — spec

Status: agreed shape, not started. Drafted 2026-09-07.

## Problem

Enquiries is the stage that goes cold. The back-and-forth loop has no single home:
today you confirm "whose court the ball is in" one file at a time at the bottom of
each property file (the `EnquiryTrackerSection`), and stalled loops leak into the
Hub's "Needs your attention" count, skewing the headline number so genuinely
actionable items blur into a pile of half-tracked enquiries.

## Goal

One page to see every open enquiry loop, whose court each is believed to be in,
and how long it's been quiet — and to blitz-confirm/flip the court across all of
them in one place. Pull open enquiry loops out of "Needs your attention" so the
headline reflects only steps we're actively chasing on the normal flow, and give
enquiries a dedicated, accountable home instead.

## Locked decisions (2026-09-07)

1. **Audience: internal only first** (admin / sales_progressor / superadmin),
   perfected there, then widened to agents (director / negotiator) behind the
   same gate. Build the role gate so widening later is a one-line change.
2. **Surface: a nav item** ("Enquiries") in the agent app shell, shown to
   internal staff only for now.
3. **Attention/headline: fully remove open enquiry loops** from "Needs your
   attention". The normal reminder flow still chases *reaching* enquiries
   (e.g. "enquiries raised" — VM10 / PM14 and the surrounding milestones); once
   that's confirmed and the `EnquiryTracker` is open, **this page takes over** the
   loop and it no longer appears in the attention count.
4. **Portal client self-report: parked.** Not in this build.

## What already exists (reuse, don't rebuild)

- `EnquiryTracker` (per file, unique): `currentlyWith` (`seller_solicitor` |
  `buyer_solicitor`), `outstandingNote`, `openedAt`, `lastMovementAt`,
  `lastChasedAt`, `chaseCount`, `escalatedAt`, `snoozedUntil`, `closedAt`.
- `EnquiryMovement` log: `note`, `source` (`progressor` / `buyer_report` /
  `seller_report` / solicitor reply), `flipsCourtTo`, `status`.
- `EnquiryTrackerSection` (bottom of the property file) — the per-file confirm/
  flip/log/mark-satisfied UI. Its server actions are what the new page reuses.
- Attention feed: the `stalled` block in `getHubAttentionItems`
  (lib/services/hub.ts:1749-1772) pushes an escalated "Enquiries stalled" item
  when `escalatedAt` is set. **This is the block to remove for decision 3.**

## The page

Route: a new internal-gated nav item, "Enquiries". Lists every file with an open
enquiry loop (`EnquiryTracker.closedAt == null`), scoped to the viewer's internal
visibility (admin/superadmin see all outsourced; sales_progressor sees assigned).

Per-row (compact, blitz-friendly — no click into the file needed):
- Property thumbnail + address (reuse the signed-photo + fallback pattern).
- **Whose court it believes** (`currentlyWith`), rendered plainly.
- **How long quiet** (from `lastMovementAt ?? openedAt`) — the staleness that
  signals "going cold". Sort worst-first (longest quiet at the top).
- Outstanding note (inline-editable).
- Chase count / escalated flag.

Blitz actions per row (reusing the existing tracker server actions):
- **Confirm still with {side}** — logs a movement, resets the quiet clock.
- **Flip to {other side}** — movement with `flipsCourtTo`.
- **Mark enquiries satisfied** — closes the loop (`closedAt`), drops it off the page.
- **Chase** / **Snooze** / edit outstanding note.

Its own count (nav badge / page header) so the set stays visible and accountable
now that it's out of the attention headline — the whole point is that enquiries
stop going cold, so this must be *more* visible here, not hidden.

## The attention/headline change (decision 3)

- Remove the `stalled` enquiry block from `getHubAttentionItems` so open loops no
  longer push "Enquiries stalled" into the attention list or count.
- Leave the normal reminder/chase flow untouched — reaching "enquiries raised"
  (VM10 / PM14 etc.) still chases and still counts, because that's a normal step
  we drive. The handoff line: **tracker opens → this page owns it → out of
  attention; tracker closed → back to the normal flow for later milestones.**
- Net effect on the Hub subheading: the "N need your attention" number stops
  being inflated by half-tracked enquiry loops.

## Access scope

- Reads scoped through the existing internal-visibility helper (same as the hub /
  work-queue). No ad-hoc `agencyId` filters.
- Nav item + page gated to internal roles for now; widen the gate to include
  director/negotiator when it graduates to agents.

## Out of scope (this build)

- Portal client self-report ("I think it's with the other side now") — parked
  (decision 4). When revisited: log it as an *unconfirmed* `buyer_report` /
  `seller_report` movement that surfaces on this page for the team to confirm,
  never an auto-flip.
- Agent (director/negotiator) access — later, same gate.

## Build order (proposed)

1. Service: a scoped `getOpenEnquiries(vis)` returning per-file tracker + sample
   photo + quiet-duration, worst-first. Reuse existing tracker actions for writes.
2. Page + internal-gated nav item, rows + blitz actions.
3. Remove the `stalled` block from `getHubAttentionItems`; verify the subheading
   count drops accordingly.
4. Nav badge count for the open-enquiries set.

## Open questions

- Nav badge: show the full open-loop count, or only those quiet > N days?
- Should "confirm still with {side}" be one tap, or require a note? (One tap,
  with optional note, is the blitz-friendly default.)
