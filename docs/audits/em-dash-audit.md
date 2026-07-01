# Em Dash Audit — Client & Agent Emails

Generated 2026-07-01. Scope: every em dash (`—`, U+2014) inside a string that ends up in an email or portal message reaching a client (buyer/seller) or agent (director/negotiator/internal). Code comments excluded — this list is only strings the recipient actually sees.

## Totals

| File | Real string em dashes | Notes |
|---|---:|---|
| `lib/portal-copy.ts` | ~276 | Milestone-copy matrix; 47 milestones × multiple copy fields |
| `lib/emails/retention/index.ts` | 6 | 5 signature lines + 1 sender display name |
| `lib/email/chainNotifications.ts` | ~22 | Chain event subjects + separators + HTML headings |
| `lib/services/portal.ts` | ~27 | Exchange/completion pack, subject lines, body text |
| `lib/email/medians-ready.ts` | ~12 | Internal system email (agent only) |
| `lib/services/survey.ts` | 3 | Post-completion survey to clients |
| `lib/services/portal-messages.ts` | 2 | Portal message notification subjects |
| `lib/services/agent-weekly-brief.ts` | 3 | Agent weekly digest body |
| `lib/services/morning-digest.ts` | 3 | Agent morning digest body |
| **TOTAL** | **~354** | Approx. — a small number of borderline "template concat" cases could swing ±5 |

## Rewrite pattern rules

Every occurrence maps to one of these six patterns. Applying the rule replaces the em dash without changing the meaning.

| Pattern | Shape | Replacement | Example |
|---|---|---|---|
| **A** | Subject line ending `X — {address}` | Colon: `X: {address}` | `"You've instructed your solicitor — {address}"` → `"You've instructed your solicitor: {address}"` |
| **B** | Hero label / short code `VMx — Description` | Colon: `VMx: Description` | `"VM1 — Seller instructed solicitor"` → `"VM1: Seller instructed solicitor"` |
| **C** | Inline body em dash (aside / explanation follows) | Period + capital, OR comma + connector, case-by-case | `"...instructing them — they'll then begin preparing the paperwork."` → `"...instructing them. They'll then begin preparing the paperwork."` |
| **D** | Chain notification subject `Update on {address} — Y` | Colon: `Update on {address}: Y` | `"Update on {address} — the buyer has pulled out"` → `"Update on {address}: the buyer has pulled out"` |
| **E** | Standalone `—` used as text separator before footer | Remove entirely | Line `"—"` before unsubscribe URL → delete the line |
| **F** | Signature `— The Sales Progressor team` | Remove `— ` prefix | `"— The Sales Progressor team"` → `"The Sales Progressor team"` |
| **G** | Sender display name `Ellis — Sales Progressor` | Comma: `Ellis, Sales Progressor` | `"Ellis — Sales Progressor"` → `"Ellis, Sales Progressor"` |

---

## FILE: lib/portal-copy.ts

The single largest source. 47 milestones (VM1–VM20 + PM1–PM27), each with a `vendor`, `purchaser`, and `progressor` copy block. Fields hit: `subject`, `heroLabel`, `opening`, `whatHappened`, `whatNext`, `description`.

### Vendor milestones (VM1–VM20)

**VM1 — Instruct solicitor**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 56 | description | C | `...instructing them — they'll then begin preparing the paperwork.` → `...instructing them. They'll then begin preparing the paperwork.` |
| 59 | vendor.subject | A | `You've instructed your solicitor — {address}` → `You've instructed your solicitor: {address}` |
| 62 | vendor.whatHappened | C | `...conveyancing process — preparing the contract pack, gathering title documents...` → `...conveyancing process, which involves preparing the contract pack, gathering title documents...` |
| 67 | purchaser.subject | A | `The seller has instructed their solicitor — {address}` → `The seller has instructed their solicitor: {address}` |
| 70 | purchaser.whatHappened | C | `...important early step — things are now moving...` → `...important early step. Things are now moving...` |
| 75 | progressor.subject | A | `VM1 complete: Seller instructed solicitor — {address}` → `VM1 complete: Seller instructed solicitor at {address}` |
| 76 | progressor.heroLabel | B | `VM1 — Seller instructed solicitor` → `VM1: Seller instructed solicitor` |

**VM2 — Memorandum of sale received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 90 | vendor.subject | A | `Memorandum of sale issued — {address}` → `Memorandum of sale issued: {address}` |
| 98 | purchaser.subject | A | `Memorandum of sale issued — {address}` → `Memorandum of sale issued: {address}` |
| 102 | purchaser.whatNext | C | `...complete your ID checks — your solicitor can't get fully started until these are done.` → `...complete your ID checks. Your solicitor can't get fully started until these are done.` |
| 106 | progressor.subject | A | `VM2 complete: MoS received — {address}` → `VM2 complete: MoS received at {address}` |
| 107 | progressor.heroLabel | B | `VM2 — MoS received` → `VM2: MoS received` |

**VM3 — Seller received welcome pack**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 118 | description | C | `Return it promptly — delays here slow down the whole transaction.` → `Return it promptly. Delays here slow down the whole transaction.` |
| 121 | vendor.subject | A | `Seller is engaging with their solicitor — {address}` → `Seller is engaging with their solicitor: {address}` |
| 124 | vendor.whatHappened | C | `...welcome pack from their solicitor — the kick-off paperwork for conveyancing on their side.` → `...welcome pack from their solicitor, the kick-off paperwork for conveyancing on their side.` |
| 129 | purchaser.subject | A | `Welcome pack received from your solicitor — {address}` → `Welcome pack received from your solicitor: {address}` |
| 133 | purchaser.whatNext | C | `Complete the forms and return them as soon as you can — ideally within a few days.` → `Complete the forms and return them as soon as you can, ideally within a few days.` |
| 137 | progressor.subject | A | `VM3 complete: Seller received welcome pack — {address}` → `VM3 complete: Seller received welcome pack at {address}` |
| 138 | progressor.heroLabel | B | `VM3 — Seller received welcome pack` → `VM3: Seller received welcome pack` |

**VM4 — Seller ID checks**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 152 | vendor.subject | A | `Seller's ID checks complete — {address}` → `Seller's ID checks complete: {address}` |
| 156 | vendor.whatNext | C | `Nothing for you to do right now — this is one of the early signals...` → `Nothing for you to do right now. This is one of the early signals...` |
| 160 | purchaser.subject | A | `ID checks complete — {address}` → `ID checks complete: {address}` |
| 164 | purchaser.whatNext | C | `...if you haven't yet returned your property information forms when you receive them, do so promptly — delays here are one of the main things that slow transactions down.` → `...if you haven't yet returned your property information forms when you receive them, do so promptly. Delays here are one of the main things that slow transactions down.` |
| 168 | progressor.subject | A | `VM4 complete: Seller ID checks done — {address}` → `VM4 complete: Seller ID checks done at {address}` |
| 169 | progressor.heroLabel | B | `VM4 — Seller ID & AML complete` → `VM4: Seller ID & AML complete` |

**VM5 — Property information forms received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 180 | description | C | `...asking about the property — fixtures included in the sale, disputes, planning consents, and more.` → `...asking about the property: fixtures included in the sale, disputes, planning consents, and more.` |
| 183 | vendor.subject | A | `Seller is gathering property information — {address}` → `Seller is gathering property information: {address}` |
| 191 | purchaser.subject | A | `Property information forms received — {address}` → `Property information forms received: {address}` |
| 195 | purchaser.whatNext | C | `Complete the forms as thoroughly and accurately as you can — these are legal documents.` → `Complete the forms as thoroughly and accurately as you can. These are legal documents.` |
| 199 | progressor.subject | A | `VM5 complete: Seller received property forms — {address}` → `VM5 complete: Seller received property forms at {address}` |
| 200 | progressor.heroLabel | B | `VM5 — Seller received property forms` → `VM5: Seller received property forms` |

