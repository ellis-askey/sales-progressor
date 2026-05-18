# Internal Staff Permissions Audit

Items surfaced during the `/agent/transactions/[id]` role-coverage pass that require a dedicated security/permissions review. These are not fixed inline — they need deliberate access-control decisions and backend enforcement verification.

---

## FU-09 — `deleteCommAction` has no UI role gate on transaction detail

**Source:** /agent/transactions/[id] inventory  
**Status:** ✅ RESOLVED `fe01c26` — `deleteCommunicationRecord` now uses `scope: AccessScope` with `scopeOwnershipWhere`. SP can only delete comms on their assigned files. UI gate (hide delete button for SP entries they don't own) is still desirable defence-in-depth but is no longer a security gap.  
**Remaining:** UI-only polish — hide delete button for SP on comms they didn't create. Not a security issue.

---

## FU-10 — `confirmMilestoneAction` has no UI role gate

**Source:** /agent/transactions/[id] inventory  
**Summary:** `NextMilestoneWidget` and `MilestonePanel` expose milestone confirm buttons to all roles. SP managing their assigned outsourced files SHOULD confirm milestones (that's their job). Admin confirming is acceptable as override access. Backend action must verify auth.  
**Likely not a bug:** SP and admin both have legitimate need. Verify backend enforces auth regardless.  
**When to revisit:** Security audit pass.

---

## FU-11 — `EditSaleDetailsDrawer` exposes agent fee editing to SP

**Source:** /agent/transactions/[id] inventory  
**Status:** ✅ RESOLVED `c7f971f` — `saveAgentFeeAction`, `saveReferralAction`, `saveBrokerReferralAction` now throw `Forbidden` if `session.user.role === "sales_progressor"`. UI gate (`hideCommercialFields={isProgressor}`) remains as defence-in-depth.  
**Remaining:** None. Both UI and backend are gated.

---

## FU-17 — `/api/chase/send-email` and `/api/ai/generate-chase` fail for SP/admin

**Source:** /agent/work-queue inventory  
**Status:** ✅ RESOLVED `0561d04` — both routes now use scope-based ownership checks:

- `/api/chase/send-email`: `scopeOwnershipWhere(scope, transactionId)` — SP can send on assigned files
- `/api/ai/generate-chase`: `canReadTransaction(scope, task.transaction)` — SP can generate on assigned files

**Next step:** Un-hide Chase CTA for SP on work-queue page (separate atomic commit — `hideChase={isInternalStaff}` can now be removed).

---

## FU-18 — `runReminderEngineAction` for SP runs platform-wide

**Source:** /agent/work-queue inventory  
**Status:** ✅ RESOLVED `c751d25` — `runReminderEngine` now accepts an optional `assignedUserId` param. `runReminderEngineAction` passes `session.user.id` for SP, scoping the engine run to SP's assigned transactions only. Agent and admin paths unchanged.

---

## FU-14 — Service type / file ownership gate for SP on transaction detail

**Source:** /agent/transactions/[id] inventory  
**Summary:** SP accessing transaction detail can view all sections of a file — including files they are not assigned to if they know the ID. `getTransactionByScope` with `kind: "assigned"` should reject unassigned files for SP. Verify `getTransactionByScope` enforcement is strict.  
**When to revisit:** Access scope audit, post-Package D.
