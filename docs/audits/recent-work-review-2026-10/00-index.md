# Recent-work review (last 21 days) — master findings index

Generated 2026-10-31. Read-only review of work since 2026-10-10. No code changed.
Evidence lives in the `_raw-*.md` files in this folder (file:line for each). This index is the decision tracker.

~62 findings across 9 arcs. Presented to Ellis in batches of 10, strongest first. Decision column: ✅ do / ⏸ later / ❌ no / — pending.

## Severity key
H = real user impact / data loss / trust / money   M = noticeable rough edge   L = cosmetic / hygiene

## BATCH 1 (the 10 strongest)
| # | ID | Title | Group | Sev | Effort | Decision |
|---|----|-------|-------|-----|--------|----------|
|1|GL-1|Baked Updates & Completions file cards don't frost for anyone but Ellis|Unfinished UI|H|S|✅ DONE staging 00bc6eed|
|2|OPM-1|Confirming a mirrored onward step ticks + confetti, then silently reverts|Dead end|H|S|✅ DONE staging 911e2daf|
|3|OPM-2/3|Read-only onward mirror shows dead controls / no address|Dead end|H|S|🔨 AGREED option A (clean read-only + address); build + seeded local preview link next|
|4|FOC-1|A logged call/note is lost if you leave Focus within 5 seconds|Logic (data loss)|H|M|✅ DONE staging e4c68f3c|
|5|RM-2|Sticky-note keystrokes in the last half-second before leaving a file are lost|Probably not considered (data loss)|H|S|✅ DONE staging 7b7ba756|
|6|CS-1|A progression business's own email domain still faces clients via the portal + CC panel|Logic|H|M|❌ WON'T FIX — working as intended (founder, 2026-10-31). Company's own email as contact when no single sender is deliberate; it's the company's job to set one up. NO code changed.|
|7|RM-1|"Founder-only" professionals is a visual gate only; the save actions aren't locked|Logic|H|S|✅ DONE staging 5f15a54b|
|8|CH-1/4|Two tabs can show opposite "ready to exchange" answers for the same sale|Missed connection|H|M|✅ DONE staging d0151771 (ticks = source of truth)|
|9|MN-1|Firm/solicitor pickers render behind the Relist window|Dead end|H|S|✅ DONE staging 0344d5a9|
|10|ML-2|Flipping a withdrawn file back to "Active" creates a dead file|Dead end|H|S|✅ BUILT staging c533abd4 (1a+2a). Migration applied staging; PROD migration + runtime test pending (ELLIS_MANUAL_TODO). Chain auto-reconnect deferred by design.|

## Remaining (batches 2+) — full list, to be sequenced
Logic: ML-1 (undo exchange leaves completion date → hub shows "completing"), ML-4 (reverse path doesn't cancel client chase — old prod bug reproducible), RM-6 (server allows earlier chase reschedule, toast lies), FOC-5 (Awaiting-reply counts automated chases), FOC-6 ("searches N days overdue" wrong number), FOC-2 (WhatsApp "connect" driven by history not connection), GL-4 (Bloom flash on wrapped glass cards), RM-3 (viewing work queue writes to DB), MN-5 (caret allow-list fragile).
Dead ends: AE-3 (errored email has no Resend in drawer), CH-5 (no-chain setup link no in-flight state), RM-7 (escalated-enquiry Chase can open empty drawer), CS-5 (Today "metric moved" links to same page), FOC-3 (mobile tap channel navigates instead of showing detail).
Missed connections: AE-2 (move/skip predicted chase — no visible change 60s), CH-2 (wrong author avatar after logging update), OPM-3 (onward mirror shows no property address), RM-4 (sticky "internal" notes visible to agency on outsourced files), CS-3 (Today transactions tile drills into unscoped list), CS-4 (Controls tab ignores sidebar scope), RM-9 (exchange-soon digest lands on unfiltered list), CS-2 (bounced email reads as "Sent" in viewer).
Logic/edge: OPM-4 (onward twin match has no role guard — rare cross-client), OPM-6 (on-hold neighbour confirmable through mirror), CH-4 (portal undo leaves node flagged ready), CH-6 (on-hold relist leaves stale chain link), ML-3 (relist keeps reconciledAtClaim).
Easy wins / hygiene: AE-1 ("Chase N of 2" hardcoded), AE-5 (dead exhausted-strip code+comment), AE-6 (dead "chased out" cockpit path), AE-7 (dead dueTodayCount field+comment), FOC-4 (orphan .fcl-tip CSS), FOC-8 (unused anyQuiet prop), MN-3 (dead .wtc-emenu CSS), MN-7 (inconsistent aria-expanded), GL-3 (6 orphan glass keys), RM-5 (stale reschedule comment), GL-2 (Design Lab can't edit/delete a style).
Probably not considered: CH-3 (join-chains irreversible, no confirm/undo), OPM-7 (kill switch drops client to setup prompt), RM-8 (sticky notes clamp X not Y, can go off-screen), RM-10 (bank-holiday table ends 2028, silent decay), MN-6 (tooltip adds tab stop on every row), MN-8 (account menu copies locked glass recipe), MN-2 (AnchoredPanel has no zIndex escape), FOC-7 (needs-you sort ignores toggle), CS-6 (Agency File sender is read-only on the "edit" page), GL-5 (dark haze fix partial).
Minor (mine): Avatar stack silently caps at 2 people (no "+N"); background-studio per-user colours built but unwired (expected — /dev experiment).
