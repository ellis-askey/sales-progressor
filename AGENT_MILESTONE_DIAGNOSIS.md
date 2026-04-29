# Agent Portal Milestone Engine — Diagnosis Report (v5)

**Branch:** `mobile-stage5` → merged to `master` 2026-04-29
**Spec authority:** `milestones_filled.xlsx` (canonical — updated 2026-04-28: weights graduated, VM19/PM26 blocksExchange corrected to No)
**Secondary reference:** `docs/MILESTONES_SPEC_v1.md` (930 lines)
**Date:** 2026-04-29 (v5 — all 12 fixes shipped; sprint closed)

---

## Sprint Shipped — What Changed

All 12 fixes in the backlog are now complete and merged to `master`. Summary of what shipped:

| # | Fix | Notes |
|---|---|---|
| 1 | Portal survey bugs (E1+E2) | `PM7` → `PM9` in two places |
| 2 | Spreadsheet reconciliation | Weights graduated; `blocksExchange` corrected |
| 3 | `eventDateRequired` schema | Field on `MilestoneDefinition`; DB migration applied |
| 4 | Bilateral auto-confirm model | VM18/PM25 de-paired; VM19/PM26 + VM20/PM27 paired with atomic transaction |
| 5 | Exchange reconciliation flow | Two-step modal, bulk-complete outstanding, `reconciledAtExchange` flag, reminder/chase cleanup |
| 6 | Exchange Forecast sync | `expectedExchangeDate` upserted on confirm; already-exchanged excluded from forecast |
| 7 | Modal copy + PM6 desktop valuation | `getEventDateLabel`; desktop-no-date checkbox |
| 8 | Edit Sale Details | `EditSaleDetailsModal`, `getSaleDetailsDelta`, `confirmSaleDetailsAction`, `reconcileMilestoneStates` |
| 9 | Cascade-prerequisite audit | `DIRECT_PREREQUISITES` audited; implied route filters already-complete; double-tap guard |
| 10 | Optimistic UI for N/R + undo | All three paths in `startTransition`; `useOptimistic` covers confirm |
| 11 | Undo with cascade preview | Two-step modal (target-only vs cascade); `outOfOrderCompletion` flag; gate re-lock; self-resolving flag |
| 12 | Exchange celebration moment | `ExchangeCelebration.tsx`; confetti; fires on VM19 or PM26; bilateral counterpart suppressed |

**Schema additions this sprint (both migrated to prod):**
- `MilestoneDefinition.eventDateRequired Boolean @default(false)` (Fix 3)
- `MilestoneCompletion.reconciledAtExchange Boolean @default(false)` (Fix 5)
- `MilestoneCompletion.outOfOrderCompletion Boolean @default(false)` (Fix 11)

---

## Hypothesis A — Optimistic UI / React state race conditions

**Verdict: RESOLVED — Fixes 10, 11.**

What exists:
- `MilestoneRow.tsx:38` runs `useOptimistic` on the confirmed row itself (immediate tick-mark on tap).
- `MilestonePanel.tsx` maintains `optimisticallyUnlockedIds: Set<string>` populated by `handleConfirmStart()` using `DIRECT_PREREQUISITES` — correct algorithm.
- Server Action `confirmMilestoneAction` calls `revalidatePath` after every DB write.
- **Fix 10:** N/R and undo/reverse now also run inside `startTransition`; `disabled` during `isPending` prevents double-tap.
- **Fix 11:** Undo path uses `useOptimistic("reverse")` for immediate visual feedback before server round-trip.

Symptoms resolved by fixing: 1, 2, 3, 4, 5.

---

## Hypothesis B — Bilateral milestone pairs incomplete

**Verdict: CONFIRMED — resolved in Fixes 4 + 5.**

### Corrected bilateral model

**VM18 / PM25 — "Solicitor confirms readiness to exchange"**
Independent milestones. Vendor solicitor and purchaser solicitor reach readiness at different times. Confirming one does NOT auto-confirm the other. Both have `blocksExchange: true` — the exchange gate requires both to be confirmed separately. There is no pairing.

**VM19 / PM26 — "Contracts exchanged"**
Bilateral by definition. Exchange happens to both parties simultaneously; confirming on one side confirms the other in the same atomic transaction. Exchange also implies that every outstanding milestone on both sides has happened by this point — a full reconciliation pass is required.

**VM20 / PM27 — "Sale completed"**
Same pattern as VM19/PM26. Bilateral + full reconciliation on both sides.

