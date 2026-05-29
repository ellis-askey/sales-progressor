# SHAPE-NOTES.md — Branching guide for the rewritten email matrix

This file maps every `[SHAPE: ...]` annotation in the rewritten journey files to the variable that branches it. When CC implements the rewrite back into the email skeletons in `lib/email-skeletons/`, this is the reference for what conditional logic each line needs.

The matrix has three independent shape axes. A real journey is the product of all three.

---

## Axis 1: Tenure

`tenure` — one of:
- `freehold`
- `leasehold`

**Affects:** form references (TA7), management-pack arc (Phase 7 entirely), lease/service charge/ground rent references throughout, leasehold-specific framing on Phase 4 forms, leasehold-specific framing on Phase 10/11 enquiries, leasehold-specific items on the final report.

| Annotation | Condition | Behaviour |
|---|---|---|
| `TA7 included on leasehold only` | `tenure === 'leasehold'` | Include "TA7 (the leasehold information form)" alongside TA6 and TA10. On freehold, omit the TA7 reference entirely; the list is just TA6 and TA10. |
| `management pack reference leasehold-only` | `tenure === 'leasehold'` | Include the management-pack sentence/clause. On freehold, omit. |
| `leasehold-specific framing` | `tenure === 'leasehold'` | Use the leasehold-specific framing (e.g. "the buyer's solicitor will scrutinise the leasehold answers closely"). On freehold, drop the qualifier. |
| `leasehold-specific list items` | `tenure === 'leasehold'` | Include "the lease, freeholder relationship, and service charges" in the list. On freehold, omit those items. |
| `leasehold-specific delay framing` | `tenure === 'leasehold'` | Include the "may be waiting on the management pack" clause. On freehold, the contract pack goes once forms are returned with no extra wait described. |
| `lease and service charges leasehold-only` | `tenure === 'leasehold'` | Include "the lease and service charges" in the enquiry-scope list. On freehold, omit those items. |
| `lease, service charges, ground rent, management pack are leasehold-only` | `tenure === 'leasehold'` | Include all four in the final-report-content list. On freehold, omit. |
| `entire phase suppressed on freehold journeys` | `tenure === 'leasehold'` | Phase 7 (management pack — VM8, VM9, PM12) fires only on leasehold. On freehold, all three are auto-marked Not Required. |

---

## Axis 2: Buyer funding

`buyerFunding` (in code, `purchaseType`) — one of:
- `cash_buyer` (no mortgage, no related sale)
- `mortgage` (mortgage required, no related sale)
- `cash_from_proceeds` (no mortgage, deposit comes from a related sale)

**Affects:** Phase 5 (mortgage milestones — PM5, PM6, PM11), Phase 13 (deposit transfer — PM24), chain-dependency language on purchaser emails, deposit-source language on PM25 and PM26, balance-funds language on PM26.

| Annotation | Condition | Behaviour |
|---|---|---|
| `mortgage emails fire on mortgage journey only` | `purchaseType === 'mortgage'` | Phase 5 (PM5, PM6, PM11) fires only on mortgage. On cash_buyer and cash_from_proceeds, all three are auto-marked Not Required. |
| `chain dependency, cash-from-proceeds only` | `purchaseType === 'cash_from_proceeds'` | Include the "related sale" / chain-coordination paragraph in the purchaser email. On cash_buyer and mortgage, omit the paragraph entirely (those buyers have no related sale). |
| `chain dependency line, cash-from-proceeds only` | `purchaseType === 'cash_from_proceeds'` | Include the single-line "your related sale has to exchange before this purchase can" reminder. On cash_buyer and mortgage, omit. |
| `coordination paragraph cash-from-proceeds specific` | `purchaseType === 'cash_from_proceeds'` | Include the paragraph about your solicitor coordinating both transactions to exchange together. On cash_buyer and mortgage, omit (the purchase exchange is standalone). |
| `"deposit covered through the buyer's related sale" replaces "deposit transferred" on cash-from-proceeds` | branch on `purchaseType` | Vendor's PM25 email: on `mortgage` or `cash_buyer`, the line reads "deposit transferred". On `cash_from_proceeds`, it reads "deposit covered through the buyer's related sale". |
| `"your related sale" line is cash-from-proceeds specific` | `purchaseType === 'cash_from_proceeds'` | Purchaser's PM25 email: include the "and your related sale" qualifier in the readiness list. On cash_buyer and mortgage, the readiness list ends at "seller's side". |
| `"deposit funded from related sale's equity" replaces the cash-buyer / mortgage version of this line` | branch on `purchaseType` | PM26 purchaser email: cash buyer wording is "Your deposit has transferred to the seller's side". Mortgage buyer wording is "Your deposit has transferred to the seller's side, and your mortgage advance is locked in". Cash-from-proceeds wording is as written: "Your deposit, funded from your related sale's equity, has been accounted for". |
| `"most of which come from the proceeds of your related sale completing on the same day" is cash-from-proceeds specific` | `purchaseType === 'cash_from_proceeds'` | Include the same-day-proceeds clause. On cash_buyer, the line reads "transferring the balance funds for completion". On mortgage, the line reads "coordinating your mortgage advance and final balance transfer". |
| `deposit-transfer email fires on cash and mortgage buyers only` | `purchaseType !== 'cash_from_proceeds'` | PM24 (deposit transferred) fires for cash_buyer and mortgage. On cash_from_proceeds, PM24 is auto-marked Not Required and no email fires. |

