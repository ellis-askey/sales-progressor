# Audit Coverage Tracker

Updated 2026-10-20 (end of Phase 1 — Discovery).

**"Inspected"** = code read and traced by the audit. **"Tested"** = behaviour actually exercised (tests run, requests made, data checked). Code inspection alone never counts as tested.

| Area | Inspected | Tested | Coverage | Notes |
|---|---|---|---|---|
| Route map + auth model (all surfaces) | ✅ High | ❌ | ~90% inspected | Every route enumerated; representative handlers spot-checked; `/admin/migrate`, `/admin/sentry-test` role gates unverified |
| Tenant scoping (agency separation) | ✅ High | ⚠️ Existing jest/e2e suites exist but not run by audit yet | ~85% inspected | All transaction-touching endpoints classified; 0 confirmed holes |
| Client/solicitor/advisor portals (token auth) | ✅ High | ❌ | ~80% | Token-binding confirmed safe by code; no runtime test yet |
| Scheduled jobs + chases + email paths | ✅ High | ❌ | ~85% | 3 send paths not opened: chain cascade senders, chain invite nudges, exchange-day client emails |
| Milestone engine (complete/undo/gates/side-effects) | ✅ High | ❌ | ~90% | UI wiring of the two undo paths unverified |
| Property chains | ✅ High | ❌ | ~85% | Chain-delete orphan behaviour unverified |
| Billing + fees | ✅ High | ❌ | ~90% | Reversal edge cases need targeted tests |
| Tests/CI/enforcement reality | ✅ High | ❌ | done | — |
| Known-issues baseline (3 tracking docs + 26 prior audits) | ✅ | n/a | done | Folded into findings register |
| **Cross-dashboard data consistency** (same fact, every screen) | ✅ High | ❌ | ~85% | 7 facts traced; 5 confirmed divergences (DATA-002…006) |
| **Data accuracy on live records** (read-only prod checks) | ❌ | ❌ | 0% | Needs Ellis's go-ahead for prod reads |
| Enquiries feature (detail) | ✅ High | ❌ | ~90% | Full lifecycle traced; ENQ-001…004 |
| Email threading / inbound capture / Outlook sync (detail) | ✅ High | ❌ | ~85% | MAIL-001…004; matching layer verified sound |
| Frontend/user interaction audit (forms, states, refresh) | ⚠️ Top-5 mutation flows audited | ❌ | ~40% | FE-001…003; error surfacing verified good on audited flows |
| WhatsApp (detail) | ⚠️ Partial | ❌ | ~40% | Built but dark in prod |
| Boardwalk Forms/To Do data routes | ⚠️ Auth layer only | ❌ | ~25% | Separate product, lower priority |
| Command Centre endpoint-by-endpoint | ✅ Complete | ❌ | 100% inspected | AI-image route is the ONLY ungated endpoint; all 22 others + admin pages verified gated |
| Billing/running totals vs invoice rows consistency | ⚠️ | ❌ | ~50% | Two sources of truth noted |
| Performance / concurrency (runtime) | ❌ | ❌ | 0% | Known scaling note: reminders engine ~150 active files |
| Production environment (env vars, reachability of dev routes) | ❌ | ❌ | 0% | Phase 3 — safe read-only checks proposed |

## Not verifiable from the repo alone (needs environment access or approval)
- Which env secrets are actually set in production (`CRON_SECRET`, `SENDGRID_WEBHOOK_PUBLIC_KEY`, `VERCEL_WEBHOOK_SECRET`, Stripe keys, flags) — prod flag truth lives in Vercel, not the repo.
- Whether `/dev/*` pages are reachable on the production domain.
- Live database consistency (orphaned records, contradictory statuses) — read-only queries need approval.
- Real email/WhatsApp delivery behaviour (SendGrid Message-ID handling is flagged in-code as needing live validation).
- Sentry contents (no read access configured).
