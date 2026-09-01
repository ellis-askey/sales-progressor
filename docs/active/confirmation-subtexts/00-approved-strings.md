# Confirmation subtexts — approved copy (shipped)

**Status:** APPROVED + IMPLEMENTED (2026-09-01).
**Implemented in:** [`lib/milestone-confirmation-subtext.ts`](../../../lib/milestone-confirmation-subtext.ts) — this file is the human record; the module is the runtime source of truth. Any wording change must update both.
**Where it renders:** the muted line beneath the confirmation sentence on milestone cards in the Activity tab (`components/activity/ActivityTimeline.tsx`).

## Rules baked into the implementation

- Copy is display-only; milestone codes, confirmer logic, avatars, dates, enquiry-tracker ownership and leasehold conditions are all unchanged.
- Confirmer buckets: **A** = client or a helper on their behalf (portal) · **B** = team (agency staff or Sales Progressor) · **C** = solicitor (update link) · **D** = auto (no named person; only VM21 / PM20, which close as a twin).
- **N/A** = that confirmer route has no line (the code simply renders no subtext).
- Skipped (`not_required`) steps never show a subtext.
- Voice: no em-dashes, no exclamation marks, no "the system"/"automatically".

---

# Seller side (VM1–VM21)

### VM1 — Seller has instructed their solicitor
- **A / B:** The solicitor is now in place, so their details can be included on the memorandum of sale.
- **C:** N/A

### VM2 — Seller has received the memorandum of sale
- **A / B:** The seller now has the agreed sale details and solicitor information.
- **C:** N/A

### VM3 — Seller has received the welcome pack from their solicitor
- **A / B:** The seller has their solicitor's opening paperwork, so we're now waiting for their onboarding requirements to be completed.
- **C:** N/A

### VM4 — Seller's ID and AML checks are complete
- **A / B:** The seller's initial checks are complete, so their solicitor can continue with the legal work.
- **C:** N/A

### VM5 — Seller has received the property information forms
- **A / B / C:** The forms are with the seller, so we're now waiting for them to be completed and returned.

### VM6 — Seller has returned the completed property forms
- **A / B:** The completed forms are back with the seller's solicitor, ready for the draft contract pack to be prepared.
- **C:** N/A

### VM7 — Seller's solicitor has issued the draft contract pack
- **A / B / C:** The draft pack is now with the buyer's solicitor for review.

### VM8 — Seller's solicitor has requested the management pack
- **A / B / C:** The request is now with the freeholder or managing agent, so we're waiting for the pack to come back.

### VM9 — Seller's solicitor has received the management pack
- **A / B / C:** The management pack is in and can now be sent across to the buyer's solicitor.

### VM10 — Seller's solicitor has received the initial enquiries
- **A:** N/A
- **B:** The first enquiries are now with the seller's solicitor, so we're waiting for their replies.
- **C:** N/A

### VM11 — Seller has provided the initial replies to their solicitor
- **A / B:** The seller's replies are with their solicitor, ready to be sent across to the buyer's side.
- **C:** N/A

### VM12 — Seller's solicitor has issued the initial responses
- **A:** N/A
- **B:** The first replies are now back with the buyer's solicitor for review.
- **C:** N/A

### VM13 — Seller's solicitor has received the additional enquiries
- **A:** N/A
- **B:** The further enquiries are now with the seller's solicitor, so we're waiting for their replies.
- **C:** N/A

### VM14 — Seller has provided the additional replies to their solicitor
- **A / B:** The seller's further replies are with their solicitor, ready to be sent across to the buyer's side.
- **C:** N/A

### VM15 — Seller's solicitor has issued the additional responses
- **A:** N/A
- **B:** The further replies are now back with the buyer's solicitor for review.
- **C:** N/A

### VM16 — Seller's solicitor has issued the contract for signing
- **A / B:** The contract is with the seller, so we're now waiting for the signed copy to go back to their solicitor.
- **C:** The contract is with the seller, so we're now waiting for the signed copy to come back.

### VM17 — Seller's solicitor has received the signed contract back
- **A / B / C:** The signed contract is back with the seller's solicitor and in place ahead of exchange.

### VM18 — Seller's solicitor is ready to exchange
- **A / B / C:** Everything is ready on the seller's side, so we're now waiting for the buyer's solicitor to reach the same point.

### VM19 — Seller knows contracts have exchanged
- **A / B:** Contracts have exchanged and the sale is legally binding. Completion is now the next step.
- **C:** N/A

### VM20 — Seller knows the sale has completed
- **A / B:** Completion has taken place and the sale is now complete.
- **C:** N/A

### VM21 — All enquiries satisfied (seller side)
- **A:** N/A
- **B / D:** Enquiries are now clear, leaving the remaining steps to get both sides ready for exchange.
- **C:** N/A

