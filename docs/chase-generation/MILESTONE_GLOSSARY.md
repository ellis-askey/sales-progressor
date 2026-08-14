# Milestone Glossary — Chase Generation Context

**Purpose.** The canonical reference for what each transaction milestone actually means and how the AI chase generation system should reason about each one. Each entry covers what the milestone tracks, what "outstanding" means in real terms, who the action-holder is, and — most importantly — how to refer to the parties involved without leaking the wrong perspective into a generated message.

**Why it exists.** The model was producing messages that misread milestone names: reading "Survey booked" as a statement of fact (the survey HAS been booked) rather than as the goal state we are chasing. It was also referring to "the buyer's solicitor" when writing to the buyer themselves — for whom that party is "your solicitor."

**Companion documents.**
- `app/api/ai/generate-chase/PROMPT_SPEC.md` — the implementation spec for the chase prompt.
- `docs/chase-generation/VOICE_CORPUS.md` — anonymised real-message anchors for voice.
- `docs/chase-generation/CHANGELOG.md` — change history.

**Runtime usage.** Only fields **What this milestone tracks**, **What "outstanding" means**, **Also called**, and **Common misframings to avoid** are injected into the runtime prompt. The other fields (Side, Blocks exchange, Who is responsible, Typical chase context) are human-reference fields. See `PROMPT_SPEC.md` §6 for the prompt integration shape.

---

## Default party-naming table

This is the baseline for "How to refer to parties." Per-milestone entries below note any cases where naming differs from this default.

| Recipient | Their own solicitor | Other side's solicitor | Other side's lay client |
|---|---|---|---|
| Buyer | your solicitor | the seller's solicitor | the seller |
| Seller | your solicitor | the buyer's solicitor | the buyer |
| Buyer's solicitor | (self) | the seller's solicitor | your client / the buyer (rarely needed) |
| Seller's solicitor | (self) | the buyer's solicitor | your client / the seller (rarely needed) |
| Mortgage broker | their solicitor | the seller's solicitor | the seller |
| Surveyor | the buyer's solicitor (when relevant) | the seller's solicitor (rare) | the buyer |

---

## Vendor milestones (VM1–VM20)

---