### What was in the codebase (wrong)
- `app/actions/milestones.ts:69–93` (pre-v4): VM18↔PM25 bilateral block existed. This is wrong.
- VM19↔PM26 and VM20↔PM27: no bilateral block anywhere (in either actions or route). This is wrong by omission.
- `app/api/milestones/route.ts`: no bilateral logic for any pair.

### Fix applied
- **Fix 4** — Removed VM18/PM25 pairing. VM19/PM26 and VM20/PM27 bilateral pairs added with `alreadyDone` guard inside `prisma.$transaction`.
- **Fix 5** — Two-step reconciliation: (1) `getExchangeReconciliationList` reads outstanding milestones; (2) modal shows them; (3) `confirmExchangeReconciliationAction` writes atomic transaction with `reconciledAtExchange: true` on swept rows, cancels open chase tasks, deactivates reminder logs.

Symptoms resolved by Fix 4 + Fix 5: 10, 11, 12.

---

## Hypothesis C — Exchange Forecast reads stale stored fields

**Verdict: CONFIRMED — resolved in Fix 6.**

`getExchangeForecast()` at `lib/services/transactions.ts` and `getHubWeeklyForecast()` in `lib/services/hub.ts` both read `overridePredictedDate ?? expectedExchangeDate` from `PropertyTransaction`. Two issues fixed:

1. **Sync write:** When VM19/PM26 is confirmed, `PropertyTransaction.expectedExchangeDate` is now upserted inside the bilateral transaction.
2. **Already-exchanged exclusion:** Both forecast queries now add `NOT: { milestoneCompletions: { some: { state: "complete", milestoneDefinition: { code: { in: ["VM19", "PM26"] } } } } }` — properties that have already exchanged are excluded from the forecast.

Symptoms resolved by fixing: 17.

---

## Hypothesis D — `eventDateRequired` missing from schema

**Verdict: CONFIRMED — resolved in Fix 3.**

Hardcoded as `DATE_REQUIRED_CODES = new Set(["VM19", "VM20", "PM26", "PM27"])` in four client files. Per the canonical spreadsheet the correct set is **PM6, PM9, PM26, PM27**.

VM19 and VM20 do not require event-date input — they receive their date via bilateral auto-confirm from PM26/PM27 respectively.

Fix 3 added `eventDateRequired Boolean @default(false)` to the `MilestoneDefinition` schema and migrated live DB.

Symptoms resolved by fixing: 13, 14, 15.

---

## Hypothesis E — Portal bugs (wrong codes)

**Verdict: CONFIRMED — resolved in Fix 1.**

- `components/portal/PortalMilestoneList.tsx:252`: skip survey button on `m.code === "PM7"` → corrected to `"PM9"`.
- `lib/services/portal.ts:867`: `PORTAL_NOT_REQUIRED_WHITELIST = { PM7: ["PM20"] }` → corrected to `{ PM9: ["PM10"] }`.

---

## VM18 / PM25 Exchange Gate — Logic Verification

**Gate logic is CORRECT.**

`maybeUnlockExchangeGate()` at `lib/services/milestones.ts`:

```typescript
// 1. Finds all MilestoneDefinitions on same side where blocksExchange = true
// 2. Looks up MilestoneCompletion state for each
// 3. Gate opens only when ALL are complete or not_required
const allClear = blockers.every((b) => {
  const s = blockerMap.get(b.id);
  return s === "complete" || s === "not_required";
});
if (!allClear) return;
```

VM18/PM25 themselves have `blocksExchange: false` in the seed — excluded from their own gate check. The gate unlocks independently per side when all blockers on that side are done. VM18 and PM25 must each be confirmed independently; neither auto-completes the other (Fix 4 corrects the incorrect wiring).

**Post-Fix 5 note:** When VM19/PM26 reconciliation runs and bulk-completes all outstanding milestones on both sides (including VM18/PM25 if they were outstanding), the gate is implicitly satisfied — `maybeUnlockExchangeGate` will be called as part of each `completeMilestone` inside the transaction and will find all blockers clear. No double-fire risk: the gate unlock path only fires `communicationRecord.create` once per side — guarded by `if (gateCompletion.state !== "locked") return`.

**Gate re-lock on undo:** `maybeLockExchangeGate()` (new in Fix 11) runs inside the `executeUndoMilestone` transaction whenever a `blocksExchange: true` milestone is reversed. Checks if gate is currently "available"; if a remaining blocker is now no longer complete/not_required, gate flips back to "locked".