**VM6 — Seller returned property forms**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 214 | vendor.subject | A | `Property forms returned to your solicitor — {address}` → `Property forms returned to your solicitor: {address}` |
| 222 | purchaser.subject | A | `The seller has returned their property information forms — {address}` → `The seller has returned their property information forms: {address}` |
| 230 | progressor.subject | A | `VM6 complete: Seller returned property forms — {address}` → `VM6 complete: Seller returned property forms at {address}` |
| 231 | progressor.heroLabel | B | `VM6 — Seller returned property forms` → `VM6: Seller returned property forms` |

**VM7 — Contract pack issued**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 245 | vendor.subject | A | `Draft contract pack sent to the buyer's solicitor — {address}` → `Draft contract pack sent to the buyer's solicitor: {address}` |
| 248 | vendor.whatHappened | C | `...legal foundation of the sale — the contract itself, your property information forms, title documents, and any relevant certificates.` → `...legal foundation of the sale: the contract itself, your property information forms, title documents, and any relevant certificates.` |
| 249 | vendor.whatNext | C | `...likely to raise enquiries — questions about the property and the documents.` → `...likely to raise enquiries, meaning questions about the property and the documents.` |
| 253 | purchaser.subject | A | `The contract pack has arrived with your solicitor — {address}` → `The contract pack has arrived with your solicitor: {address}` |
| 256 | purchaser.whatHappened | C | `...full bundle of legal documents — the draft contract, title documents, property information forms, and more.` → `...full bundle of legal documents: the draft contract, title documents, property information forms, and more.` |
| 261 | (other subject) | A | `Contract pack issued — {address}` → `Contract pack issued: {address}` |
| 269 | progressor.subject | A | `VM7 complete: Contract pack issued — {address}` → `VM7 complete: Contract pack issued at {address}` |
| 270 | progressor.heroLabel | B | `VM7 — Draft contract pack issued` → `VM7: Draft contract pack issued` |

**VM8 — Management pack requested**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 284 | vendor.subject | A | `Leasehold information requested — {address}` → `Leasehold information requested: {address}` |
| 287 | vendor.whatHappened | C | `...leasehold information your solicitor will need — service charges, ground rent, building insurance, and any planned major works.` → `...leasehold information your solicitor will need: service charges, ground rent, building insurance, and any planned major works.` |
| 292 | purchaser.subject | A | `Management pack requested from your freeholder — {address}` → `Management pack requested from your freeholder: {address}` |
| 295 | purchaser.whatHappened | C | `...leasehold information the buyer's solicitor will need — service charge accounts, ground rent history, building insurance, and details of any planned major works.` → `...leasehold information the buyer's solicitor will need: service charge accounts, ground rent history, building insurance, and details of any planned major works.` |
| 296 | purchaser.whatNext | C | `Management packs can take a while — typically several weeks, sometimes longer.` → `Management packs can take a while, typically several weeks, sometimes longer.` |
| 300 | progressor.subject | A | `VM8 complete: Management pack requested — {address}` → `VM8 complete: Management pack requested at {address}` |
| 301 | progressor.heroLabel | B | `VM8 — Management pack requested` → `VM8: Management pack requested` |

**VM9 — Management pack received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 315 | vendor.subject | A | `Management pack received — {address}` → `Management pack received: {address}` |
| 318 | vendor.whatHappened | C (double dash) | `...review the leasehold information — service charges, ground rent, building insurance, and any planned works — before sending it to the buyer's solicitor.` → `...review the leasehold information (service charges, ground rent, building insurance, and any planned works) before sending it to the buyer's solicitor.` |
| 323 | purchaser.subject | A | `Management pack received on your purchase — {address}` → `Management pack received on your purchase: {address}` |
| 326 | purchaser.whatHappened | C | `...leasehold information your solicitor needs — service charges, ground rent, building insurance, and details of any planned major works to the building.` → `...leasehold information your solicitor needs: service charges, ground rent, building insurance, and details of any planned major works to the building.` |
| 331 | progressor.subject | A | `VM9 complete: Management pack received — {address}` → `VM9 complete: Management pack received at {address}` |
| 332 | progressor.heroLabel | B | `VM9 — Management pack received` → `VM9: Management pack received` |

**VM10 — Initial enquiries received (buyer-side)**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 343 | description | C | `...raised questions about the property — these might cover planning history, building works, boundaries, or anything in the documents that needs clarification.` → `...raised questions about the property. These might cover planning history, building works, boundaries, or anything in the documents that needs clarification.` |
| 346 | vendor.subject | A | `Your solicitor's questions are with the seller's side — {address}` → `Your solicitor's questions are with the seller's side: {address}` |
| 350 | vendor.whatNext | C | `Nothing for you to do right now — your solicitor will let you know when the replies come back.` → `Nothing for you to do right now. Your solicitor will let you know when the replies come back.` |
| 354 | purchaser.subject | A | `Buyer's enquiries received — {address}` → `Buyer's enquiries received: {address}` |
| 357 | purchaser.whatHappened | C | `...raised their first round of enquiries — questions about the property and the documents in the contract pack.` → `...raised their first round of enquiries: questions about the property and the documents in the contract pack.` |
| 362 | progressor.subject | A | `VM10 complete: Initial enquiries received — {address}` → `VM10 complete: Initial enquiries received at {address}` |
| 363 | progressor.heroLabel | B | `VM10 — Initial enquiries received` → `VM10: Initial enquiries received` |

**VM11 — Seller provided replies**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 374 | description | C | `Respond as quickly as you can — delays in enquiries are one of the most common reasons transactions stall.` → `Respond as quickly as you can. Delays in enquiries are one of the most common reasons transactions stall.` |
| 377 | vendor.subject | A | `Seller has answered your solicitor's questions — {address}` → `Seller has answered your solicitor's questions: {address}` |
| 381 | vendor.whatNext | C | `Nothing for you to do right now — your solicitor will let you know once the replies are in their hands.` → `Nothing for you to do right now. Your solicitor will let you know once the replies are in their hands.` |
| 385 | purchaser.subject | A | `Replies to enquiries provided — {address}` → `Replies to enquiries provided: {address}` |
| 393 | progressor.subject | A | `VM11 complete: Seller provided enquiry replies — {address}` → `VM11 complete: Seller provided enquiry replies at {address}` |
| 394 | progressor.heroLabel | B | `VM11 — Seller provided replies` → `VM11: Seller provided replies` |

**VM12 — Initial replies sent to buyer's solicitor**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 408 | vendor.subject | A | `Enquiry replies sent to the buyer's solicitor — {address}` → `Enquiry replies sent to the buyer's solicitor: {address}` |
| 411 | vendor.whatHappened | C | `...may come back with further questions — this is completely normal.` → `...may come back with further questions. This is completely normal.` |
| 416 | purchaser.subject | A | `The seller has replied to your solicitor's enquiries — {address}` → `The seller has replied to your solicitor's enquiries: {address}` |
| 424 | progressor.subject | A | `VM12 complete: Initial replies sent to buyer's solicitor — {address}` → `VM12 complete: Initial replies sent to buyer's solicitor at {address}` |
| 425 | progressor.heroLabel | B | `VM12 — Initial replies sent` → `VM12: Initial replies sent` |

