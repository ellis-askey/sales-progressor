# Opportunity Sweep — Backlog

**Date opened:** 2026-05-23 (post clean-break promotion)
**Last verified:** 2026-08-27 (full code inspection of every open item)
**Working style:** Items can be picked up in any order, not necessarily sequentially. Strike through each one (`~~A1~~`) or tick the checkbox as it lands. New ideas can be appended to the **Yes** list with a fresh letter/number.

### Status at 2026-08-27
- **Shipped (8):** A1, B2, B4, F2, C2, plus D1, F1, C1 — the three "last 10%" partials were finished 2026-08-27.
- **Still open (5):** E2, A2, A3, B5, D2.

---

## ✅ Yes — to build

Roughly ordered. **D1 stays last** (data permitting). **D2 moved to very last** (only relevant once we have self-progressing customer agencies — every current user is outsourcing to SP, so it doesn't help anyone today).

- [x] ~~**A1 — Solicitor chases**~~
  Apply the client-chase machinery (ClientChaseState, OutboundEmailQueue, FallbackKind chips, automation-controls Settings) to vendor + purchaser solicitors. Per-milestone chase rules fire on the same grace/repeat cadence we use for clients.
  - **Ellis:** "Yes."
  - **✅ SHIPPED** (verified 2026-08-27): `lib/solicitor-confirm/chase.ts` + `app/api/cron/solicitor-chase/route.ts` — automated per-side solicitor confirmation chase with grace window, repeat interval, chase cap, agent escalation, and an admin on/off switch.

- [x] ~~**B2 — Portal document upload**~~
  Documents tab on the buyer/seller portal: contact uploads, categorises, controls sharing. Agent gets read-only view. Email notifications fire when a document is shared.
  - **Ellis:** "Yes. I think we already maybe even have a document upload plan ready to go?"
  - **✅ SHIPPED** (verified 2026-08-27): `components/portal/PortalDocumentsTab.tsx` + `lib/services/portal-documents.ts` — client uploads by category, toggles "share with the other side", downloads/removes; agent always sees them (Batch 2, 2026-08-17).

- [x] ~~**B4 — "Who's holding it now" on the portal**~~
  Show the client which party currently holds the work — "Waiting on your solicitor for searches" or "Waiting on the buyer's lender". Today the portal shows progress but not blame/responsibility.
  - **Ellis:** "Yes."
  - **✅ SHIPPED** (verified 2026-08-27): `components/portal/PortalNextActionCard.tsx` — the portal shows "Waiting on your solicitor" / "Waiting on the other side" / "Action needed from you" against the live step.

- [ ] **E2 — Voice note → activity entry**
  Agent leaves a quick voice note from their phone; it transcribes (Whisper-style) and drops into the comms timeline as an internal note.
  - **Ellis:** "Yes."
  - **Risk flag:** New third-party dependency (transcription API). Add to `ELLIS_MANUAL_TODO.md` when picked up.
  - **○ STILL OPEN** (verified 2026-08-27): no audio capture or transcription-to-timeline anywhere. (Note: `memo-parse` reads a memo-of-sale PDF, and WhatsApp ingests media files, but neither is voice-note transcription.)

- [x] ~~**F1 — SP load board with SLA**~~
  For internal SP staff, a queue of unclaimed files ranked by "how long since assignment was needed", with an SLA flag.
  - **Ellis:** "Yes."
  - **✅ SHIPPED** (2026-08-27, commit ac01f754): the hub's "Needs your attention" card now shows each unassigned outsourced file's waiting time, sorted longest-waiting first, escalating to amber at 48 hours and red at 72, with a breach count in the summary line. Added an `outsourcedAt` timestamp (backfilled) so the clock is accurate even for switched files. Assignment stays admin-only (Ellis), by choice. Thresholds set at 48h/72h.

- [x] ~~**F2 — Agent ↔ SP structured handoff**~~
  Structured "request" button (not ad-hoc email) for SP-to-agent escalations. The agent gets a structured todo in their queue.
  - **Ellis:** "Yes — but we'll use sparingly. After all, this is what they send the files for us to do in the first place, but there comes a time we have to say we can't chase anymore if they're not going to do it, so this is needed every now and then."
  - **✅ SHIPPED** (verified 2026-08-27): `lib/services/manual-tasks.ts` (`isAgentRequest`, `listProgressorInboxTasks`) — a structured agent request creates a task in the assigned progressor's inbox, not an ad-hoc email.

- [x] ~~**D1 — Solicitor performance scorecard**~~
  Per solicitor firm (across all files on the platform), surface typical time-to-exchange, search turnaround, fall-through rate when this firm is involved. Visible to directors + agents at solicitor-pick time.
  - **Ellis:** "Yes, but make this the last on the yes list."
  - **✅ SHIPPED** (2026-08-27, commits be2dc3e5 + 13f8c373): the firm badge now reports **medians** (the typical file, not skewed by one disaster) for weeks-to-exchange and search turnaround, and adds a **fall-through rate** over resolved sales, shown once a firm has 5+ finished files (else "not enough data yet"). Optional "median time on enquiries" not built (not needed for v1). Still data-gated: most firms show little until volume builds.

- [ ] **D2 — Director's agency-KPI weekly email** (DEFERRED — LAST)
  Per-agency weekly summary for the director: files closed, average time-to-exchange, fall-throughs with reasons, top solicitor firms by speed/drag. **Net-new** — the existing weekly brief is per-agent file lists, not agency KPIs.
  - **Ellis:** "Defer D2 until last, then we'll choose. Only relevant for agents with self-progressed files, whereas all current users are outsourcing to us at the moment."
  - **Note:** Re-evaluate when there's at least one self-managed customer agency on the platform.
  - **○ STILL OPEN** (verified 2026-08-27): weekly emails exist but are per-agent file digests (`agent-weekly-brief.ts`) and per-client updates (`client-weekly-update.ts`); no per-agency director KPI roll-up.

---

## 🕓 Queue — good, not first

- [ ] **A2 — Broker / mortgage advisor check-ins**
  Same engine as A1, narrower scope (mortgage milestones). Easy follow-on once A1 ships.
  - **Ellis:** "Queue."
  - **○ STILL OPEN** (verified 2026-08-27): the broker surface is a buyer-portal card + buyer-initiated quote request (`lib/services/broker-card.ts`); nothing chases the broker on a schedule. (A1's engine now exists to build on.)

- [ ] **A3 — Lender-chase drafts (agent-reviewed, not auto-fire)**
  Pre-fill an email to the broker quoting today's exact milestone state; agent reviews and sends. Human-in-the-loop alternative for sensitive parties.
  - **Ellis:** "Queue."
  - **○ STILL OPEN** (verified 2026-08-27): the human-in-the-loop draft pattern exists only client→solicitor (`lib/portal/followup-state.ts`), not agent→broker/lender.

- [ ] **B5 — Completion-day memory email**
  Upgrade existing celebration email from text to personalised "your move with us" — property photo, key dates, agent who handled it.
  - **Ellis:** "Queue."
  - **Risk flag:** Touches an existing client email channel. Content tone matters.
  - **○ STILL OPEN** (verified 2026-08-27): a plain-text completion milestone email exists (`lib/portal-copy.ts`, `lib/exchange-day/emails.ts`) but not the personalised "memory" upgrade (photo, key dates, agent).

- [x] ~~**C1 — Per-file early warning ("you'll slip exchange")**~~
  When the prediction says a file will miss its 12-week target by more than two weeks, fire a specific banner naming the bottleneck milestone (NAME, not code).
  - **Ellis:** "Queue."
  - **✅ SHIPPED** (2026-08-27, commit 76b148ca): the agent file banner now fires when exchange is predicted more than two weeks past the target, naming the current blocking step (earliest incomplete exchange-gating step, unlocked first) in plain present tense, framed as a projection not a promise. Agent/internal only. Suppressed while too-new to predict, on hold, or already exchanged.

- [x] ~~**C2 — At-risk drill-down on file list**~~
  Hover/expand the at_risk / off_track pill to show "PM5 stuck 15 days, vendor solicitor unresponsive 9 days, mortgage offer pending" inline.
  - **Ellis:** "Queue. This will be good but need to make sure no milestone codes displayed."
  - **Caveat:** Show milestone NAMES only, never codes (UI principle).
  - **✅ SHIPPED** (verified 2026-08-27): `components/transactions/RiskBadgeWithPopover.tsx` (+ `lib/services/risk.ts`) — the risk pill on the file list expands into per-factor reasons ("N days stuck on milestone", "solicitor unresponsive", "last activity N days ago").

---

## 🎉 Already shipping (moved off the list)

Confirmed by code inspection on 2026-05-23. Mentioned here for the record so they don't get re-proposed.

- ~~**B3 — Reassurance ping (heartbeat email)**~~
  `lib/services/client-weekly-update.ts` runs weekly via `client-weekly-update` cron. Skips clients who've had outbound comms in the last 7 days.

- ~~**C3 — Fall-through risk score**~~
  `components/transaction/RiskScoreWidget.tsx` renders on every transaction-detail page (low/medium/high level + 0–100 score bar).

- ~~**E1 — "First 30 minutes" priority queue**~~
  `components/hub/AttentionListView.tsx` on `/agent/hub` — escalated / overdue / due-today, ranked.

---

## ❌ No

- ~~**B1 — "What's next for you" portal personalisation**~~
  Already how the Overview behaves for buyers/sellers per Ellis's note.

---

## How to use this file

- Pick any item in **Yes** or **Queue** when ready. They don't have to be sequential.
- When an item ships, strike it through (`- [x] ~~A1 — Solicitor chases~~`) and add a one-line "shipped at commit `<sha>`" pointer underneath.
- If an item is dropped or merged into another, note it inline; don't delete (keeps the audit trail).
- New ideas added later: keep the letter+number scheme (A4, B6, etc.) so references in conversation stay stable.