---

## PM6 (Lender Valuation Booked) — Call Graph Trace

Milestone: PM6 "Lender valuation has been booked" — spreadsheet confirms `event_date_required: Yes`.

**Resolved in Fix 3** (schema field) and **Fix 7** (modal copy + desktop valuation toggle).

After Fix 3: PM6 has `eventDateRequired: true` in the DB. The four client files now read `def.eventDateRequired` directly instead of a hardcoded set. The date prompt opens for PM6.

After Fix 7: The date input is labelled **"Valuation date"**. A "Desktop valuation — no date" checkbox appears below the input for PM6 only. When checked, the date input is disabled and confirm fires with `eventDate: null`. Server-side, `completeMilestone` accepts `null` for any milestone — `eventDateRequired` is a UI gate only, no server enforcement.

---

## Spreadsheet ↔ Seed Mismatch Table

**All mismatches resolved.** Spreadsheet updated 2026-04-28.

| Code | Field | Spreadsheet | Seed / Code | Status |
|---|---|---|---|---|
| PM6 | event_date_required | Yes | Now `eventDateRequired: true` in DB | Fixed (Fix 3) |
| PM9 | event_date_required | Yes | Now `eventDateRequired: true` in DB | Fixed (Fix 3) |
| VM19 | event_date_required | No | Now `eventDateRequired: false` in DB | Fixed (Fix 3) |
| VM20 | event_date_required | No | Now `eventDateRequired: false` in DB | Fixed (Fix 3) |
| VM19 | blocksExchange | No | Seed: false | Fixed (spreadsheet corrected) |
| PM26 | blocksExchange | No | Seed: false | Fixed (spreadsheet corrected) |
| All 47 | weight | Graduated | Graduated | Fixed (spreadsheet corrected) |

---

## Fix Plan

### Fix 1 — Portal survey bugs (E1 + E2) ✓ DONE
**Scope: SMALL** — 2 lines.
- `PortalMilestoneList.tsx`: `"PM7"` → `"PM9"` (skip survey button)
- `lib/services/portal.ts`: `PM7: ["PM20"]` → `PM9: ["PM10"]` (whitelist)

---

### Fix 2 — Spreadsheet ↔ seed reconciliation ✓ DONE
**Scope: COMPLETE** — no application code change.
Spreadsheet corrections applied 2026-04-28.

---

### Fix 3 — `eventDateRequired` in schema ✓ DONE
**Scope: MEDIUM** — schema field + migration + 4 component rewrites.
- `eventDateRequired Boolean @default(false)` added to `MilestoneDefinition`
- Migration applied to live Supabase DB
- Seed updated: PM6, PM9, PM26, PM27 = true
- Four `DATE_REQUIRED_CODES` constants removed; replaced with `def.eventDateRequired`
- Type threaded through 5 data pipeline files

---

### Fix 4 — Bilateral auto-confirm model ✓ DONE
**Scope: SMALL-MEDIUM**

- `app/actions/milestones.ts` + `app/api/milestones/route.ts`: VM18/PM25 pairing removed; VM19↔PM26 and VM20↔PM27 added with `alreadyDone` guard
- `BILATERAL_UNDO_PAIRS` map added to `lib/services/milestones.ts` (used by Fix 11 undo)

**Verification:**
- Confirming VM18 on a transaction where PM25 is still incomplete → PM25 stays incomplete ✓
- Exchange gate: VM18 and PM25 each still contribute `blocksExchange: true` independently; gate does not open until both are confirmed separately ✓

---

### Fix 5 — Exchange/Completion reconciliation flow ✓ DONE
**Scope: MEDIUM-LARGE**

Schema addition:
```prisma
reconciledAtExchange Boolean @default(false)  // on MilestoneCompletion
```

Two-step server/client flow:
1. `getExchangeReconciliationList` — read-only; returns outstanding milestones on both sides
2. Reconciliation modal — shows list grouped by side; collapsible; inline date for `eventDateRequired` rows
3. `confirmExchangeReconciliationAction` — single `prisma.$transaction`: complete primary + counterpart + all outstanding (with `reconciledAtExchange: true`); cancel chase tasks; deactivate reminder logs; sync `expectedExchangeDate`/`completionDate`