**VM13 — Additional enquiries received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 436 | description | C | `This is completely normal — most transactions have at least two rounds of enquiries.` → `This is completely normal. Most transactions have at least two rounds of enquiries.` |
| 439 | vendor.subject | A | `Your further questions are with the seller's side — {address}` → `Your further questions are with the seller's side: {address}` |
| 447 | purchaser.subject | A | `Additional enquiries from the buyer — {address}` → `Additional enquiries from the buyer: {address}` |
| 451 | purchaser.whatNext | C | `...they'll be in touch — please respond as promptly as you can.` → `...they'll be in touch. Please respond as promptly as you can.` |
| 455 | progressor.subject | A | `VM13 complete: Additional enquiries received — {address}` → `VM13 complete: Additional enquiries received at {address}` |
| 456 | progressor.heroLabel | B | `VM13 — Additional enquiries received` → `VM13: Additional enquiries received` |

**VM14 — Seller provided additional replies**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 470 | vendor.subject | A | `Seller has answered the further questions — {address}` → `Seller has answered the further questions: {address}` |
| 478 | purchaser.subject | A | `Additional replies provided — {address}` → `Additional replies provided: {address}` |
| 486 | progressor.subject | A | `VM14 complete: Seller provided additional replies — {address}` → `VM14 complete: Seller provided additional replies at {address}` |
| 487 | progressor.heroLabel | B | `VM14 — Seller provided additional replies` → `VM14: Seller provided additional replies` |

**VM15 — Additional replies sent**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 501 | vendor.subject | A (double dash) | `All enquiry replies sent — moving towards exchange — {address}` → `All enquiry replies sent, moving towards exchange: {address}` |
| 509 | purchaser.subject | A | `The seller has replied to all enquiries — {address}` → `The seller has replied to all enquiries: {address}` |
| 517 | progressor.subject | A | `VM15 complete: Additional replies sent to buyer's solicitor — {address}` → `VM15 complete: Additional replies sent to buyer's solicitor at {address}` |
| 518 | progressor.heroLabel | B | `VM15 — Additional replies sent` → `VM15: Additional replies sent` |

**VM16 — Contract issued to seller**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 529 | description | C | `Read it carefully — check the price, completion date, and what's included in the sale.` → `Read it carefully. Check the price, completion date, and what's included in the sale.` |
| 532 | vendor.subject | A | `Seller has received their contract — {address}` → `Seller has received their contract: {address}` |
| 535 | vendor.whatHappened | C | `This is an important step — the transaction is closing in on exchange.` → `This is an important step. The transaction is closing in on exchange.` |
| 540 | purchaser.subject | A | `Your contract is ready to sign — {address}` → `Your contract is ready to sign: {address}` |
| 543 | purchaser.whatHappened | C | `This is an important step — you're on the way to exchange of contracts.` → `This is an important step. You're on the way to exchange of contracts.` |
| 544 | purchaser.whatNext | C | `...what you're committing to — exchange is the legally binding moment.` → `...what you're committing to. Exchange is the legally binding moment.` |
| 548 | progressor.subject | A | `VM16 complete: Contract issued to seller — {address}` → `VM16 complete: Contract issued to seller at {address}` |
| 549 | progressor.heroLabel | B | `VM16 — Contract issued to seller` → `VM16: Contract issued to seller` |

**VM17 — Seller signed contract**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 560 | description | C | `The contracts aren't exchanged yet — you're signing them ready for exchange, which is the legally binding moment.` → `The contracts aren't exchanged yet. You're signing them ready for exchange, which is the legally binding moment.` |
| 563 | vendor.subject | A | `Seller has signed the contract — {address}` → `Seller has signed the contract: {address}` |
| 571 | vendor.subject (alt) | A (double dash) | `Signed contract received — ready for exchange — {address}` → `Signed contract received, ready for exchange: {address}` |
| 574 | vendor.whatHappened | C | `...commitment this represents — the legally binding moment is exchange, not signing.` → `...commitment this represents: the legally binding moment is exchange, not signing.` |
| 579 | purchaser.subject | A | `Seller signed and returned contract — {address}` → `Seller signed and returned contract: {address}` |
| 587 | progressor.subject | A | `VM17 complete: Seller signed and returned contract — {address}` → `VM17 complete: Seller signed and returned contract at {address}` |
| 588 | progressor.heroLabel | B | `VM17 — Seller signed contract` → `VM17: Seller signed contract` |

**VM18 — Vendor solicitor ready to exchange**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 602 | vendor.subject | A | `Your solicitor is ready to exchange — {address}` → `Your solicitor is ready to exchange: {address}` |
| 606 | vendor.whatNext | C | `Once both solicitors confirm, exchange can be arranged quickly — make sure you're reachable.` → `Once both solicitors confirm, exchange can be arranged quickly. Make sure you're reachable.` |
| 610 | purchaser.subject | A | `The seller's solicitor is ready to exchange — {address}` → `The seller's solicitor is ready to exchange: {address}` |
| 618 | progressor.subject | A | `VM18 complete: Vendor solicitor ready to exchange — {address}` → `VM18 complete: Vendor solicitor ready to exchange at {address}` |
| 619 | progressor.heroLabel | B | `VM18 — Vendor solicitor ready to exchange` → `VM18: Vendor solicitor ready to exchange` |

**VM19 — Contracts exchanged**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 633 | vendor.subject | A (double dash) | `Contracts exchanged — your sale is legally committed — {address}` → `Contracts exchanged, your sale is legally committed: {address}` |
| 637 | vendor.whatNext | C | `Your solicitor will manage the legal transfer of funds — you'll hear from them on the day.` → `Your solicitor will manage the legal transfer of funds. You'll hear from them on the day.` |
| 647 | purchaser.subject | A | `Exchange confirmed — {address}` → `Exchange confirmed: {address}` |
| 655 | progressor.subject | A | `VM19 complete: Contracts exchanged — {address}` → `VM19 complete: Contracts exchanged at {address}` |
| 656 | progressor.heroLabel | B | `VM19 — Contracts exchanged` → `VM19: Contracts exchanged` |

**VM20 — Sale completed**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 670 | vendor.subject | A (double dash) | `Sale complete — congratulations — {address}` → `Sale complete, congratulations: {address}` |
| 672 | vendor.opening | C | `Congratulations — it's done.` → `Congratulations. It's done.` |
| 674 | vendor.whatNext | C | `Keep your completion statement safely for your records — you may need it for tax purposes.` → `Keep your completion statement safely for your records. You may need it for tax purposes.` |
| 683 | purchaser.subject | A | `Completion confirmed — {address}` → `Completion confirmed: {address}` |
| 691 | progressor.subject | A | `VM20 complete: Sale completed — {address}` → `VM20 complete: Sale completed at {address}` |
| 692 | progressor.heroLabel | B | `VM20 — Sale completed` → `VM20: Sale completed` |

### Purchaser milestones (PM1–PM27)

**PM1 — Buyer instructed solicitor**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 705 | description | C | `Contact them to confirm you're instructing them — they'll send you a welcome pack and start work.` → `Contact them to confirm you're instructing them. They'll send you a welcome pack and start work.` |
| 708 | purchaser.subject | A | `You've instructed your solicitor — {address}` → `You've instructed your solicitor: {address}` |
| 712 | purchaser.whatNext | C | `...complete your ID checks as quickly as possible — your solicitor cannot begin substantive work until these are in place.` → `...complete your ID checks as quickly as possible. Your solicitor cannot begin substantive work until these are in place.` |
| 716 | vendor.subject | A | `The buyer has instructed their solicitor — {address}` → `The buyer has instructed their solicitor: {address}` |
| 720 | vendor.whatNext | C | `Nothing for you to do right now — we'll keep you updated as both sides progress.` → `Nothing for you to do right now. We'll keep you updated as both sides progress.` |
| 724 | progressor.subject | A | `PM1 complete: Buyer instructed solicitor — {address}` → `PM1 complete: Buyer instructed solicitor at {address}` |
| 725 | progressor.heroLabel | B | `PM1 — Buyer instructed solicitor` → `PM1: Buyer instructed solicitor` |

