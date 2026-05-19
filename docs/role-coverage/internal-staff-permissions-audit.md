# Internal Staff Permissions Audit

Items surfaced during the `/agent/transactions/[id]` role-coverage pass that require a dedicated security/permissions review. These are not fixed inline — they need deliberate access-control decisions and backend enforcement verification.

---

## FU-09 — `deleteCommAction` has no UI role gate on transaction detail

**Source:** /agent/transactions/[id] inventory  
**Status:** ✅ RESOLVED. Backend (`fe01c26`): `deleteCommunicationRecord` uses `scope: AccessScope` with `scopeOwnershipWhere` — SP can only delete comms on their assigned files. UI (`ActivityTimeline.tsx`): delete button gated by `entry.createdById === currentUserId` for SP; agents and admin unaffected. `createdById` added to `ActivityEntry` comm type and query mapping in `lib/services/comms.ts`.

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

## FU-14 — ComposeEmail FROM identity routing for SP

**Source:** /agent/transactions/[id] inventory  
**Status:** ✅ RESOLVED — SP/admin ComposeEmail now resolves sender from the file's agency domain. Happy path: SP's `UserVerifiedEmail` at the agency's `VerifiedDomain` (`"Name <sp@agency.co.uk>"`). Fallback: platform sender (`"Sales Progressor <updates@thesalesprogressor.co.uk>"`), Reply-To = `session.user.email`. ComposeEmail un-hidden for SP/admin on transaction detail when `spSenderIdentity` is resolved. Chase path unchanged (always uses `updates@...` for all roles via `lib/email.ts`).  
**Files:** `app/api/agent/send-email/route.ts`, `components/verified-emails/ComposeEmail.tsx`, `app/agent/transactions/[id]/page.tsx`

---

## FU-21 — Chase send route hardcodes DEFAULT_FROM for all roles

**Source:** /api/chase/send-email route audit  
**Status:** ✅ RESOLVED — `resolveSenderForTransaction` helper extracted to `lib/email.ts`. Handles both paths:  
- Agent (director/negotiator): auto-selects most-recently-used verified email at their agency domain; falls back to DEFAULT_FROM  
- SP/admin: looks up SP's verified email at the file's agency domain (same logic as FU-14); falls back to DEFAULT_FROM with Reply-To = session.user.email  

Chase route now passes `{ from, replyTo }` from the helper to `sendEmail`. Agents who've completed `/agent/settings` domain verification now see their personal sender on outbound chases.  
`/api/agent/send-email` internal staff branch also refactored to use the helper (no behaviour change for ComposeEmail agent path — user-picked fromEmail validation unchanged).  
**Files:** `lib/email.ts`, `app/api/chase/send-email/route.ts`, `app/api/agent/send-email/route.ts`

---

## FU-20 — SP file ownership gate on transaction detail

**Source:** /agent/transactions/[id] inventory  
**Status:** ✅ RESOLVED (already secure — no fix needed). `getTransactionByScope` calls `scopeOwnershipWhere(scope, id)`; for SP (`kind: "assigned"`) this produces `{ id, assignedUserId: scope.userId }`. If SP is not assigned, `findFirst` returns `null` and the page calls `notFound()`. Confirmed in `lib/security/access-scope.ts:71` and `lib/services/transactions.ts:177`.