**Analytics constraint (permanent):** All queries on `MilestoneCompletion.completedAt` gaps MUST filter `reconciledAtExchange = false`. Swept milestones get `completedAt = now()` at exchange time and will corrupt cycle-time averages if included.

---

### Fix 6 — Exchange Forecast sync ✓ DONE
**Scope: SMALL** — 3 files.
- `PropertyTransaction.expectedExchangeDate` upserted inside the `prisma.$transaction` on VM19/PM26 confirm
- `getExchangeForecast` and `getHubWeeklyForecast`: already-exchanged transactions excluded via `NOT milestoneCompletions.some(state: complete, code: VM19/PM26)` filter

---

### Fix 7 — Modal copy + PM6 desktop valuation toggle ✓ DONE
**Scope: SMALL** — 4 files + 1 helper.
- `getEventDateLabel(code)` added to `lib/portal-copy.ts`
- Labels updated in `MilestoneRow`, `PortalNextActionCard`, `PortalMilestoneList`
- PM6-only "Desktop valuation — no date" checkbox in `MilestoneRow` event-date panel
- `NextMilestoneWidget`: no date UI rendered for `eventDateRequired` milestones — no change needed

---

### Fix 8 — Edit Sale Details reconciliation flow ✓ DONE
**Scope: LARGE**

New service function `reconcileMilestoneStates(transactionId, newTenure, newPurchaseType)`:
- Computes delta (auto-NR codes for new vs old values)
- `was not_required, now required` → returns to locked/available (re-evaluates prereq chain)
- `was complete/available/locked, now auto-NR` → switches to `not_required`
- Skips milestones already `complete` — does not revert confirmed work
- Re-runs `maybeUnlockExchangeGate` for both sides after delta

New `EditSaleDetailsModal` component (`components/transaction/EditSaleDetailsModal.tsx`):
- Tenure + purchaseType selectors
- `getSaleDetailsDelta` action called on change to preview affected milestones
- Shows milestones gaining NR (green) and milestones being restored (red) before commit
- `confirmSaleDetailsAction` → `prisma.$transaction`: UPDATE PropertyTransaction + reconcileMilestoneStates

Wired in `TransactionSidebar.tsx`.

---

### Fix 9 — Cascade-prerequisite audit ✓ DONE
**Scope: MEDIUM**

- `DIRECT_PREREQUISITES` audited against spreadsheet "Hard Prerequisites" column — all 47 entries verified
- `/api/milestones/implied` filters already-complete milestones out of the returned list
- `MilestoneRow` sets `loading = true` before fetch; Confirm disabled while in-flight (double-tap guard)

---

### Fix 10 — Optimistic UI for N/R and undo ✓ DONE
**Scope: MEDIUM**

- `markNotRequiredAction` and undo paths wrapped in `startTransition` + `useOptimistic`
- Immediate visual state on all three paths (confirm, N/R, undo)
- `disabled={isPending}` on N/R and undo buttons prevents double-tap

---

### Fix 11 — Undo with cascade preview ✓ DONE
**Scope: LARGE**

Schema addition:
```prisma
outOfOrderCompletion Boolean @default(false)  // on MilestoneCompletion
```

Two-step modal flow:
1. `getUndoImpactAction` — read-only; returns cascade list + three projected percentages
2. Modal with radio choice: "Undo this milestone only" (default) vs "Undo this and downstream milestones" (only shown when cascade exists); cascade list collapsible; reconciled-at-exchange badge

`executeUndoMilestoneAction` — single `prisma.$transaction`:
- Reverses primary milestone (both bilateral partners if `BILATERAL_UNDO_PAIRS` match)
- Cascade mode: also reverses all downstream completed milestones
- Target-only mode: sets `outOfOrderCompletion: true` on downstream milestones
- Re-locks currently-available milestones whose prereq is now gone
- Calls `maybeLockExchangeGate` for affected sides
- Cancels reminder logs + chase tasks for reversed codes
- Creates `CommunicationRecord` entries for audit trail

Self-resolving flag: `completeMilestone` checks for `outOfOrderCompletion: true` rows after confirming the upstream milestone; clears the flag on any downstream milestones whose full prereq chain is now satisfied.

---

### Fix 12 — Exchange celebration moment ✓ DONE
**Scope: SMALL**

`ExchangeCelebration.tsx` — new component:
- `createPortal` to `document.body`; z-index 200 (above all other overlays)
- 120-piece requestAnimationFrame confetti; 7 colours; 3s with 600ms fade; cleanup on unmount
- Scale-in modal card: star icon, "Exchange confirmed", property address, copy text, Continue button