**PM2 — MoS received (buyer side)**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 739 | purchaser.subject | A | `Memorandum of sale issued — {address}` → `Memorandum of sale issued: {address}` |
| 743 | purchaser.whatNext | C | `...complete your ID checks — your solicitor can't get fully started until these are done.` → `...complete your ID checks. Your solicitor can't get fully started until these are done.` |
| 747 | progressor.subject | A | `PM2 complete: MoS received — {address}` → `PM2 complete: MoS received at {address}` |
| 748 | progressor.heroLabel | B | `PM2 — MoS received` → `PM2: MoS received` |

**PM3 — Buyer ID checks**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 762 | vendor.subject | A | `Buyer's ID checks complete — {address}` → `Buyer's ID checks complete: {address}` |
| 766 | vendor.whatNext | C | `Nothing for you to do right now — this is one of the early signals...` → `Nothing for you to do right now. This is one of the early signals...` |
| 770 | purchaser.subject | A | `ID checks complete — {address}` → `ID checks complete: {address}` |
| 774 | purchaser.whatNext | C | `...if you haven't yet paid your money on account, do this as soon as possible — your solicitor will need it before they can order searches.` → `...if you haven't yet paid your money on account, do this as soon as possible. Your solicitor will need it before they can order searches.` |
| 778 | progressor.subject | A | `PM3 complete: Buyer ID checks done — {address}` → `PM3 complete: Buyer ID checks done at {address}` |
| 779 | progressor.heroLabel | B | `PM3 — Buyer ID & AML complete` → `PM3: Buyer ID & AML complete` |

**PM4 — Buyer paid money on account**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 793 | vendor.subject | A | `Buyer has put funds with their solicitor — {address}` → `Buyer has put funds with their solicitor: {address}` |
| 797 | vendor.whatNext | C | `Searches will typically be ordered shortly — that's usually the next major step on the buyer's side.` → `Searches will typically be ordered shortly. That's usually the next major step on the buyer's side.` |
| 801 | purchaser.subject | A | `Payment on account received by your solicitor — {address}` → `Payment on account received by your solicitor: {address}` |
| 803 | purchaser.opening | C | `Thank you — your solicitor has received your payment on account.` → `Thank you. Your solicitor has received your payment on account.` |
| 809 | progressor.subject | A | `PM4 complete: Buyer paid money on account — {address}` → `PM4 complete: Buyer paid money on account at {address}` |
| 810 | progressor.heroLabel | B | `PM4 — Buyer paid money on account` → `PM4: Buyer paid money on account` |

**PM5 — Buyer submitted mortgage application**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 824 | vendor.subject | A | `Buyer's mortgage application is in — {address}` → `Buyer's mortgage application is in: {address}` |
| 827 | vendor.whatHappened | C | `The lender will now process the application — this typically includes a valuation visit to the property.` → `The lender will now process the application. This typically includes a valuation visit to the property.` |
| 832 | purchaser.subject | A | `Mortgage application submitted — {address}` → `Mortgage application submitted: {address}` |
| 836 | purchaser.whatNext | C | `Your lender will book a valuation of the property — usually within a week or two.` → `Your lender will book a valuation of the property, usually within a week or two.` |
| 840 | progressor.subject | A | `PM5 complete: Buyer submitted mortgage application — {address}` → `PM5 complete: Buyer submitted mortgage application at {address}` |
| 841 | progressor.heroLabel | B | `PM5 — Buyer submitted mortgage application` → `PM5: Buyer submitted mortgage application` |

**PM6 — Lender valuation booked**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 852 | description | C | `This is not a structural survey — it's for the lender's benefit, not yours.` → `This is not a structural survey. It's for the lender's benefit, not yours.` |
| 855 | vendor.subject | A | `Buyer's lender valuation — {address}` → `Buyer's lender valuation: {address}` |
| 863 | purchaser.subject | A | `Mortgage valuation — {address}` → `Mortgage valuation: {address}` |
| 866 | purchaser.whatHappened | C | `Your lender has arranged a valuation of the property — {eventDateClause}.` → `Your lender has arranged a valuation of the property. {eventDateClause}.` |
| 867 | purchaser.whatNext | C (double) | `now is a good time — a RICS HomeBuyer Report will identify issues the lender's valuation won't cover. Once the valuation is complete, your mortgage offer should follow within 1–3 weeks.` → `now is a good time. A RICS HomeBuyer Report will identify issues the lender's valuation won't cover. Once the valuation is complete, your mortgage offer should follow within 1 to 3 weeks.` (also swaps en dash in 1–3) |
| 871 | progressor.subject | A | `PM6 complete: Lender valuation booked — {address}` → `PM6 complete: Lender valuation booked at {address}` |
| 872 | progressor.heroLabel | B | `PM6 — Lender valuation booked` → `PM6: Lender valuation booked` |

**PM7 — Draft contract pack received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 886 | purchaser.subject | A | `Contract pack received by your solicitor — {address}` → `Contract pack received by your solicitor: {address}` |
| 889 | purchaser.whatHappened | C | `...the legal foundation of the purchase — the draft contract, title documents...` → `...the legal foundation of the purchase: the draft contract, title documents...` |
| 890 | purchaser.whatNext | C | `...if you haven't already ordered searches, make sure that's in hand — your solicitor needs your payment on account before they can do so.` → `...if you haven't already ordered searches, make sure that's in hand. Your solicitor needs your payment on account before they can do so.` |
| 894 | vendor.subject | A | `Your contract pack has arrived with the buyer's solicitor — {address}` → `Your contract pack has arrived with the buyer's solicitor: {address}` |
| 898 | vendor.whatNext | C | `Your solicitor will handle the enquiries — they may need your input on some points, and we'll be in touch if so.` → `Your solicitor will handle the enquiries. They may need your input on some points, and we'll be in touch if so.` |
| 902 | progressor.subject | A | `PM7 complete: Contract pack received — {address}` → `PM7 complete: Contract pack received at {address}` |
| 903 | progressor.heroLabel | B | `PM7 — Draft contract pack received` → `PM7: Draft contract pack received` |

**PM8 — Searches ordered**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 914 | description | C | `Your solicitor has applied for searches — checks with the local council, water authority, and other bodies.` → `Your solicitor has applied for searches: checks with the local council, water authority, and other bodies.` |
| 917 | vendor.subject | A | `Buyer's solicitor has ordered searches — {address}` → `Buyer's solicitor has ordered searches: {address}` |
| 920 | vendor.whatHappened | C | `Searches check for planning permissions, flood risk, and drainage — they're a standard part of the buyer's due diligence.` → `Searches check for planning permissions, flood risk, and drainage. They're a standard part of the buyer's due diligence.` |
| 925 | purchaser.subject | A | `Searches ordered on your purchase — {address}` → `Searches ordered on your purchase: {address}` |
| 929 | purchaser.whatNext | C | `Searches typically take 2–4 weeks to come back depending on the local authority — there's nothing for you to do while you wait.` → `Searches typically take 2 to 4 weeks to come back depending on the local authority. There's nothing for you to do while you wait.` (also swaps en dash) |
| 933 | progressor.subject | A | `PM8 complete: Searches ordered — {address}` → `PM8 complete: Searches ordered at {address}` |
| 934 | progressor.heroLabel | B | `PM8 — Searches ordered` → `PM8: Searches ordered` |