---

## Axis 3: Confirmation route + direction

Two sub-axes that combine.

**`route`** — one of:
- `client_portal` (the buyer or seller confirms via their portal — the email speaks to that person directly)
- `agent` or `sales_progressor` (an agent or our team confirms on the agency's behalf — the email speaks as the agency). In SHAPE-NOTES this is referred to as "internal".

**`direction`** — one of:
- `default` (the milestone is confirmed in the natural order of the bilateral pair) — SHAPE-NOTES calls this "natural"
- `inverse` (the opposite side has already confirmed when this one comes in — the two are catching up to sync)

These apply to bilateral milestones only. Unilateral milestones (VM1, VM3, VM4, VM11, VM14, PM3, PM10, PM16, PM19, PM20, PM22, PM26, PM27) and the agent-confirm-only milestones (VM18, PM25, VM19, VM20) do not branch by route or direction.

### Bilateral milestones (Phase 6, Phase 10, Phase 11, Phase 12)

Each has up to five variants on the acted side: `portal × natural`, `internal × natural`, `portal × inverse`, `internal × inverse`. Plus the hand-off-nudge variants on the counterpart side: `natural` and `inverse`.

| Milestone | Has natural hand-off nudge to counterpart? | Has inverse hand-off nudge? |
|---|---|---|
| VM7 / PM7 (contract pack) | Yes (VM7 → buyer) | Yes (PM7 inverse → seller) |
| PM14 / VM10 (initial enquiries) | Yes (PM14 → seller) | Yes (VM10 inverse → buyer) |
| VM12 / PM15 (initial replies) | Yes (VM12 → buyer) | Yes (PM15 inverse → seller) |
| PM17 / VM13 (follow-up enquiries) | Yes (PM17 → seller) | Yes (VM13 inverse → buyer) |
| VM15 / PM18 (follow-up replies) | Yes (VM15 → buyer) | Yes (PM18 inverse → seller) |

### Voice differences by route (locked across all bilateral variants)

| Route | Opener pattern | Subject pattern |
|---|---|---|
| `portal × natural` | "Thanks. You've confirmed [thing]." | "You've confirmed [thing has happened]" |
| `internal × natural` | "[Thing] has happened. We've logged it on your sale/purchase." | "[Thing has happened]" |
| `portal × inverse` | "Thanks. You've confirmed [thing], and the [other side] has already logged [counterpart action] on their end." | "You've confirmed [thing] [unchanged subject]" |
| `internal × inverse` | "[Thing] has happened. We've logged it on your sale/purchase, ahead of the [other side] having logged [counterpart action]." | "[Thing] logged" |
| `hand-off × natural` | "[Thing] is on the way. When your solicitor confirms it's landed, open your portal and tap the highlighted confirm button. Takes about ten seconds." | "[Thing] on the way, please confirm receipt" or similar |
| `hand-off × inverse` | "The [other side] has logged [their action] ahead of your side confirming [your action]. When your solicitor confirms [your action], open your portal..." | "[Other side] has confirmed [their action]" |

---

## Bilateral firing & suppression — the state logic (READ THIS CAREFULLY)

This is the most important section for getting the bilateral behaviour right. A bilateral milestone is a **pair**: one action confirmed by each side (e.g. contract pack *issued* by seller-side = VM7, and *received* by buyer-side = PM7). The pair is complete only when both sides have confirmed. The rule that matters most is a **suppression**: once a side has confirmed its own half, it must NEVER be emailed again about the other side completing the pair — it already acted, it already knows.

### The core principle

> **Email the side that just took an action. Notify the other side only if they don't already know. Never re-notify a side about something they themselves already confirmed.**

### The four possible events in a bilateral pair, and exactly what fires

Take the contract-pack pair as the worked example (VM7 = seller-side issues; PM7 = buyer-side receives). The same pattern applies to every bilateral pair listed below.

**Event 1 — Seller-side confirms first (natural order opener).**
- ✅ FIRE: acted-side email to the **seller** (VM7 natural-order, portal or internal route as appropriate).
- ✅ FIRE: hand-off nudge to the **buyer** ("the pack's on its way, confirm receipt when your solicitor says it's landed").
- The pair is now half-complete, waiting on the buyer.

**Event 2 — Buyer-side then confirms (completing the pair in natural order).**
- ✅ FIRE: acted-side email to the **buyer** (PM7 natural-order). This is the "thanks, you've confirmed receipt" email.
- 🚫 **SUPPRESS** any email to the **seller**. The seller confirmed in Event 1 and already knows the pack went out. Sending them "the buyer has received it" is the spammy, system-y behaviour we are explicitly avoiding. **No seller email fires on Event 2.**
- Pair complete.

**Event 3 — Buyer-side confirms first (inverse order opener).**
- ✅ FIRE: acted-side email to the **buyer**, the *inverse* variant ("thanks, you've confirmed receipt, ahead of the seller's side confirming it went out").
- ✅ FIRE: inverse-direction hand-off nudge to the **seller** ("the buyer's side has logged receipt ahead of your side confirming issuance, tap to confirm and bring the two in sync").
- Pair half-complete, waiting on the seller.

**Event 4 — Seller-side then confirms (completing the pair in inverse order).**
- ✅ FIRE: acted-side email to the **seller**, the *inverse* variant ("issuance logged, the buyer's side had already confirmed receipt, the two are now in sync").
- 🚫 **SUPPRESS** any email to the **buyer**. The buyer confirmed in Event 3 and already knows. **No buyer email fires on Event 4.**
- Pair complete.

### State to track per bilateral pair

To implement this, CC needs a tiny state machine per bilateral milestone pair, per transaction:

```
state: { sellerSideConfirmed: bool, buyerSideConfirmed: bool }

on seller-side confirm:
  if !buyerSideConfirmed:                         // Event 1 (natural opener)
      send seller acted-side (natural)
      send buyer hand-off nudge (natural)
  else:                                           // Event 4 (inverse completion)
      send seller acted-side (inverse)
      // SUPPRESS buyer — already confirmed in a prior event
  set sellerSideConfirmed = true

on buyer-side confirm:
  if !sellerSideConfirmed:                         // Event 3 (inverse opener)
      send buyer acted-side (inverse)
      send seller hand-off nudge (inverse)
  else:                                            // Event 2 (natural completion)
      send buyer acted-side (natural)
      // SUPPRESS seller — already confirmed in a prior event
  set buyerSideConfirmed = true
```

The single rule that prevents the spammy behaviour: **on the second confirmation of a pair, only the side that just acted is emailed. The side that acted first is never re-notified.**

### Which pairs this applies to (every bilateral milestone)

| Pair | Seller-side milestone | Buyer-side milestone | Natural opener |
|---|---|---|---|
| Contract pack | VM7 (issues) | PM7 (receives) | Seller issues first |
| Initial enquiries | VM10 (receives) | PM14 (raises) | Buyer raises first |
| Initial replies | VM12 (issues) | PM15 (receives) | Seller issues first |
| Follow-up enquiries | VM13 (receives) | PM17 (raises) | Buyer raises first |
| Follow-up replies | VM15 (issues) | PM18 (receives) | Seller issues first |

Note the natural opener differs by pair: for enquiries the *buyer* raises first (so the buyer-side milestone is the natural opener); for the contract pack and replies the *seller* issues first.

### Unilateral milestones do NOT use this logic

Milestones where only one side genuinely acts (VM1, VM3, VM4, VM11, VM14, PM1, PM2, PM3, PM4, PM5, PM6, PM10, PM11, PM16, PM19, PM20, PM24) fire their own acted-side email plus, where shown in the journey files, a one-way informational email to the other side. They have no pair, no natural/inverse direction, and no suppression logic. The agent-confirm-only milestones (VM18, PM25, VM19, PM26, VM20, PM27) fire to both sides and also have no bilateral suppression.

---

## Implementation notes for skeleton authors

**1. The lexicon is locked.** "Related sale" not "concurrent sale". "Has to exchange before this purchase can" not "gating step" or "blocks". No "on its own clock" filler. No em dashes in body copy. Subject lines use comma separators.

**2. Greeting and sign-off are fixed.** Every body opens "Hi {First}," followed by a blank line (the renderer does this automatically). No sign-off — the body ends, then the portal link arrow on its own line (the renderer does this automatically too).

**3. Subject lines.** Pattern: `<descriptive subject>, <propertyAddress>`. Commas not em dashes.

**4. White-labelled "we".** In internal-route emails, "we" is the agency from the recipient's perspective. Our team writes as the agency, never as "Sales Progressor". Portal-route emails to the user use "you" / "your" and avoid the possessive "we" where it would imply institutional voice.

**5. The annotations themselves never render to the user.** `[SHAPE: ...]` annotations are present in the FINAL files for reference. In the skeleton TS files, these become `when` clauses on the relevant `Section`.

**6. One-place-only definitions.** A term defined in its first use (e.g. "enquiries are the formal questions...") should not be redefined in later emails.

**7. When in doubt about a branch, suppress rather than hedge.** If a sentence would need an "if applicable" hedge to be true on the journey, the correct fix is to branch (or suppress the sentence on this shape), not to hedge.
