# Demo Fixtures Manifest

**Last seed:** 2026-06-05 against staging (`etidawkbqctarmsdjoxp`)
**Seed script:** [scripts/seed-demo.ts](scripts/seed-demo.ts)
**Reset script:** [scripts/reset-demo.ts](scripts/reset-demo.ts) (`npm run demo:reset`)
**Verify script:** [scripts/demo-verify.ts](scripts/demo-verify.ts) (`npm run demo:verify`)
**Reset Demo (Command Centre):** `/command/admin/demo` — superadmin only, typed RESET confirmation

> Portal tokens regenerate on every seed. Re-run `npm run demo:verify` to surface fresh URLs.

---

## Logins

| Role        | Email                              | Password         |
|-------------|------------------------------------|------------------|
| Director    | `demo-director@fairview.test`      | `FairviewDemo1!` |
| Negotiator  | `demo-negotiator@fairview.test`    | `FairviewDemo2!` |

**Agency:** Fairview Estates
**Billing noise suppressed:** `firstSubmissionAt = now` + `stripeCustomerId = "demo-stub-not-a-real-stripe-id"` → no trial-expired modal, no PaymentBlockBanner, no PaymentMethodNudge for the demo director.

---

## Fixtures (15 transactions)

All addresses are synthetic. All contact + login emails use `.test` TLDs (RFC 6761 — never deliverable, so even if `sendEmail()` fires past the SendGrid sandbox-mode gap, nothing reaches a real inbox).

### Hero file — the centrepiece
| | |
|---|---|
| **Address** | 42 Hawthorn Road, Bristol, BS6 7NR |
| **Tenure × purchase** | freehold × mortgage |
| **Price** | £525,000 |
| **Owner** | Sarah Whitcomb (director) |
| **Status** | active, mid-journey |
| **What it demonstrates** | Mid-journey file with the full engagement layer: VM1–VM5 + PM1–PM4 confirmed, 2 vendor contacts + 2 purchaser contacts, vendor + purchaser solicitor firms attached, **in a chain** (`Hawthorn Road chain`, position 2 of 3 — stubs upward and downward), 7 OutboundMessages across multiple days with varied methods (email, phone, SMS, voicemail, WhatsApp, internal note), 2 active ClientChaseState rows on Tom Clarke so `/portal/<token>/respond` has work to confirm |
| **Use it for** | Property file walkthrough; demonstrating chain visibility; showing the buyer portal in action |

### Exchange-ready file — the confetti moment
| | |
|---|---|
| **Address** | 8 Elmwood Crescent, Bath, BA1 5DT |
| **Tenure × purchase** | freehold × mortgage |
| **Price** | £695,000 |
| **Owner** | James Patel (negotiator) |
| **Status** | active, every blocksExchange milestone complete or NR; VM18 + PM25 available; **VM19/PM26 NOT confirmed** |
| **What it demonstrates** | The exchange-ready state — both exchange gates sit available, waiting for confirmation |
| **Use it for** | **Confirm VM19 live in the demo for the confetti moment.** Do NOT preconfirm. |

### Active files (×4)
| Address | Tenure × purchase | Price | Owner | What it demonstrates |
|---|---|---|---|---|
| 17 Cedar Lane, Clifton, BS8 2RJ | leasehold × mortgage | £410,000 | Sarah | `expectedExchangeDate = today` — diary entry (coral) |
| 33 Oakfield Avenue, Wells, BA5 2QH | freehold × cash_buyer | £365,000 | James | `completionDate = today` — diary entry (green); already exchanged 21d ago |
| 5 Birch Mews, Frome, BA11 1AB | freehold × mortgage | £480,000 | Sarah | `lastActivityAt = 18d ago` — stalled-files row + FileAlertsStrip |
| 21 Willow Court, Bristol, BS4 3LE | leasehold × cash_from_proceeds | £555,000 | James | `agentFeeAmount = null` — no-fee widget on /agent/analytics |

### Exchanged, awaiting completion (×5)
| Address | Tenure × purchase | Price | Owner | Completion bucket | Notes |
|---|---|---|---|---|---|
| 9 Maple Drive, Bath, BA2 4PG | freehold × mortgage | £740,000 | Sarah | **Overdue** (~4 days late) | Exchanged 8d ago |
| 14 Acacia Close, Bristol, BS7 9TF | freehold × mortgage | £615,000 | James | **This week** | Exchanged 18d ago |
| 27 Ivy Terrace, Clifton, BS8 3HX | leasehold × mortgage | £895,000 | Sarah | **Next week** | Exchanged 4d ago (this month — momentum) |
| 11 Rowan Gardens, Wells, BA5 3DR | freehold × cash_buyer | £425,000 | James | **Later** (~3 weeks out) | Exchanged 35d ago (last month — momentum) |
| 6 Beech Court, Frome, BA11 4SY | leasehold × mortgage | £380,000 | Sarah | **No date set** | Exchanged 42d ago (last month — momentum) |

### Completed (×2)
| Address | Tenure × purchase | Price | Owner | Completed | Notes |
|---|---|---|---|---|---|
| 19 Sycamore Avenue, Bristol, BS5 6BJ | freehold × mortgage | £570,000 | Sarah | ~22 days ago | Exchanged 25d ago (this month) |
| 44 Larch Way, Bath, BA1 8QK | freehold × mortgage | £1,180,000 | James | ~34 days ago | Exchanged 38d ago (last month — top of pipeline value) |