**PM9 — Buyer booked survey**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 945 | description | C (double) | `costs around £400–700 and covers the condition of the property in detail — something the lender's valuation does not do.` → `costs around £400 to £700 and covers the condition of the property in detail — something the lender's valuation does not do.` [First is en dash; the em dash: `...in detail. Something the lender's valuation does not do.`] |
| 948 | vendor.subject | A | `Buyer has booked their survey — {address}` → `Buyer has booked their survey: {address}` |
| 951 | vendor.whatHappened | C | `A surveyor will visit the property — access has been arranged, so nothing else for you to do right now.` → `A surveyor will visit the property. Access has been arranged, so nothing else for you to do right now.` |
| 956 | purchaser.subject | A | `Survey booked — {address}` → `Survey booked: {address}` |
| 960 | purchaser.whatNext | C (multi) | `Most survey reports flag some issues — the report will highlight what your solicitor can formally request information on from the seller, though not all are legal requirements. If significant issues are found and you want to renegotiate, you'll need a specialist contractor to assess them and provide a quote — that quote is what any price reduction would be based on.` → `Most survey reports flag some issues. The report will highlight what your solicitor can formally request information on from the seller, though not all are legal requirements. If significant issues are found and you want to renegotiate, you'll need a specialist contractor to assess them and provide a quote. That quote is what any price reduction would be based on.` |
| 964 | progressor.subject | A | `PM9 complete: Buyer booked survey — {address}` → `PM9 complete: Buyer booked survey at {address}` |
| 965 | progressor.heroLabel | B | `PM9 — Buyer booked survey` → `PM9: Buyer booked survey` |

**PM10 — Survey report received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 976 | description | C | `Most reports flag some issues — many are minor.` → `Most reports flag some issues. Many are minor.` |
| 979 | vendor.subject | A | `Buyer's survey report has been received — {address}` → `Buyer's survey report has been received: {address}` |
| 982 | vendor.whatHappened | C | `Surveys commonly flag some issues — this doesn't necessarily mean there's a problem...` → `Surveys commonly flag some issues. This doesn't necessarily mean there's a problem...` |
| 987 | purchaser.subject | A | `Your survey report has arrived — {address}` → `Your survey report has arrived: {address}` |
| 990 | purchaser.whatHappened | C | `Most surveys flag some issues — it's rare to get a completely clean report...` → `Most surveys flag some issues. It's rare to get a completely clean report...` |
| 991 | purchaser.whatNext | C | `If you have concerns, speak to your solicitor — they can advise on whether to seek a specialist report...` → `If you have concerns, speak to your solicitor. They can advise on whether to seek a specialist report...` |
| 995 | progressor.subject | A | `PM10 complete: Buyer received survey report — {address}` → `PM10 complete: Buyer received survey report at {address}` |
| 996 | progressor.heroLabel | B | `PM10 — Survey report received` → `PM10: Survey report received` |

**PM11 — Mortgage offer received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1007 | description | C | `Your solicitor will receive a copy — they'll need to check it against the property title.` → `Your solicitor will receive a copy. They'll need to check it against the property title.` |
| 1010 | purchaser.subject | A | `Your mortgage offer has arrived — {address}` → `Your mortgage offer has arrived: {address}` |
| 1012 | purchaser.opening | C | `Congratulations — your mortgage is confirmed.` → `Congratulations. Your mortgage is confirmed.` |
| 1014 | purchaser.whatNext | C | `Check the offer carefully — confirm the loan amount, rate, and term match what you agreed...` → `Check the offer carefully. Confirm the loan amount, rate, and term match what you agreed...` |
| 1018 | vendor.subject | A | `The buyer's mortgage offer has been issued — {address}` → `The buyer's mortgage offer has been issued: {address}` |
| 1021 | vendor.whatHappened | C | `The financing for your sale is now confirmed — a significant step towards exchange.` → `The financing for your sale is now confirmed, a significant step towards exchange.` |
| 1026 | (other subject) | A | `Buyer's mortgage offer issued — {address}` → `Buyer's mortgage offer issued: {address}` |
| 1034 | progressor.subject | A | `PM11 complete: Buyer mortgage offer received — {address}` → `PM11 complete: Buyer mortgage offer received at {address}` |
| 1035 | progressor.heroLabel | B | `PM11 — Mortgage offer received` → `PM11: Mortgage offer received` |

**PM12 — Management pack received (buyer side)**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1049 | (subject) | A | `Management pack received — {address}` → `Management pack received: {address}` |
| 1057 | (subject) | A | `Management pack received — {address}` → `Management pack received: {address}` |
| 1065 | progressor.subject | A | `PM12 complete: Management pack received — {address}` → `PM12 complete: Management pack received at {address}` |
| 1066 | progressor.heroLabel | B | `PM12 — Management pack received` → `PM12: Management pack received` |

**PM13 — Search results received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1080 | vendor.subject | A | `Buyer's search results are back — {address}` → `Buyer's search results are back: {address}` |
| 1084 | vendor.whatNext | C | `Most searches come back without issue — we'll let you know if anything needs attention.` → `Most searches come back without issue. We'll let you know if anything needs attention.` |
| 1088 | purchaser.subject | A | `Search results back — {address}` → `Search results back: {address}` |
| 1091 | purchaser.whatHappened | C | `Your solicitor will now review them carefully — they cover planning permissions, flood risk, drainage, and other factors affecting the property.` → `Your solicitor will now review them carefully. They cover planning permissions, flood risk, drainage, and other factors affecting the property.` |
| 1096 | (subject alt) | A | `Buyer's search results received — {address}` → `Buyer's search results received: {address}` |
| 1104 | progressor.subject | A | `PM13 complete: Search results received — {address}` → `PM13 complete: Search results received at {address}` |
| 1105 | progressor.heroLabel | B | `PM13 — Search results received` → `PM13: Search results received` |

**PM14 — Initial enquiries raised**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1116 | description | C | `This is a normal part of the process — they're checking everything is in order before you exchange.` → `This is a normal part of the process. They're checking everything is in order before you exchange.` |
| 1119 | vendor.subject | A | `Buyer's solicitor has raised enquiries — {address}` → `Buyer's solicitor has raised enquiries: {address}` |
| 1122 | vendor.whatHappened | C | `They're asking questions about the property, the title, and documents in the contract pack — a normal part of conveyancing.` → `They're asking questions about the property, the title, and documents in the contract pack. A normal part of conveyancing.` |
| 1127 | purchaser.subject | A | `Your solicitor has raised enquiries — {address}` → `Your solicitor has raised enquiries: {address}` |
| 1130 | purchaser.whatHappened | C | `Your solicitor has raised their first round of enquiries with the seller's solicitor — questions about the property, the title, and the documents in the contract pack.` → `Your solicitor has raised their first round of enquiries with the seller's solicitor: questions about the property, the title, and the documents in the contract pack.` |
| 1135 | (subject alt) | A | `Initial enquiries raised — {address}` → `Initial enquiries raised: {address}` |
| 1143 | progressor.subject | A | `PM14 complete: Initial enquiries raised — {address}` → `PM14 complete: Initial enquiries raised at {address}` |
| 1144 | progressor.heroLabel | B | `PM14 — Initial enquiries raised` → `PM14: Initial enquiries raised` |

**PM15 — Initial replies received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1158 | vendor.subject | A | `Your solicitor has replied to the buyer's enquiries — {address}` → `Your solicitor has replied to the buyer's enquiries: {address}` |
| 1166 | purchaser.subject | A | `Seller's solicitor has replied to your solicitor's enquiries — {address}` → `Seller's solicitor has replied to your solicitor's enquiries: {address}` |
| 1174 | progressor.subject | A | `PM15 complete: Initial replies received — {address}` → `PM15 complete: Initial replies received at {address}` |
| 1175 | progressor.heroLabel | B | `PM15 — Initial replies received` → `PM15: Initial replies received` |

