# Sales Progressor — Milestone System Specification

**Version:** 1.0 (Canonical)
**Last updated:** 2026-04-28
**Status:** Source of truth. The live system aligns to this document, not the other way around.

---

## 1. Purpose

This document is the canonical specification for the milestone system. It defines:

- All vendor and purchaser milestones
- The order in which they unlock
- Which milestones can be marked not required, and by whom
- Notification audiences (for email)
- How exchange readiness is derived
- How progress is calculated

When the live system disagrees with this document, the document is correct and the system is the bug. All future milestone-related work uses this as the single reference.

---

## 2. State machine

A milestone exists in one of four states:

| State | Meaning |
|---|---|
| **Locked** | The predecessor is not yet complete. Cannot be actioned by the user. Visible in the milestone list but greyed out. |
| **Available** | The predecessor is complete (or this milestone has no predecessor). Ready to be marked complete by a user. |
| **Complete** | The milestone has been confirmed. Counts toward progress. |
| **Not required** | The milestone does not apply to this transaction. Removed from the visible list. Counts toward progress as if it never existed. |

There is no "Blocked" state.

### State transitions

```
   ┌──────────┐  predecessor   ┌────────────┐  user clicks   ┌──────────┐
   │  Locked  │ ─────────────▶ │ Available  │ ─────────────▶ │ Complete │
   └──────────┘  completes     └────────────┘  complete      └──────────┘
        │                            │                            │
        │                            │ marked                     │ uncomplete
        │  marked                    │ not required               │ (with confirm)
        │  not required              ▼                            │
        │                     ┌──────────────┐                    │
        └────────────────────▶│ Not required │                    │
                              └──────────────┘                    │
                                     ▲                            │
                                     └────────────────────────────┘
                                     (uncompleting can flow to either
                                      Available or Locked depending on
                                      whether predecessor is still complete)
```

---

## 3. Roles

Four user roles interact with milestones:

- **Director** — agency staff, full access
- **Negotiator** — agency staff, scoped to their files
- **Progressor** — internal Sales Progressor team (admin side)
- **Buyer / Seller** — clients with portal access (currently informational)

Anyone with access to the file can mark any milestone complete or not required (with the exceptions in §6 below for the survey). There is no role-based completion permission. The "responsibility" field on each milestone is descriptive only — it tells the user who, in the real-world transaction, would normally do the work, so they know who to chase.

---

## 4. Progress calculation

### 4.1 The applicable set

The "applicable set" of milestones for a given file is the full milestone list MINUS any that are marked not required. Whether marked not required automatically (because of tenure or finance settings — see §7) or manually by a user, both are excluded from the applicable set.

### 4.2 Weighted percentage

Each milestone has a weight (assigned in a separate weighting design pass — not in this document yet). Progress is calculated as:

```
progress = (sum of weights of complete milestones / sum of weights of applicable milestones) × 100
```

The denominator is always the sum of weights of the applicable set, NOT a fixed 100. This means the percentage always sums to 100% across the active milestones.

### 4.3 Implications

- When a milestone is marked not required mid-transaction, progress JUMPS up (the denominator shrinks while the numerator stays the same).
- When a not-required marking is undone, progress DROPS back.
- When a complete milestone is uncompleted, progress drops (the numerator shrinks).
- When a complete milestone is marked not required, progress stays the same — the milestone moves from the numerator to outside the applicable set entirely. Mathematically equivalent.

### 4.4 Special case — exchange readiness milestones

VM18 and PM25 (solicitor confirmed readiness to exchange) are special:

- They are always visible
- They are always Locked until ALL OTHER required milestones on their side are either Complete or Not required
- A human (agent / progressor / buyer / seller) confirms them once Available
- They DO count toward progress like any other milestone
- They DO NOT block themselves — the system derives availability automatically

---

## 5. Predecessor logic

Each milestone has at most ONE predecessor (the "previous milestone"). When the predecessor is complete, this milestone moves from Locked to Available.

Some milestones have **no predecessor** — they are immediately Available when the file is created. These are listed below in §7.

### 5.1 Cross-side dependencies are deliberately loose

The system does NOT enforce strict cross-side gates on most milestones. Example: PM7 (Buyer's solicitor received the draft contract pack) is unlocked by PM4 (Buyer paid money on account), NOT by VM7 (Seller's solicitor issued the draft contract pack), even though logically VM7 must precede PM7 in the real world.