### Edge states (×2)
| Address | Status | What it demonstrates |
|---|---|---|
| 38 Poplar Road, Wells, BA5 1MN | **on_hold** | Renders `OnHoldBanner` on the transaction detail page; has a `TransactionHoldPeriod` row started 6 days ago with `plannedEndAt` 8 days in the future (so the Expired Holds Card stays silent) |
| 55 Hazel Crescent, Frome, BA11 2WP | **withdrawn** (`exchangedAt = null`) | Renders `RelistBanner` on the transaction detail — relist arc demo candidate |

---

## Hero file portal URLs

These four URLs are bookmarkable for the live demo. Visit each in an incognito window (the portal is token-auth, no login required).

| Role | Contact | URL |
|---|---|---|
| Vendor    | David Mitchell | `https://portal.thesalesprogressor.co.uk/portal/d20cc3c8-d2ee-4d5e-8e44-e4c033d80855` |
| Vendor    | Sarah Mitchell | `https://portal.thesalesprogressor.co.uk/portal/864303b8-3ddd-4ecd-9b52-c90ed8248bc7` |
| Purchaser | **Tom Clarke** | `https://portal.thesalesprogressor.co.uk/portal/db0e4498-64c4-4907-aef3-0c1953a87014` |
| Purchaser | Emma Clarke | `https://portal.thesalesprogressor.co.uk/portal/bebc2cf4-5d0e-4999-80b8-9ea0819f0d19` |

**Tom Clarke is the lead purchaser** — has the two active ClientChaseState rows so `/portal/<token>/respond` shows two milestones (PM5 mortgage application, PM7 contract pack) for him to confirm live.

> **These tokens are from the 2026-06-05 seed.** Every `npm run demo:seed` / `demo:reset` / Reset Demo button click regenerates them. Re-run `npm run demo:verify` to print the current set.

---

## Supporting fixtures

- **Solicitor firms (4):** Hartwell Conveyancing, Greenwood Legal, Maple & Cross LLP, Riverside Solicitors. Hartwell + Greenwood are reused across ≥6 files so the solicitor-exchange-stats panel on /agent/analytics has repeat-firm data.
- **Broker firm (1):** Pinnacle Mortgages (2 contacts). Set as the agency's preferred broker (`AgencyPreferredBroker` row, default referral fee £400).
- **Recommended solicitors:** Hartwell + Greenwood marked as recommended with £250 default referral fee — drives the analytics referral-income widget.
- **Referrals:** 3 transactions carry `referredFirmId` + `referralFee` (Hawthorn, Maple, Sycamore via Hartwell; Oakfield via Greenwood).
- **Broker referrals:** 4 transactions carry `brokerFirmId` + `brokerReferralFee` (Hawthorn, Birch, Ivy, Beech, Larch with mixed `purchaserBrokerReferral` flags).

---

## Smoke-check results (from `npm run demo:verify` after the 2026-06-05 seed)

```
PropertyTransaction by status:
    withdrawn : 1
    active    : 11
    completed : 2
    on_hold   : 1
Contact:                33
MilestoneCompletion (complete): 421
ReminderLog (active):   7
ChaseTask:              7
ManualTask:             5
OutboundEmailQueue:     11
ClientChaseState (act): 2
TransactionHoldPeriod:  1
PropertyChain:          1

Work queue buckets:
  Overdue:     4
  Due today:   1
  Coming up:   2
  Escalated:   2
```

All four status tabs populated; every work-queue header pill colour fires; all five completion-date buckets are represented; 421 milestones complete across the agency (routed through `completeMilestone()` so exchange-gate unlock + exchangedAt + lastActivityAt stamps all fired correctly); chain visible on the hero; two active chase states on the hero purchaser so the portal respond page has content.

> **Note on browser-level smoke:** This is a DB-shape verification. Loading each page in a browser (hub, transactions tabs, work-queue, completions, updates, analytics, automated-emails, hero detail, hero purchaser portal home + respond) is a human step — recommend doing it once after the first seed and again immediately before the live demo to catch any visual regression on the staging deployment.

---

## How to operate

### Fresh seed (or reset)
```bash
# Bash (Git Bash on Windows OK)
DEMO_SEED_ALLOWED=true npm run demo:seed

# PowerShell
$env:DEMO_SEED_ALLOWED='true'; npm run demo:seed
```

Both `npm run demo:seed` and `npm run demo:reset` are idempotent — they tear down the existing `Fairview Estates` agency tree before reseeding.

### From the Command Centre
Visit `/command/admin/demo` as a superadmin. The page shows the safety-rail status and a typed-`RESET` confirmation. On success the fresh logins (and confirmation that 15 fixtures landed) are displayed inline — no need to leave the Command Centre.

### Tear down without reseeding
Not exposed as a script — `runSeedDemo` always tears down first then reseeds. If you genuinely need to wipe the demo agency without reseeding, run `npm run demo:reset` once: the wipe is the same; the reseed is the value-add.

### Verify
```bash
npm run demo:verify
```
Read-only. Prints the manifest snapshot above plus fresh portal tokens.

---

## Safety rails (recap)

Both scripts and the Reset Demo server action abort unless:

1. `DATABASE_URL` contains the staging Supabase project id `etidawkbqctarmsdjoxp`.
2. `DATABASE_URL` does NOT contain the production project id `gmkfustgwipgihpmpjpr`.
3. `DEMO_SEED_ALLOWED=true` is set in the environment.

These are duplicated, not OR'd — all three must pass. The Reset Demo page surfaces the per-rail status visually so the demoer knows whether the button is operational before pressing.