**PM16 — Initial replies reviewed**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1193 | purchaser.subject | A | `Your solicitor has reviewed the seller's replies — {address}` → `Your solicitor has reviewed the seller's replies: {address}` |
| 1201 | progressor.subject | A | `PM16 complete: Initial replies reviewed — {address}` → `PM16 complete: Initial replies reviewed at {address}` |
| 1202 | progressor.heroLabel | B | `PM16 — Initial replies reviewed` → `PM16: Initial replies reviewed` |

**PM17 — Additional enquiries raised**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1213 | description | C | `This is completely normal — most transactions go through two or three rounds of enquiries before all points are resolved.` → `This is completely normal. Most transactions go through two or three rounds of enquiries before all points are resolved.` |
| 1216 | vendor.subject | A | `Buyer's solicitor has raised further questions — {address}` → `Buyer's solicitor has raised further questions: {address}` |
| 1219 | vendor.whatHappened | C | `Multiple rounds of questions are completely normal in conveyancing — this doesn't indicate a problem.` → `Multiple rounds of questions are completely normal in conveyancing. This doesn't indicate a problem.` |
| 1224 | purchaser.subject | A | `Your solicitor has raised further questions — {address}` → `Your solicitor has raised further questions: {address}` |
| 1226 | purchaser.opening | C | `Another round of questions — completely normal.` → `Another round of questions, completely normal.` |
| 1227 | purchaser.whatHappened | C | `Most transactions go through at least two rounds of questions before everything is resolved — this doesn't indicate a problem.` → `Most transactions go through at least two rounds of questions before everything is resolved. This doesn't indicate a problem.` |
| 1232 | progressor.subject | A | `PM17 complete: Additional enquiries raised — {address}` → `PM17 complete: Additional enquiries raised at {address}` |
| 1233 | progressor.heroLabel | B | `PM17 — Additional enquiries raised` → `PM17: Additional enquiries raised` |

**PM18 — Additional replies received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1247 | vendor.subject | A | `Your solicitor has replied to further buyer enquiries — {address}` → `Your solicitor has replied to further buyer enquiries: {address}` |
| 1255 | purchaser.subject | A | `Further replies received from the seller's solicitor — {address}` → `Further replies received from the seller's solicitor: {address}` |
| 1263 | progressor.subject | A | `PM18 complete: Additional replies received — {address}` → `PM18 complete: Additional replies received at {address}` |
| 1264 | progressor.heroLabel | B | `PM18 — Additional replies received` → `PM18: Additional replies received` |

**PM19 — Additional replies reviewed**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1281 | purchaser.subject | A | `Your solicitor has reviewed all replies — {address}` → `Your solicitor has reviewed all replies: {address}` |
| 1289 | progressor.subject | A | `PM19 complete: Additional replies reviewed — {address}` → `PM19 complete: Additional replies reviewed at {address}` |
| 1290 | progressor.heroLabel | B | `PM19 — Additional replies reviewed` → `PM19: Additional replies reviewed` |

**PM20 — All enquiries satisfied**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1301 | description | C | `This is a significant milestone — you're now in the final stretch before exchange.` → `This is a significant milestone. You're now in the final stretch before exchange.` |
| 1304 | vendor.subject | A | `All legal enquiries resolved — {address}` → `All legal enquiries resolved: {address}` |
| 1312 | purchaser.subject | A (double) | `All legal questions resolved — moving towards exchange — {address}` → `All legal questions resolved, moving towards exchange: {address}` |
| 1320 | (subject alt) | A | `All enquiries satisfied — {address}` → `All enquiries satisfied: {address}` |
| 1328 | progressor.subject | A | `PM20 complete: All enquiries satisfied — {address}` → `PM20 complete: All enquiries satisfied at {address}` |
| 1329 | progressor.heroLabel | B | `PM20 — All enquiries satisfied` → `PM20: All enquiries satisfied` |

**PM21 — Final report received**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1343 | vendor.subject | A | `Buyer is reviewing their solicitor's final report — {address}` → `Buyer is reviewing their solicitor's final report: {address}` |
| 1346 | vendor.whatHappened | C | `The buyer's solicitor has sent their final report to the buyer — a comprehensive summary of the property, title, searches, and mortgage conditions.` → `The buyer's solicitor has sent their final report to the buyer, a comprehensive summary of the property, title, searches, and mortgage conditions.` |
| 1351 | purchaser.subject | A | `Your solicitor's final report is ready — {address}` → `Your solicitor's final report is ready: {address}` |
| 1354 | purchaser.whatHappened | C | `Your solicitor has sent you their final report — a comprehensive summary of everything about the property...` → `Your solicitor has sent you their final report, a comprehensive summary of everything about the property...` |
| 1359 | progressor.subject | A | `PM21 complete: Buyer received final report — {address}` → `PM21 complete: Buyer received final report at {address}` |
| 1360 | progressor.heroLabel | B | `PM21 — Final report received` → `PM21: Final report received` |

**PM22 — Contract issued to buyer**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1371 | description | C | `Signing doesn't commit you yet — that happens at exchange.` → `Signing doesn't commit you yet. That happens at exchange.` |
| 1374 | vendor.subject | A | `Buyer has been issued their contract — {address}` → `Buyer has been issued their contract: {address}` |
| 1382 | purchaser.subject | A | `Your contract is ready to sign — {address}` → `Your contract is ready to sign: {address}` |
| 1386 | purchaser.whatNext | C | `...what you're committing to — exchange is the legally binding moment.` → `...what you're committing to. Exchange is the legally binding moment.` |
| 1390 | progressor.subject | A | `PM22 complete: Contract issued to buyer — {address}` → `PM22 complete: Contract issued to buyer at {address}` |
| 1391 | progressor.heroLabel | B | `PM22 — Contract issued to buyer` → `PM22: Contract issued to buyer` |

**PM23 — Buyer signed contract**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1405 | vendor.subject | A | `Buyer has signed and returned their contract — {address}` → `Buyer has signed and returned their contract: {address}` |
| 1413 | purchaser.subject | A (double) | `Signed contract received — ready for exchange — {address}` → `Signed contract received, ready for exchange: {address}` |
| 1416 | purchaser.whatHappened | C | `They will have explained what signing means — the legally binding moment is exchange, not this step.` → `They will have explained what signing means. The legally binding moment is exchange, not this step.` |
| 1417 | purchaser.whatNext | C | `Make sure your deposit is on its way to your solicitor's client account if it isn't already — it needs to be there as cleared funds before exchange can happen.` → `Make sure your deposit is on its way to your solicitor's client account if it isn't already. It needs to be there as cleared funds before exchange can happen.` |
| 1421 | (subject alt) | A | `Buyer has signed and returned their contract — {address}` → `Buyer has signed and returned their contract: {address}` |
| 1429 | progressor.subject | A | `PM23 complete: Buyer signed and returned contract — {address}` → `PM23 complete: Buyer signed and returned contract at {address}` |
| 1430 | progressor.heroLabel | B | `PM23 — Buyer signed contract` → `PM23: Buyer signed contract` |

