# Survey & lender-valuation booking reminders — agreed plan

Status: agreed with founder 2026-09-08. Build in progress.
Spec touched: `docs/MILESTONES_SPEC_v1.md` (buyer confirmation of PM6/PM9 becomes provisional — see §"Spec change" below).

## The two milestones

- **PM6** — "Lender valuation has been booked" (auto-skipped for cash buyers).
- **PM9** — "Buyer has booked a Level 2 or Level 3 survey".

Both already capture a real appointment date (`MilestoneCompletion.eventDate`) and are flagged `eventDateRequired`. Both are buyer-confirmable on the portal.

## Core principle

Every booking is confirmed by a real person on the responsible side before anything is emailed.

### Path 1 — logged directly by an agent (self-managed) or our progressor (outsourced)
Already verified. Date + keys entered in one go. Step completes, all emails fire immediately.

### Path 2 — logged by the buyer on their portal (provisional)
- Buyer enters the date (already forced), submits, and **sees it as done** — their progress ticks over. Nothing looks pending to them.
- `awaitingBookingConfirmation = true` is set; **all emails are held** (buyer + seller confirmation emails AND the internal diary email).
- It surfaces as a **"confirm this booking" job** on the hub, for the agency agent (self-managed) or our progressor (outsourced).
- On confirm: date + `keyCollectionRequired` are set, `awaitingBookingConfirmation` flips to false, and the held emails release (carrying the confirmed date).

## Who gets what, once confirmed

- **Buyer + seller confirmation emails** — the existing milestone emails. Released on confirmation (immediately for Path 1; on our confirm for Path 2). Always carry the confirmed date.
- **Booking-day "diary" email → agency agent** — outsourced files only (on self-managed the agent always confirms it themselves). Skipped for desktop valuations (no date) and straight-to-property jobs (`keyCollectionRequired = false`). Carries an add-to-calendar (.ics) attachment. Re-sends on a reschedule, worded as a reschedule.
- **7am morning-of email → agency agent** — every file, every dated appointment. Keys line only when `keyCollectionRequired = true`; straight-to-property jobs get a plain "happening today" version.

## The keys checkbox

One checkbox — "surveyor/valuer collecting keys from us" — set by the internal confirmer, so it's never unknown when emails go out. Unticked = straight to property. Stored as `MilestoneCompletion.keyCollectionRequired`.

## Data model (this migration)

`MilestoneCompletion`:
- `keyCollectionRequired Boolean?` — access arrangement; null until an internal person sets it.
- `awaitingBookingConfirmation Boolean @default(false)` — provisional buyer booking; holds all emails while true.

## Build order

1. Schema + migration (this step). Staging via `prisma db push`, prod via `migrate deploy`.
2. Keys checkbox on the agent confirm screen (both steps).
3. Portal buyer path goes provisional + hub "to confirm" pile + email hold/release.
4. Booking-day diary email + 7am morning-of email + calendar attachment.
5. Settings toggle: "Appointment reminders" (default on) controlling the two new agent emails.
6. Spec update + voice pass.

## Spec change

`docs/MILESTONES_SPEC_v1.md` §3/§11 currently make buyer confirmation of PM6/PM9 authoritative and immediately complete. This work makes buyer confirmation of these two steps **provisional pending internal confirmation** (progress ticks for the buyer, but the step is not "released" until our side confirms). To be recorded in the spec in step 6.

## Recipient resolution

- Agency agent = `PropertyTransaction.agentUserId`. Always present in practice; fall back to `assignedUserId` (progressor) only as a never-happens safety net.
- Outsourced vs self-managed = `PropertyTransaction.serviceType`.
- Internal agent emails send via `sendAgentEmail(...)` with `resolveAgencySender(agencyId, { fromPlatformAddress: true })`, matching the morning-digest / weekly-brief pattern.
