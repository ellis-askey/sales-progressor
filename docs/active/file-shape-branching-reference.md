# File-shape branching reference

> Read-only investigation, 2026-05-27. The map for extending the client email matrix to account for file shape (tenure + funding). All facts traced from the actual code — sources cited inline.

---

## 1. The file-shape dimensions the schema actually tracks

[prisma/schema.prisma:209+ `PropertyTransaction`](../../prisma/schema.prisma#L209) + [enums :199–378](../../prisma/schema.prisma#L199).

**Dimensions that affect milestone existence or email content:**

| Field | Type | Values | Effect |
|---|---|---|---|
| `tenure` | `Tenure?` enum | `freehold`, `leasehold` (nullable) | Auto-NRs VM8/VM9/PM12 if freehold |
| `purchaseType` | `PurchaseType?` enum | `mortgage`, `cash_buyer`, `cash_from_proceeds` (nullable) | Auto-NRs PM5/PM6/PM11 if cash_buyer or cash_from_proceeds; additionally auto-NRs PM24 if cash_from_proceeds |
| `isShareOfFreehold` | `Boolean` | true / false | **No milestone effect.** Only used in `lib/services/fees.ts` for VM9 duration prediction (14 days vs 35 days median). Set false on freehold files. |
| `serviceType` | `ServiceType` enum | `self_managed`, `outsourced` | **No milestone effect.** Suppresses `vendorAgent` email variant when `self_managed` ([portal.ts:1064](../../lib/services/portal.ts#L1064)). |

**Dimensions that affect *whether* milestone emails fire at all (but don't change milestone set):**

| Field | Effect |
|---|---|
| `status` ≠ `"active"` | [reminders.ts:306](../../lib/services/reminders.ts#L306) `evaluateTransactionReminders` bails immediately. No chase digest entries created. The on-confirm fan-out still fires (it's not status-gated). |
| `clientEmailsPaused` | [client-chase-cron.ts:315](../../lib/services/client-chase-cron.ts#L315) — chase digest enqueue skipped per file. On-confirm fan-out unaffected. |
| `chainLinkId` set | Triggers additional `enqueueChainMilestoneNotifications` on VM19/PM26 — separate fan-out to other chain participants. Not file-shape branching, but a parallel fan-out worth knowing about. |
| `freeOnExchange` (trial flag) | Billing only. No email or milestone effect. |
| `isMigrated` | Analytics only. No email or milestone effect. |

**Dimensions the schema does NOT track** (so cannot branch on today):

- **Not modelled:** new-build, auction, shared ownership, repossession, probate, help-to-buy. None of these have a field. The string `"new-build"` appears twice in `lib/portal-copy.ts` (VM19/PM26 buildings-insurance line) but only as passive mention — no branching, copy fires identically for new-build and re-sales.
- **Not separately modelled in purchaseType:** "first-time buyer" — no enum value. A first-time buyer is just `mortgage` from the schema's POV.
- **Cash-from-proceeds IS separately modelled** — distinct enum value, auto-NRs PM24 in addition to PM5/PM6/PM11.

---

## 2. Auto-NR rules (the canonical source)

[lib/milestone-auto-nr.ts](../../lib/milestone-auto-nr.ts):

```ts
export const FREEHOLD_NR_CODES       = new Set(["VM8", "VM9", "PM12"]);
export const PURCHASE_TYPE_NR_CODES   = new Set(["PM5", "PM6", "PM11", "PM24"]);

export function computeAutoNrCodes(purchaseType, tenure): Set<string> {
  const codes = new Set<string>();
  if (tenure === "freehold") { for (const c of FREEHOLD_NR_CODES) codes.add(c); }
  if (purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds") {
    codes.add("PM5"); codes.add("PM6"); codes.add("PM11");
  }
  if (purchaseType === "cash_from_proceeds") { codes.add("PM24"); }
  return codes;
}
```

Single source of truth. Consumed by:
- `initializeMilestoneCompletions` ([milestones.ts:93](../../lib/services/milestones.ts#L93)) — at file creation
- `confirmSaleDetailsAction` — when tenure/purchaseType is edited later
- `ReconcileMilestonePicker` (client mirror) — to grey out picks the agent shouldn't make

**Symmetry note:** "Cash buyer" suppresses PM5/PM6/PM11 (no mortgage). "Cash from proceeds" suppresses the same plus PM24 (deposit comes from a concurrent sale's equity, not a fresh transfer). Cash buyers DO transfer a deposit — PM24 fires for them.

---

## 3. Per file shape — exactly which milestones fire vs auto-NR

Vendor side has 20 codes (VM1–VM20). Purchaser side has 27 codes (PM1–PM27). Total 47.

For each tenure × purchaseType combo, the auto-NR'd codes are the union of the two rule sets:

| tenure | purchaseType | Auto-NR'd codes | Codes that fire | # fire |
|---|---|---|---|---|
| `freehold` | `mortgage` | VM8, VM9, PM12 | 47 − 3 = 44 | 44 |
| `freehold` | `cash_buyer` | VM8, VM9, PM12, PM5, PM6, PM11 | 47 − 6 = 41 | 41 |
| `freehold` | `cash_from_proceeds` | VM8, VM9, PM12, PM5, PM6, PM11, PM24 | 47 − 7 = 40 | 40 |
| `leasehold` | `mortgage` | (none auto-NR'd) | 47 | 47 |
| `leasehold` | `cash_buyer` | PM5, PM6, PM11 | 47 − 3 = 44 | 44 |
| `leasehold` | `cash_from_proceeds` | PM5, PM6, PM11, PM24 | 47 − 4 = 43 | 43 |

**The two dimensions compose freely.** All six combinations are legal at file creation, and the auto-NR sets are additive with no special-case "leasehold cash buyer" handling. No milestone depends on BOTH dimensions simultaneously.

**Note on `isShareOfFreehold`:** A leasehold file with `isShareOfFreehold=true` still fires VM8/VM9/PM12 — the auto-NR only checks `tenure === "freehold"`, not the boolean. This is deliberate; share-of-freehold properties often still have managing agents and management packs. If the file in fact doesn't need a management pack, the agent N/Rs it manually.

---

## 4. What auto-NR does to emails — concrete answer

**Auto-NR'd milestones fire NO client-facing email.** Confirmed by tracing two paths:

### 4.1 At creation time (initializer)

[lib/services/milestones.ts:93–149](../../lib/services/milestones.ts#L93) `initializeMilestoneCompletions`:

```ts
return prisma.milestoneCompletion.upsert({
  ...
  create: {
    transactionId,
    milestoneDefinitionId: def.id,
    state,                                    // "not_required" for auto-NR codes
    notRequiredReason: isNr ? "Auto-set at file creation" : null,
    completedById: createdById ?? null,
    createdAt: now,
  },
  update: {},
});
```

This is the ONLY write. It does not call `sendAdminMilestoneNotificationToPortal`, does not write an `OutboundMessage`, does not call `pushToTransaction`. The auto-NR'd row exists in the DB and that's it. The milestone simply doesn't exist in the user's reality — it's never surfaced as a step, never chased, never emailed about.

### 4.2 At manual mark-N/R time (post-creation)

[lib/services/milestones.ts:771–822](../../lib/services/milestones.ts#L771) `markNotRequired`:

- Writes the `MilestoneCompletion` row with `state="not_required"`
- Calls `unlockDirectDependents` + `maybeUnlockExchangeGate` (state-cascade housekeeping)
- Writes a single `OutboundMessage` with `type: "internal_note"` — visible only in the file's internal activity timeline, NOT emailed
- Calls `evaluateTransactionReminders` (added by PR1) to deactivate any active reminder

It does NOT call any client-facing email path. **No "this step was skipped" email exists, in either auto-NR or manual-NR flow.** The matrix has empty cells for auto-NR'd codes per file shape, not skip-cells.

### 4.3 Chase digest effect

[lib/services/reminders.ts:267–272](../../lib/services/reminders.ts#L267):

```ts
if (rule.targetMilestoneCode) {
  const targetCompletion = completionByCode.get(rule.targetMilestoneCode);
  if (targetCompletion && (targetCompletion.state === "complete" || targetCompletion.state === "not_required")) {
    await deactivateLog(transactionId, rule.id, "Target milestone confirmed", assignedUserId);
    continue;
  }
}
```

Auto-NR'd milestones have `state === "not_required"` → the reminder rule targeting that code is deactivated → never appears as a chase digest bullet. So auto-NR'd milestones produce zero bullets, zero emails, on any channel.

---

## 5. Copy that ALREADY conditions on file shape

### 5.1 Real interpolation (template `{vars}` resolved at send time)

**Only PM6 today.** [lib/services/portal.ts:1012–1030](../../lib/services/portal.ts#L1012):

```ts
const eventDateVar = formattedEventDate ? ` — ${formattedEventDate}` : "";
const eventDateClause = formattedEventDate
  ? `booked for ${formattedEventDate}`
  : milestoneCode === "PM6" ? "a desktop valuation (no physical visit required)" : "";
const isDesktop = milestoneCode === "PM6" && !formattedEventDate;
const purchaserPhysicalNote = (milestoneCode === "PM6" && !isDesktop)
  ? " Their primary concern is that it's worth enough to secure their loan — it's not a structural survey and won't flag problems with the condition of the property."
  : "";
const vendorVisitNote = milestoneCode === "PM6"
  ? isDesktop
    ? " No physical visit to the property is needed — the assessment is conducted remotely."
    : " A surveyor acting for the lender will visit to value the property — access has been arranged, so nothing else for you to do right now."
  : "";
```

| Variable | Used by | What it branches on |
|---|---|---|
| `{eventDate}` | PM6, PM9 bodies | Whether the milestone has an event date stamp on the completion (date present vs absent) |
| `{eventDateClause}` | PM6 purchaser body | Same as above — but for PM6 specifically interpolates "a desktop valuation (no physical visit required)" when date is absent |
| `{vendorVisitNote}` | PM6 vendor body | Whether the valuation is physical (date present) or desktop (date absent) |
| `{purchaserPhysicalNote}` | PM6 purchaser body | Physical only — empty string on desktop |
| `{completionDate}` | VM19 vendorAgent body | The transaction's `completionDate` field |
| `{address}` | Universal | Just the property address (not really branching, just substitution) |

**That's the entire interpolation set.** No `{tenure}`, no `{purchaseType}`, no `{isShareOfFreehold}` variables exist. Tenure and funding never branch wording at send time.

### 5.2 Hard-coded inline qualifiers (no interpolation — text always fires as-is)

Several `whatNext` paragraphs hand-wave the conditional with an "if you" qualifier rather than branching. These fire identically on every file regardless of shape — the recipient just ignores the bit that doesn't apply.

- **VM1 vendor `whatNext`**: `"Your solicitor will prepare the contract pack and, if the property is leasehold, request the management pack from your freeholder or managing agent."` Fires on freehold files too (the "if leasehold" qualifier saves it; reads as harmless).
- **PM2 purchaser `whatNext`**: `"If you're buying with a mortgage, also make sure your application is progressing."` Fires on cash files too (qualifier saves it).
- **VM19 purchaser / PM26 purchaser `whatNext`**: `"...as for new-builds and many leaseholds the freeholder's policy covers the building."` Fires on freehold re-sales too (passive mention, harmless).

These are the only "if X" qualifiers in the matrix. They're fine — they read naturally on any file shape.

### 5.3 Hard-coded copy that wrongly assumes a file shape

**Copy that assumes mortgage but fires on cash purchases as-is today:**

| Code | Recipient | Phrase | Why it fires wrong |
|---|---|---|---|
| **PM7** | purchaser | `whatNext`: `"In parallel, keep your mortgage application and survey progressing."` | PM7 fires on every file. On cash files, "your mortgage application" doesn't exist. **Misleading copy.** |
| **PM21** | purchaser | `whatHappened`: `"...the title, the search results, the replies to enquiries, and any conditions attached to your mortgage offer."` | PM21 fires on every file. Cash buyers have no mortgage offer. **Inaccurate copy.** |

These are the two cells that genuinely misrepresent the cash buyer's reality. Worth flagging because they'd need branching when you extend the matrix.

**Copy that assumes leasehold but fires on freeholds**: none found. The three leasehold-specific milestones (VM8/VM9/PM12) are auto-NR'd on freeholds and never email, so their "leasehold paperwork" framing is fine. Other milestones don't bake leasehold into the prose.

**Copy with explicit role-specific framing that holds for both funding paths**: PM5/PM6/PM11 bodies mention "your broker" / "your lender" — they only fire when funding is mortgage, so this is correct.

---

## 6. Interaction summary — what combines, what doesn't

### 6.1 Combinations

All six tenure × purchaseType combinations are legal and supported. The auto-NR sets compose by **set union**:

```
autoNr(tenure, purchaseType) = FREEHOLD_NR_CODES(if freehold) ∪ PURCHASE_TYPE_NR_CODES(if cash) ∪ {PM24}(if cash_from_proceeds)
```

No combination is rejected at creation. No combination triggers a special-case milestone or special-case copy.

### 6.2 No milestone depends on BOTH dimensions

There is no code that says "if tenure=X AND purchaseType=Y, do something special." Auto-NR rules are additive but independent. Copy doesn't reference both dimensions in any single string. The dimensions are orthogonal.

### 6.3 What's NOT orthogonal

- **`isShareOfFreehold`** only meaningful when `tenure="leasehold"`. The form's UI surfaces this checkbox only on leasehold ([app/admin/migrate/MigrateSaleForm.tsx](../../app/admin/migrate/MigrateSaleForm.tsx)). On freehold, `isShareOfFreehold` is always false. So practically it's a sub-dimension of leasehold.
- **`serviceType`** is independent of tenure/funding but interacts with email fan-out: on `self_managed` files, the `vendorAgent` variant is suppressed. So `serviceType` is its own dimension if you're building a recipient × file-shape matrix.

---

## 7. Implications for the extended client email matrix

Concrete map for what the matrix needs to express:

1. **Per file shape, the milestones that fire are a strict subset of 47.** The matrix has empty rows for auto-NR'd codes on the relevant shapes (per §3 table). It is not a "skipped" cell with copy; it is *no email at all*.

2. **Two cells today fire substantively incorrect copy on cash files** (PM7 purchaser `whatNext`, PM21 purchaser `whatHappened` — §5.3). These need branched copy when you extend the matrix to account for funding. Everything else either auto-NRs cleanly or uses "if you" inline qualifiers that read fine on any shape.

3. **PM6 is the only milestone with real send-time interpolation today.** If the extended matrix wants more (e.g. tenure-branched copy on VM7), you'd be adding new template variables to `lib/services/portal.ts`'s `extraVars` block — there's no existing pattern for tenure-driven interpolation.

4. **`isShareOfFreehold` and `serviceType` are real axes too**, even though the user's question framed it as tenure × funding. The full file-shape matrix has 4 dimensions if you want completeness:
   - tenure (2 values)
   - purchaseType (3 values)
   - isShareOfFreehold (2 values, leasehold-only)
   - serviceType (2 values — agent-side recipient changes)

   The minimum useful matrix is the tenure × purchaseType (6 combos). `isShareOfFreehold` is only a copy concern if you want to thank the freeholder fee on completion, etc. `serviceType` doesn't change the milestone set or per-milestone copy — only whether the agent FYI fires.

5. **No new-build / auction / shared ownership branching exists today**, so the matrix can't condition on those without first adding schema fields. The two `"new-build"` mentions in current copy (VM19/PM26 purchaser) are passive ("for new-builds and many leaseholds...") and don't need branching as-is.

6. **The `clientEmailsPaused` and `status="on_hold"` toggles are global suppression**, not branching — they don't change what an email *says*, they just stop it from firing. Worth noting in the matrix as "row entirely suppressed" cases rather than as branching axes.

---

## 8. The two cells that genuinely need branched copy (today's bugs)

To save you grep time later — these are the two flat strings that wrongly assume mortgage and fire to cash buyers as-is:

**PM7 → purchaser → `whatNext`** ([portal-copy.ts:890](../../lib/portal-copy.ts#L890)):
```
"Your solicitor will work through the contract pack and raise enquiries.
 If you haven't already ordered searches, make sure that's in hand —
 your solicitor needs your payment on account before they can do so.
 In parallel, keep your mortgage application and survey progressing."
```

**PM21 → purchaser → `whatHappened`** ([portal-copy.ts:1363](../../lib/portal-copy.ts#L1363)):
```
"Your solicitor has sent you their final report — a comprehensive summary
 of everything about the property: the title, the search results, the
 replies to enquiries, and any conditions attached to your mortgage offer.
 This is the document you need to review before signing the contract."
```

Both fire identically on cash purchases today. Branching them on `purchaseType` would be the first real tenure/funding interpolation in the matrix (beyond PM6's physical/desktop split).

---

## 9. Cross-reference — sources used

- Schema enums + PropertyTransaction model: [prisma/schema.prisma:199–378](../../prisma/schema.prisma#L199)
- Auto-NR rules: [lib/milestone-auto-nr.ts](../../lib/milestone-auto-nr.ts)
- Initializer: [lib/services/milestones.ts:93](../../lib/services/milestones.ts#L93)
- Manual N/R: [lib/services/milestones.ts:771](../../lib/services/milestones.ts#L771)
- Reminder eval (skips inactive, deactivates N/R targets): [lib/services/reminders.ts:215](../../lib/services/reminders.ts#L215)
- Chase digest: [lib/email/client-chase-digest.ts](../../lib/email/client-chase-digest.ts)
- Fan-out logic: [lib/services/portal.ts:742](../../lib/services/portal.ts#L742), `sendRichMilestoneEmails:980`
- PM6 interpolation: [lib/services/portal.ts:1012](../../lib/services/portal.ts#L1012)
- All `emailCopy` entries: [lib/portal-copy.ts:49–1571](../../lib/portal-copy.ts)