**PM24 — Buyer transferred deposit**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1441 | description | C (double) | `Transfer your deposit — typically 10% of the purchase price — to your solicitor's client account.` → `Transfer your deposit (typically 10% of the purchase price) to your solicitor's client account.` |
| 1444 | vendor.subject | A | `Buyer's deposit is in place — {address}` → `Buyer's deposit is in place: {address}` |
| 1452 | purchaser.subject | A (double) | `Deposit received — ready for exchange — {address}` → `Deposit received, ready for exchange: {address}` |
| 1456 | purchaser.whatNext | C | `We're coordinating exchange with the seller's solicitor — you could be exchanging very soon.` → `We're coordinating exchange with the seller's solicitor. You could be exchanging very soon.` |
| 1460 | progressor.subject | A | `PM24 complete: Buyer transferred deposit — {address}` → `PM24 complete: Buyer transferred deposit at {address}` |
| 1461 | progressor.heroLabel | B | `PM24 — Buyer transferred deposit` → `PM24: Buyer transferred deposit` |

**PM25 — Buyer solicitor ready to exchange**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1475 | purchaser.subject | A | `Your solicitor is ready to exchange — {address}` → `Your solicitor is ready to exchange: {address}` |
| 1479 | purchaser.whatNext | C | `Make sure you're reachable — exchange can sometimes happen very quickly once both sides are ready.` → `Make sure you're reachable. Exchange can sometimes happen very quickly once both sides are ready.` |
| 1483 | vendor.subject | A | `The buyer's solicitor is ready to exchange — {address}` → `The buyer's solicitor is ready to exchange: {address}` |
| 1491 | progressor.subject | A | `PM25 complete: Buyer solicitor ready to exchange — {address}` → `PM25 complete: Buyer solicitor ready to exchange at {address}` |
| 1492 | progressor.heroLabel | B | `PM25 — Buyer solicitor ready to exchange` → `PM25: Buyer solicitor ready to exchange` |

**PM26 — Contracts exchanged (buyer)**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1506 | purchaser.subject | A (double) | `Contracts exchanged — your purchase is legally committed — {address}` → `Contracts exchanged, your purchase is legally committed: {address}` |
| 1510 | purchaser.whatNext | C | `Buildings insurance: risk in the property usually passes to you on exchange — check with your solicitor whether this applies to your purchase...` → `Buildings insurance: risk in the property usually passes to you on exchange. Check with your solicitor whether this applies to your purchase...` |
| 1517 | progressor.subject | A | `PM26 complete: Contracts exchanged — {address}` → `PM26 complete: Contracts exchanged at {address}` |
| 1518 | progressor.heroLabel | B | `PM26 — Contracts exchanged` → `PM26: Contracts exchanged` |

**PM27 — Purchase completed**

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 1529 | description | C | `The keys are yours — welcome home.` → `The keys are yours. Welcome home.` |
| 1532 | purchaser.subject | A (double) | `Purchase complete — welcome to your new home — {address}` → `Purchase complete, welcome to your new home: {address}` |
| 1534 | purchaser.opening | C | `Congratulations — it's done.` → `Congratulations. It's done.` |
| 1536 | purchaser.whatNext | C | `Keep your completion statement and transfer documents safely for your records — you may need them for future legal or tax purposes.` → `Keep your completion statement and transfer documents safely for your records. You may need them for future legal or tax purposes.` |
| 1543 | progressor.subject | A | `PM27 complete: Purchase completed — {address}` → `PM27 complete: Purchase completed at {address}` |
| 1544 | progressor.heroLabel | B | `PM27 — Purchase completed` → `PM27: Purchase completed` |

---

## FILE: lib/emails/retention/index.ts

Retention emails to agents at various lifecycle points. Signature lines dominate.

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 80 | activation_day_1 HTML sign-off | F | `<p>— The Sales Progressor team</p>` → `<p>The Sales Progressor team</p>` |
| 173 | stuck_day_3 HTML sign-off | F | `<p>— The Sales Progressor team</p>` → `<p>The Sales Progressor team</p>` |
| 208 | first_exchange HTML sign-off | F | `<p>— The Sales Progressor team</p>` → `<p>The Sales Progressor team</p>` |
| 242 | quiet_30d HTML sign-off | F | `<p>— The Sales Progressor team</p>` → `<p>The Sales Progressor team</p>` |
| 290 | send_to_us_drop_21d display name | G | `"Ellis — Sales Progressor"` → `"Ellis, Sales Progressor"` |
| 319 | last_touch_60d HTML sign-off | F | `<p>— The Sales Progressor team</p>` → `<p>The Sales Progressor team</p>` |

Also text-mode counterparts of the HTML sign-offs (mentioned by sub-agent scan): lines 72, 165, 200, 233, 309 — same rule, remove `— ` prefix.

---

## FILE: lib/email/chainNotifications.ts

Chain events to agents. Subject lines follow Pattern D; text bodies have a standalone `—` separator.

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 81 | LOST_BUYER subject | D | `Update on ${address} — the buyer has pulled out` → `Update on ${address}: the buyer has pulled out` |
| 84 | LOST_BUYER follow text | C | `Open the chain to let us know what's next — find a new buyer, or withdraw.` → `Open the chain to let us know what's next: find a new buyer, or withdraw.` |
| 86 | LOST_BUYER text body separator | E | Line containing just `—` before unsubscribe → delete the line |
| 101 | LOST_PURCHASE subject | D | `Update on ${address} — the onward purchase has fallen through` → `Update on ${address}: the onward purchase has fallen through` |
| 104 | LOST_PURCHASE follow text | C | `Open the chain to let us know what's next — find a new purchase, proceed without one, or withdraw.` → `Open the chain to let us know what's next: find a new purchase, proceed without one, or withdraw.` |
| 106 | LOST_PURCHASE separator | E | Line containing just `—` before unsubscribe → delete the line |
| 121 | ASKED_TO_WAIT subject | D | `Update on ${address} — onward chain is re-forming` → `Update on ${address}: onward chain is re-forming` |
| 126 | ASKED_TO_WAIT separator | E | Line containing just `—` before unsubscribe → delete the line |
| 158 | REMARKETING_CHAIN_REFORMED subject | D | `Update on ${address} — the chain has reformed below you` → `Update on ${address}: the chain has reformed below you` |
| 172 | REMARKETING_CHAIN_REFORMED separator | E | delete the `—` line |
| 187 | REMARKING_SHORTENING subject | D | `Update on ${address} — your chain has been shortened` → `Update on ${address}: your chain has been shortened` |
| 192 | REMARKING_SHORTENING separator | E | delete the `—` line |
| 212 | generic chain event separator | E | delete the `—` line |
| 446 | AGENT_DECLINED subject | D | `${email} declined your invite — ${address}` → `${email} declined your invite: ${address}` |
| 457 | AGENT_DECLINED separator | E | delete the `—` line |
| 471 | AGENT_DECLINED HTML heading | D | `${escapeHtml(stubAgentEmail)} declined your invite — ${escapeHtml(stubAddress)}` → `${escapeHtml(stubAgentEmail)} declined your invite: ${escapeHtml(stubAddress)}` |
| 503 | AGENT_EXCHANGED subject | D | `${address} has exchanged — chain update` → `${address} has exchanged, chain update` |
| 514 | AGENT_EXCHANGED separator | E | delete the `—` line |
| 528 | AGENT_EXCHANGED HTML heading | D | `${escapeHtml(exchangedAddress)} has exchanged — chain update` → `${escapeHtml(exchangedAddress)} has exchanged, chain update` |
| 560 | AGENT_COMPLETED subject | D | `${address} has completed — chain update` → `${address} has completed, chain update` |
| 571 | AGENT_COMPLETED separator | E | delete the `—` line |
| 585 | AGENT_COMPLETED HTML heading | D | `${escapeHtml(completedAddress)} has completed — chain update` → `${escapeHtml(completedAddress)} has completed, chain update` |
| 684 | generic footer separator | E | delete the `—` line |

---

## FILE: lib/services/portal.ts

