# Sales Progressor — Milestone Weights

**Version:** 1.0 (Locked)
**Last updated:** 2026-04-28
**Companion to:** `MILESTONES_SPEC_v1.md`

---

## 1. Purpose

This document specifies the progress weight assigned to every milestone in the system. It is the single source of truth for progress calculation. Where the live system disagrees, the system is the bug.

Read this alongside the canonical milestones spec. The spec defines structure, predecessors, and behaviour. This document defines the numbers used to calculate progress percentages.

---

## 2. Calculation rules

### 2.1 Per-side calculation

Each side (vendor, purchaser) calculates progress independently. Each side's weights sum to **100%**.

```
side_progress = (sum of weights of complete milestones on this side) /
                (sum of weights of applicable milestones on this side) × 100
```

The denominator is dynamic — it excludes any milestone marked Not required (whether automatically or manually). When milestones become Not required mid-transaction, the denominator shrinks and the percentage adjusts accordingly.

### 2.2 Overall calculation

The overall progress percentage is a 50/50 blend of the two sides:

```
overall_progress = (vendor_progress + purchaser_progress) / 2
```

This means each side has equal influence on the overall progress, regardless of how many milestones are on each side.

### 2.3 Storage and display

- **Storage:** weights are stored as decimal numbers with up to 2 decimal places (e.g. `8.00`, `5.50`, `2.00`).
- **Display:** all percentages shown in the UI are rounded to the nearest whole integer (e.g. `47%`, not `47.3%`). Use standard rounding (0.5 rounds up).
- **Internal logic:** all calculations use the unrounded values. Rounding is a display-only concern.

### 2.4 Edge cases

