# Exchange Day — spec

**Status:** planning, 2026-08-21. No code yet. Iterating with founder before build.
**Owner:** Ellis.

## Intent
An agent flips a file into **"Exchange day"** — a single-day operational overlay meaning "we're aiming to exchange contracts today." It drives:
1. A timed sequence of **plain emails to the two solicitors** (not clients) confirming the plan and chasing an update through the day.
2. A **client portal state** asking them to give their solicitor authority and stay reachable, with an **"I've given authority"** confirm.
3. A **subtle** agent-side indicator that this file is in exchange day.

It is deliberately **not** a milestone, not a step, not part of the %. It is a same-day flag.

## Core rules (settled)
- **Single day only.** Exchange day is active only for the calendar day it was started. Reading it the next day shows inactive — no auto carry-over. To try again the next day the agent **re-activates** it (fresh authority requests, logged). This sidesteps the "3–4 day / carbon-copy / many-variations" problem.
- **Midnight reset is a read-time derivation, not a cron.** State is "active" iff `exchangeDayStartedAt` is set AND its UK date == today AND the file hasn't exchanged AND it wasn't cancelled. Once the date rolls, it's simply inactive.
- **A completion date is required to enter exchange day** (you can't agree to exchange without an agreed completion date). The entry flow captures/confirms `completionDate`.
- **Reversible.** A "Not exchanging today" control cancels the mode: stops any unsent solicitor emails, reverts the client state, logs a note.

## State (data)
On `PropertyTransaction`:
- `exchangeDayStartedAt DateTime?` — set on activation. Its UK date == the exchange day. Cleared/superseded on re-activation.
- `exchangeDayCancelledAt DateTime?` — set on reversal (or we just clear startedAt; TBD in build).
- `completionDate` — already exists; required before activation.

Client authority (per contact), valid only relative to the current exchange day:
- `Contact.exchangeAuthorityGivenAt DateTime?` — counts only when `>= exchangeDayStartedAt`, so re-activation naturally invalidates yesterday's authority with no cron.

## Entry flow (agent)
- Control lives on the **file hero, next to the status** (agreed). Label ~ **"Start exchange day →"**, understated.
- Opens a small confirm: **requires a completion date** (pre-filled if one exists), a short note that this will email both solicitors and ask the clients to give authority, and a confirm button.
- On confirm: stamp `exchangeDayStartedAt`, queue the solicitor emails for today's remaining slots (see below), flip the client portal state, log an activity note.

### Decision A — when is "Start exchange day" available? RESOLVED: decoupled.
Allow it **any time, independent of step state** (option b). No hard gate on VM18 + PM25.

The data-pollution worry is **already handled** and doesn't block this:
- Completions caught up before exchange go through the **exchange-reconciliation flow** and are flagged `reconciledAtExchange` (also `reconciledAtClaim`, `outOfOrderCompletion`); real dates are captured in `eventDate`, unknown dates left `null`.
- The learned per-step duration medians count **non-reconciled completions only** (`lib/email/medians-ready.ts`: "sampleSize = non-reconciled complete rows"). So catch-up ticks don't pollute the per-step averages.
- So decoupling is safe: if a file's a few steps behind when exchange comes out of nowhere, catching them up through reconciliation keeps the timing data clean.
- (One caveat for a later pass: at least one headline overview stat — total time-to-exchange in `analytics.ts` — currently reads raw `completedAt` without excluding reconciled rows. Not part of this feature; worth a separate tidy if it matters.)

## Solicitor email sequence (settled shape)
Recipients: the **buyer's solicitor and the seller's solicitor, individually** (no clients emailed). Skip a side whose solicitor email is missing and flag it to the agent.

| # | Time (UK) | Sends when | Purpose |
|---|---|---|---|
| 1 | **08:45** | on activation, if the slot hasn't passed | Confirm we're aiming to exchange today; offer assistance |
| 2 | **12:30** | only if **not yet exchanged** | Check we're still on course; offer help |
| 3 | **15:30** | only if **not yet exchanged**; phrased to read right whether or not they replied earlier | End-of-day "where are we?" update request |

- **The 8:45/10:00 rule:** at activation we only queue slots still in the future. Activate at 10:00 → email 1 (08:45) is never queued; 2 and 3 still go.
- **Conditional at send:** emails 2 and 3 re-check at send time that the file is still in exchange day AND not yet exchanged (the exchange step VM19/PM26 not confirmed). If it exchanged, they don't send.
- **Reversal** deletes any unsent queued emails for the file.
- **Format:** plain, warm, professional. `Hi {firstName},` … no buttons. Sign-off block styled nicely — name in bold:
  > Best regards,
  > **Ellis Askey**
  > {Agency}
- **Sender:** the agency's verified sending address via `resolveAgencySenderForTransaction` (per the agency-sender policy), signed by the progressor + agency.

### Copy deck (FINAL — founder-approved 2026-08-21)
Note the `{completionDate}` token in email 1. Sign-off "Ellis Askey" styled (bold), agency after a middot.

**1 · 08:45 (morning) — both solicitors** · Subject: `Exchange today: {addressShort}`
> Hi {firstName},
>
> I hope you are well.
>
> We're aiming to exchange contracts on {address} today, with completion agreed for {completionDate}. As far as we're aware, all parties are set to exchange today, so hopefully we're in a good position to get things over the line.
>
> If anything comes up that we can help with from our side, just let us know and we'll do what we can to keep things moving.
>
> Best regards,
> **Ellis Askey** · {Agency}

**2 · 12:30 (follow-up) — both solicitors, only if not yet exchanged** · Subject: `{addressShort} — exchange update`
> Hi {firstName},
>
> Hope you're well. I just wanted to check in to see how things are progressing with exchange on {address}, as we're still hoping to get everything over the line today.
>
> If there's been any further movement towards exchange, we'd really appreciate an update when you have a moment. If there's anything we can chase or help with from our side, please let us know.
>
> Best regards,
> **Ellis Askey** · {Agency}

**3 · 15:30 — both solicitors, only if not yet exchanged** · Subject: `{addressShort} — end of day`
> Hi {firstName},
>
> We haven't had confirmation of exchange yet, so I just wanted to touch base one last time so that I can update the clients and manage expectations if things are going to drift into another day.
>
> Please let us know the latest when you can, and if there's anything we can do to help get things across the line.
>
> Best regards,
> **Ellis Askey** · {Agency}

## Client portal state (no client emails)
While exchange day is active, the client's portal shows a new pre-exchange state (banner + next-action card, sitting in front of the existing post-exchange `ExchangeBanner`):
- **"We're aiming to exchange today"** — plain, warm, and careful not to over-promise.
- Ask them to **give their solicitor authority to exchange** and to **stay reachable** today (one message covers both email-authority-in-advance and verbal-authority-on-the-day, so we don't need per-solicitor variants).
- An **"I've given authority"** button → a confirm sheet (header / subtext / button, same pattern as the step confirms via `getMilestoneConfirmCopy` / `PortalNextActionCard`). On confirm it stamps `Contact.exchangeAuthorityGivenAt` and **logs an activity note / notification** like other client actions.
- On **re-activation the next day**, authority is requested again (yesterday's is invalidated) — the copy explains why they're being asked again.

## Agent-side visibility (recommendation)
Yes — the file should show it's in exchange day, but **understated, because it's not a promise.**
- **Hero:** a small muted chip next to the status, e.g. a grey/slate **"Exchange day"** pill (not coral, not celebratory). Shows the completion date on hover.
- **File list / hub:** a small dot or the same muted chip so it's spottable in a list without shouting.
- **Authority status** for the agent: on the file, show who's given authority (buyer ✓ / seller ✓ / waiting on X), so you know when everyone's ready.
- No confetti, no "Exchanging!" — tone stays "aiming to."

## Chase suppression (agreed)
While in exchange day, **quiet the normal step chases** for that file. Belt-and-braces — by exchange day there shouldn't be active step chases anyway, but a catch-all so nothing odd goes out on exchange morning. Re-enable when the mode clears.

## Auto-clear (explained, per your check)
There is no persistent "on" that lingers. Exchange day is active only for the day it was started (derived from `exchangeDayStartedAt`'s UK date). At midnight it's simply no longer "today," so the state reads inactive, the client banner reverts, and authority resets. Nothing to send after 15:30. If you're still trying tomorrow, you re-activate — one tap — and the day's sequence + authority requests start fresh.

## Open decisions for founder
- ~~A — availability of "Start exchange day"~~ **RESOLVED: decoupled** (reconciliation already siphons catch-up data).
- ~~Chase suppression~~ **AGREED: quiet chases during exchange day** (catch-all).
- **Authority styling** — happy to keep it as one simple "give authority + stay reachable" message + the button, rather than per-solicitor email-vs-verbal variants? (Recommended.)
- **Copy deck v2** — the three rewritten solicitor emails (above) + the client copy. Redline anything.

## Build process (founder-directed)
Build in chunks. **After each chunk, give a full explanation**: what was added, the UI/UX, the scenario(s) it covers, and any strings added. Founder may give feedback for on-the-spot changes before continuing to the next chunk. Nothing pushed until the whole feature is reviewed.

## Build phases (once agreed)
1. **State + backend** — schema fields, active-derivation helper, activate/cancel service, activity notes, completion-date requirement. (No UI yet.)
2. **Entry/exit UI** — hero control + entry confirm (completion date) + cancel.
3. **Solicitor email sequence** — queue future slots, conditional 2/3, format, copy, sender.
4. **Client portal state** + "I've given authority" confirm + note logging.
5. **Agent-side chip** + authority status + chase suppression.