Portal service emails (agent notifications, exchange/completion packs, milestone confirms).

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 817 | agent notification subject | A | `Client confirmed: "${milestoneLabel}" — ${tx.propertyAddress}` → `Client confirmed: "${milestoneLabel}" at ${tx.propertyAddress}` |
| 847 | HTML event date | (skip) | ` — ${formattedPortalEventDate}` — this is a template concat used inside a larger sentence. Reads best if the preceding string ends with the em-dash slot removed and the date joined with a preposition. Case-by-case rewrite required — flag for review. |
| 853 | valuation copy | C | `Their primary concern is that it's worth enough to secure their loan — it's not a structural survey and won't flag problems with the condition of the property.` → `Their primary concern is that it's worth enough to secure their loan. It's not a structural survey and won't flag problems with the condition of the property.` |
| 857 | valuation copy | C | `No physical visit to the property is needed — the assessment is conducted remotely.` → `No physical visit to the property is needed. The assessment is conducted remotely.` |
| 858 | valuation copy | C | `A surveyor acting for the lender will visit to value the property — access has been arranged, so nothing else for you to do right now.` → `A surveyor acting for the lender will visit to value the property. Access has been arranged, so nothing else for you to do right now.` |
| 914 | subject | A | `Step confirmed — {address}` → `Step confirmed: {address}` |
| 958 | subject | A | `Progress update — {address}` → `Progress update: {address}` |
| 971 | log entry | A | `Progress update — {address}` → `Progress update: {address}` |
| 1117 | subject | A | `Your {saleWord} has completed — {address}` → `Your {saleWord} has completed: {address}` |
| 1119 | HTML intro | C | `Congratulations — your {saleWord} at <strong>{address}</strong> has completed...` → `Congratulations. Your {saleWord} at <strong>{address}</strong> has completed...` |
| 1121 | subject | A | `Ready to exchange — {address}` → `Ready to exchange: {address}` |
| 1125 | subject | A | `Date confirmed — {address}` → `Date confirmed: {address}` |
| 1131 | subject | A | `Progress update — {address}` → `Progress update: {address}` |
| 1139 | template line | B-like | `{stepLabel} — {stepDate}` → `{stepLabel}: {stepDate}` |
| 1262 | HTML footer | A | `Sales Progressor system — ${address}` → `Sales Progressor system: ${address}` |
| 1483 | HTML event date | (skip) | ` — ${formattedEventDate}` — same as 847; case-by-case |
| 1490 | valuation copy (duplicate) | C | see line 853 |
| 1494 | valuation copy (duplicate) | C | see line 857 |
| 1495 | valuation copy (duplicate) | C | see line 858 |
| 1702 | HTML list item | C | `Your solicitor will handle the transfer of funds — you don't need to be at the property.` → `Your solicitor will handle the transfer of funds. You don't need to be at the property.` |
| 1705 | HTML list item | C | `Leave appliance manuals, warranties, and service records — the buyer is entitled to these.` → `Leave appliance manuals, warranties, and service records. The buyer is entitled to these.` |
| 1712 | HTML list item | C | `Keep your phone on — your solicitor will call you when the funds have been transferred.` → `Keep your phone on. Your solicitor will call you when the funds have been transferred.` |
| 1715 | HTML list item | C | `From today, the property is at your risk — if your buildings insurance isn't already in place, arrange it as soon as possible.` → `From today, the property is at your risk. If your buildings insurance isn't already in place, arrange it as soon as possible.` |
| 1724 | subject | A | `Contracts exchanged — what happens next for your sale` → `Contracts exchanged: what happens next for your sale` |
| 1725 | subject | A | `Contracts exchanged — what happens next for your purchase` → `Contracts exchanged: what happens next for your purchase` |
| 1787 | log entry | A | `Contracts exchanged — what happens next for your sale` → `Contracts exchanged: what happens next for your sale` |
| 1799 | log entry | A | `Contracts exchanged — what happens next for your purchase` → `Contracts exchanged: what happens next for your purchase` |
| 1843-1847 | log entries | A | `Contracts exchanged — what happens next for your {side}` → `Contracts exchanged: what happens next for your {side}` |

---

## FILE: lib/services/portal-messages.ts

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 146 | client message subject | A | `Message from {name} — {address}` → `Message from {name}: {address}` |
| 219 | agent message subject | A | `Message from {progressorName} — {address}` → `Message from {progressorName}: {address}` |

---

## FILE: lib/services/survey.ts

Post-completion survey to clients.

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 38 | subject | C | `Congratulations on your {role} — how was your experience?` → `Congratulations on your {role}. How was your experience?` |
| 46 | text body | C | `we'd love to hear how it went — your feedback helps us make the experience better for everyone who comes after you.` → `we'd love to hear how it went. Your feedback helps us make the experience better for everyone who comes after you.` |
| 54 | HTML body | C | Same as line 46, HTML version |

---

## FILE: lib/services/agent-weekly-brief.ts

Agent-only weekly digest.

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 105 | body template | B-like | ` — target {date} ({days})` → `: target {date} ({days})` |
| 115 | body template | B-like | ` — {reasons}` → `: {reasons}` |
| 132 | body template | B-like | ` — {kinds}: {reason}` → `, {kinds}: {reason}` (colon already present, comma reads cleaner) |

---

## FILE: lib/services/morning-digest.ts

Agent-only morning digest.

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 127 | body copy | C | `Nothing urgent today — quick check-in` → `Nothing urgent today. Quick check-in.` |
| 138 | body template | B-like | ` — {overdue}` → `: {overdue}` |
| 151 | body template | B-like | ` — target {date} ({days away})` → `: target {date} ({days away})` |

---

## FILE: lib/email/medians-ready.ts

Internal system email (agent only, not routed to clients). Includes both string em dashes and text-mode `—` used as monospace-table placeholders.

| Line | Field | Pattern | Current → Proposed |
|---:|---|:---:|---|
| 37 | status label | B-like | `Ready — suggest swap` → `Ready: suggest swap` |
| 38 | status label | B-like | `Low sample — consider waiting` → `Low sample: consider waiting` |
| 39 | status label | B-like | `Insufficient — wait` → `Insufficient: wait` |
| 43 | table placeholder | (keep) | `return "—"` — monospace-table cell for empty numeric. Retain as visual placeholder, or replace with `""` empty string. Recommend keep. |
| 74 | text body | C | `Try a few examples first — swap only the rows tagged "Ready — suggest swap" (≥30 samples), leave the others on hardcoded values.` → `Try a few examples first. Swap only the rows tagged "Ready: suggest swap" (≥30 samples), leave the others on hardcoded values.` |
| 88 | text placeholder | (keep) | `"—"` monospace cell — same as 43 |
| 124 | HTML placeholder | (keep) | `"—"` — same as 43 |
| 159 | HTML body | C | Same substance as line 74, HTML version |

Plus other em dashes flagged by sub-agent (67, 77, 101, 103, 148, 153, 160, 193) — same rules apply: Pattern C for inline em dashes, Pattern F for the sign-off "— Sales Progressor" at line 103.

---

## Application plan

If approved:

1. Apply Patterns A, B, D wholesale via search-and-replace on the string literals (mechanical — no judgment required).
2. Apply Pattern C row-by-row using the proposed rewrites above (bespoke per sentence — the doc IS the source of truth).
3. Remove Pattern E lines and Pattern F prefixes.
4. Swap Pattern G display name.
5. Test render: hit `/test/outsource-intro` and equivalent test routes for each email, screenshot check.
6. Also update the "no em dashes in Cadence copy" style rule for the Sales Progressor voice guide (docs/reference/VOICE.md) so future authors know.

Effort estimate: ~1-2 hours mechanical, plus ~1 hour reading the Pattern C rewrites for tone/clarity before committing.
