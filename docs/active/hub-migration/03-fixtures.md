# Fixtures — what's already seeded, what's missing

**Assessed:** 2026-07-28
**Seed source:** [scripts/seed-demo.ts](../../../scripts/seed-demo.ts) (Fairview Estates demo agency)

## Existing fixtures

`seed-demo.ts` provisions the Fairview Estates demo agency with the following transaction buckets:

| Bucket key | Address | State |
|---|---|---|
| `hero` | 42 Hawthorn Road, Bristol | Active, has chain, 1 escalated reminder |
| `active_compl_today` | | Completes today |
| `active_stalled` | | Active, 1 escalated reminder |
| `active_no_fee` | | Active with no fee set |
| `exchanged_overdue` | | Past exchange date |
| `exchanged_this_week` | | Exchanging this week |
| `exchanged_next_week` | | |
| `exchanged_later` | | |
| `exchanged_no_date` | | |
| `completed_recent` | | |
| `completed_last_month` | | |
| `on_hold` | | Has an active `TransactionHoldPeriod` |
| `withdrawn_relist` | | `status = "withdrawn"`, relist trigger |

Also seeded:
- **3-link property chain** anchored on the hero file
- **2 escalated reminders** (chaseCount ≥ rule threshold): one on `active_stalled`, one on `hero`

## Coverage assessment vs the audit checklist

Populated hub sections that ARE reachable via existing fixtures:

- ✅ Populated pipeline stats (active files, exchange counts)
- ✅ Attention items — escalated + overdue urgencies
- ✅ Wins card (completed transactions)
- ✅ Weekly forecast (varied exchange dates across 4 weeks)
- ✅ Service split donut (mix of self-managed vs outsourced via ownedBy)
- ✅ Recent activity ribbon
- ✅ Diary items (upcoming dates)
- ✅ Expired holds card (via `on_hold` fixture aging past its return date)
- ✅ Chain widget (3-link chain on hero)
- ✅ Withdrawn / relist banner path

## Fixture gaps (to seed OR to test manually)

Update this list as the audit surfaces more conditionals:

- ⚠️ **Empty state** — need a fresh director account with **zero** files. Not covered by seed-demo. Options: (a) manually create via `/register` on staging, (b) add a new fixture agency to seed-demo, (c) add a bulletproof "fresh account" seed script.
- ⚠️ **Chain-declined link** — the audit needs to confirm whether the 3-link chain has any link in `DECLINED` state. If not, we need one.
- ⚠️ **PaymentBlockBanner** — needs an agency in `PAST_DUE` payment status. Not currently seeded.
- ⚠️ **PaymentMethodNudge** — needs an agency with billing set up but no method. Not currently seeded.
- ⚠️ **Unassigned files widget populated** — needs at least one transaction with `assignedUserId = null` in an agency where a sales_progressor logs in.
- ⚠️ **NewBuyersToAcknowledge widget** — depends on `getHubRelistsToAcknowledge` shape. Confirm from audit.
- ⚠️ **ChainSetupPending widget** — depends on `getHubChainSetupPending` shape. Confirm from audit.

## Fill-the-gaps recipe

Rather than modify `seed-demo.ts` (which is scoped to demos), the cleanest path is a **new** script:

`scripts/seed-hub-fixtures.ts` — idempotent, safe-rails-checked, creates ONLY the edge-state files not covered by `seed-demo.ts`. Runs on staging as a follow-on to `npm run demo:seed`.

**Decision point** (Ellis): do we (a) extend seed-demo to cover these edges, (b) write a separate `seed-hub-fixtures.ts`, or (c) verify the missing states in production data instead of seeded staging data? Option (c) is fastest but leaves the automated verification tests with no way to reach those states.

Recommendation: **(b)** — small dedicated seed script per surface being migrated. Each surface (hub, file, chain, etc.) gets its own fixture-completeness script. Reusable.

## Action items

- [ ] Ellis decides on gap-fill approach (a/b/c above)
- [ ] Confirm gap list is complete after audit (01-audit.md) lands
- [ ] If (b), write `scripts/seed-hub-fixtures.ts` and add npm script
- [ ] Run the fixture seed against staging before baseline screenshot capture