Why? Because in practice the buyer often hears about delivery before the seller side knows the pack was sent. The agent uses the buyer-side completion to chase the seller side. Strict cross-side gates would prevent users from logging what they actually know.

The exception is exchange and completion milestones, which are gated by the exchange-readiness check (§4.4).

### 5.2 Cascade behaviour

**On predecessor complete:** dependent milestone moves from Locked → Available.

**On milestone marked not required:** dependent milestones are also auto-marked not required (they cannot logically apply if the parent doesn't). Activity log entry per cascaded change.

**On uncomplete (with confirmation):** dependent milestones revert. Direct dependents go from Complete or Available back to Locked. Cascading through the tree. Confirmation dialog before action: *"Reverting this milestone will lock X dependent milestones and reduce progress by Y%. — Cancel / Confirm."*

---

## 6. Marking not required — rules

### 6.1 Automatic at file creation

The following milestones are auto-marked not required at file creation based on file metadata:

| Milestone | Trigger |
|---|---|
| VM8 (Seller's solicitor requested management pack) | Tenure = Freehold |
| VM9 (Seller's solicitor received management pack) | Tenure = Freehold |
| PM12 (Buyer's solicitor received management pack from vendor's solicitor) | Tenure = Freehold |
| PM5 (Buyer submitted mortgage application) | Purchase type = Cash buyer OR Cash from proceeds |
| PM6 (Lender valuation booked) | Purchase type = Cash buyer OR Cash from proceeds |
| PM11 (Buyer's solicitor received the mortgage offer) | Purchase type = Cash buyer OR Cash from proceeds |

These are excluded from the visible milestone list immediately. No user action.

### 6.2 Manual after file creation

After file creation, only ONE milestone can be marked not required by users:

| Milestone | Who can mark it | Cascade |
|---|---|---|
| PM9 (Buyer has booked a Level 2 or Level 3 survey) | Director, Negotiator, Progressor, Buyer | Cascades to PM10 (Buyer received survey report) |

Marking PM9 not required requires a confirmation dialog: *"Mark survey as not required? This will be logged in the activity timeline and will recalculate progress. — Cancel / Confirm."*

### 6.3 Undoing not required

Marking-not-required can be undone by Directors and Progressors only (not by Negotiators, Buyers, or Sellers — to prevent accidental client-side reactivation). Undoing reverts the milestone to its appropriate state (Locked or Available depending on predecessor) and is logged in the activity timeline.

For automatic-at-creation milestones (§6.1), undoing is theoretically possible but only by a Director (in case of a metadata correction — e.g. tenure was wrong). This needs a stronger confirmation: *"This file was set as Freehold. Reactivating this milestone will treat the file as Leasehold for progress purposes. — Cancel / Confirm."*

---

## 7. Milestones available at file creation

These milestones have **no predecessor** and become Available immediately on file creation (assuming their auto-not-required conditions don't apply):

**Vendor side:**
- VM1 — Seller has instructed their solicitor
- VM2 — Seller has received the memorandum of sale
- VM8 — Seller's solicitor has requested the management pack *(only if Leasehold)*

**Purchaser side:**
- PM1 — Buyer has instructed their solicitor
- PM2 — Buyer has received the memorandum of sale
- PM5 — Buyer has submitted their mortgage application *(only if not Cash buyer / Cash from proceeds)*
- PM9 — Buyer has booked a Level 2 or Level 3 survey

All other milestones are Locked at file creation.

---

## 8. Reminder anchors

Each milestone has a reminder anchor that determines when grace days start counting down:

- **`created_at`** — grace days start from the file creation timestamp (used for milestones available immediately at file creation)
- **`predecessor`** — grace days start from the moment the predecessor milestone is marked Complete

Chase frequency rules (how often reminders fire after grace days expire) are managed in the live system and are out of scope for this spec — they are not redefined here.

---

## 9. Notifications

The "notification audience" column governs who receives **email notifications** when a milestone is marked Complete. It does NOT affect what is visible in the portal — all four parties (Buyer, Seller, Agent, Progressor) can see all milestone activity from both sides in the portal regardless of who completed it.

Notification audiences are listed per-milestone below in §10 and §11.

---

## 10. Vendor milestones (20)

### VM1 — Seller has instructed their solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 1 |
| Predecessor | None (available at file creation) |
| Reminder anchor | `created_at` |
| Responsibility | Seller |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Auto-not-required if | — |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | The legal process cannot start until the seller formally appoints representation. |

### VM2 — Seller has received the memorandum of sale

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 2 |
| Predecessor | None (available at file creation) |
| Reminder anchor | `created_at` |
| Responsibility | Agent |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Auto-not-required if | — |
| Notification audience | Agent, Progressor, Seller |
| Why it matters | Confirms all parties, price, and details so solicitors can begin work accurately. |

### VM3 — Seller has received the welcome pack from their solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 3 |
| Predecessor | VM1 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller |
| Why it matters | Provides the seller with instructions, forms, and requirements to progress the file. |

### VM4 — Seller has completed ID and AML checks with their solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 4 |
| Predecessor | VM3 |
| Reminder anchor | `predecessor` |
| Responsibility | Seller |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller |
| Why it matters | Legal requirement before any work can proceed. |

### VM5 — Seller has received the property information forms from their solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 5 |
| Predecessor | VM4 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller |
| Why it matters | These forms form the foundation of the legal pack and disclosures. |

### VM6 — Seller has returned completed property information forms to their solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 6 |
| Predecessor | VM5 |
| Reminder anchor | `predecessor` |
| Responsibility | Seller |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Enables the solicitor to prepare the draft contract pack. |

### VM7 — Seller's solicitor has issued the draft contract pack

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 7 |
| Predecessor | VM6 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Allows the buyer's solicitor to begin legal review and raise enquiries. |

### VM8 — Seller's solicitor has requested the management pack

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 8 |
| Predecessor | None (available at file creation, leasehold only) |
| Reminder anchor | `created_at` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | Auto-only |
| Auto-not-required if | Tenure = Freehold |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Required for leasehold properties to provide building and management details. |

### VM9 — Seller's solicitor has received the management pack

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 9 |
| Predecessor | VM8 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | Auto-only |
| Auto-not-required if | Tenure = Freehold |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Enables full legal review for leasehold transactions. |

### VM10 — Seller's solicitor has received initial enquiries

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 10 |
| Predecessor | VM7 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Buyer's solicitor has reviewed documents and raised questions. |

### VM11 — Seller has provided initial replies to their solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 11 |
| Predecessor | VM10 |
| Reminder anchor | `predecessor` |
| Responsibility | Seller |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Seller input is required to answer legal and property-specific queries. |

### VM12 — Seller's solicitor has issued initial responses to the buyer's solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 12 |
| Predecessor | VM11 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Keeps the legal process moving and reduces uncertainty. |

### VM13 — Seller's solicitor has received additional enquiries

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 13 |
| Predecessor | VM10 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Follow-up questions based on previous replies or findings. |

### VM14 — Seller has provided additional replies to their solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 14 |
| Predecessor | VM13 |
| Reminder anchor | `predecessor` |
| Responsibility | Seller |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Further clarification required to resolve outstanding issues. |

### VM15 — Seller's solicitor has issued additional responses to the buyer's solicitor

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 15 |
| Predecessor | VM14 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Moves the deal toward enquiry resolution. |

### VM16 — Seller's solicitor has issued contract documents to the seller

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 16 |
| Predecessor | VM7 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Enables the seller to review and sign legal documents. |

### VM17 — Seller's solicitor has received signed contract documents back from the seller

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 17 |
| Predecessor | VM16 |
| Reminder anchor | `predecessor` |
| Responsibility | Seller |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Required before exchange can take place. |

### VM18 — Seller's solicitor has confirmed readiness to exchange

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 18 |
| Predecessor | Derived — see §4.4 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | No (this IS the exchange gate) |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Confirms all legal work is complete on the seller's side. |

**Special:** Locked until ALL other required vendor-side milestones are Complete or Not required. Then becomes Available. Human confirms.

### VM19 — Seller has received confirmation that contracts have exchanged

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 19 |
| Predecessor | VM18 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | No |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | The deal becomes legally binding. |

### VM20 — Seller has received confirmation that the sale has completed

| Property | Value |
|---|---|
| Side | Vendor |
| Order | 20 |
| Predecessor | VM19 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | No |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Ownership has transferred and funds have been received. |

---

## 11. Purchaser milestones (27)

### PM1 — Buyer has instructed their solicitor

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 1 |
| Predecessor | None (available at file creation) |
| Reminder anchor | `created_at` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | The legal process cannot start until the buyer formally appoints representation. |

### PM2 — Buyer has received the memorandum of sale

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 2 |
| Predecessor | None (available at file creation) |
| Reminder anchor | `created_at` |
| Responsibility | Agent |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Buyer |
| Why it matters | Confirms transaction details and allows legal work to begin. |

### PM3 — Buyer has completed ID and AML checks with their solicitor

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 3 |
| Predecessor | PM1 |
| Reminder anchor | `predecessor` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Mandatory legal requirement before progressing. |

### PM4 — Buyer has paid money on account to their solicitor

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 4 |
| Predecessor | PM1 |
| Reminder anchor | `predecessor` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Enables the solicitor to order searches and begin work. |

### PM5 — Buyer has submitted their mortgage application

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 5 |
| Predecessor | None (available at file creation, mortgage buyers only) |
| Reminder anchor | `created_at` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | Auto-only |
| Auto-not-required if | Purchase type = Cash buyer OR Cash from proceeds |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Required to secure funding for the purchase. |

### PM6 — Lender valuation has been booked

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 6 |
| Predecessor | PM5 |
| Reminder anchor | `predecessor` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | Auto-only |
| Auto-not-required if | Purchase type = Cash buyer OR Cash from proceeds |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Confirms the lender's assessment of the property value. |

### PM7 — Buyer's solicitor has received the draft contract pack

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 7 |
| Predecessor | PM4 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Buyer |
| Why it matters | Provides the legal documentation required for review. |

**Note:** This is one of the deliberately loose cross-side dependencies (§5.1). The buyer side may surface this milestone before the seller side knows VM7 has been issued.

### PM8 — Buyer's solicitor has ordered searches

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 8 |
| Predecessor | PM7 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Identifies legal, environmental, and local authority issues. |

### PM9 — Buyer has booked a Level 2 or Level 3 survey

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 9 |
| Predecessor | None (available at file creation) |
| Reminder anchor | `created_at` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | Yes — by Director, Negotiator, Progressor, Buyer |
| Cascade | Marking not required cascades to PM10 |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Assesses the physical condition of the property. |

**User confirmation required to mark not required.** Dialog: *"Mark survey as not required? This will be logged in the activity timeline and will recalculate progress. — Cancel / Confirm."*

### PM10 — Buyer has received the survey report

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 10 |
| Predecessor | PM9 |
| Reminder anchor | `predecessor` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | Auto-only (cascades from PM9) |
| Auto-not-required if | PM9 marked not required |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Identifies risks, defects, or potential renegotiation points. |

### PM11 — Buyer's solicitor has received the mortgage offer

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 11 |
| Predecessor | PM6 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | Auto-only |
| Auto-not-required if | Purchase type = Cash buyer OR Cash from proceeds |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Confirms funding is formally approved. |

### PM12 — Buyer's solicitor has received the management pack from the vendor's solicitor

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 12 |
| Predecessor | VM9 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | Auto-only |
| Auto-not-required if | Tenure = Freehold |
| Notification audience | Agent, Progressor, Buyer |
| Why it matters | Required for leasehold legal review. |

**Note:** Cross-side predecessor — PM12 unlocks when VM9 is complete.

### PM13 — Buyer's solicitor has received the search results

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 13 |
| Predecessor | PM8 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Provides critical legal and environmental insights. |

### PM14 — Buyer's solicitor has raised initial enquiries to the seller's solicitor

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 14 |
| Predecessor | PM7 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Seeks clarification on legal and property matters. |

### PM15 — Buyer's solicitor has received initial replies from the seller's solicitor

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 15 |
| Predecessor | PM14 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Begins resolving uncertainties in the transaction. |

### PM16 — Buyer's solicitor has reviewed the initial replies

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 16 |
| Predecessor | PM15 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Determines if further clarification is needed. |

### PM17 — Buyer's solicitor has raised additional enquiries

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 17 |
| Predecessor | PM14 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Addresses outstanding or unclear issues. |

### PM18 — Buyer's solicitor has received additional replies

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 18 |
| Predecessor | PM17 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Progress toward resolving all enquiries. |

### PM19 — Buyer's solicitor has reviewed the additional replies

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 19 |
| Predecessor | PM18 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Final checks before confirming satisfaction. |

### PM20 — Buyer's solicitor has confirmed all enquiries are now satisfied

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 20 |
| Predecessor | PM19 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Critical step before exchange can be considered. |

### PM21 — Buyer has received the final report from their solicitor

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 21 |
| Predecessor | PM20 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Summarises the transaction and risks before commitment. |

### PM22 — Buyer's solicitor has issued contract documents to the buyer

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 22 |
| Predecessor | PM21 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Enables the buyer to formally agree to the purchase. |

### PM23 — Buyer's solicitor has received the signed contract documents back from the buyer

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 23 |
| Predecessor | PM22 |
| Reminder anchor | `predecessor` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Required for exchange. |

### PM24 — Buyer has transferred the deposit

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 24 |
| Predecessor | PM23 |
| Reminder anchor | `predecessor` |
| Responsibility | Buyer |
| Blocks exchange | Yes |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Financial commitment required to exchange contracts. |

### PM25 — Buyer's solicitor has confirmed readiness to exchange

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 25 |
| Predecessor | Derived — see §4.4 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | No (this IS the exchange gate) |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Confirms all legal and financial conditions are met. |

**Special:** Locked until ALL other required purchaser-side milestones are Complete or Not required. Then becomes Available. Human confirms.

### PM26 — Buyer has received confirmation that contracts have exchanged

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 26 |
| Predecessor | PM25 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | No |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | The purchase becomes legally binding. |

### PM27 — Buyer has received confirmation that the sale has completed

| Property | Value |
|---|---|
| Side | Purchaser |
| Order | 27 |
| Predecessor | PM26 |
| Reminder anchor | `predecessor` |
| Responsibility | Solicitor |
| Blocks exchange | No |
| Can be marked not required | No |
| Notification audience | Agent, Progressor, Seller, Buyer |
| Why it matters | Ownership transfers and the buyer can take possession. |

---

## 12. Activity log entries

The following events generate activity log entries:

| Event | What's logged |
|---|---|
| Milestone marked Complete | Milestone name, who marked it, timestamp |
| Milestone uncompleted (with cascade) | Milestone name, who reverted it, list of cascaded milestones reverted, timestamp |
| Milestone marked Not required (manual) | Milestone name, who marked it, timestamp |
| Milestone marked Not required (auto at file creation) | Milestone name, reason (e.g. "Tenure: Freehold"), timestamp |
| Milestone Not required undone | Milestone name, who reactivated it, timestamp |
| Exchange readiness Available | "All required milestones complete on [side]. Ready to exchange." |

---

## 13. Implementation notes (non-prescriptive)

These are observations for the implementation team, not part of the spec proper:

- **Ordering:** the order numbers (1-20 vendor, 1-27 purchaser) are display order. They do NOT imply strict completion order — predecessor logic is what enforces ordering.
- **Persistence:** marking not required does not delete the underlying record. Use a status field. This allows undo and historical reporting.
- **Atomicity:** cascading operations (not-required cascade, uncomplete cascade) should be transactional — either all the affected milestones update together or none do.
- **Cross-side reads:** when calculating exchange readiness, the system queries only same-side milestones (vendor readiness only checks vendor milestones; purchaser readiness only checks purchaser milestones).
- **Reminder system:** reminder rules in the live system are the source of truth for chase frequency. This document does not attempt to redefine them.

---

## 14. What this spec deliberately does NOT cover

The following are out of scope for this document and managed elsewhere:

- **Weights** — to be designed in a separate weighting design pass before implementation
- **Chase frequency / reminder timing rules** — managed in the live system, not redefined here
- **UI design** — how the milestone list looks, how confirmation dialogs are styled, etc.
- **Notification content** — the actual text of emails sent on milestone events
- **Chain-of-sale handling** — what happens when a "Cash from proceeds" buyer's parent sale milestones change
- **Solicitor portal access** — solicitors aren't in the portal yet; when they are, permissions will need revisiting

---

*End of specification. This document is authoritative. Where the live system disagrees, the system is the bug.*