---

# Buyer side (PM1–PM27)

### PM1 — Buyer has instructed their solicitor
- **A / B:** The solicitor is now in place, so the seller's side has somewhere to send the contract pack.
- **C:** N/A

### PM2 — Buyer has received the memorandum of sale
- **A / B:** The buyer now has the agreed sale details and solicitor information.
- **C:** N/A

### PM3 — Buyer's ID and AML checks are complete
- **A / B:** The buyer's initial checks are complete, so their solicitor can continue with the legal work.
- **C:** N/A

### PM4 — Buyer has paid money on account to their solicitor
- **A / B:** The initial payment is with the buyer's solicitor, so searches can now be ordered when they're ready.
- **C:** N/A

### PM5 — Buyer has submitted their mortgage application
- **A / B:** The mortgage application is in, so we're now waiting for the lender to progress it.
- **C:** N/A

### PM6 — Lender's valuation has been booked
- **A / B:** The valuation is booked and the mortgage application is continuing with the lender.
- **C:** N/A

### PM7 — Buyer's solicitor has received the draft contract pack
- **A / B / C:** The draft pack is now with the buyer's solicitor for review.

### PM8 — Buyer's solicitor has ordered the searches
- **A / B / C:** The searches are underway, so we're now waiting for the results to come back.

### PM9 — Buyer has booked a survey
- **A / B:** The survey is booked, so we'll now wait for the appointment and report.
- **C:** N/A

### PM10 — Buyer has received the survey report
- **A / B:** The buyer has their report, so we'll see whether anything comes back from the survey.
- **C:** N/A

### PM11 — Buyer's solicitor has received the mortgage offer
- **A / B:** The formal mortgage offer is now with the buyer's solicitor and in place ahead of exchange.
- **C:** The formal mortgage offer is now in and in place ahead of exchange.

### PM12 — Buyer's solicitor has received the management pack
- **A / B:** The management pack is now with the buyer's solicitor for review.
- **C:** The management pack is now in for review.

### PM13 — Buyer's solicitor has received the search results
- **A / B:** The search results are back with the buyer's solicitor and are now being reviewed.
- **C:** The search results are back and are now being reviewed.

### PM14 — Buyer's solicitor has raised the initial enquiries
- **A:** N/A
- **B:** The first enquiries are now with the seller's solicitor, so we're waiting for their replies.
- **C:** N/A

### PM15 — Buyer's solicitor has received the initial replies
- **A:** N/A
- **B:** The first replies are back with the buyer's solicitor and are now being reviewed.
- **C:** N/A

### PM16 — Buyer's solicitor has reviewed the initial replies
- **A:** N/A
- **B:** The first replies have been reviewed, so we're waiting to see whether anything further is needed.
- **C:** N/A

### PM17 — Buyer's solicitor has raised the additional enquiries
- **A:** N/A
- **B:** Further enquiries are now with the seller's solicitor, so we're waiting for their replies.
- **C:** N/A

### PM18 — Buyer's solicitor has received the additional replies
- **A:** N/A
- **B:** The further replies are back with the buyer's solicitor and are now being reviewed.
- **C:** N/A

### PM19 — Buyer's solicitor has reviewed the additional replies
- **A:** N/A
- **B:** The further replies have been reviewed, so we're now waiting for confirmation that enquiries are satisfied.
- **C:** N/A

### PM20 — All enquiries satisfied (buyer side)
- **A:** N/A
- **B / D:** Enquiries are now clear, leaving the remaining steps to get both sides ready for exchange.
- **C:** N/A

### PM21 — Buyer has received the final report from their solicitor
- **A / B:** The final report is with the buyer, so we're now waiting for the remaining pre-exchange steps to be completed.
- **C:** N/A

### PM22 — Buyer's solicitor has issued the contract for signing
- **A / B:** The contract is with the buyer, so we're now waiting for the signed copy to go back to their solicitor.
- **C:** The contract is with the buyer, so we're now waiting for the signed copy to come back.

### PM23 — Buyer's solicitor has received the signed contract back
- **A / B / C:** The signed contract is back with the buyer's solicitor and in place ahead of exchange.

### PM24 — Buyer has transferred the deposit
- **A / B:** The deposit is with the buyer's solicitor and in place ahead of exchange.
- **C:** N/A

### PM25 — Buyer's solicitor is ready to exchange
- **A / B / C:** Everything is ready on the buyer's side, so we're now waiting for the seller's solicitor to reach the same point.

### PM26 — Buyer knows contracts have exchanged
- **A / B:** Contracts have exchanged and the purchase is legally binding. Completion is now the next step.
- **C:** N/A

### PM27 — Buyer knows the sale has completed
- **A / B:** Completion has taken place and the purchase is now complete.
- **C:** N/A
