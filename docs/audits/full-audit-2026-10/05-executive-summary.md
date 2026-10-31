# Executive Summary — as of 2026-10-20 (Phase 1 complete)

## Where the audit stands
Phase 1 (Discovery) is complete: the whole application has been mapped (287 pages, 292 API endpoints, 46 scheduled jobs, 8 surfaces), and six deep code investigations have been carried out covering routes/access, agency separation, automation/email, billing, chains/milestones, and the existing test/quality machinery. **Everything so far is code inspection — no behaviour has been exercised yet** (that is Phase 3). Nothing in the application has been changed.

## How reliable TSP currently appears
Better at its core than the bug pattern suggests, weaker at its edges and in its process:

**Strong:** agency-to-agency separation (no confirmed leak anywhere; the one canonical access helper is used pervasively and is itself well-tested); the main outbound email queue (double-send-safe by design); billing double-charge protections; chain privacy between agencies; concurrent-edit handling on milestones.

**Weak:**
1. **Process** — there is no automated gate between a code change and production. ~100 test files exist; nothing runs them. This is the most plausible root cause of the recurring small bugs.
2. **Undo paths** — completing things is well-engineered; *reversing* things is not. Undoing an exchange can leave the bill in place (one of two undo routes skips billing reversal), leaves queued "contracts exchanged" emails to send anyway, and never un-earns referral credits.
3. **Direct-send automations** — two email paths (solicitor chases, exchange-day emails) bypass the safe queue and can double-send on failure.
4. **Edges** — the ungated `/dev` page area (one page lists working staging portal links), one unauthenticated Command Centre endpoint, fail-open patterns if certain server secrets go missing, three digest emails that fail silently.

## Most serious findings (detail in 03-findings-register.md)
P1: PROC-001 (no CI), SEC-001 (/dev ungated + portal-token page), SEC-002 (unauthenticated AI-image endpoint), MILE-001 (exchange undo keeps the bill), MILE-002 (queued exchange emails survive undo), AUTO-001/002 (double-send windows), AUTO-003 (fail-open cron auth), AUTO-004 (silent digest failures), BILL-001 (service-type switch changes the bill), SEC-003 (staging token endpoint).

## What has NOT been verified yet
- Anything at runtime: no tests run, no requests made, no data checked.
- Production environment: which secrets/flags are actually set; whether /dev pages are reachable live.
- Live data consistency (needs approval for read-only production queries).
- Cross-dashboard consistency, frontend behaviour, enquiries detail, inbound email capture detail, Boardwalk data routes, per-file Command Centre sweep.

## Open decisions for Ellis
Seven business-logic questions (BL-001 … BL-007) in 04-business-logic-questions.md — undo-email policy, fee-on-service-switch, free-sale-after-fallthrough, NR permissions and lists, skipped-pack-step recovery, duplicate chain addresses.

## Recommended next steps
1. **Phase 2** — cross-dashboard data-accuracy tracing (same fact on every screen), enquiries, inbound email capture, frontend interaction audit, Command Centre per-file sweep. No approval needed (read-only).
2. **Phase 3 (safe verification)** — run the existing jest suite; safe GET checks of /dev reachability on prod; verify prod env secrets via Vercel; targeted reproduction of the undo/billing findings against staging with synthetic data.
3. **Decisions** — answer BL-001…BL-007.
4. **First fix batch (after approval)** — CI + the P1 security/automation items; all are small, local changes.