Firing conditions:
- `confirmMilestoneAction` returns `{ triggeredCelebration: true, propertyAddress }` when code is VM19 or PM26
- `confirmExchangeReconciliationAction` returns the same shape for the same codes
- Standard success toast suppressed when `triggeredCelebration` is true
- Bilateral counterpart auto-confirmed by server — never calls a client action — so no second celebration fires

---

## Future Work (not in this sprint)

### 1 — VM20/PM27 Completion celebration
Same pattern as the exchange celebration (Fix 12). Headline "Sale completed", different copy. Low effort — reuse `ExchangeCelebration` with a `type: "exchange" | "completion"` prop.

### 2 — Analytics rebuild filtering
Any existing analytics aggregation on `MilestoneCompletion.completedAt` gaps needs two permanent filters:
- `reconciledAtExchange = false` — exclude milestones swept in at exchange/completion
- `outOfOrderCompletion = false` — exclude milestones that were left complete after a partial undo

This is a **pre-launch blocker for the analytics tab** — without these filters, cycle-time averages will be corrupted.

### 3 — Pre-launch security audit (5 phases)
- RLS policies on all Supabase tables (agency isolation)
- Rate limiting on server actions and API routes
- GDPR: data export + deletion flow for property transaction records
- Session token hardening
- Penetration test on portal auth (agent login flow)

### 4 — Bulk chase + weekly agent email
Listed in deferred features memory. Confirmed wanted but not yet scheduled. Weekly email digest requires either a cron job (Vercel) or Supabase Edge Function; bulk chase requires multi-select in the hub.

### 5 — Two-way portal messaging
Listed in deferred features memory. Current portal is read-only. Add a message thread per transaction; agent sees in hub.

---

## Risk Callouts

| Risk | Fix | Mitigation |
|---|---|---|
| Prisma migration on prod DB | Fix 3 ✓ | `@default(false)` safe; applied via Supabase SQL Editor |
| Prisma migration on prod DB | Fix 5 ✓ | `reconciledAtExchange @default(false)`; applied via `prisma db execute --url DIRECT_URL` |
| Prisma migration on prod DB | Fix 11 ✓ | `outOfOrderCompletion @default(false)`; applied same way |
| VM18/PM25 wrongly wired as bilateral | Fix 4 ✓ | Pairing removed; gate still requires both independently |
| Exchange reconciliation atomicity | Fix 5 ✓ | Single `prisma.$transaction`; all 7 write steps inside |
| Analytics cycle-time pollution | Fix 5 ✓ | `reconciledAtExchange: true` on swept milestones; analytics must filter — see Future Work §2 |
| Gate double-fire after reconciliation | Fix 5 ✓ | `maybeUnlockExchangeGate` guards on `state !== "locked"` — no-ops if already unlocked |
| Portal E1+E2 shipped together | Fix 1 ✓ | Both lines in same commit |
| PM6 completed before purchase type change | Fix 8 ✓ | Skip reconciliation for `complete` records |
| Undo cascade + gate re-lock | Fix 11 ✓ | `maybeLockExchangeGate` called inside `executeUndoMilestone` transaction |
| Out-of-order completions after target-only undo | Fix 11 ✓ | `outOfOrderCompletion` flag; self-resolves on upstream re-confirm |

---

## Scope Summary

| # | Fix | Status | Scope |
|---|---|---|---|
| 1 | Portal survey bugs (E1+E2) | ✓ Done | Small |
| 2 | Spreadsheet reconciliation | ✓ Done | — |
| 3 | `eventDateRequired` in schema + 4 components | ✓ Done | Medium |
| 4 | Bilateral auto-confirm model | ✓ Done | Small-Medium |
| 5 | Exchange/Completion reconciliation flow | ✓ Done | Medium-Large |
| 6 | Exchange Forecast sync + already-exchanged exclusion | ✓ Done | Small |
| 7 | Modal copy + PM6 desktop valuation toggle | ✓ Done | Small |
| 8 | Edit Sale Details reconciliation | ✓ Done | Large |
| 9 | Cascade-prerequisite audit | ✓ Done | Medium |
| 10 | Optimistic UI for N/R + undo | ✓ Done | Medium |
| 11 | Undo with cascade preview | ✓ Done | Large |
| 12 | Exchange celebration moment | ✓ Done | Small |

**Total: 12 fixes. All shipped.**
