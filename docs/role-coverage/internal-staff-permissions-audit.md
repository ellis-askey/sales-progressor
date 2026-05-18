# Internal Staff Permissions Audit

Items surfaced during the `/agent/transactions/[id]` role-coverage pass that require a dedicated security/permissions review. These are not fixed inline — they need deliberate access-control decisions and backend enforcement verification.

---

## FU-09 — `deleteCommAction` has no UI role gate on transaction detail

**Source:** /agent/transactions/[id] inventory  
**Summary:** `ActivityTimeline.tsx` renders a delete button on every communication entry for any authenticated user with file access. SP and admin can delete any comm on any file they can view. Backend `deleteCommAction` server action must enforce role/ownership restriction.  
**Recommendation:** SP can delete their own logged comms only; admin can delete any. UI: hide the delete button for SP on entries they don't own.  
**When to revisit:** Security/permissions audit pass.

---

## FU-10 — `confirmMilestoneAction` has no UI role gate

**Source:** /agent/transactions/[id] inventory  
**Summary:** `NextMilestoneWidget` and `MilestonePanel` expose milestone confirm buttons to all roles. SP managing their assigned outsourced files SHOULD confirm milestones (that's their job). Admin confirming is acceptable as override access. Backend action must verify auth.  
**Likely not a bug:** SP and admin both have legitimate need. Verify backend enforces auth regardless.  
**When to revisit:** Security audit pass.

---

## FU-11 — `EditSaleDetailsDrawer` exposes agent fee editing to SP

**Source:** /agent/transactions/[id] inventory  
**Status:** UI gate shipped in role-coverage pass — edit button hidden for SP via `canEditSaleDetails={!isProgressor}`. Backend enforcement TBD.  
**Remaining gap:** `saveAgentFeeAction`, `savePriceAction`, `saveReferralAction` server actions must check that the caller is not a `sales_progressor`. UI gate is defence-in-depth only.  
**When to revisit:** Backend permissions audit.

---

## FU-17 — `/api/chase/send-email` and `/api/ai/generate-chase` fail for SP/admin

**Source:** /agent/work-queue inventory  
**Summary:** Two Chase API routes use hard `agencyId` equality that breaks for internal staff (agencyId = null/""):

`/api/chase/send-email` (route.ts line 24):
```ts
where: { id: transactionId, agencyId: session.user.agencyId }
```
SP/admin: `agencyId = null/""`→ `findFirst` returns `null` → **404 "Transaction not found"**.

`/api/ai/generate-chase` (route.ts lines 114, 147):
```ts
if (primaryTask.transaction.agencyId !== session.user.agencyId) { return 403 }
```
SP/admin: `customerAgencyId !== null` → always **403 Forbidden**.

**Fix:** Apply `agencyId ? { id, agencyId } : { id }` bypass in send-email; replace strict equality with `agencyId && primaryTask.transaction.agencyId !== session.user.agencyId` in generate-chase.

**Interim mitigation:** Chase CTA hidden for all internal staff via `hideChase={isInternalStaff}` prop (shipped in role-coverage pass). SP cannot trigger broken path from UI.

**When to revisit:** Before SP Chase workflow is unblocked. Both routes need the agencyId bypass + role authorisation (SP should only chase on their assigned files).

---

## FU-14 — Service type / file ownership gate for SP on transaction detail

**Source:** /agent/transactions/[id] inventory  
**Summary:** SP accessing transaction detail can view all sections of a file — including files they are not assigned to if they know the ID. `getTransactionByScope` with `kind: "assigned"` should reject unassigned files for SP. Verify `getTransactionByScope` enforcement is strict.  
**When to revisit:** Access scope audit, post-Package D.
