# Unknowns log

Items where the correct answer isn't fully clear from source code. Flagged here rather than guessing in article text.

---

## Analytics page — exact metrics

The analytics page exists at `/agent/analytics` but the exact charts and metrics shown are not fully confirmed from source code alone. The hub confirms: active files, exchanging soon, need attention, pipeline value, momentum (month-on-month exchange count), exchange forecast (weekly, 30-day horizon), service split (self-managed vs outsourced).

The analytics page likely shows historical trends and longer-range data. Article written at a high level; may need review against the live UI.

## Work Queue — exact columns and sort order

`/agent/work-queue` is referenced in hub code as the destination for "Reminders" and stalled files, but the exact UI layout of the work queue page wasn't read in full. Article is written based on what can be inferred from the reminder engine (urgency levels: due_today, overdue, escalated) and the hub's attention items. Should be verified against live.

## Chase email UX — exact flow

The chase email generation exists at `/api/ai/generate-chase` and `/api/chase/send-email`. The exact UX for generating and sending a chase email (which button, what confirmation step) is written based on general pattern inference. Should be verified against live UI.

## Portal — "message" feature availability

`portal-copy.ts` references messaging between agent and contact, but whether the portal currently has a working two-way message input for the contact side is unclear (deferred features doc lists it as "not yet scheduled"). Article describes the portal as read-only for contacts with contact information shown; marked as uncertain.

## Completions page — exact structure

`/agent/completions` is referenced in hub code as the destination for "Exchanging soon". Exact layout not read.
