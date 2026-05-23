# Opportunity Sweep — Backlog

**Date opened:** 2026-05-23 (post clean-break promotion)
**Working style:** Items can be picked up in any order, not necessarily sequentially. Strike through each one (`~~A1~~`) or tick the checkbox as it lands. New ideas can be appended to the **Yes** list with a fresh letter/number.

---

## ✅ Yes — to build

Roughly ordered. **D1 stays last** (data permitting). **D2 moved to very last** (only relevant once we have self-progressing customer agencies — every current user is outsourcing to SP, so it doesn't help anyone today).

- [ ] **A1 — Solicitor chases**
  Apply the client-chase machinery (ClientChaseState, OutboundEmailQueue, FallbackKind chips, automation-controls Settings) to vendor + purchaser solicitors. Per-milestone chase rules fire on the same grace/repeat cadence we use for clients.
  - **Ellis:** "Yes."
  - **Risk flag:** Emails real solicitors. Needs solicitor-side opt-out, professional tone calibration (different voice from client chases), per-firm pause toggle.
  - **Note:** No build plan drafted yet — hold until explicitly picked up.

- [ ] **B2 — Portal document upload**
  Documents tab on the buyer/seller portal: contact uploads, categorises, controls sharing. Agent gets read-only view. Email notifications fire when a document is shared.
  - **Ellis:** "Yes. I think we already maybe even have a document upload plan ready to go?"
  - **Status:** ✓ confirmed — spec exists at [docs/active/portal-document-sharing-spec.md](portal-document-sharing-spec.md) dated 2026-05-20 (planned on Claude, not Claude Code). Fast path — build to existing spec.

- [ ] **B4 — "Who's holding it now" on the portal**
  Show the client which party currently holds the work — "Waiting on your solicitor for searches" or "Waiting on the buyer's lender". Today the portal shows progress but not blame/responsibility.
  - **Ellis:** "Yes."
  - **Risk flag:** None — info only on a logged-in surface.

- [ ] **E2 — Voice note → activity entry**
  Agent leaves a quick voice note from their phone; it transcribes (Whisper-style) and drops into the comms timeline as an internal note.
  - **Ellis:** "Yes."
  - **Risk flag:** New third-party dependency (transcription API). Add to `ELLIS_MANUAL_TODO.md` when picked up.

- [ ] **F1 — SP load board with SLA**
  For internal SP staff, a queue of unclaimed files ranked by "how long since assignment was needed", with an SLA flag ("Hartwell file unclaimed 36 hours — over 24h threshold").
  - **Ellis:** "Yes."
  - **Risk flag:** None — internal only.

- [ ] **F2 — Agent ↔ SP structured handoff**
  Structured "request" button (not ad-hoc email) for SP-to-agent escalations. The agent gets a structured todo in their queue.
  - **Ellis:** "Yes — but we'll use sparingly. After all, this is what they send the files for us to do in the first place, but there comes a time we have to say we can't chase anymore if they're not going to do it, so this is needed every now and then."
  - **Risk flag:** None — internal only.

- [ ] **D1 — Solicitor performance scorecard**
  Per solicitor firm (across all files on the platform), surface median time-to-respond, median time on enquiries, fall-through rate when this firm is involved. Visible to directors + agents at solicitor-pick time.
  - **Ellis:** "Yes, but make this the last on the yes list. We may defer it to queue when we get there, depending on if we have enough data."
  - **Note:** Data-volume gate at decision time. Falls out of A1 naturally — A1 generates the chase history that powers this.

- [ ] **D2 — Director's agency-KPI weekly email** (DEFERRED — LAST)
  Per-agency weekly summary for the director: files closed, average time-to-exchange, fall-throughs with reasons, top solicitor firms by speed/drag. **Net-new** — the existing weekly brief is per-agent file lists, not agency KPIs.
  - **Ellis:** "Defer D2 until last, then we'll choose. Only relevant for agents with self-progressed files, whereas all current users are outsourcing to us at the moment."
  - **Note:** Re-evaluate when there's at least one self-managed customer agency on the platform.

---

## 🕓 Queue — good, not first

- [ ] **A2 — Broker / mortgage advisor check-ins**
  Same engine as A1, narrower scope (mortgage milestones). Easy follow-on once A1 ships.
  - **Ellis:** "Queue."

- [ ] **A3 — Lender-chase drafts (agent-reviewed, not auto-fire)**
  Pre-fill an email to the broker quoting today's exact milestone state; agent reviews and sends. Human-in-the-loop alternative for sensitive parties.
  - **Ellis:** "Queue."

- [ ] **B5 — Completion-day memory email**
  Upgrade existing celebration email from text to personalised "your move with us" — property photo, key dates, agent who handled it.
  - **Ellis:** "Queue."
  - **Risk flag:** Touches an existing client email channel. Content tone matters.

- [ ] **C1 — Per-file early warning ("you'll slip exchange")**
  When velocity calc says a file will miss its 12-week target by >2 weeks, fire a specific banner naming the bottleneck milestone (NAME, not code).
  - **Ellis:** "Queue."

- [ ] **C2 — At-risk drill-down on file list**
  Hover/expand the at_risk / off_track pill to show "PM5 stuck 15 days, vendor solicitor unresponsive 9 days, mortgage offer pending" inline.
  - **Ellis:** "Queue. This will be good but need to make sure no milestone codes displayed."
  - **Caveat:** Show milestone NAMES only, never codes (UI principle).

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