### VM1 — Seller has instructed their solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller has formally appointed a solicitor to act for them in this transaction and confirmed their details to the agent. |
| **What "outstanding" means** | The seller has not yet confirmed they have a solicitor in place. We are chasing them to appoint one (if they haven't) or to provide their solicitor's name and contact details so the memorandum of sale can be issued correctly. |
| **Who is responsible** | Seller |
| **Also called** | "Appointing a solicitor", "instructing solicitors", "choosing a conveyancer", "getting a solicitor on board". |
| **How to refer to parties** | To the seller: "your solicitor" once instructed. Before instruction, just "a solicitor" or "your conveyancer." To the buyer or buyer's solicitor: this milestone is rarely communicated to them — it's an internal seller-side prerequisite. |
| **Common misframings to avoid** | Don't imply the seller has dragged their feet — they may simply be still choosing between firms. Don't reference specific named solicitors unless confirmed. The chase is about getting them to commit, not nagging them. |
| **Typical chase context** | Sits at the very start of the transaction. If outstanding more than a few days post-MOS, gently nudge — many sellers underestimate how quickly this needs to be in place. |

---

### VM2 — Seller has received the memorandum of sale

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the memorandum of sale (MOS) — the document confirming agreed price, parties, solicitor details, and transaction terms — has been received by the seller. |
| **What "outstanding" means** | The MOS has not yet been confirmed as received by the seller. We are chasing confirmation that the seller (and their solicitor) has the MOS and all parties have the correct details to proceed. |
| **Who is responsible** | Agent (issues the MOS); Seller (confirms receipt) |
| **Also called** | "MOS", "memo of sale", "sales memo", "the memo". |
| **How to refer to parties** | To the seller: "your MOS" or "the memo of sale we sent over." To the seller's solicitor: "the MOS for [property]." To the buyer side: rarely chased to them, but if mentioned: "the memorandum of sale." |
| **Common misframings to avoid** | The agent issues the MOS — so a chase usually means we're asking for confirmation it's been received and reviewed, not that we're waiting for someone else to send it. Don't imply the seller has lost it; sometimes the issue is just that they haven't opened the email. |
| **Typical chase context** | Should be confirmed within 24–48 hours of MOS issue. If outstanding longer, gentle check-in — often just an inbox issue. |

---

### VM3 — Seller has received the welcome pack from their solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller's solicitor has sent their initial welcome or client care pack to the seller — typically containing the client care letter, ID requirements, and initial instruction forms. |
| **What "outstanding" means** | The seller's solicitor has not yet issued their welcome pack to the seller. We are chasing the seller's solicitor to send it, or the seller to confirm they have received it. |
| **Who is responsible** | Seller's solicitor (issues it); Seller (confirms receipt) |
| **Also called** | "Welcome pack", "client care pack", "onboarding pack", "instruction pack", "protocol forms" (though that strictly refers to a subset). |
| **How to refer to parties** | To the seller: "your welcome pack" or "the pack from your solicitor." To the seller's solicitor: "your welcome pack" or "the client care documentation." |
| **Common misframings to avoid** | If the seller hasn't received it, the chase target is the solicitor — not the seller. Don't blame the seller for a pack they haven't been sent. |
| **Typical chase context** | Usually issued within a few days of the solicitor being instructed. If more than a week passes, worth chasing the solicitor. |

---

### VM4 — Seller has completed ID and AML checks with their solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller has provided valid identification and completed anti-money laundering verification with their solicitor — a legal requirement before any conveyancing work can progress. |
| **What "outstanding" means** | The seller has not yet submitted their ID documents or completed AML checks. We are chasing the seller to do this with their solicitor promptly, as legal work cannot proceed until it is done. |
| **Who is responsible** | Seller |
| **Also called** | "ID checks", "AML checks", "anti-money laundering", "identity verification", "Thirdfort" (when that platform is used), "client verification". |
| **How to refer to parties** | To the seller: "your ID and AML checks" or "your identity verification." To the seller's solicitor: "your client's ID/AML." To buyer side: not usually communicated. |
| **Common misframings to avoid** | This is on the seller, not the solicitor. The solicitor has likely sent instructions; the seller needs to complete them. Don't soften this to "checking in on the solicitors' onboarding" — be clear it's the seller's action. |
| **Typical chase context** | Often the longest-running personal admin task on the seller side. Worth a gentle nudge after a week, firmer after two. Many lay clients underestimate how blocking this is. |

---

### VM5 — Seller has received the property information forms from their solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller's solicitor has sent the property information forms (TA6 Property Information Form, TA10 Fittings and Contents, and any relevant leasehold forms) to the seller to complete. |
| **What "outstanding" means** | The seller's solicitor has not yet sent the property information forms to the seller. We are chasing the seller's solicitor to issue them so the seller can begin completing them. |
| **Who is responsible** | Seller's solicitor (issues the forms) |
| **Also called** | "Protocol forms", "TA6 and TA10", "property information forms", "fixtures and fittings forms", "the forms from your solicitor" (lay-client phrasing). |
| **How to refer to parties** | To the seller: "your property information forms" or "the protocol forms (TA6 and TA10)." To the seller's solicitor: "the protocol forms" or named individually if relevant. Leasehold adds TA7. |
| **Common misframings to avoid** | Chase target is the solicitor here, not the seller. The seller can't fill in what they haven't been sent. Don't conflate this with VM6 (seller returning them). |
| **Typical chase context** | Should follow within days of welcome pack. Often grouped with VM3 in a single nudge to the solicitor. |

---

### VM6 — Seller has returned completed property information forms to their solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller has completed all property information forms and returned them to their solicitor, enabling the draft contract pack to be prepared. |
| **What "outstanding" means** | The seller has received the forms but has not yet completed and returned them. We are chasing the seller to fill them in and send them back to their solicitor, as the contract pack cannot be issued until this is done. |
| **Who is responsible** | Seller |
| **Also called** | "Returning the forms", "sending back the TA6/TA10", "completing the protocol forms". |
| **How to refer to parties** | To the seller: "your completed forms" or "the protocol forms." To the seller's solicitor: "your client's completed protocol forms." |
| **Common misframings to avoid** | This is critical-path — contract pack issuance (VM7) is blocked by it. But the chase is about getting them done, not making the seller feel they've broken anything. Many sellers find these forms genuinely confusing — offering to help where you can lands well. |
| **Typical chase context** | Often the slowest seller-side task because the forms are long and detailed. Two-week lead time is common. Sellers can hand-deliver or scan; offering to chase their solicitor on receipt is a useful follow-up. |

---

### VM7 — Seller's solicitor has issued the draft contract pack

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller's solicitor has compiled and sent the draft contract pack — including the draft contract, title documents, and completed property information forms — to the buyer's solicitor. |
| **What "outstanding" means** | The seller's solicitor has not yet issued the draft contract pack. We are chasing the seller's solicitor to send it to the buyer's solicitor so legal review and enquiries can begin. |
| **Who is responsible** | Seller's solicitor |
| **Also called** | "DCP", "draft contract pack", "contract pack", "the pack", "draft contract", "issuing contracts to the other side". |
| **How to refer to parties** | To the seller: "the draft contract pack from your solicitor." To the seller's solicitor: "the DCP" or "the draft contract pack." To the buyer's solicitor: "the draft contract pack" or "the contract pack from the seller's side." To the buyer: "the contract pack" or "the legal pack." |
| **Common misframings to avoid** | Don't treat this as automatic — solicitors often need a nudge once VM6 (seller forms back) is done. Also don't imply the seller can do this — the seller can only chase their solicitor. The seller's solicitor is the action-holder. |
| **Typical chase context** | One of the most-chased milestones in any transaction. Once VM4, VM6 are done, the DCP should follow within days, but in practice often slips. Nudging the seller's solicitor directly is most effective. |

---

### VM8 — Seller's solicitor has requested the management pack

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes (leasehold only; auto-not-required for freehold) |
| **What this milestone tracks** | Whether the seller's solicitor has formally requested the management pack from the freeholder or managing agent. Applies to leasehold properties only. |
| **What "outstanding" means** | The seller's solicitor has not yet made the request to the freeholder or managing agent. We are chasing the seller's solicitor to make that request without further delay, as management packs can take several weeks to arrive. |
| **Who is responsible** | Seller's solicitor |
| **Also called** | "Management pack request", "LPE1", "management information", "leasehold pack", "freeholder pack", "requesting the LPE1". |
| **How to refer to parties** | To the seller: "the management pack request" or "the leasehold pack request." To the seller's solicitor: "the LPE1" or "the management pack request." To the buyer's solicitor: usually framed as "we're progressing the management pack on this side." |
| **Common misframings to avoid** | This step is often forgotten on leasehold sales because freehold transactions don't need it. If the milestone is in play, we're chasing the solicitor to make the request — the seller usually can't do this directly. |
| **Typical chase context** | Management packs from freeholders/managing agents commonly take 4–6 weeks to arrive, so requesting promptly is critical. Worth chasing within days of solicitor instruction on a leasehold sale. |

---

### VM9 — Seller's solicitor has received the management pack

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes (leasehold only; auto-not-required for freehold) |
| **What this milestone tracks** | Whether the seller's solicitor has received the management pack back from the freeholder or managing agent. Applies to leasehold properties only. |
| **What "outstanding" means** | The management pack has been requested but has not yet arrived with the seller's solicitor. We are chasing the seller's solicitor to follow up with the freeholder or managing agent on the outstanding pack. |
| **Who is responsible** | Seller's solicitor (chases the freeholder or managing agent) |
| **Also called** | "Management pack arrived", "LPE1 returned", "leasehold pack received". |
| **How to refer to parties** | To the seller: "the management pack" or "the leasehold info from the freeholder." To the seller's solicitor: "the management pack" or "the LPE1." To buyer side: cross-references PM12. |
| **Common misframings to avoid** | The freeholder/managing agent are slow by reputation — the chase is the solicitor following up with them, not the seller. Sellers have no leverage here. |
| **Typical chase context** | Often the slowest single step in a leasehold sale. Genuinely outside everyone's direct control once the request is in. A weekly nudge to the solicitor is usual. |

---

### VM10 — Seller's solicitor has received initial enquiries

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller's solicitor has received the first round of legal enquiries from the buyer's solicitor, raised after reviewing the draft contract pack. |
| **What "outstanding" means** | The buyer's solicitor has either not yet raised their initial enquiries, or the seller's solicitor has not yet confirmed receipt. We are checking with the seller's solicitor whether enquiries have arrived. If not, the buyer's solicitor may need chasing separately (via PM14 on the buyer side). |
| **Who is responsible** | Seller's solicitor (confirms receipt); the action of raising enquiries sits with the buyer's solicitor |
| **Also called** | "Initial enquiries", "first round of enquiries", "enquiries raised", "the enquiries from the other side". |
| **How to refer to parties** | To the seller: "the buyer's solicitor's initial enquiries" or "the first batch of legal questions." To the seller's solicitor: "the initial enquiries from the buyer's side." To the buyer's solicitor: "your initial enquiries." |
| **Common misframings to avoid** | Pure receipt-tracking — the seller side can't generate these, only confirm arrival. Chase aimed at the seller's solicitor is for confirmation; if not received, the buyer's solicitor needs chasing via PM14. |
| **Typical chase context** | Should follow DCP issuance within 1–3 weeks (search results often need to be in first). Long delays usually mean the buyer's solicitor is waiting on searches. |

---

### VM11 — Seller has provided initial replies to their solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller has gathered the information needed to answer the buyer's initial enquiries and provided their replies to their solicitor. |
| **What "outstanding" means** | Initial enquiries have arrived but the seller has not yet provided their answers to their solicitor. We are chasing the seller to supply the information their solicitor needs to respond to the buyer's questions. |
| **Who is responsible** | Seller |
| **Also called** | "Replies to enquiries", "answering the enquiries", "your replies", "responses to the enquiries". |
| **How to refer to parties** | To the seller: "your replies to the enquiries" or "your answers." To the seller's solicitor: "your client's replies." |
| **Common misframings to avoid** | Some enquiries will be ones the solicitor handles legally — the seller only needs to respond to factual ones about the property. Don't imply the seller has to handle all of them. |
| **Typical chase context** | Speed varies massively by seller. Some respond same-day; others take weeks. Worth offering to facilitate or clarify questions if the seller seems stuck. |

---

### VM12 — Seller's solicitor has issued initial responses to the buyer's solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller's solicitor has compiled the seller's replies to initial enquiries and formally sent them to the buyer's solicitor. |
| **What "outstanding" means** | The seller has provided replies to their solicitor but the solicitor has not yet sent the formal responses to the buyer's solicitor. We are chasing the seller's solicitor to issue the responses promptly. |
| **Who is responsible** | Seller's solicitor |
| **Also called** | "Replies issued", "responses sent across", "enquiry responses gone over", "replies in". |
| **How to refer to parties** | To the seller: "the replies your solicitor has sent across" or "the responses to enquiries." To the seller's solicitor: "your replies to the buyer's solicitor." To the buyer's solicitor: "the replies from the seller's side." |
| **Common misframings to avoid** | Once VM11 is done, the solicitor often takes time to format and dispatch — chase is to get them out. The seller can't do this themselves. |
| **Typical chase context** | Usually 2–5 working days after the seller provides replies. Solicitors often bundle replies with other work, so a nudge can speed things up. |

---

### VM13 — Seller's solicitor has received additional enquiries

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller's solicitor has received a further round of enquiries from the buyer's solicitor, typically following review of the initial replies. |
| **What "outstanding" means** | Additional enquiries have not yet arrived with the seller's solicitor, or they have not confirmed receipt. We are checking with the seller's solicitor whether further questions have come in. If not, the buyer's solicitor may need chasing separately (via PM17 on the buyer side). |
| **Who is responsible** | Seller's solicitor (confirms receipt); the action of raising further enquiries sits with the buyer's solicitor |
| **Also called** | "Additional enquiries", "further enquiries", "second round", "follow-up enquiries", "supplementary questions". |
| **How to refer to parties** | To the seller: "any additional enquiries" or "further questions from the buyer's side." To the seller's solicitor: "additional enquiries from the buyer's solicitor." |
| **Common misframings to avoid** | Not every transaction has additional enquiries — sometimes the initial replies satisfy everything. Don't assume there will be more; the chase is sometimes "have any been raised, or are we good?" |
| **Typical chase context** | Typical 1–2 weeks after initial replies issued. Volume and intensity varies by buyer's solicitor and any issues raised in searches. |

---

### VM14 — Seller has provided additional replies to their solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller has answered the additional enquiries raised by the buyer's solicitor and provided these further replies to their solicitor. |
| **What "outstanding" means** | Additional enquiries have been received but the seller has not yet supplied their further answers to their solicitor. We are chasing the seller to provide the information needed to resolve the outstanding questions. |
| **Who is responsible** | Seller |
| **Also called** | "Further replies", "additional answers", "the next round of replies". |
| **How to refer to parties** | To the seller: "your further replies" or "your answers to the additional enquiries." To the seller's solicitor: "your client's further replies." |
| **Common misframings to avoid** | Same pattern as VM11 — many additional enquiries are legal/technical and the solicitor handles them. Don't imply the seller is the bottleneck for every question. |
| **Typical chase context** | Often faster turnaround than VM11 because the questions are usually narrower and more specific by this stage. |

---

### VM15 — Seller's solicitor has issued additional responses to the buyer's solicitor

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller's solicitor has sent the seller's additional replies to the buyer's solicitor, resolving the further round of enquiries. |
| **What "outstanding" means** | The seller has provided additional replies but the seller's solicitor has not yet formally issued them to the buyer's solicitor. We are chasing the seller's solicitor to send the responses so enquiries can be resolved. |
| **Who is responsible** | Seller's solicitor |
| **Also called** | "Further responses sent across", "additional replies issued", "second-round replies in". |
| **How to refer to parties** | To the seller: "the further replies your solicitor sent." To the seller's solicitor: "the further responses." To the buyer's solicitor: "the further replies from the seller's side." |
| **Common misframings to avoid** | As with VM12, nudges to dispatch are often useful. Solicitors batch work; a chase pushes it up the priority list. |
| **Typical chase context** | Usually quicker than initial responses — often 1–3 days once seller provides answers. |

---

### VM16 — Seller's solicitor has issued contract documents to the seller

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller's solicitor has sent the final contract documents to the seller for review and signature ahead of exchange. |
| **What "outstanding" means** | The seller's solicitor has not yet issued the contract documents to the seller for signing. We are chasing the seller's solicitor to prepare and send them so the signing process can begin. |
| **Who is responsible** | Seller's solicitor |
| **Also called** | "Contract docs", "contract for signature", "the final contract", "contract pack for signing", "signing pack". |
| **How to refer to parties** | To the seller: "your contract" or "the documents for signing." To the seller's solicitor: "the contract documents." |
| **Common misframings to avoid** | This is the final contract being sent for signature — distinct from VM7 (the draft contract pack going to the other side). Don't conflate. By this stage all enquiries should be satisfied. |
| **Typical chase context** | Issued once enquiries are formally satisfied. Solicitors will usually only release after exchange-readiness is confirmed; a nudge once enquiries close is normal. |

---

### VM17 — Seller's solicitor has received signed contract documents back from the seller

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the seller has signed the contract documents and returned them to their solicitor — a prerequisite for exchange to take place. |
| **What "outstanding" means** | The seller has received the contract documents but has not yet signed and returned them. We are chasing the seller to sign and send them back to their solicitor, as exchange cannot happen without them. |
| **Who is responsible** | Seller |
| **Also called** | "Signed contract back", "signed and returned", "returning the signed docs". |
| **How to refer to parties** | To the seller: "your signed contract" or "the signed documents." To the seller's solicitor: "your client's signed contract." |
| **Common misframings to avoid** | Pure seller action. Some sellers sign immediately; some take days. By this stage urgency is real — exchange typically follows within days. |
| **Typical chase context** | Final critical-path action by the seller. Many solicitors offer to collect or arrange courier. |

---

### VM18 — Seller's solicitor has confirmed readiness to exchange

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | No — this milestone IS the exchange gate per `AGENT_MILESTONE_DIAGNOSIS.md` v4.1 (verify against current seed) |
| **What this milestone tracks** | Whether the seller's solicitor has formally confirmed they are ready to exchange contracts, meaning all legal work on the seller's side is complete and they are authorised to proceed. |
| **What "outstanding" means** | Either not all required vendor-side milestones are yet complete (this milestone remains locked until they are), or all are complete and the seller's solicitor has not yet been asked to give formal confirmation. We are chasing the seller's solicitor to confirm their readiness to exchange. |
| **Who is responsible** | Seller's solicitor |
| **Also called** | "Ready to exchange", "exchange-ready", "all clear from the seller's side", "seller side is good to go". |
| **How to refer to parties** | To the seller: "your solicitor confirming we're ready to exchange." To the seller's solicitor: "confirming you're ready to exchange." To the buyer's solicitor: "the seller's solicitor has confirmed they're ready" (status update). |
| **Common misframings to avoid** | This is the gate — not blocked by other things, it IS the confirmation. Don't describe it as a checkbox to tick; it's the formal solicitor-to-solicitor sign-off that triggers exchange. |
| **Typical chase context** | Once everything else is in place, the actual ready-to-exchange call between solicitors is often the same day. A nudge to the seller's solicitor with "are we good to exchange?" is the usual move. |

---

### VM19 — Seller has received confirmation that contracts have exchanged

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | No (post-exchange notification milestone) |
| **What this milestone tracks** | Whether the seller has been informed that contracts have been formally exchanged, making the transaction legally binding with a confirmed completion date. |
| **What "outstanding" means** | Exchange has taken place but the seller has not yet been formally notified. We are confirming that the seller has received word and is aware of the completion date. |
| **Who is responsible** | Seller's solicitor (notifies seller) |
| **Also called** | "Exchanged", "contracts have exchanged", "we've exchanged". |
| **How to refer to parties** | To the seller: "exchange has happened" or "contracts are now exchanged" — usually celebratory. To others: this is post-event confirmation, not chased. |
| **Common misframings to avoid** | This is celebration territory, not chase territory. If the milestone is open, the seller probably already knows but hasn't confirmed via portal. Tone is congratulatory. |
| **Typical chase context** | Same-day or next-day after exchange. Often comes through informally first (a phone call) before formal portal update. |

---

### VM20 — Seller has received confirmation that the sale has completed

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | No (post-completion notification milestone) |
| **What this milestone tracks** | Whether the seller has been informed that legal completion has taken place — funds received by their solicitor, ownership transferred, transaction closed. |
| **What "outstanding" means** | Completion has occurred but the seller has not yet been formally notified. We are confirming the seller has received word that the sale is done. |
| **Who is responsible** | Seller's solicitor (notifies seller) |
| **Also called** | "Completed", "completion has happened", "the sale has completed", "completed and closed". |
| **How to refer to parties** | To the seller: "completion is done" — fully celebratory at this point. Often paired with thanks for the business. |
| **Common misframings to avoid** | This is end-of-transaction. No more work to chase; just confirmation. Tone should reflect that. |
| **Typical chase context** | Same-day. Funds usually clear by mid-afternoon on completion day; sellers want to know as soon as the money's in. |

---

### VM21 — All enquiries satisfied (seller side)

| Field | Value |
|---|---|
| **Side** | Vendor (seller side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the whole back-and-forth of legal enquiries between the two solicitors has finished on the seller side — every question raised by the buyer's solicitor has been answered to their satisfaction. It is the seller-side twin of PM20 and completes automatically when the buyer's solicitor confirms enquiries satisfied. |
| **What "outstanding" means** | The enquiries loop is still open — the buyer's solicitor has questions that have not yet been fully answered. Progress is tracked on the enquiries tracker (whose-court state and movement log), not by chasing this milestone directly. |
| **Who is responsible** | Managed internally off the enquiries tracker; confirmed in practice by the buyer's solicitor closing enquiries (PM20). Not chased on its own. |
| **Also called** | "Enquiries satisfied", "enquiries all answered", "enquiries closed", "legal questions resolved". |
| **How to refer to parties** | To the seller: "the legal enquiries are all resolved." Avoid implying the seller took any action — this is solicitor-to-solicitor work. |
| **Common misframings to avoid** | Do not chase the seller or the seller's solicitor on this milestone — the enquiries tracker owns the chase cadence. This is a completion marker, not a chase target. Do not confuse with VM10 (enquiries first received). |
| **Typical chase context** | Not independently chased. Completes alongside PM20 when the buyer's solicitor confirms all enquiries are satisfied. |

---

## Purchaser milestones (PM1–PM27)

---

### PM1 — Buyer has instructed their solicitor

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer has formally appointed a solicitor to act for them in this transaction and confirmed their details to the agent. |
| **What "outstanding" means** | The buyer has not yet confirmed they have a solicitor in place. We are chasing them to appoint one (if they haven't) or to provide their solicitor's name and contact details so the transaction can begin properly. |
| **Who is responsible** | Buyer |
| **Also called** | "Appointing a solicitor", "instructing solicitors", "choosing a conveyancer", "getting a solicitor on board". |
| **How to refer to parties** | To the buyer: "your solicitor" once instructed; "appointing a solicitor" before. To the seller side: rarely communicated, but if needed: "the buyer's solicitor." |
| **Common misframings to avoid** | Critical to get right — without this the seller's solicitor can't issue the contract pack to anyone. Don't soften too much; this is the very first thing a buyer needs to do. |
| **Typical chase context** | Should be in place within days of MOS. Buyers using brokers often have a recommended solicitor; nudge can be "have you confirmed with [recommended firm]?" |

---

### PM2 — Buyer has received the memorandum of sale

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the memorandum of sale has been received by the buyer, confirming agreed price, parties, solicitor details, and transaction terms. |
| **What "outstanding" means** | The MOS has not yet been confirmed as received by the buyer. We are chasing confirmation that the buyer and their solicitor have the MOS and all details are correct. |
| **Who is responsible** | Agent (issues the MOS); Buyer (confirms receipt) |
| **Also called** | "MOS", "memo of sale", "the memo". |
| **How to refer to parties** | To the buyer: "your MOS" or "the memo we sent over." To the buyer's solicitor: "the MOS for [property]." |
| **Common misframings to avoid** | Same pattern as VM2 — the agent issued it, so we're confirming receipt. Don't imply the buyer should be chasing anyone for it. |
| **Typical chase context** | Should be confirmed within 24–48 hours of MOS issue. |

---

### PM3 — Buyer has completed ID and AML checks with their solicitor

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer has provided valid identification and completed anti-money laundering verification with their solicitor. |
| **What "outstanding" means** | The buyer has not yet submitted their ID documents or completed AML checks with their solicitor. We are chasing the buyer to do this, as legal work cannot proceed until it is done. |
| **Who is responsible** | Buyer |
| **Also called** | "ID checks", "AML checks", "anti-money laundering", "identity verification", "Thirdfort". |
| **How to refer to parties** | To the buyer: "your ID and AML checks." To the buyer's solicitor: "your client's ID/AML." |
| **Common misframings to avoid** | Pure buyer action. Often forms part of a "complete onboarding with your solicitor" instruction along with PM4 (money on account). Don't blame the solicitor. |
| **Typical chase context** | Like VM4, often a slow personal admin task. Buyers using Thirdfort can complete in minutes; older firms may use post. |

---

### PM4 — Buyer has paid money on account to their solicitor

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer has paid an initial sum (typically covering search fees and other disbursements) to their solicitor to enable work to begin. |
| **What "outstanding" means** | The buyer has not yet transferred the money on account. We are chasing the buyer to make this payment so their solicitor can order searches and begin substantive work. |
| **Who is responsible** | Buyer |
| **Also called** | "Money on account", "MOA", "funds on account", "initial payment", "search fees", "the £300–£500 to your solicitor". |
| **How to refer to parties** | To the buyer: "money on account" or "the initial payment to your solicitor." To the buyer's solicitor: "MOA from your client." |
| **Common misframings to avoid** | Often paired with PM3 in chase messages. Specific amount varies (usually £200–£500). Don't guess at the amount; let the buyer's solicitor confirm. |
| **Typical chase context** | Critical-path because PM8 (searches ordered) is blocked by it. Many buyers don't realise this until their solicitor flags it. |

---

### PM5 — Buyer has submitted their mortgage application

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes (mortgage purchases only; auto-not-required for cash buyers) |
| **What this milestone tracks** | Whether the buyer has formally submitted their mortgage application to their chosen lender. Applies only to mortgage-funded purchases. |
| **What "outstanding" means** | The buyer has not yet submitted their mortgage application. We are chasing them to submit it promptly — usually through their mortgage broker — as the application, valuation, and offer process takes several weeks. |
| **Who is responsible** | Buyer (typically via their mortgage broker) |
| **Also called** | "Mortgage application", "mortgage app", "submitting the mortgage", "applying for the mortgage", "your application is in". |
| **How to refer to parties** | To the buyer: "your mortgage application." To the broker: "your client's mortgage application." To the buyer's solicitor: rarely needed unless flagging delay. |
| **Common misframings to avoid** | Buyers often think "having an Agreement in Principle (AIP)" means they've applied — they haven't. The full application is a separate, post-offer-accepted step. Worth being explicit about which stage. |
| **Typical chase context** | Should follow MOS by days. Common chase target is the broker — they have visibility on submission and can confirm or progress. |

---

### PM6 — Lender valuation has been booked

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes (mortgage purchases only; auto-not-required for cash buyers) |
| **What this milestone tracks** | Whether the lender's valuation of the property has been booked. This can be either a physical valuation (surveyor visits the property) or a desktop valuation (no visit needed). Per `AGENT_MILESTONE_DIAGNOSIS.md` Fix 7, the UI has a "Desktop valuation — no date" checkbox to satisfy this milestone without a date. |
| **What "outstanding" means** | The mortgage application has been submitted but the lender has not yet scheduled their valuation, or confirmed they've done a desktop valuation. We are chasing the buyer or their broker to find out when the valuation is booked and to keep it progressing. |
| **Who is responsible** | Buyer (chases their lender or broker to confirm booking); in practice it is the lender who arranges it |
| **Also called** | "Lender's valuation", "mortgage valuation", "valuation booked", "physical valuation", "desktop valuation" (when no site visit needed), "the bank's valuation". |
| **How to refer to parties** | To the buyer: "your lender's valuation" or "the mortgage valuation." To the broker: "the lender's valuation booking." To the seller side: relevant for access if physical — "the buyer's lender valuation." |
| **Common misframings to avoid** | Don't conflate with the buyer's own survey (PM9). The lender valuation is for the bank's benefit, not the buyer's. It's also not the same as the survey; many buyers think one valuation covers both. The desktop variant is increasingly common — if the lender has done one, this milestone is satisfied without a date. |
| **Typical chase context** | Should be booked within days of mortgage application. Brokers usually have visibility. Physical valuations require seller-side coordination for access. |

---

### PM7 — Buyer's solicitor has received the draft contract pack

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has received the draft contract pack from the seller's solicitor, providing the legal documentation required to begin their review. |
| **What "outstanding" means** | The buyer's solicitor has not yet received the draft contract pack. We are chasing the buyer's solicitor to confirm whether it has arrived. If it has not, the seller's solicitor needs chasing separately (via VM7 on the seller side). |
| **Who is responsible** | Buyer's solicitor (confirms receipt); the act of issuing the pack sits with the seller's solicitor |
| **Also called** | "DCP", "draft contract pack", "contract pack received", "the pack from the other side". |
| **How to refer to parties** | To the buyer: "the contract pack from the seller's side" or "the draft contract pack." To the buyer's solicitor: "the DCP from the seller's side." To the seller's solicitor: cross-reference VM7. |
| **Common misframings to avoid** | If the pack hasn't arrived, the buyer's solicitor isn't the cause — chase VM7 (seller's solicitor) instead. Don't imply the buyer's solicitor is blocking; they're waiting. |
| **Typical chase context** | Receipt confirmation usually within 24–48 hours of issue. Long delays usually mean issue from VM7 hasn't actually happened. |

---

### PM8 — Buyer's solicitor has ordered searches

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has submitted applications for the standard property searches — local authority, drainage, environmental, and any others required. |
| **What "outstanding" means** | The buyer's solicitor has received the contract pack but has not yet ordered searches. We are chasing the buyer's solicitor to place the search applications without further delay. |
| **Who is responsible** | Buyer's solicitor |
| **Also called** | "Searches ordered", "searches in", "searches underway", "ordering searches", "LA searches" (referring to local authority), "the searches". |
| **How to refer to parties** | To the buyer: "your searches" or "the searches." To the buyer's solicitor: "the searches" or by type if specific. To the seller side: "the buyer's searches" (status update). |
| **Common misframings to avoid** | Searches are blocked by PM4 (money on account) — if the buyer hasn't paid, the solicitor can't order. Worth checking PM4 before assuming the solicitor is the bottleneck. Local authority searches take 3–6 weeks; environmental and drainage often back same-day. |
| **Typical chase context** | One of the most-chased milestones. Should be ordered within days of PM7 (DCP received) and PM4 (MOA paid). LA searches dictate the timeline. |

---

### PM9 — Buyer has booked a Level 2 or Level 3 survey

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes (can be marked not required if buyer declines a survey) |
| **What this milestone tracks** | Whether the buyer has commissioned a homebuyer's report (Level 2) or full structural survey (Level 3) on the property. This is separate from the lender's valuation. |
| **What "outstanding" means** | The buyer has not yet booked a survey. We are chasing the buyer to book one promptly, or to confirm they have decided not to have one (in which case the milestone can be marked not required). The milestone name describes the completed state — when outstanding, the booking has NOT yet been made. |
| **Who is responsible** | Buyer |
| **Also called** | "Survey", "Level 2", "Level 3", "Homebuyer's report", "Building survey", "structural survey", "the survey", "their survey". |
| **How to refer to parties** | To the buyer: "your survey" or "your Level 2/3 survey." To the seller side: "the buyer's survey" (relevant for access). To the buyer's solicitor: rarely needed, but if so: "your client's survey." |
| **Common misframings to avoid** | **Critical example for the model.** Milestone reads "Buyer has booked a Level 2 or Level 3 survey" — this is the COMPLETED state. When outstanding, the survey has NOT been booked. Don't write "the survey is booked" or "we're looking forward to the survey." The chase is to get it booked. Also: this is the buyer's private survey, NOT the lender's valuation (PM6) — keep them separate. |
| **Typical chase context** | Optional in principle but most buyers do one. Worth raising the option clearly with first-time buyers who may not know it's separate from the lender's valuation. Survey appointments need seller-side access coordination once booked. |

---

### PM10 — Buyer has received the survey report

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes (auto-not-required if PM9 marked not required) |
| **What this milestone tracks** | Whether the buyer has received the completed survey report back from their surveyor. |
| **What "outstanding" means** | The survey has been booked but the report has not yet been received by the buyer. We are chasing the buyer to confirm when the report is expected or, if overdue, to follow up with their surveyor. |
| **Who is responsible** | Buyer (receives from surveyor and confirms) |
| **Also called** | "Survey report", "the report", "survey results", "their report back". |
| **How to refer to parties** | To the buyer: "your survey report" or "your report back." To the seller side: rarely communicated unless report raises issues — "the buyer's survey report." |
| **Common misframings to avoid** | Surveyors deliver reports a few days after the visit. If the visit happened but the report hasn't arrived, the chase is the surveyor (via the buyer). Don't treat the buyer as blocking — they're waiting on the surveyor too. |
| **Typical chase context** | Reports typically arrive 3–7 days after survey. If report raises issues, opens potential price re-negotiation conversation. Tone should be neutral until the buyer confirms it's clear. |

---

### PM11 — Buyer's solicitor has received the mortgage offer

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes (mortgage purchases only; auto-not-required for cash buyers) |
| **What this milestone tracks** | Whether the buyer's solicitor has received the formal mortgage offer from the lender — the document confirming the loan terms and conditions. |
| **What "outstanding" means** | The lender has not yet issued the mortgage offer, or the buyer's solicitor has not yet confirmed receipt. We are chasing the buyer or their broker to find out when the offer is expected and whether there are any outstanding conditions. |
| **Who is responsible** | Buyer's solicitor (receives offer from lender); Buyer or broker (chases progress) |
| **Also called** | "Mortgage offer", "formal offer", "the offer is in", "offer received", "the bank's offer". |
| **How to refer to parties** | To the buyer: "your mortgage offer." To the broker: "your client's mortgage offer." To the buyer's solicitor: "the mortgage offer." To seller side: "the buyer's mortgage offer" (status update). |
| **Common misframings to avoid** | **Important.** The milestone name "received the mortgage offer" reads as past tense — when outstanding, this is the gap. Don't write "now you have your mortgage offer." The mortgage offer is from the LENDER (not the broker, not the solicitor — they receive it). Cash buyers skip this entirely. |
| **Typical chase context** | Issued 1–3 weeks after lender valuation. Brokers have most visibility. Often the second-longest critical-path item after searches. |

---

### PM12 — Buyer's solicitor has received the management pack from the vendor's solicitor

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes (leasehold only; auto-not-required for freehold) |
| **What this milestone tracks** | Whether the buyer's solicitor has received the management pack from the seller's solicitor. This milestone has a cross-side predecessor: it unlocks when VM9 (seller's solicitor received the management pack) is complete. |
| **What "outstanding" means** | The management pack has not yet been passed from the seller's solicitor to the buyer's solicitor. We are chasing the buyer's solicitor to confirm receipt. If it has not arrived, the seller's solicitor may need chasing separately (via VM9 on the seller side). |
| **Who is responsible** | Buyer's solicitor (confirms receipt); seller's solicitor (sends it on) |
| **Also called** | "Management pack", "LPE1", "leasehold pack", "freeholder pack". |
| **How to refer to parties** | To the buyer: "the management pack from the seller's side." To the buyer's solicitor: "the management pack" or "the LPE1." Cross-references VM9. |
| **Common misframings to avoid** | If not received, root cause is usually VM9 (seller side hasn't got it from freeholder yet). Don't blame the buyer's solicitor — they're waiting. |
| **Typical chase context** | Same slow-moving issue as VM8/VM9. Often the rate-limiting step on leasehold transactions. |

---

### PM13 — Buyer's solicitor has received the search results

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the results of the property searches have been returned and received by the buyer's solicitor. Search results typically take 3–6 weeks from the point of ordering. |
| **What "outstanding" means** | Searches have been ordered but the results have not yet arrived. We are chasing the buyer's solicitor to confirm when results are expected and whether there are any delays with the search providers. |
| **Who is responsible** | Buyer's solicitor (awaiting results from search providers) |
| **Also called** | "Search results", "searches back", "searches in", "results received", "LA back" (specifically local authority). |
| **How to refer to parties** | To the buyer: "your searches" or "the search results." To the buyer's solicitor: "the search results" or by type. To seller side: "the buyer's searches are back" (status update). |
| **Common misframings to avoid** | Search results are a passive wait — the buyer's solicitor placed the order, now awaits results from external providers (councils, water companies, environmental agencies). Don't imply the solicitor is blocking. Local Authority is usually the slowest. |
| **Typical chase context** | 3–6 weeks typical. Environmental and drainage usually fast (days); LA can be 4–8 weeks depending on council. Sometimes back in batches. |

---

### PM14 — Buyer's solicitor has raised initial enquiries to the seller's solicitor

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has reviewed the draft contract pack and formally raised their first round of legal enquiries to the seller's solicitor. |
| **What "outstanding" means** | The buyer's solicitor has received the contract pack but has not yet raised initial enquiries. We are chasing the buyer's solicitor to submit their questions promptly so the enquiry process can begin. |
| **Who is responsible** | Buyer's solicitor |
| **Also called** | "Initial enquiries", "first round of enquiries", "raised enquiries", "enquiries gone across". |
| **How to refer to parties** | To the buyer: "your solicitor's initial enquiries." To the buyer's solicitor: "your initial enquiries." To seller side: cross-references VM10. |
| **Common misframings to avoid** | Many buyer's solicitors wait for searches before raising enquiries (so they only raise once). Worth asking process — some raise immediately, others batch. If they're waiting on searches (PM13), that's the actual blocker. |
| **Typical chase context** | Variable depending on solicitor process. Some raise within days of DCP receipt; others wait for searches. Worth establishing process early. |

---

### PM15 — Buyer's solicitor has received initial replies from the seller's solicitor

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has received the seller's solicitor's responses to the initial enquiries. This milestone's reminder is anchored to VM12 (seller's solicitor issued initial replies). |
| **What "outstanding" means** | Initial replies have not yet arrived with the buyer's solicitor. We are chasing the buyer's solicitor to confirm whether replies have been received. If not, the seller's solicitor needs chasing separately (via VM12 on the seller side). |
| **Who is responsible** | Buyer's solicitor (confirms receipt); seller's solicitor (sends the replies) |
| **Also called** | "Replies in", "replies received", "replies back", "responses to enquiries". |
| **How to refer to parties** | To the buyer: "the replies from the seller's side." To the buyer's solicitor: "the replies." Cross-references VM12. |
| **Common misframings to avoid** | If not received, root cause is VM12 (seller's solicitor hasn't sent). Buyer's solicitor is just confirming receipt. |
| **Typical chase context** | Should arrive 1–2 weeks after PM14 (initial enquiries raised). Long delays usually indicate seller-side issues with VM11 (seller providing answers). |

---

### PM16 — Buyer's solicitor has reviewed the initial replies

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has completed their review of the seller's initial enquiry replies and determined whether further enquiries are needed. |
| **What "outstanding" means** | Initial replies have been received but the buyer's solicitor has not yet confirmed they have reviewed them. We are chasing the buyer's solicitor to complete their review and advise whether they are satisfied or need to raise further questions. |
| **Who is responsible** | Buyer's solicitor |
| **Also called** | "Reviewing replies", "going through the replies", "reviewing the responses", "checking the replies". |
| **How to refer to parties** | To the buyer: "your solicitor reviewing the replies." To the buyer's solicitor: "your review of the replies." To seller side: "the buyer's solicitor reviewing replies." |
| **Common misframings to avoid** | Pure buyer's-solicitor action. Outcome is either "all satisfied" (move toward exchange) or "raising further enquiries" (PM17 follows). Don't pre-empt which. |
| **Typical chase context** | Usually a few days. Can stretch if replies are extensive or raise new issues. |

---

### PM17 — Buyer's solicitor has raised additional enquiries

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has raised a further round of enquiries to the seller's solicitor following their review of the initial replies. |
| **What "outstanding" means** | The initial replies have been reviewed but the buyer's solicitor has not yet raised any additional questions. We are chasing the buyer's solicitor to either raise further enquiries or confirm they are satisfied and no additional questions are needed. |
| **Who is responsible** | Buyer's solicitor |
| **Also called** | "Further enquiries", "additional enquiries", "second round", "follow-up enquiries". |
| **How to refer to parties** | To the buyer: "your solicitor's further enquiries." To the buyer's solicitor: "your further enquiries." To seller side: cross-references VM13. |
| **Common misframings to avoid** | Not every transaction has additional enquiries — it's legitimate to satisfy everything in the first round. Don't assume there will be more; the chase can be "are we done with enquiries, or further to raise?" |
| **Typical chase context** | Within a week of PM16. Often quicker than initial enquiries since they're narrower in scope. |

---

### PM18 — Buyer's solicitor has received additional replies

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has received the seller's solicitor's responses to the additional enquiries. This milestone's reminder is anchored to VM15 (seller's solicitor issued further replies). |
| **What "outstanding" means** | Further enquiries have been raised but the seller's solicitor has not yet responded, or the buyer's solicitor has not confirmed receipt. We are chasing the buyer's solicitor to confirm whether replies have arrived. If not, the seller's solicitor needs chasing separately (via VM15 on the seller side). |
| **Who is responsible** | Buyer's solicitor (confirms receipt); seller's solicitor (provides the replies) |
| **Also called** | "Further replies in", "additional replies received", "responses to further enquiries". |
| **How to refer to parties** | To the buyer: "the further replies from the seller's side." To the buyer's solicitor: "the further replies." Cross-references VM15. |
| **Common misframings to avoid** | If not received, chase target is VM15 (seller's solicitor). Buyer's solicitor is the receiver, not the action-holder. |
| **Typical chase context** | Usually 1–2 weeks after PM17. Quicker than initial replies because the questions are narrower. |

---

### PM19 — Buyer's solicitor has reviewed the additional replies

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has reviewed the additional enquiry replies and assessed whether all legal questions are now resolved. |
| **What "outstanding" means** | Additional replies have been received but the buyer's solicitor has not yet confirmed they have reviewed them and are content to proceed. We are chasing the buyer's solicitor to complete their review. |
| **Who is responsible** | Buyer's solicitor |
| **Also called** | "Reviewing further replies", "going through additional replies", "reviewing second-round responses". |
| **How to refer to parties** | To the buyer: "your solicitor reviewing the further replies." To the buyer's solicitor: "your review." |
| **Common misframings to avoid** | Like PM16 but for the second round. Outcome is usually "all satisfied" by this stage; if not, may trigger a third round (rare). |
| **Typical chase context** | Days, not weeks. By this stage transaction is usually nearing pre-exchange phase. |

---

### PM20 — Buyer's solicitor has confirmed all enquiries are now satisfied

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has formally confirmed that all legal enquiries have been resolved to their satisfaction and they are ready to proceed toward exchange. |
| **What "outstanding" means** | The enquiry review is complete but the buyer's solicitor has not yet given their formal sign-off confirming satisfaction with all replies. We are chasing the buyer's solicitor for this confirmation, which unlocks the final pre-exchange steps. |
| **Who is responsible** | Buyer's solicitor |
| **Also called** | "Enquiries satisfied", "all enquiries resolved", "enquiries closed", "all clear on enquiries". |
| **How to refer to parties** | To the buyer: "your solicitor confirming all enquiries are satisfied." To the buyer's solicitor: "confirming all enquiries are satisfied." |
| **Common misframings to avoid** | This is the formal sign-off. Often comes via the buyer's solicitor saying "we're happy with replies and looking to issue contract docs." Distinct from PM16/PM19 (review of replies) — this is the final-clear confirmation. |
| **Typical chase context** | Usually same day or day after PM19. Triggers PM21/PM22 (final report and contract docs to buyer). |

---

### PM21 — Buyer has received the final report from their solicitor

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has prepared and sent the buyer a final report summarising the legal position, search results, mortgage conditions, and recommendation to proceed with the purchase. |
| **What "outstanding" means** | The buyer's solicitor has not yet sent, or the buyer has not yet confirmed receipt of, the final report. We are chasing the buyer's solicitor to issue it and the buyer to confirm they have it. |
| **Who is responsible** | Buyer's solicitor (issues the report); Buyer (confirms receipt) |
| **Also called** | "Final report", "report on title", "the report from your solicitor", "the legal report". |
| **How to refer to parties** | To the buyer: "your final report" or "the report from your solicitor." To the buyer's solicitor: "your final report." To seller side: rarely needed. |
| **Common misframings to avoid** | Issued by buyer's solicitor — the buyer reads, doesn't generate. Often packaged with PM22 (contract documents). Don't imply the buyer has to do anything other than read it. |
| **Typical chase context** | Issued shortly after PM20. Can come in same package as PM22 contract documents. |

---

### PM22 — Buyer's solicitor has issued contract documents to the buyer

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer's solicitor has sent the contract documents to the buyer for review and signature ahead of exchange. |
| **What "outstanding" means** | The buyer's solicitor has not yet issued the contract documents to the buyer. We are chasing the buyer's solicitor to prepare and send them so the signing process can begin. |
| **Who is responsible** | Buyer's solicitor |
| **Also called** | "Contract docs", "contract for signing", "the contract pack for signature", "signing pack". |
| **How to refer to parties** | To the buyer: "your contract" or "the documents for signing." To the buyer's solicitor: "the contract documents." |
| **Common misframings to avoid** | This is the final contract for signing — distinct from PM7 (the draft contract pack received from seller's side). Don't conflate. Solicitor-issued, not buyer-generated. |
| **Typical chase context** | Issued once enquiries closed. Often packaged with PM21 final report. By this stage exchange is days away. |

---

### PM23 — Buyer's solicitor has received the signed contract documents back from the buyer

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer has signed the contract documents and returned them to their solicitor — a prerequisite for exchange to take place. |
| **What "outstanding" means** | The buyer has received contract documents but has not yet signed and returned them. We are chasing the buyer to sign and send them back to their solicitor, as exchange cannot happen without them. |
| **Who is responsible** | Buyer |
| **Also called** | "Signed contract back", "signed and returned", "your signed contract", "returning the signed docs". |
| **How to refer to parties** | To the buyer: "your signed contract" or "the signed documents." To the buyer's solicitor: "your client's signed contract." |
| **Common misframings to avoid** | Pure buyer action by this stage — exchange waits on this. Tone can be more urgent because exchange is imminent. Same pattern as VM17 on seller side. |
| **Typical chase context** | Final critical-path action. Many solicitors arrange courier or DocuSign. Should be days, not weeks. |

---

### PM24 — Buyer has transferred the deposit

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | Yes |
| **What this milestone tracks** | Whether the buyer has transferred the exchange deposit (typically 10% of the purchase price) to their solicitor's client account in readiness for exchange. |
| **What "outstanding" means** | The buyer has not yet transferred the deposit funds to their solicitor. We are chasing the buyer to arrange the transfer promptly, as exchange cannot proceed without cleared funds in the solicitor's account. |
| **Who is responsible** | Buyer |
| **Also called** | "Deposit transferred", "deposit funds in", "the 10%", "exchange deposit", "deposit on account", "cleared funds". |
| **How to refer to parties** | To the buyer: "your deposit" or "the exchange deposit." To the buyer's solicitor: "the deposit from your client" or "cleared funds." |
| **Common misframings to avoid** | Standard 10%, but can be reduced by mutual agreement (e.g. 5% if deposit is constrained). Funds need to clear, so transfer must happen 1–2 working days before exchange. Don't treat the deposit as "the full amount" — that's completion (separate event). |
| **Typical chase context** | Critical: bank transfer cut-off times matter. Transfers initiated late on a Friday may not clear until Monday. Worth flagging timing explicitly. |

---

### PM25 — Buyer's solicitor has confirmed readiness to exchange

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | No — this milestone IS the exchange gate per `AGENT_MILESTONE_DIAGNOSIS.md` v4.1 (verify against current seed) |
| **What this milestone tracks** | Whether the buyer's solicitor has formally confirmed they are ready to exchange contracts, meaning all legal, financial, and due-diligence conditions on the buyer's side are satisfied. |
| **What "outstanding" means** | Either not all required purchaser-side milestones are yet complete (this milestone remains locked until they are), or all are complete and the buyer's solicitor has not yet been asked to give formal confirmation. We are chasing the buyer's solicitor to confirm their readiness to exchange. |
| **Who is responsible** | Buyer's solicitor |
| **Also called** | "Ready to exchange", "exchange-ready", "all clear from the buyer's side", "buyer side is good to go". |
| **How to refer to parties** | To the buyer: "your solicitor confirming we're ready to exchange." To the buyer's solicitor: "confirming you're ready to exchange." To the seller's solicitor: "the buyer's solicitor has confirmed they're ready" (status update). |
| **Common misframings to avoid** | Same pattern as VM18. This is THE gate confirmation. Once both sides have confirmed (VM18 + PM25), exchange happens. Don't describe it as a checkbox. |
| **Typical chase context** | Final solicitor-to-solicitor sign-off. Often same day as the actual exchange. Both sides confirm; then contracts exchange formally over the phone or by DX. |

---

### PM26 — Buyer has received confirmation that contracts have exchanged

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | No (post-exchange notification milestone) |
| **What this milestone tracks** | Whether the buyer has been informed that contracts have been formally exchanged, making the transaction legally binding with a confirmed completion date. |
| **What "outstanding" means** | Exchange has taken place but the buyer has not yet been formally notified. We are confirming the buyer has received word and is aware of the completion date. |
| **Who is responsible** | Buyer's solicitor (notifies buyer) |
| **Also called** | "Exchanged", "contracts exchanged", "exchange confirmed". |
| **How to refer to parties** | To the buyer: "exchange has happened" or "we've exchanged" — celebratory tone. Often paired with mention of the completion date. |
| **Common misframings to avoid** | Celebration territory. The buyer may already know informally; this is portal confirmation. Don't treat as a chase — treat as a check-in / congratulation. |
| **Typical chase context** | Same-day. Often comes through verbally first. |

---

### PM27 — Buyer has received confirmation that the sale has completed

| Field | Value |
|---|---|
| **Side** | Purchaser (buyer side) |
| **Blocks exchange** | No (post-completion notification milestone) |
| **What this milestone tracks** | Whether the buyer has been informed that legal completion has taken place — funds transferred, ownership transferred, and they can collect the keys. |
| **What "outstanding" means** | Completion has occurred but the buyer has not yet been formally notified. We are confirming the buyer has received word that completion is done and keys are available. |
| **Who is responsible** | Buyer's solicitor (notifies buyer); Agent (releases keys) |
| **Also called** | "Completed", "completion done", "you're in", "keys are ready", "moved in". |
| **How to refer to parties** | To the buyer: "you're completed" or "completion is done — keys are ready." Tone fully celebratory; often "welcome home" type messaging. |
| **Common misframings to avoid** | End of transaction. No more chasing — just confirmation and key handover. Tone reflects the moment. |
| **Typical chase context** | Funds typically clear by mid-afternoon on completion day. Keys released once seller's solicitor confirms funds received. |

---

*End of glossary.*
