# Solicitor confirmation emails — scope

**Status:** demo slice validated 2026-08-09 (Ellis clicked through both emails). Building the full feature on branch `feat/solicitor-confirm` (off master, isolated worktree).
**Owner:** Ellis
**One-line:** automated emails that let solicitors confirm the milestones they perform, mirroring the client portal-confirm flow. Additive — clients keep getting their emails too.

Law 1 note: no prior spec existed for this feature; this doc is it. All decisions below were confirmed with the founder across the Q&A of 2026-08-08/09.

---

## What it does

A solicitor gets a professional, trustworthy email listing the step(s) they're responsible for on a matter. For each step they can:
1. **Confirm it's done** → flips the milestone instantly (attributed to their firm; the agent can override).
2. **Give an expected date** → records an expected date, pauses chasing until then.
3. **Provide a written update** → posts an internal note for us (agents + sales progressors only; never buyers/sellers).

All three are **instant-through** — no agent-review gate, including "ready to exchange". A solicitor confirming *is* a confirmation. (Locked 2026-08-09.)

The confirmation writes to the same milestone record the agent app and client portal both read, so one confirmation updates everyone at once.

---

## Locked decisions (do not relitigate)

- **Routing:** VM* → seller's solicitor, PM* → buyer's solicitor. Shared-with-client codes (VM5, VM16, PM22) go to BOTH the solicitor and the client. Welcome pack / ID-AML / mortgage app / survey / deposit / MOS = client only. Exchange + completion (VM19/PM26, VM20/PM27) = nobody asked. Full code lists in `lib/solicitor-confirm/codes.ts`.
- **"Ready to exchange" (VM18/PM25):** opens to solicitor AND client. Instant-through like everything else.
- **Digest, not per-step spam:** one email per file+side. Multiple due steps → one email listing them + a single "Confirm or update these" button → page with per-step controls. Single step → 3 buttons.
- **Cadence (softer than clients):** first nudge 5 working days after a step falls due, repeat every 7 days, cap at 2 nudges, then escalate to the team. Editable on Settings → Automation.
- **Sender:** the assigned agent's verified email for that file's agency (reuse `lib/services/verified-emails.ts`, same as Compose Email). Fallback `ellis@thesalesprogressor.co.uk` (e.g. EXP). From name "Ellis Askey (Agency)", reply-to = same address.
- **Subject:** `{full property address} - Client: {name}` (or `Clients: A & B`), no em dash. "Client" in the subject = the recipient solicitor's OWN client (buyer's solicitor sees the buyer). The BODY names the SELLER (our instructing client).
- **Voice:** first-person, in-house staff (NOT outsourced). "our file", "I'm looking after…".
- **On by default.** No self-managed files exist today; new files get it from the start. Per-matter unsubscribe. No solicitor on file → nothing sends.
- **Written updates are internal-only** (agents + sales progressors). A first-class "solicitor update" entry that pings the assigned agent.

---

## Build stages (migrations staging-first — Law 3)

### Stage 1 — Data groundwork (migration 20260814140000_solicitor_confirm_groundwork) ✅ built
1. Four per-party pause flags on `PropertyTransaction` (`vendorEmailsPaused`, `purchaserEmailsPaused`, `vendorSolicitorEmailsPaused`, `purchaserSolicitorEmailsPaused`); backfill `vendor = purchaser = clientEmailsPaused`. `clientEmailsPaused` retained until Stage 2c migrates its 8 consumers, then dropped.
2. `MilestoneCompletion.confirmedBySolicitorFirmId` / `confirmedBySolicitorContactId` (FKs). `Confirmer` union in `lib/services/milestones.ts` gains `{ kind: "solicitor"; firmId; contactId; firmName }`.
3. `SolicitorChaseState` (mirrors `ClientChaseState`, keyed by side).
4. `SolicitorChaseSettings` global singleton (grace 5wd / repeat 7d / cap 2).

### Stage 2a — Confirm page + secure links
Production-harden `app/s/[token]`: real solicitor-confirmer attribution; "stop these emails" flips the per-side solicitor pause flag; `/s/` public in `middleware.ts`; rate limiting.

### Stage 2b — Digest builder + send cron
`/api/cron/solicitor-chase` (weekday ~9am). Per file+side with an open solicitor-owned step past the 5-working-day grace, respecting pause flags / 2-nudge cap / 7-day repeat / expected-date snooze: one digest email, sent from the agent's verified sender, recording `SolicitorChaseState`. After the cap → team `ChaseTask`.

### Stage 2c — Wiring into the file + settings
Migrate the 8 `clientEmailsPaused` consumers to the per-party flags, then drop `clientEmailsPaused`. Solicitor confirmations ("confirmed by {firm}") + updates as first-class timeline entries; the update pings the assigned agent. Settings → Automation cadence controls.

### Stage 2d — Per-file 4-toggle pause menu
Replace the single "Portal emails paused" pill with 4 independent toggles: Seller / Buyer / {Seller's firm} / {Buyer's firm}.

---

## Working method
Built in an isolated `feat/solicitor-confirm` worktree off master, separate from the concurrent `feat/provider-quotes` and empty-states work. The shared staging DB can only reflect one branch's migrations at a time, so the Stage 1 migration is applied to staging only at ship time (staging → verify → prod).
