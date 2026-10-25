# Automated-emails "By sale" cockpit — TSP-gated

Founder-approved 2026-10-25. Replace the bottom half's time-ordered email *log*
with a file-centric *cockpit* (approved mock: claude.ai/code/artifact/01a1b04c,
tightened). **Internal staff only** for now (sales_progressor / admin /
superadmin); agencies + external SP keep today's Outbox until it's perfected,
then we broaden by relaxing one gate.

## Data — reuse what the page already loads, no new heavy queries
- `getAutomationFiles(scope)` — per-file status (covered / needInfo / paused),
  nextSendAt, issuesCount. The backbone (already exists; fetched on the By-sale tab).
- `getNeedsAttention(scope)` — per-issue items (bounced / missing / errored),
  already fetched by the page.
- `getUpcomingForecastCached(scope)` — predicted chases (+ `chaseMax`, added) and
  the exhausted list. Already fetched (and now memoised).
- Photos via `getSignedUrlMap` (same as the reminders list).

## Groups (pure assembler, unit-tested)
- **Needs you** — one row per stuck file: bounced / missing email / errored /
  chased-out. Most-urgent-first. One safe action per row (navigates to the file:
  Update email / Add email / Review). No destructive actions in v1.
- **Chasing now** — covered files with an upcoming chase, not stuck/paused. The
  common next-run sits in the group header; a row shows a chip ONLY when it
  deviates (different send day). Who · milestone · chase N of M (dots).
- **All set** — covered + quiet, collapsed to a count; expand to a tight list.
- **Paused** — automation off; small collapsed strip.

## Styling — no regressions
- Real primitives only: `StatusPill` (canonical Pill tones — the app standard,
  no bespoke faded blocks), `PropertyThumb` (real photo), `agent-btn`, bare
  Phosphor icons at 14–16px (NO coloured icon-backers).
- Load-in: each group is a `data-bloom` block inside the page's `BloomStage`.
- Hover: rows use the agent hover-row treatment; buttons/links their own states.
- Agent tokens (`--agent-*`), light + dark, matching the Reminders file cards.

## Wiring + gate
- New "By sale" tab, default for internal staff; `getAutomationFiles` fetched on
  that tab. Non-internal never see it. Broadening later = relax the role gate.

## Follow-ups (after the layout is signed off)
- Per-row Chase-now (ChaseDrawer) + Pause wiring (actions already exist elsewhere).