- **All milestones complete:** progress = 100% (rounded).
- **No milestones complete, all milestones Not required:** progress is undefined — treat as 100% (the side has nothing to do, so it's effectively done). Display a special state if needed.
- **All milestones on a side Not required:** that side's progress = 100%. The blend with the other side proceeds normally.
- **Both sides 100% Not required:** overall = 100%.

---

## 3. Vendor side weights (sums to 100%)

| Order | Milestone ID | Milestone | Weight |
|---|---|---|---|
| 1 | VM1 | Seller has instructed their solicitor | 6.00 |
| 2 | VM2 | Seller has received the memorandum of sale | 3.00 |
| 3 | VM3 | Seller has received the welcome pack from their solicitor | 4.00 |
| 4 | VM4 | Seller has completed ID and AML checks with their solicitor | 3.00 |
| 5 | VM5 | Seller has received the property information forms from their solicitor | 4.00 |
| 6 | VM6 | Seller has returned completed property information forms to their solicitor | 8.00 |
| 7 | VM7 | Seller's solicitor has issued the draft contract pack | 8.00 |
| 8 | VM8 | Seller's solicitor has requested the management pack | 3.00 |
| 9 | VM9 | Seller's solicitor has received the management pack | 3.00 |
| 10 | VM10 | Seller's solicitor has received initial enquiries | 5.00 |
| 11 | VM11 | Seller has provided initial replies to their solicitor | 5.00 |
| 12 | VM12 | Seller's solicitor has issued initial responses to the buyer's solicitor | 5.00 |
| 13 | VM13 | Seller's solicitor has received additional enquiries | 3.00 |
| 14 | VM14 | Seller has provided additional replies to their solicitor | 3.00 |
| 15 | VM15 | Seller's solicitor has issued additional responses to the buyer's solicitor | 3.00 |
| 16 | VM16 | Seller's solicitor has issued contract documents to the seller | 4.00 |
| 17 | VM17 | Seller's solicitor has received signed contract documents back from the seller | 8.00 |
| 18 | VM18 | Seller's solicitor has confirmed readiness to exchange | 8.00 |
| 19 | VM19 | Seller has received confirmation that contracts have exchanged | 9.00 |
| 20 | VM20 | Seller has received confirmation that the sale has completed | 5.00 |

**Total: 100.00** ✓

---

## 4. Purchaser side weights (sums to 100%)

| Order | Milestone ID | Milestone | Weight |
|---|---|---|---|
| 1 | PM1 | Buyer has instructed their solicitor | 5.00 |
| 2 | PM2 | Buyer has received the memorandum of sale | 3.00 |
| 3 | PM3 | Buyer has completed ID and AML checks with their solicitor | 2.00 |
| 4 | PM4 | Buyer has paid money on account to their solicitor | 6.00 |
| 5 | PM5 | Buyer has submitted their mortgage application | 3.00 |
| 6 | PM6 | Lender valuation has been booked | 2.00 |
| 7 | PM7 | Buyer's solicitor has received the draft contract pack | 3.00 |
| 8 | PM8 | Buyer's solicitor has ordered searches | 3.00 |
| 9 | PM9 | Buyer has booked a Level 2 or Level 3 survey | 4.00 |
| 10 | PM10 | Buyer has received the survey report | 3.00 |
| 11 | PM11 | Buyer's solicitor has received the mortgage offer | 6.00 |
| 12 | PM12 | Buyer's solicitor has received the management pack from the vendor's solicitor | 2.00 |
| 13 | PM13 | Buyer's solicitor has received the search results | 3.00 |
| 14 | PM14 | Buyer's solicitor has raised initial enquiries to the seller's solicitor | 3.00 |
| 15 | PM15 | Buyer's solicitor has received initial replies from the seller's solicitor | 3.00 |
| 16 | PM16 | Buyer's solicitor has reviewed the initial replies | 2.00 |
| 17 | PM17 | Buyer's solicitor has raised additional enquiries | 2.00 |
| 18 | PM18 | Buyer's solicitor has received additional replies | 2.00 |
| 19 | PM19 | Buyer's solicitor has reviewed the additional replies | 2.00 |
| 20 | PM20 | Buyer's solicitor has confirmed all enquiries are now satisfied | 6.00 |
| 21 | PM21 | Buyer has received the final report from their solicitor | 3.00 |
| 22 | PM22 | Buyer's solicitor has issued contract documents to the buyer | 3.00 |
| 23 | PM23 | Buyer's solicitor has received the signed contract documents back from the buyer | 6.00 |
| 24 | PM24 | Buyer has transferred the deposit | 3.00 |
| 25 | PM25 | Buyer's solicitor has confirmed readiness to exchange | 7.00 |
| 26 | PM26 | Buyer has received confirmation that contracts have exchanged | 8.00 |
| 27 | PM27 | Buyer has received confirmation that the sale has completed | 5.00 |

**Total: 100.00** ✓

---

## 5. Worked examples

### 5.1 Leasehold-mortgage file (all 47 milestones active)

- Vendor: 20 milestones, all in applicable set, sum to 100%
- Purchaser: 27 milestones, all in applicable set, sum to 100%
- No scaling needed — the stored weights are the active weights

### 5.2 Freehold-cash file at file creation

Auto-marked Not required:
- Vendor: VM8 (3), VM9 (3) — total 6% removed from vendor applicable set
- Purchaser: PM5 (3), PM6 (2), PM11 (6), PM12 (2) — total 13% removed from purchaser applicable set

Vendor applicable total: 94%
Purchaser applicable total: 87%

Progress calculations divide by these totals, NOT by 100. Display rounds to integer.

Example: if VM1 is the only complete milestone on vendor side, vendor progress = 6 / 94 × 100 = 6.38% → displays as `6%`.

### 5.3 Survey marked Not required mid-transaction

Before: PM9 (4) and PM10 (3) are in applicable set. Purchaser applicable total = 100%.
After: PM9 and PM10 cascade to Not required. Purchaser applicable total = 93%.

If buyer has completed PM1-PM4 (5+3+2+6 = 16%) and we're calculating purchaser progress:
- Before: 16 / 100 = 16%
- After: 16 / 93 × 100 = 17.20% → displays as `17%`

The percentage jumped 1 point because the denominator shrunk. Intended behaviour.

### 5.4 Both sides have progress

Vendor side at 32%, Purchaser side at 47%.
Overall = (32 + 47) / 2 = 39.5% → displays as `40%`.

---

## 6. What's NOT in this document

- **Per-milestone reminder timing** — managed in the live system
- **UI placement of progress bars** — separate concern
- **Per-side display format** — UI design decision, not a calculation rule

---

*End of weights document. Used by the implementation prompt as the canonical reference for progress calculation logic.*
