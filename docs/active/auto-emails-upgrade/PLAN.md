# Auto emails page — audit + upgrade plan

Status: APPROVED (founder "Proceed", 2026-10-21). Phase 1 (truth pass) BUILT
2026-10-21 — one problem definition everywhere (banner = needs-attention =
Problems tab, incl. a missing-emails strip on the tab), 3-state banner
(paused / needs attention / healthy), "Sent today N · still to go M" replaces
the misleading "Chasing today", Issues KPI tile removed from the activity
strip, Upcoming/Files tab counts always computed, honest admin subtitle,
"Updated HH:MM · refreshes itself" with a 2-minute self-refresh, DST-correct
London "today" (lib/utils londonDayBounds) across overview/list/preview.
Phases 2-5 not started; 4-section shape (Outbox / History / Problems /
Insights) taken as approved by the same "Proceed".
Route: /agent/automated-emails. Audit evidence gathered from the live services
(lib/services/automated-emails-*) and components; file:line detail lives in the
audit transcript; this doc is the founder-approved shape for the build arc.

## The job of the page

One question: "What are we sending on my behalf — what went, what's about to
go, to whom, and what does it look like?" Everything on the page is judged
against how fast it answers that.

## Audit findings (grouped)

### A. The numbers can't be trusted (worst problem)
1. "Automation healthy" checks ONLY the global send switch — it says healthy
   while 30 problems sit beside it. (overview.ts banner.automationPaused =
   env gate only.)
2. "Chasing today: 0" / "Sending today: nothing" actually mean "still WAITING
   to send today" — after the morning run they always read zero even when 7
   emails just went. Labels describe activity; numbers describe the remaining
   queue. Also banner counts client chases only; the panel counts all types.
3. Three different "issues" figures: Needs attention 30 (30d window + missing
   emails unwindowed, dedup by recipient), Activity "Issues 25" (30d, wide
   problem definition), Issues tab 355 (ALL-TIME, narrow errorAt-only
   definition). None agree; a bounced email is a problem in two of the three
   but absent from the tab.
4. Upcoming / Files tab counts are blank until you're already on the tab.
5. No "as of" clock anywhere; a page left open goes stale silently.
6. Superadmin subtitle says "across every agency" but the data is deliberately
   TSP's outsourced book only (scope.ts).
7. Silent caps: several counts stop counting past 5k/20k rows with no hint.
8. "Today" is computed on UTC midnight, drifts an hour around BST.

### B. Doesn't answer the core question fast
1. UPCOMING emails have NO preview — the one thing users most want to inspect
   (what's about to go) is a text row linking to the file. Sent rows DO open
   the true HTML (good — keep that drawer).
2. No pause/resume control here; must go to the file.
3. Solicitor emails are second-class: no edit, no cancel, gaps in capture
   (agent-less files never logged).
4. Seven tabs with overlapping meanings (Pending / Activity / Issues /
   Upcoming / Files / Chase performance / Email health); the landing view
   buries "what's next" below the fold.
5. Filters are five stacked full-width raw controls + Export disguised as a
   text input.

### C. Polish below app standard (the "lazy AI" layer)
1. Two implementations of the same category chip — one canonical Pill, one
   hand-coloured raw hex (the pills Ellis spotted). Upcoming kind chip also
   raw hex.
2. Internal words leak: "chase"/"notification"/"client"/"solicitor" rendered
   raw; unmapped types can print raw enum codes (RETENTION_*…); "(unknown
   file)" placeholders can surface.
3. Buttons: Skip fully hand-rolled; Send now / Update email canonical class
   but ad-hoc inline resizing; Export = agent-input styled as a button.
4. Hand-rolled overflow menu, off-token radii/shadows, literal hex dot
   colours, hand-rolled conic-gradient donut.
5. Filter toolbar has a one-off margin hack for wrap; mobile relies on it.

### D. What's already good (keep)
- EmailDetailDrawer true-to-inbox preview (sandboxed iframe, real sent HTML),
  send-now / cancel / edit for queued rows, race-safe actions.
- Server-side search + working CSV export.
- Chase performance + Email health tabs are REAL data (honest delivery
  accounting), just buried.
- GlassCard shells, bloom, segment pills, recharts chart, EmptyStates.

## The plan (phases; each shippable alone)

### Phase 1 — Truth pass (make every number mean one thing)
- One definitions dictionary: a "problem" is one thing, counted one way, one
  window, everywhere (banner, panel, tab). Pick the Needs-attention
  definition; the Issues tab becomes the same list, filterable to all-time.
- Banner states: Healthy (switch on AND nothing needing attention) / Needs
  attention (N) / Paused. Honest subtitle per role (fix "every agency").
- Split "today" into two honest figures: "Sent today N · still to go M".
- Tab counts always computed; add a visible "as of HH:MM" with auto-refresh;
  London-correct "today"; surface (don't silently hit) the count caps.

### Phase 2 — Re-centre on the Outbox (speed-to-answer)
- Landing view = today's schedule: what went (with delivery state), what's
  still to go, then the next 14 days, grouped by day; each row: time, type,
  recipient (name + role), file, one-tap TRUE PREVIEW — including upcoming
  predicted emails (compose with the same engine the chase page preview
  uses, so preview == send).
- Collapse 7 tabs → 4: Outbox (today + upcoming), History (sent, 30/90d),
  Problems (the one unified issues list with fix-it actions inline), Insights
  (coverage + chase performance + email health).
- Per-file lens stays (Files view folds into Outbox/Insights filtering).

### Phase 3 — Controls where you look
- Pause/resume a file's automation from this page (same switch the file page
  has), skip / send-now (exists), edit (exists), and MOVE a send using the
  chase-page reschedule control (hold fields already built, 2026-10-20).
- Solicitor sends: cancel/edit parity where the send path allows; close the
  agent-less capture gap so History is complete.

### Phase 4 — Polish to standard
- One CategoryChip built on Pill tones; kill both hand-rolled chips; no raw
  internal words anywhere (label map with safe fallbacks).
- Buttons from the button library sizes (no inline resizing); Export becomes
  a real button; one compact canonical filter row (match enquiries triage);
  tokenised radii/shadows/dots; donut to chart standards; mobile pass;
  voice pass on every string.

### Phase 5 — Scale guardrails
- Replace per-file prediction fan-out + in-memory caps with bounded queries;
  no silently-truncated figures.

Open decision for Ellis: confirm the 4-section shape (Outbox / History /
Problems / Insights) before Phase 2 starts. Phase 1 is shape-independent.
