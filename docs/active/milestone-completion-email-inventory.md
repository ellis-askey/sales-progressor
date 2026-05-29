# Milestone-completion email inventory — all 47 codes (verbatim)

> Status: read-only extraction from current code as at 2026-05-27. No code changes.
> Scope: every email that fires **because a milestone was completed**. Auth/invites/billing/survey/retention are out of scope — they don't fan out from milestone completion.
> Companion: bilateral hand-off Artifact 2 ([bilateral-handoff-artifact-2-email-copy.md](bilateral-handoff-artifact-2-email-copy.md)) — its hand-off copy is slotted in alongside the existing copy for the 10 bilateral codes so it can be voice-checked in context.

---

## 0. How to read this document

Each of the 47 milestone codes appears once, in **journey order** (instruction → completion), with all its email variants together. Direct quotes from `lib/portal-copy.ts` — subject + body verbatim. Variant labels (`vendor`, `purchaser`, `vendorAgent`, `progressor`) match the keys in the `emailCopy` object on each milestone.

For the 10 bilateral codes, the proposed Artifact 2 hand-off copy is inserted **below the existing variant it replaces**, marked `→ HAND-OFF REPLACEMENT`. Use these to check the new copy reads naturally next to its neighbours.

Voice flags (per [docs/polish-pass/VOICE_GUIDELINES.md](../polish-pass/VOICE_GUIDELINES.md)) are added inline where I noticed something. Most copy is solid; flags are sparse.

---

## 1. The completion fan-out (how this works at runtime)

When a milestone is confirmed, [lib/services/portal.ts:742](../../lib/services/portal.ts#L742) `sendAdminMilestoneNotificationToPortal` runs:

- **Exchange (VM19) and exchange (PM26)** get a separate "completion pack" path via `sendExchangeCompletionPack` (lines 1090+) — not the standard rich-email path. Out of scope of this doc's verbatim quoting only because it's a templated multi-step pack rather than a single email; the `vendor`/`purchaser` variants on VM19/PM26 in `portal-copy.ts` ARE used for the headline parts of the pack.
- **All other codes** with a defined `emailCopy` go through `sendRichMilestoneEmails` (line 980), which fans out to up to **four recipients per confirm**:
  1. **`vendor`** variant — emailed to every contact on the file with `roleType = "vendor"`. The vendor key exists on most milestones (both seller-side and buyer-side), because vendor-side contacts want to know about buyer-side events too.
  2. **`purchaser`** variant — same shape, sent to every `roleType = "purchaser"` contact.
  3. **`vendorAgent`** variant — sent to `tx.agentUser` (the agency director/negotiator who owns the file). **Suppressed entirely when `serviceType === "self_managed"`** (line 1064) — self-managed agents don't get emails about their own confirms.
  4. **`progressor`** variant — sent to `tx.assignedUser` (the assigned Sales Progressor). **Suppressed when the SP is the confirmer** (line 1076) — no self-notification echoes.
- Codes with **no `emailCopy` defined** fall through to a generic "Progress update" template (lines 819–824 of portal.ts) — quoted below in §3 as a single template that covers all such codes. (In practice every code with substantive copy defines `emailCopy`; only edge cases hit the fallback.)

**Variant presence matters.** If a milestone doesn't define a `purchaser` variant, no purchaser email fires on that confirm. Many seller-side milestones omit `vendorAgent` and that's fine — the agent FYI just doesn't go out. The presence/absence per code is noted on each milestone below.

---

## 2. Chase-digest treatment (one mechanism for all codes)

The **chase-digest email is not per-code**. It is a daily roll-up email built by [lib/email/client-chase-digest.ts](../../lib/email/client-chase-digest.ts), sent once per contact per file, listing all currently-due chaseable milestones as bullets. Per-code "chase email" content reduces to a single string: the milestone's **`label`** field (from `portal-copy.ts`).

- Subject: `"{address}: 1 update needed"` or `"{address}: N updates needed"`
- Body (overall-tone = "nudge"): `"A quick update on your sale at {address}. N things are sitting with your solicitor right now that we haven't seen confirmed yet:"` then bullets in the form `"• {label}"`.
- Body (overall-tone = "diy"): `"There are N things on your sale at {address} that only you can move forward:"` then bullets.
- Body (overall-tone = "mixed"): split into "Yours to do:" + "[party] is sitting on these:" sections, both with bulleted labels.
- Tail: `"You don't need to do anything yourself. If it's been a while and you want to chase, a short email often helps. If you've heard back and we just don't know yet, open the page below and let us know..."`

**Per-code chase content** = the milestone's `label`. Listed per milestone below in the "Chase digest label" line.

Codes that **never appear in the client digest** (no client-facing chase): per [lib/chase/portal-agent-only-codes.ts](../../lib/chase/portal-agent-only-codes.ts), the six exchange-gate / exchange / completion codes (VM18, PM25, VM19, PM26, VM20, PM27) are excluded. Their bullets never fire to clients.

---

## 3. The fallback "Progress update" template (lines 819–824 of portal.ts)

For any code without an `emailCopy`, this generic email fires to all vendor + purchaser contacts:

```
Subject: Progress update — {address}

Hi {firstName},

Your {sale|purchase} at {address} is moving forward.

  ✓ {label}{ — date if eventDate present}

View your portal: {portalUrl}
```

This is the safety net. Every milestone in the inventory below defines `emailCopy`, so the fallback isn't hit in practice — it's noted here so the inventory is complete.

---

## 4. Per-milestone inventory (journey order)

Codes in 16 phases following the natural transaction flow. The 10 bilateral pairs are clustered with their counterpart for side-by-side voice checking.

---

### PHASE 1 — Instruction

---

#### VM1 — Seller has instructed their solicitor
[portal-copy.ts:49](../../lib/portal-copy.ts#L49) · `who: "you"` · `canBeMarkedNr: never` · No predecessor
**Chase digest label:** `Instruct your solicitor`
**Fan-out:** vendor, purchaser, progressor *(no vendorAgent variant)*

**vendor:**
```
Subject: You've instructed your solicitor — {address}

You've taken the first step.

You've formally instructed your solicitor to act on the sale. They'll now start the conveyancing process — preparing the contract pack, gathering title documents, and handling any questions that come in from the buyer's solicitor.

Your solicitor will prepare the contract pack and, if the property is leasehold, request the management pack from your freeholder or managing agent. This typically takes a few weeks. We'll be in touch when there's a meaningful update.

→ View your portal
```

**purchaser:**
```
Subject: The seller has instructed their solicitor — {address}

Good news on your purchase.

The seller has formally instructed their solicitor to act on the sale. This is an important early step — things are now moving on the seller's side of the transaction.

Nothing for you to do right now. The seller's solicitor will prepare the contract pack and send it to your solicitor in the coming weeks. We'll let you know when that happens.

→ View your portal
```

**progressor:**
```
Subject: VM1 complete: Seller instructed solicitor — {address}

Logged on {address}.

Vendor has confirmed solicitor instruction.

→ View transaction
```

---

#### PM1 — Buyer has instructed their solicitor
[portal-copy.ts:703](../../lib/portal-copy.ts#L703) · `who: "you"` · `canBeMarkedNr: never` · No predecessor
**Chase digest label:** `Instruct your solicitor`
**Fan-out:** purchaser, vendor, progressor *(no vendorAgent variant)*

**purchaser:**
```
Subject: You've instructed your solicitor — {address}

You've taken the first step.

You've formally instructed your solicitor to act on your purchase. They'll now contact you with a welcome pack, their terms of business, and details of what they need from you to get started.

Return your solicitor's welcome pack and complete your ID checks as quickly as possible — your solicitor cannot begin substantive work until these are in place. We'll update you when there's meaningful progress.

→ View your portal
```

**vendor:**
```
Subject: The buyer has instructed their solicitor — {address}

Good news on your sale.

The buyer has formally instructed their solicitor to act on the purchase. Conveyancing is now underway on the buyer's side.

Nothing for you to do right now — we'll keep you updated as both sides progress.

→ View your portal
```

**progressor:**
```
Subject: PM1 complete: Buyer instructed solicitor — {address}

Logged on {address}.

Purchaser has confirmed solicitor instruction.

→ View transaction
```

🅥 **Voice flag (mild):** VM1 vendor / PM1 purchaser both close with "meaningful update" / "meaningful progress" — the same filler I caught in Artifact 2. Worth tightening (e.g. VM1 → "We'll let you know when the buyer's side has instructed their solicitor too" / "when the contract pack goes out"). Not a regression, just a polish opportunity.

---

### PHASE 2 — Memorandum of sale

---

#### VM2 — Seller has received the memorandum of sale
[portal-copy.ts:80](../../lib/portal-copy.ts#L80) · `who: "solicitor"` · No predecessor
**Chase digest label:** `Receive memorandum of sale`
**Fan-out:** vendor, purchaser, progressor

**vendor:**
```
Subject: Memorandum of sale issued — {address}

The legal process has officially started.

The memorandum of sale has been sent to all solicitors, confirming the agreed price and the details of both parties. This is the document that formally kicks off conveyancing.

Your solicitor will now begin preparing the contract pack. Returning your solicitor's welcome pack quickly is the single biggest thing you can do this week to keep the transaction moving.

→ View your portal
```

**purchaser:**
```
Subject: Memorandum of sale issued — {address}

The legal process has officially started.

The memorandum of sale has been sent to all solicitors, confirming the agreed purchase price and the details of both parties. Your solicitor now has formal confirmation to proceed.

If you haven't already, return your solicitor's welcome pack and complete your ID checks — your solicitor can't get fully started until these are done. If you're buying with a mortgage, also make sure your application is progressing.

→ View your portal
```

**progressor:**
```
Subject: VM2 complete: MoS received — {address}

Logged on {address}.

Memorandum of sale confirmed received by vendor's solicitor.

→ View transaction
```

---

#### PM2 — Buyer has received the memorandum of sale
[portal-copy.ts:734](../../lib/portal-copy.ts#L734) · `who: "solicitor"` · No predecessor
**Chase digest label:** `Receive memorandum of sale`
**Fan-out:** purchaser, progressor *(no vendor variant — asymmetric vs VM2)*

**purchaser:**
```
Subject: Memorandum of sale issued — {address}

The legal process has officially started.

The memorandum of sale has been sent to all solicitors, confirming the agreed purchase price and the details of both parties. Your solicitor now has formal confirmation to begin conveyancing.

If you haven't already, return your solicitor's welcome pack and complete your ID checks — your solicitor can't get fully started until these are done. If you're buying with a mortgage, also make sure your application is progressing.

→ View your portal
```

**progressor:**
```
Subject: PM2 complete: MoS received — {address}

Logged on {address}.

Memorandum of sale confirmed received by buyer's solicitor.

→ View transaction
```

🅥 **Voice flag — asymmetry:** PM2 has no `vendor` variant. So when the buyer's side confirms MOS receipt, the seller gets no email. VM2 does fire a purchaser email on the symmetric event. The asymmetry isn't necessarily wrong (MOS is the same event for both sides, sent by the agent to all solicitors at the same time, so the second confirm of "received" might be considered redundant) — but worth flagging because the inventory's job is to surface inconsistencies. Decision call: keep asymmetric (it's redundant) or add the missing variant (consistency).

---

### PHASE 3 — Welcome pack, ID/AML, money on account

---

#### VM3 — Seller has received the welcome pack from their solicitor
[portal-copy.ts:111](../../lib/portal-copy.ts#L111) · `who: "you"` · `canBeMarkedNr: never`
**Chase digest label:** `Receive welcome pack from solicitor` (`labelOther: "Seller received welcome pack from solicitor"`)
**Fan-out:** purchaser, vendor, progressor

**vendor:**
```
Subject: Welcome pack received from your solicitor — {address}

Your solicitor has made contact.

Your solicitor has sent you their welcome pack. It contains their terms of business, a property questionnaire, and details of what ID they need from you. Returning this quickly is one of the best things you can do to keep the transaction moving.

Complete the forms and return them as soon as you can — ideally within a few days. Your solicitor cannot begin substantive work until these are back with them.

→ View your portal
```

**purchaser:**
```
Subject: Seller is engaging with their solicitor — {address}

Quick update on your purchase.

The seller has received their welcome pack from their solicitor — the kick-off paperwork for conveyancing on their side.

Nothing for you to do right now. The seller will return the forms to their solicitor in due course.

→ View your portal
```

**progressor:**
```
Subject: VM3 complete: Seller received welcome pack — {address}

Logged on {address}.

Vendor has confirmed receipt of solicitor's welcome pack.

→ View transaction
```

🅥 **Voice flag (mild):** Purchaser body — "The seller has received their welcome pack from their solicitor" feels like low-signal noise to the buyer. It's a process update with no implication for them. Not off-voice exactly, but it's the kind of email the buyer might reasonably wonder "why am I being told this?". Compare to bilateral hand-off philosophy: only nudge the opposite side when the event has *implications* for them. Worth considering whether VM3 → purchaser should fire at all.

---

#### VM4 — Seller has completed ID and AML checks with their solicitor
[portal-copy.ts:142](../../lib/portal-copy.ts#L142) · `who: "you"` · `canBeMarkedNr: never`
**Chase digest label:** `Complete ID & AML checks` (`labelOther: "Seller completed ID & AML checks"`)
**Fan-out:** purchaser, vendor, progressor

**vendor:**
```
Subject: ID checks complete — {address}

You've cleared an important legal requirement.

Your identity has been verified and your solicitor has completed the anti-money laundering checks required by law. This clears the way for them to begin substantive work on your behalf.

Your solicitor will now continue preparing the contract pack. Worth flagging: if you haven't yet returned your property information forms when you receive them, do so promptly — delays here are one of the main things that slow transactions down.

→ View your portal
```

**purchaser:**
```
Subject: Seller's ID checks complete — {address}

Good news on your purchase.

The seller has completed their ID and anti-money laundering checks. Their solicitor can now begin substantive work on the sale.

Nothing for you to do right now — this is one of the early signals that things are moving properly on the seller's side.

→ View your portal
```

**progressor:**
```
Subject: VM4 complete: Seller ID checks done — {address}

Logged on {address}.

Vendor has confirmed completion of ID and AML verification.

→ View transaction
```

---

#### PM3 — Buyer has completed ID and AML checks with their solicitor
[portal-copy.ts:757](../../lib/portal-copy.ts#L757) · `who: "you"` · `canBeMarkedNr: never`
**Chase digest label:** `Complete ID & AML checks` (`labelOther: "Buyer completed ID & AML checks"`)
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: ID checks complete — {address}

You've cleared an important legal requirement.

Your identity has been verified and your solicitor has completed the anti-money laundering checks required by law. This allows them to begin substantive work on your purchase.

Your solicitor is now able to work on your case fully. Worth flagging: if you haven't yet paid your money on account, do this as soon as possible — your solicitor will need it before they can order searches.

→ View your portal
```

**vendor:**
```
Subject: Buyer's ID checks complete — {address}

Good news on your sale.

The buyer has completed their ID and anti-money laundering checks. Their solicitor can now begin substantive work on the purchase.

Nothing for you to do right now — this is one of the early signals that things are moving properly on the buyer's side.

→ View your portal
```

**progressor:**
```
Subject: PM3 complete: Buyer ID checks done — {address}

Logged on {address}.

Purchaser has confirmed completion of ID and AML verification.

→ View transaction
```

---

#### PM4 — Buyer has paid money on account to their solicitor
[portal-copy.ts:788](../../lib/portal-copy.ts#L788) · `who: "you"` · `canBeMarkedNr: never`
**Chase digest label:** `Pay money on account to solicitor` (`labelOther: "Buyer paid money on account to solicitor"`)
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Payment on account received by your solicitor — {address}

Thank you — your solicitor has received your payment on account.

Your initial payment to your solicitor has been received. This covers the cost of searches and other disbursements they'll incur on your behalf during the conveyancing process. This is separate from your deposit.

Your solicitor can now order searches and proceed with the full conveyancing process. We'll update you as each stage progresses.

→ View your portal
```

**vendor:**
```
Subject: Buyer has put funds with their solicitor — {address}

Strong signal on your sale.

The buyer has transferred funds to their solicitor for searches and disbursements. This is one of the clearest signals that the buyer is committed in the early stages of a transaction.

Searches will typically be ordered shortly — that's usually the next major step on the buyer's side.

→ View your portal
```

**progressor:**
```
Subject: PM4 complete: Buyer paid money on account — {address}

Logged on {address}.

Purchaser has confirmed payment on account to solicitor.

→ View transaction
```

---

### PHASE 4 — Property information forms (TA6 / TA10)

---

#### VM5 — Seller has received the property information forms from their solicitor
[portal-copy.ts:173](../../lib/portal-copy.ts#L173) · `who: "you"` · `canBeMarkedNr: never`
**Chase digest label:** `Receive property information forms` (`labelOther: "Seller received property information forms"`)
**Fan-out:** purchaser, vendor, progressor

**vendor:**
```
Subject: Property information forms received — {address}

Your solicitor needs information from you.

Your solicitor has sent you the property information forms (TA6 and TA10). These ask about the property's history, what's included in the sale, any disputes or planning permissions, and more. The buyer's solicitor will rely on your answers.

Complete the forms as thoroughly and accurately as you can — these are legal documents. Return them to your solicitor promptly. If you're unsure about any question, call your solicitor before leaving it blank.

→ View your portal
```

**purchaser:**
```
Subject: Seller is gathering property information — {address}

Quick update on your purchase.

The seller has been sent their property information forms (TA6 and TA10) by their solicitor. These capture details about the property's history, what's included in the sale, and any planning or dispute history.

Nothing for you to do right now. The seller will complete and return these to their solicitor in the coming days.

→ View your portal
```

**progressor:**
```
Subject: VM5 complete: Seller received property forms — {address}

Logged on {address}.

Vendor has confirmed receipt of TA6/TA10 property information forms.

→ View transaction
```

🅥 **Voice flag (mild):** Same as VM3 — purchaser variant is a low-signal "process update" that may not need to fire. The buyer has nothing to do and nothing to react to. Compare to the bilateral hand-off philosophy: nudge the other side when there's an implication for them, not when the system has logged a step.

---

#### VM6 — Seller has returned completed property information forms to their solicitor
[portal-copy.ts:204](../../lib/portal-copy.ts#L204) · `who: "you"` · `canBeMarkedNr: never`
**Chase digest label:** `Return completed property forms`
**Fan-out:** vendor, purchaser, progressor

**vendor:**
```
Subject: Property forms returned to your solicitor — {address}

Your forms are back with your solicitor.

Your completed property information forms have been received by your solicitor. They'll now incorporate these into the contract pack and send everything to the buyer's solicitor.

Your solicitor will issue the draft contract pack to the buyer's solicitor. We'll let you know when that's done.

→ View your portal
```

**purchaser:**
```
Subject: The seller has returned their property information forms — {address}

Progress on your purchase.

The seller has returned their completed property information forms to their solicitor. These will be included in the contract pack that comes to your solicitor.

Nothing to do from your side right now. The seller's solicitor will now finalise the contract pack and send it across.

→ View your portal
```

**progressor:**
```
Subject: VM6 complete: Seller returned property forms — {address}

Logged on {address}.

Vendor has confirmed return of completed TA6/TA10 forms to solicitor.

→ View transaction
```

---

### PHASE 5 — Mortgage

---

#### PM5 — Buyer has submitted their mortgage application
[portal-copy.ts:819](../../lib/portal-copy.ts#L819) · `who: "you"` · `canBeMarkedNr: auto_only` (NRs on cash purchases)
**Chase digest label:** `Submit mortgage application` (`labelOther: "Buyer submitted mortgage application"`)
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Mortgage application submitted — {address}

Your mortgage application is in.

Your full mortgage application has been submitted to your lender. They'll now assess your application, arrange a valuation of the property, and work towards issuing a formal mortgage offer.

Your lender will book a valuation of the property — usually within a week or two. Once the valuation is done, the formal mortgage offer typically follows within 1–3 weeks. Your broker or lender will keep you updated.

→ View your portal
```

**vendor:**
```
Subject: Buyer's mortgage application is in — {address}

Quick update on your sale.

The buyer has submitted their mortgage application to their lender. The lender will now process the application — this typically includes a valuation visit to the property. We'll be in touch to coordinate access.

We'll let you know when the mortgage offer is issued.

→ View your portal
```

**progressor:**
```
Subject: PM5 complete: Buyer submitted mortgage application — {address}

Logged on {address}.

Purchaser has confirmed mortgage application submitted.

→ View transaction
```

---

#### PM6 — Lender valuation has been booked
[portal-copy.ts:850](../../lib/portal-copy.ts#L850) · `who: "lender"` · `eventDateRequired: true` · `canBeMarkedNr: auto_only`
**Chase digest label:** `Lender valuation booked`
**Fan-out:** vendor, purchaser, progressor
**Interpolation vars:** `{eventDate}`, `{eventDateClause}`, `{vendorVisitNote}`, `{purchaserPhysicalNote}` — sub'd at send-time depending on whether the valuation is physical or desktop (PM6-specific).

**vendor:**
```
Subject: Buyer's lender valuation — {address}

Quick update on your sale.

The buyer's lender has booked the property valuation{eventDate}.{vendorVisitNote} Once the valuation is done, the buyer's mortgage offer typically follows within 1–3 weeks. We'll let you know when it's issued.

→ View your portal
```

`{vendorVisitNote}` interpolates to one of:
- ` A surveyor acting for the lender will visit to value the property — access has been arranged, so nothing else for you to do right now.` (physical)
- ` No physical visit to the property is needed — the assessment is conducted remotely.` (desktop)

**purchaser:**
```
Subject: Mortgage valuation — {address}

Your mortgage lender has arranged their valuation.

Your lender has arranged a valuation of the property — {eventDateClause}.{purchaserPhysicalNote}

If you haven't already booked your own survey, now is a good time — a RICS HomeBuyer Report will identify issues the lender's valuation won't cover. Once the valuation is complete, your mortgage offer should follow within 1–3 weeks.

→ View your portal
```

`{eventDateClause}` interpolates to `booked for {date}` or `a desktop valuation (no physical visit required)`. `{purchaserPhysicalNote}` adds reassurance text on physical valuations only.

**progressor:**
```
Subject: PM6 complete: Lender valuation booked — {address}

Logged on {address}.

Lender valuation confirmed booked.

→ View transaction
```

---

#### PM11 — Buyer's solicitor has received the mortgage offer
[portal-copy.ts:1005](../../lib/portal-copy.ts#L1005) · `who: "lender"` · `useEventDate: true` · `canBeMarkedNr: auto_only`
**Chase digest label:** `Mortgage offer received`
**Fan-out:** purchaser, vendor, vendorAgent, progressor

**purchaser:**
```
Subject: Your mortgage offer has arrived — {address}

Congratulations — your mortgage is confirmed.

Your lender has issued a formal mortgage offer. This confirms the amount they're willing to lend, the interest rate, the term, and any conditions attached. Your solicitor has received a copy and will check it against the property title.

Check the offer carefully — confirm the loan amount, rate, and term match what you agreed with your broker or lender. If anything looks wrong, raise it immediately. Your solicitor will review the conditions and let you know if anything needs addressing.

→ View your portal
```

**vendor:**
```
Subject: The buyer's mortgage offer has been issued — {address}

Good news on your sale.

The buyer has received their formal mortgage offer from their lender. The financing for your sale is now confirmed — a significant step towards exchange.

Nothing for you to do. The transaction is moving in the right direction on the buyer's side.

→ View your portal
```

**vendorAgent:**
```
Subject: Buyer's mortgage offer issued — {address}

Quick update on {address}.

Buyer has received their formal mortgage offer. Financing confirmed.

→ View in dashboard
```

**progressor:**
```
Subject: PM11 complete: Buyer mortgage offer received — {address}

Logged on {address}.

Purchaser has confirmed mortgage offer received from lender.

→ View transaction
```

---

### PHASE 6 — Draft contract pack 🤝 BILATERAL PAIR

---

#### VM7 — Seller's solicitor has issued the draft contract pack
[portal-copy.ts:235](../../lib/portal-copy.ts#L235) · `who: "solicitor"` · `canBeMarkedNr: never`
**Chase digest label:** `Draft contract pack issued`
**Fan-out:** vendor, purchaser, vendorAgent, progressor
**🤝 Bilateral with PM7** — see Artifact 2 §5

**vendor (existing, unchanged under hand-off):**
```
Subject: Draft contract pack sent to the buyer's solicitor — {address}

A significant step forward.

Your solicitor has sent the draft contract pack to the buyer's solicitor. This is the bundle of documents that forms the legal foundation of the sale — the contract itself, your property information forms, title documents, and any relevant certificates.

The buyer's solicitor will now review everything carefully and is likely to raise enquiries — questions about the property and the documents. Your solicitor will handle these, though they may need your input on some points.

→ View your portal
```

**purchaser (existing — `→ HAND-OFF REPLACEMENT` see below):**
```
Subject: The contract pack has arrived with your solicitor — {address}

Things are moving on your purchase.

The seller's solicitor has sent the contract pack to your solicitor. This is the full bundle of legal documents — the draft contract, title documents, property information forms, and more. Your solicitor will now review everything in detail.

Your solicitor will go through the contract pack and raise any questions that need answering. In the meantime, make sure your mortgage application is progressing and any searches have been ordered.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §5.A.4):**
```
Subject: Please confirm receipt of the contract pack — {address}

Good news on your purchase. The seller's solicitor has sent the contract pack across to your solicitor — the full bundle of legal documents that will form the basis of your purchase. Your solicitor will now review everything in detail and start raising enquiries.

On your end, there's one quick thing: open your portal and confirm you're aware the pack is now with your solicitor. The confirm button is highlighted, waiting for you. It takes about ten seconds and it helps keep the file moving.

While you wait, it's worth checking your mortgage application is progressing and any searches have been ordered. We'll be in touch when your solicitor's enquiries go across.

→ Open your portal
```

**vendorAgent:**
```
Subject: Contract pack issued — {address}

Quick update on {address}.

Seller's solicitor has issued the draft contract pack to the buyer's solicitor.

→ View in dashboard
```

**progressor:**
```
Subject: VM7 complete: Contract pack issued — {address}

Logged on {address}.

Vendor solicitor has issued draft contract pack to buyer's solicitor.

→ View transaction
```

---

#### PM7 — Buyer's solicitor has received the draft contract pack
[portal-copy.ts:881](../../lib/portal-copy.ts#L881) · `who: "solicitor"` · `canBeMarkedNr: never`
**Chase digest label:** `Draft contract pack received`
**Fan-out:** purchaser, vendor, progressor *(no vendorAgent variant)*
**🤝 Bilateral with VM7** — Artifact 2 §5 inverse direction

**purchaser (existing, unchanged):**
```
Subject: Contract pack received by your solicitor — {address}

The legal documents are with your solicitor.

Your solicitor has received the contract pack from the seller's solicitor. This is the bundle of documents that forms the legal foundation of the purchase — the draft contract, title documents, property information forms, and any relevant certificates. Your solicitor will now review everything carefully.

Your solicitor will work through the contract pack and raise enquiries. If you haven't already ordered searches, make sure that's in hand — your solicitor needs your payment on account before they can do so. In parallel, keep your mortgage application and survey progressing.

→ View your portal
```

**vendor (existing — `→ HAND-OFF REPLACEMENT` see below):**
```
Subject: Your contract pack has arrived with the buyer's solicitor — {address}

Progress on your sale.

The contract pack has been received by the buyer's solicitor. They'll now review everything carefully and will raise any questions they have about the property or the documents.

The buyer's solicitor will raise enquiries in due course and will also order searches around this time. Your solicitor will handle the enquiries — they may need your input on some points, and we'll be in touch if so.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §5.B.4, inverse direction):**
```
Subject: Please confirm the contract pack has gone out — {address}

Quick update on your sale. The buyer's solicitor has confirmed they've received the draft contract pack — so it sounds like your solicitor has sent it across as planned, even if it hasn't been logged on our side yet.

Could you do one quick thing? Open your portal and confirm you're aware the pack has been sent. The confirm button is highlighted, waiting for you. It takes about ten seconds and it helps keep the file's records in sync.

The buyer's solicitor will be reviewing the pack now and is likely to raise enquiries in the next week or two. Your solicitor will handle those — they may need your input on some points, and we'll be in touch if so.

→ Open your portal
```

**progressor:**
```
Subject: PM7 complete: Contract pack received — {address}

Logged on {address}.

Buyer's solicitor has confirmed receipt of draft contract pack.

→ View transaction
```

---

### PHASE 7 — Management pack (leasehold)

---

#### VM8 — Seller's solicitor has requested the management pack
[portal-copy.ts:274](../../lib/portal-copy.ts#L274) · `who: "solicitor"` · `canBeMarkedNr: auto_only` (NRs on freeholds)
**Chase digest label:** `Management pack requested`
**Fan-out:** purchaser, vendor, progressor

**vendor:**
```
Subject: Management pack requested from your freeholder — {address}

Leasehold paperwork is underway.

Your solicitor has requested the management pack from your freeholder or managing agent. This pack contains the leasehold information the buyer's solicitor will need — service charge accounts, ground rent history, building insurance, and details of any planned major works.

Management packs can take a while — typically several weeks, sometimes longer. Worth noting: freeholders usually charge a fee for providing the pack, which will be deducted from your sale proceeds at completion. We'll let you know as soon as it arrives.

→ View your portal
```

**purchaser:**
```
Subject: Leasehold information requested — {address}

Quick update on your purchase.

The seller's solicitor has requested the management pack from the freeholder or managing agent. This contains the leasehold information your solicitor will need — service charges, ground rent, building insurance, and any planned major works.

Management packs sometimes take a few weeks to come back, but this is now in motion. Nothing for you to do right now.

→ View your portal
```

**progressor:**
```
Subject: VM8 complete: Management pack requested — {address}

Logged on {address}.

Vendor solicitor has requested management pack from freeholder/managing agent.

→ View transaction
```

---

#### VM9 — Seller's solicitor has received the management pack
[portal-copy.ts:305](../../lib/portal-copy.ts#L305) · `who: "solicitor"` · `typicalDuration: "can take 4–8 weeks"` · `canBeMarkedNr: auto_only`
**Chase digest label:** `Management pack received`
**Fan-out:** vendor, purchaser, progressor

**vendor:**
```
Subject: Management pack received — {address}

The leasehold paperwork has arrived.

The management pack has been received from your freeholder or managing agent. Your solicitor will now review the leasehold information — service charges, ground rent, building insurance, and any planned works — before sending it to the buyer's solicitor.

This is often one of the longer waits in a leasehold transaction, so receiving it is real progress. Your solicitor will incorporate the pack into the contract pack and send it across to the buyer's side.

→ View your portal
```

**purchaser:**
```
Subject: Management pack received on your purchase — {address}

Good news on the leasehold side.

The management pack from the freeholder has arrived and is being reviewed. This contains the leasehold information your solicitor needs — service charges, ground rent, building insurance, and details of any planned major works to the building.

Your solicitor will review the management pack carefully and raise any points with the seller's solicitor as part of the enquiries process.

→ View your portal
```

**progressor:**
```
Subject: VM9 complete: Management pack received — {address}
[remainder follows the standard progressor template — "Logged on {address}. Vendor solicitor confirmed receipt of management pack."]
```

---

#### PM12 — Buyer's solicitor has received the management pack from the vendor's solicitor
[portal-copy.ts:1044](../../lib/portal-copy.ts#L1044) · `who: "solicitor"` · prereq: `VM9` (cross-side) · `canBeMarkedNr: auto_only`
**Chase digest label:** `Management pack received`
**Fan-out:** vendor, purchaser, progressor
**📌 Explicitly kept OUT of bilateral hand-off scope** — see brief §3. Its chase stays live (it's the kind of step that quietly stalls and needs watching).

**vendor:**
```
Subject: Management pack received — {address}

Quick update on your sale.

The management pack from the freeholder has been received by the buyer's solicitor. They'll now review service charges, ground rent, building insurance, and any planned major works.

Nothing for you to do right now.

→ View your portal
```

**purchaser:**
```
Subject: Management pack received — {address}

The leasehold paperwork has arrived.

The management pack from the freeholder has been received by your solicitor. They'll now review the service charge accounts, ground rent history, building insurance arrangements, and any planned or recent major works to the building.

Your solicitor will raise any concerns from the management pack with the seller's solicitor as part of the enquiries process. We'll let you know if anything needs your attention.

→ View your portal
```

**progressor:**
```
Subject: PM12 complete: Management pack received — {address}

Logged on {address}.

Buyer's solicitor has confirmed management pack received.

→ View transaction
```

🅥 **Voice flag — subject collision:** VM9 and PM12 share the **exact same subject line** `Management pack received — {address}` going to the vendor contact (VM9 fires "vendor" variant; PM12 also fires "vendor" variant). On a leasehold file, the seller will get two emails with identical subjects within hours/days of each other, one when their solicitor logs receipt (VM9) and one when the buyer's solicitor logs receipt (PM12). Vendor body text differs but subject does not. **Recommend disambiguating** — e.g. VM9 → `Management pack received by your solicitor — {address}`, PM12 → `Buyer's solicitor has the management pack — {address}`. Out of scope for hand-off feature but worth a quick polish ticket.

---

### PHASE 8 — Searches

---

#### PM8 — Buyer's solicitor has ordered searches
[portal-copy.ts:912](../../lib/portal-copy.ts#L912) · `who: "solicitor"` · `typicalDuration: "results in 2–4 weeks"` · `canBeMarkedNr: never`
**Chase digest label:** `Searches ordered`
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Searches ordered on your purchase — {address}

Your solicitor has ordered the searches.

Your solicitor has submitted the search applications to the local authority, water authority, and other relevant bodies. Searches check for things like planning permissions, flood risk, drainage rights, and other factors that could affect the property.

Searches typically take 2–4 weeks to come back depending on the local authority — there's nothing for you to do while you wait. We'll let you know when they arrive.

→ View your portal
```

**vendor:**
```
Subject: Buyer's solicitor has ordered searches — {address}

Quick update on your sale.

The buyer's solicitor has submitted search applications to the local authority, water authority, and other relevant bodies. Searches check for planning permissions, flood risk, and drainage — they're a standard part of the buyer's due diligence.

Nothing for you to do. We'll keep you updated as things progress.

→ View your portal
```

**progressor:**
```
Subject: PM8 complete: Searches ordered — {address}

Logged on {address}.

Buyer's solicitor has confirmed searches ordered.

→ View transaction
```

---

#### PM13 — Buyer's solicitor has received the search results
[portal-copy.ts:1075](../../lib/portal-copy.ts#L1075) · `who: "solicitor"` · `typicalDuration: "usually 2–6 weeks"`
**Chase digest label:** `Search results received`
**Fan-out:** vendor, purchaser, vendorAgent, progressor

**purchaser:**
```
Subject: Search results back — {address}

Your searches have come back.

The search results have been received from the local authority and other bodies. Your solicitor will now review them carefully — they cover planning permissions, flood risk, drainage, and other factors affecting the property.

Most searches come back with nothing of concern. If your solicitor does identify something worth discussing, they'll be in touch. Otherwise, this keeps things moving towards exchange.

→ View your portal
```

**vendor:**
```
Subject: Buyer's search results are back — {address}

Quick update on your sale.

The search results have been received by the buyer's solicitor. Searches cover planning, flood risk, drainage, and other local factors.

Nothing for you to do. Most searches come back without issue — we'll let you know if anything needs attention.

→ View your portal
```

**vendorAgent:**
```
Subject: Buyer's search results received — {address}

Quick update on {address}.

Buyer's solicitor has confirmed search results received. Conveyancing progressing.

→ View in dashboard
```

**progressor:**
```
Subject: PM13 complete: Search results received — {address}

Logged on {address}.

Buyer's solicitor has confirmed search results received.

→ View transaction
```

---

### PHASE 9 — Survey

---

#### PM9 — Buyer has booked a Level 2 or Level 3 survey
[portal-copy.ts:943](../../lib/portal-copy.ts#L943) · `who: "you"` · `eventDateRequired: true` · `canBeMarkedNr: manual_allowed`
**Chase digest label:** `Book your survey` (`labelOther: "Buyer booked their survey"`)
**Fan-out:** vendor, purchaser, progressor
**Interpolation:** `{eventDate}` — " — {dayname}, {date}" or empty.

**purchaser:**
```
Subject: Survey booked — {address}

Your survey is booked{eventDate}.

Your independent survey has been booked. The surveyor will inspect the property and produce a detailed report covering its condition and any issues they find.

Most survey reports flag some issues — the report will highlight what your solicitor can formally request information on from the seller, though not all are legal requirements. If significant issues are found and you want to renegotiate, you'll need a specialist contractor to assess them and provide a quote — that quote is what any price reduction would be based on. Discuss your options with your solicitor when the report arrives.

→ View your portal
```

**vendor:**
```
Subject: Buyer has booked their survey — {address}

Quick update on your sale.

The buyer has booked their property survey{eventDate}. A surveyor will visit the property — access has been arranged, so nothing else for you to do right now. The visit itself usually takes a few hours; the written report typically follows within one to two weeks. We'll let you know once the buyer has their report.

→ View your portal
```

**progressor:**
```
Subject: PM9 complete: Buyer booked survey — {address}

Logged on {address}.

Purchaser has confirmed survey booked.

→ View transaction
```

---

#### PM10 — Buyer has received the survey report
[portal-copy.ts:974](../../lib/portal-copy.ts#L974) · `who: "you"` · `canBeMarkedNr: auto_only` (cascades from PM9 N/R)
**Chase digest label:** `Survey report received`
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Your survey report has arrived — {address}

Your survey report is ready.

Your surveyor has delivered their report on the property. Most surveys flag some issues — it's rare to get a completely clean report, so don't be alarmed if yours highlights a few things.

Read the report carefully and note anything rated as a significant risk or requiring urgent attention. If you have concerns, speak to your solicitor — they can advise on whether to seek a specialist report or request further information from the seller.

→ View your portal
```

**vendor:**
```
Subject: Buyer's survey report has been received — {address}

Quick update on your sale.

The buyer has received their survey report. Surveys commonly flag some issues — this doesn't necessarily mean there's a problem, but the buyer may come back with queries or requests.

We'll let you know if the buyer raises anything from the report.

→ View your portal
```

**progressor:**
```
Subject: PM10 complete: Buyer received survey report — {address}

Logged on {address}.

Purchaser has confirmed receipt of survey report.

→ View transaction
```

---

### PHASE 10 — Initial enquiries 🤝 BILATERAL PAIRS

---

#### PM14 — Buyer's solicitor has raised initial enquiries
[portal-copy.ts:1114](../../lib/portal-copy.ts#L1114) · `who: "solicitor"`
**Chase digest label:** `Initial enquiries raised`
**Fan-out:** vendor, purchaser, vendorAgent, progressor
**🤝 Bilateral with VM10** — Artifact 2 §6 (default direction: PM14 confirms first)

**purchaser (existing, unchanged):**
```
Subject: Your solicitor has raised enquiries — {address}

Enquiries are now with the seller's solicitor.

Your solicitor has raised their first round of enquiries with the seller's solicitor — questions about the property, the title, and the documents in the contract pack. This is a completely normal and important part of the conveyancing process.

The seller's solicitor will work through the questions and reply in due course. Your solicitor will review the replies and let you know if any further questions are needed.

→ View your portal
```

**vendor (existing — `→ HAND-OFF REPLACEMENT` see below):**
```
Subject: Buyer's solicitor has raised enquiries — {address}

Quick update on your sale.

The buyer's solicitor has raised their initial round of enquiries with your solicitor. They're asking questions about the property, the title, and documents in the contract pack — a normal part of conveyancing.

Your solicitor will work through the questions and reply. We'll let you know when replies have been sent.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §6.A.4 — informational, NOT a confirm-push, see asymmetry note):**
```
Subject: Heads up: enquiries on the way to your solicitor — {address}

A quick heads up on your sale. The buyer's solicitor has raised their first round of enquiries — questions about the property and the documents in the contract pack. They'll be on their way to your solicitor now (or already with them — these things move quickly). This is a completely normal part of the process and doesn't indicate any problem.

There's nothing for you to do right now. Your solicitor will let you know when the enquiries land and may need your input on some points — if they reach out, please respond as quickly as you can. Delays on enquiries are one of the most common reasons transactions slow down.

→ View your portal
```

**vendorAgent:**
```
Subject: Initial enquiries raised — {address}

Quick update on {address}.

Buyer's solicitor has raised their initial enquiries with the seller's solicitor.

→ View in dashboard
```

**progressor:**
```
Subject: PM14 complete: Initial enquiries raised — {address}

Logged on {address}.

Buyer's solicitor has raised initial enquiries with vendor's solicitor.

→ View transaction
```

---

#### VM10 — Seller's solicitor has received initial enquiries
[portal-copy.ts:336](../../lib/portal-copy.ts#L336) · `who: "solicitor"` · prereq: `VM7`
**Chase digest label:** `Initial enquiries received`
**Fan-out:** purchaser, vendor, progressor
**🤝 Bilateral with PM14** — Artifact 2 §6 (inverse direction: VM10 confirms before PM14)

**vendor (existing — `→ HAND-OFF REPLACEMENT` for default-direction nudge — but see asymmetry: VM10 default-direction nudge is the informational §6.A.4 quoted under PM14 above; this VM10 vendor email below is what fires when VM10 ITSELF is confirmed, which is the inverse direction or the late-confirm case):**
```
Subject: Buyer's enquiries received — {address}

The buyer's solicitor has questions.

The buyer's solicitor has raised their first round of enquiries — questions about the property and the documents in the contract pack. This is a completely normal part of the process. Your solicitor will work through them and may need your input on some points.

If your solicitor contacts you asking for information to help answer the enquiries, please respond as quickly as you can. Delays in enquiries are one of the most common reasons transactions slow down.

→ View your portal
```

**purchaser (existing — `→ HAND-OFF REPLACEMENT` see below, for inverse direction):**
```
Subject: Your solicitor's questions are with the seller's side — {address}

Quick update on your purchase.

Your solicitor's initial enquiries have been received by the seller's solicitor. They'll now work through the questions with the seller.

Nothing for you to do right now — your solicitor will let you know when the replies come back.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §6.B.4, inverse direction — VM10 confirms before PM14):**
```
Subject: Please confirm your solicitor has raised the enquiries — {address}

Quick update on your purchase. The seller's solicitor has confirmed they've received the first round of enquiries — so your solicitor has clearly raised them, even if that step hasn't been logged on our side yet.

Could you do one quick thing? Open your portal and confirm your solicitor has raised the enquiries. The confirm button is highlighted, waiting for you. It takes about ten seconds and it helps keep your file's records in sync.

The seller's solicitor will work through the questions and your solicitor will review the replies when they come back. We'll keep you posted.

→ Open your portal
```

**progressor:**
```
Subject: VM10 complete: Initial enquiries received — {address}

Logged on {address}.

Buyer's solicitor has raised initial enquiries.

→ View transaction
```

---

#### VM11 — Seller has provided initial replies to their solicitor
[portal-copy.ts:367](../../lib/portal-copy.ts#L367) · `who: "you"` · `canBeMarkedNr: never`
**Chase digest label:** `Provide replies to enquiries` (`labelOther: "Seller provided replies to enquiries"`)
**Fan-out:** purchaser, vendor, progressor

**vendor:**
```
Subject: Replies to enquiries provided — {address}

Good progress on your sale.

You've provided your solicitor with the information they need to prepare replies to the buyer's enquiries.

Your solicitor will compile the formal replies and send them to the buyer's solicitor. We'll let you know when they're across.

→ View your portal
```

**purchaser:**
```
Subject: Seller has answered your solicitor's questions — {address}

Progress on your purchase.

The seller has provided their solicitor with the information needed to reply to your solicitor's enquiries. The seller's solicitor will now formally send the replies across.

Nothing for you to do right now — your solicitor will let you know once the replies are in their hands.

→ View your portal
```

**progressor:**
```
Subject: VM11 complete: Seller provided enquiry replies — {address}

Logged on {address}.

Vendor has confirmed they've provided replies to solicitor for initial enquiries.

→ View transaction
```

---

#### VM12 — Seller's solicitor has issued initial responses to the buyer's solicitor
[portal-copy.ts:398](../../lib/portal-copy.ts#L398) · `who: "solicitor"`
**Chase digest label:** `Replies sent to buyer's solicitor`
**Fan-out:** vendor, purchaser, progressor
**🤝 Bilateral with PM15** — Artifact 2 §7 (default direction: VM12 confirms first)

**vendor (existing, unchanged):**
```
Subject: Enquiry replies sent to the buyer's solicitor — {address}

Your solicitor has replied to the enquiries.

Your solicitor has sent their replies to the buyer's solicitor's initial enquiries. The buyer's solicitor will now review these and may come back with further questions — this is completely normal.

There's nothing for you to do right now. If another round of questions arrives, we'll let you know.

→ View your portal
```

**purchaser (existing — `→ HAND-OFF REPLACEMENT` see below):**
```
Subject: The seller has replied to your solicitor's enquiries — {address}

Progress on the enquiries.

The seller's solicitor has sent replies to your solicitor's initial enquiries. Your solicitor will now review the answers and decide whether any further questions are needed.

Your solicitor will let you know if anything in the replies needs your attention. Otherwise, they'll continue working through the remaining points before you move towards exchange.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §7.A.4):**
```
Subject: Please confirm receipt of the seller's replies — {address}

Progress on your purchase. The seller's solicitor has sent their replies to your solicitor's initial enquiries. Your solicitor will now review the answers and decide whether further questions are needed.

On your end, one quick thing: open your portal and confirm you're aware the replies have come back. The confirm button is highlighted, waiting for you. It takes about ten seconds.

If anything in the replies needs your attention, your solicitor will be in touch. Otherwise, they'll continue working through the remaining points before you move towards exchange.

→ Open your portal
```

**progressor:**
```
Subject: VM12 complete: Initial replies sent to buyer's solicitor — {address}

Logged on {address}.

Vendor solicitor has sent initial enquiry replies to buyer's solicitor.

→ View transaction
```

---

#### PM15 — Buyer's solicitor has received initial replies from the seller's solicitor
[portal-copy.ts:1153](../../lib/portal-copy.ts#L1153) · `who: "solicitor"` · prereq: `PM14`
**Chase digest label:** `Initial replies received`
**Fan-out:** vendor, purchaser, progressor
**🤝 Bilateral with VM12** — Artifact 2 §7 (inverse direction)

**vendor (existing — would fire if VM12 hadn't already; under hand-off this is the inverse-direction acted-side):**
```
Subject: Your solicitor has replied to the buyer's enquiries — {address}

Quick update on your sale.

Your solicitor has replied to the buyer's solicitor's initial enquiries. The buyer's solicitor will now review the responses.

There may be follow-up questions. We'll keep you updated.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §7.B.4, inverse direction):**
```
Subject: Please confirm your replies have gone out — {address}

Quick update on your sale. The buyer's solicitor has confirmed they've received the replies to their initial enquiries — so it sounds like your solicitor has sent them across as planned, even if it hasn't been logged on our side yet.

Could you do one quick thing? Open your portal and confirm you're aware the replies have gone out. The confirm button is highlighted, waiting for you. It takes about ten seconds and it helps keep the file's records in sync.

The buyer's solicitor will review the replies and may come back with further questions — that's normal. We'll keep you updated.

→ Open your portal
```

**purchaser (existing, unchanged):**
```
Subject: Seller's solicitor has replied to your solicitor's enquiries — {address}

Replies are in from the seller's side.

The seller's solicitor has replied to your solicitor's initial enquiries. Your solicitor will now review the answers and assess whether everything has been addressed satisfactorily.

Your solicitor may come back with further questions, or they may be satisfied and begin working towards exchange. Either way, we'll keep you posted.

→ View your portal
```

**progressor:**
```
Subject: PM15 complete: Initial replies received — {address}

Logged on {address}.

Initial enquiry replies received from vendor's solicitor.

→ View transaction
```

---

#### PM16 — Buyer's solicitor has reviewed the initial replies
[portal-copy.ts:1184](../../lib/portal-copy.ts#L1184) · `who: "solicitor"` · prereq: `PM15`
**Chase digest label:** `Initial replies reviewed`
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Your solicitor has reviewed the seller's replies — {address}

Your solicitor has reviewed the seller's answers.

Your solicitor has gone through the replies to their initial enquiries. They're assessing whether all the questions have been answered satisfactorily and whether any further questions are needed.

If further questions are needed, your solicitor will raise them. Otherwise, they'll move on to reviewing the remaining legal points before reporting to you and moving towards exchange.

→ View your portal
```

**vendor:**
```
Subject: Buyer's solicitor has reviewed the enquiry replies — {address}

Quick update on your sale.

The buyer's solicitor has reviewed your solicitor's replies to their enquiries and is assessing whether all points have been answered satisfactorily.

There may be a further round of questions — this is normal. We'll keep you updated.

→ View your portal
```

**progressor:**
```
Subject: PM16 complete: Initial replies reviewed — {address}

Logged on {address}.

Buyer's solicitor has reviewed initial enquiry replies.

→ View transaction
```

---

### PHASE 11 — Further enquiries 🤝 BILATERAL PAIRS

---

#### PM17 — Buyer's solicitor has raised additional enquiries
[portal-copy.ts:1215](../../lib/portal-copy.ts#L1215) · `who: "solicitor"` · prereq: `PM14`
**Chase digest label:** `Additional enquiries raised`
**Fan-out:** vendor, purchaser, progressor
**🤝 Bilateral with VM13** — Artifact 2 §8

**purchaser (existing, unchanged):**
```
Subject: Your solicitor has raised further questions — {address}

Another round of questions — completely normal.

Your solicitor has raised a further round of enquiries with the seller's solicitor. Most transactions go through at least two rounds of questions before everything is resolved — this doesn't indicate a problem.

The seller's solicitor will work through the additional questions and reply. Your solicitor will then review and let you know if all points have been resolved.

→ View your portal
```

**vendor (existing — `→ HAND-OFF REPLACEMENT` see below):**
```
Subject: Buyer's solicitor has raised further questions — {address}

Quick update on your sale.

The buyer's solicitor has raised a further round of enquiries with your solicitor. Multiple rounds of questions are completely normal in conveyancing — this doesn't indicate a problem.

Your solicitor will work through the additional questions and reply. We'll let you know when replies are sent.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §8.A.4 — informational, NOT a confirm-push):**
```
Subject: Heads up: further enquiries on the way to your solicitor — {address}

A quick heads up on your sale. The buyer's solicitor has raised a further round of enquiries with your solicitor. Most transactions go through at least two rounds of questions before everything is resolved, so this is completely normal — not a sign of any problem. They'll be on their way to your solicitor now (or already with them).

There's nothing for you to do right now. Your solicitor will work through the additional questions and may need your input on some points. If they reach out, please respond as promptly as you can.

→ View your portal
```

**progressor:**
```
Subject: PM17 complete: Additional enquiries raised — {address}

Logged on {address}.

Buyer's solicitor has raised additional enquiries.

→ View transaction
```

---

#### VM13 — Seller's solicitor has received additional enquiries
[portal-copy.ts:429](../../lib/portal-copy.ts#L429) · `who: "solicitor"` · prereq: `VM10`
**Chase digest label:** `Additional enquiries received`
**Fan-out:** purchaser, vendor, progressor
**🤝 Bilateral with PM17** — Artifact 2 §8 (inverse direction)

**vendor (existing — fires when VM13 itself confirms, which is the inverse direction):**
```
Subject: Additional enquiries from the buyer — {address}

Another round of questions.

Most transactions go through at least two rounds of enquiries before all questions are resolved. Your solicitor will work through these and may need your input on some points.

Your solicitor will work through these. If they need your input on any points, they'll be in touch — please respond as promptly as you can.

→ View your portal
```

**purchaser (existing — `→ HAND-OFF REPLACEMENT` see below, inverse direction):**
```
Subject: Your further questions are with the seller's side — {address}

Quick update on your purchase.

The further enquiries your solicitor raised have been received by the seller's solicitor. They'll now work through the additional points with the seller.

Nothing for you to do right now.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §8.B.4, inverse direction):**
```
Subject: Please confirm your solicitor has raised the further enquiries — {address}

Quick update on your purchase. The seller's solicitor has confirmed they've received your solicitor's further round of enquiries — so your solicitor has clearly raised them, even if that step hasn't been logged on our side yet.

Could you do one quick thing? Open your portal and confirm your solicitor has raised the further enquiries. The confirm button is highlighted, waiting for you. It takes about ten seconds and it helps keep your file's records in sync.

The seller's solicitor will work through the questions and your solicitor will review the replies when they come back. We'll keep you posted.

→ Open your portal
```

**progressor:**
```
Subject: VM13 complete: Additional enquiries received — {address}

Logged on {address}.

Buyer's solicitor has raised additional enquiries.

→ View transaction
```

🅥 **Voice flag — duplicate progressor body:** VM13's progressor `whatHappened` reads "Buyer's solicitor has raised additional enquiries" — same as PM17's progressor body. From the progressor's perspective, these are two distinct log events (one on each side) but the body doesn't distinguish them. Tiny edit: VM13 → "Vendor's solicitor has confirmed receipt of additional enquiries from buyer's solicitor."

---

#### VM14 — Seller has provided additional replies to their solicitor
[portal-copy.ts:460](../../lib/portal-copy.ts#L460) · `who: "you"` · `canBeMarkedNr: never`
**Chase digest label:** `Provide additional replies` (`labelOther: "Seller provided additional replies"`)
**Fan-out:** purchaser, vendor, progressor

**vendor:**
```
Subject: Additional replies provided — {address}

Good progress on your sale.

You've given your solicitor the additional information needed to reply to the buyer's further enquiries.

Your solicitor will compile and send the additional replies to the buyer's solicitor.

→ View your portal
```

**purchaser:**
```
Subject: Seller has answered the further questions — {address}

Progress on your purchase.

The seller has provided their solicitor with answers to the additional enquiries your solicitor raised. The seller's solicitor will now send these replies across.

Nothing for you to do right now.

→ View your portal
```

**progressor:**
```
Subject: VM14 complete: Seller provided additional replies — {address}

Logged on {address}.

Vendor has confirmed they've provided replies to solicitor for additional enquiries.

→ View transaction
```

---

#### VM15 — Seller's solicitor has issued additional responses to the buyer's solicitor
[portal-copy.ts:491](../../lib/portal-copy.ts#L491) · `who: "solicitor"`
**Chase digest label:** `Additional replies sent`
**Fan-out:** vendor, purchaser, progressor
**🤝 Bilateral with PM18** — Artifact 2 §9

**vendor (existing, unchanged):**
```
Subject: All enquiry replies sent — moving towards exchange — {address}

The enquiries are behind you.

Your solicitor has sent replies to all outstanding enquiries from the buyer's solicitor. Both sides are now working towards exchange of contracts.

The next steps are your solicitor sending you the contract to sign and confirming they're ready to exchange. We'll be in touch when there's an update.

→ View your portal
```

**purchaser (existing — `→ HAND-OFF REPLACEMENT` see below):**
```
Subject: The seller has replied to all enquiries — {address}

The enquiry stage is winding up.

The seller's solicitor has replied to all of your solicitor's enquiries. Your solicitor will now review the additional replies and work through any remaining outstanding points.

Once your solicitor is satisfied with all the replies, they'll prepare their final report to you and confirm they're ready to move towards exchange.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §9.A.4):**
```
Subject: Please confirm receipt of the further replies — {address}

The enquiry stage is winding up. The seller's solicitor has replied to all of your solicitor's enquiries. Your solicitor will now review the additional replies and work through any remaining outstanding points.

On your end, one quick thing: open your portal and confirm you're aware the replies have come back. The confirm button is highlighted, waiting for you. It takes about ten seconds.

Once your solicitor is satisfied with all the replies, they'll prepare their final report to you and confirm they're ready to move towards exchange.

→ Open your portal
```

**progressor:**
```
Subject: VM15 complete: Additional replies sent to buyer's solicitor — {address}

Logged on {address}.

Vendor solicitor has sent additional enquiry replies to buyer's solicitor.

→ View transaction
```

---

#### PM18 — Buyer's solicitor has received additional replies
[portal-copy.ts:1246](../../lib/portal-copy.ts#L1246) · `who: "solicitor"` · prereq: `PM17`
**Chase digest label:** `Additional replies received`
**Fan-out:** vendor, purchaser, progressor
**🤝 Bilateral with VM15** — Artifact 2 §9 (inverse direction)

**vendor (existing — would fire if VM15 hadn't already; inverse-direction acted-side):**
```
Subject: Your solicitor has replied to further buyer enquiries — {address}

Quick update on your sale.

Your solicitor has replied to the buyer's solicitor's additional enquiries. The buyer's solicitor will now review the answers.

We'll let you know when the buyer's solicitor has worked through the replies.

→ View your portal
```

→ **HAND-OFF REPLACEMENT (Artifact 2 §9.B.4, inverse direction):**
```
Subject: Please confirm your further replies have gone out — {address}

Quick update on your sale. The buyer's solicitor has confirmed they've received the replies to their further enquiries — so it sounds like your solicitor has sent them across as planned, even if it hasn't been logged on our side yet.

Could you do one quick thing? Open your portal and confirm you're aware the replies have gone out. The confirm button is highlighted, waiting for you. It takes about ten seconds and it helps keep the file's records in sync.

The buyer's solicitor will now review the further replies and, if they're satisfied, work towards preparing their final report — you're in the home stretch before exchange.

→ Open your portal
```

**purchaser (existing, unchanged):**
```
Subject: Further replies received from the seller's solicitor — {address}

Replies to the further questions are in.

The seller's solicitor has replied to your solicitor's additional enquiries. Your solicitor will now review the answers.

Your solicitor will assess whether all points have now been addressed. If they're satisfied, they'll move towards preparing their final report to you.

→ View your portal
```

**progressor:**
```
Subject: PM18 complete: Additional replies received — {address}

Logged on {address}.

Additional enquiry replies received from vendor's solicitor.

→ View transaction
```

---

#### PM19 — Buyer's solicitor has reviewed the additional replies
[portal-copy.ts:1277](../../lib/portal-copy.ts#L1277) · `who: "solicitor"` · prereq: `PM18`
**Chase digest label:** `Additional replies reviewed`
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Your solicitor has reviewed all replies — {address}

Your solicitor has worked through everything.

Your solicitor has reviewed all of the seller's replies and is working through the final legal points. They're assessing whether everything has been addressed to their satisfaction.

If your solicitor is satisfied, they'll send you their final report and confirm they're ready to exchange.

→ View your portal
```

**vendor:**
```
Subject: Buyer's solicitor has reviewed all outstanding replies — {address}

Quick update on your sale.

The buyer's solicitor has reviewed all outstanding enquiry replies and is working through the remaining legal points.

If satisfied, the buyer's solicitor will prepare their final report to the buyer, moving towards contract sign-off and exchange.

→ View your portal
```

**progressor:**
```
Subject: PM19 complete: Additional replies reviewed — {address}

Logged on {address}.

Buyer's solicitor has reviewed all outstanding enquiry replies.

→ View transaction
```

---

#### PM20 — Buyer's solicitor has confirmed all enquiries are now satisfied
[portal-copy.ts:1308](../../lib/portal-copy.ts#L1308) · `who: "solicitor"` · prereq: `PM19`
**Chase digest label:** `All enquiries satisfied`
**Fan-out:** vendor, purchaser, vendorAgent, progressor

**purchaser:**
```
Subject: All legal questions resolved — moving towards exchange — {address}

A significant milestone on your purchase.

All of the legal questions about the property have been answered to your solicitor's satisfaction. This is one of the last major legal steps before exchange of contracts.

Your solicitor will now prepare their final report to you, which summarises the property, the title, the search results, and any conditions on your mortgage. Once you've received and reviewed that, you'll be ready to sign the contract and exchange.

→ View your portal
```

**vendor:**
```
Subject: All legal enquiries resolved — {address}

Good news on your sale.

All of the buyer's solicitor's legal questions have been answered to their satisfaction. This is one of the final legal steps before exchange of contracts.

The buyer's solicitor will now prepare their final report to the buyer. Once the buyer reviews and signs off, you'll be ready to exchange.

→ View your portal
```

**vendorAgent:**
```
Subject: All enquiries satisfied — {address}

Good news on {address}.

Buyer's solicitor has confirmed all enquiries satisfied. Transaction is in the final stretch before exchange.

→ View in dashboard
```

**progressor:**
```
Subject: PM20 complete: All enquiries satisfied — {address}

Logged on {address}.

Buyer's solicitor has confirmed all enquiries satisfied.

→ View transaction
```

---

### PHASE 12 — Final report + contract sign-off

---

#### PM21 — Buyer has received the final report from their solicitor
[portal-copy.ts:1347](../../lib/portal-copy.ts#L1347) · `who: "you"` · prereq: `PM20` · `canBeMarkedNr: never`
**Chase digest label:** `Final report received from solicitor`
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Your solicitor's final report is ready — {address}

Your solicitor's final report has arrived.

Your solicitor has sent you their final report — a comprehensive summary of everything about the property: the title, the search results, the replies to enquiries, and any conditions attached to your mortgage offer. This is the document you need to review before signing the contract.

Read the report carefully and raise any questions with your solicitor. Once you're happy, your solicitor will send you the contract to sign.

→ View your portal
```

**vendor:**
```
Subject: Buyer is reviewing their solicitor's final report — {address}

Quick update on your sale.

The buyer's solicitor has sent their final report to the buyer — a comprehensive summary of the property, title, searches, and mortgage conditions. The buyer is now reviewing it before signing the contract.

Once the buyer is satisfied and signs the contract, you'll be in the final stages before exchange.

→ View your portal
```

**progressor:**
```
Subject: PM21 complete: Buyer received final report — {address}

Logged on {address}.

Purchaser has confirmed receipt of solicitor's final report.

→ View transaction
```

---

#### VM16 — Seller's solicitor has issued contract documents to the seller
[portal-copy.ts:522](../../lib/portal-copy.ts#L522) · `who: "you"` · prereq: `VM7`
**Chase digest label:** `Contract documents issued to you` (`labelOther: "Contract documents issued to seller"`)
**Fan-out:** purchaser, vendor, progressor

**vendor:**
```
Subject: Your contract is ready to sign — {address}

Your contract documents have arrived.

Your solicitor has sent you the contract documents to review and sign. This is an important step — you're on the way to exchange of contracts.

Read the contract carefully. Check the purchase price, the proposed completion date, and the list of fixtures and fittings included in the sale. Your solicitor will explain exactly what signing means and what you're committing to — exchange is the legally binding moment. Once you're happy, sign and return it.

→ View your portal
```

**purchaser:**
```
Subject: Seller has received their contract — {address}

Good news on your purchase.

The seller has received their contract documents to review and sign. This is an important step — the transaction is closing in on exchange.

Nothing for you to do right now. We'll let you know once the seller has signed and returned their contract.

→ View your portal
```

**progressor:**
```
Subject: VM16 complete: Contract issued to seller — {address}

Logged on {address}.

Vendor solicitor has issued contract documents to the vendor for signature.

→ View transaction
```

---

#### VM17 — Seller's solicitor has received signed contract documents back from the seller
[portal-copy.ts:553](../../lib/portal-copy.ts#L553) · `who: "you"` · prereq: `VM16`
**Chase digest label:** `Sign and return contract documents` (`labelOther: "Seller signed and returned contract"`)
**Fan-out:** purchaser, vendor, vendorAgent, progressor

**vendor:**
```
Subject: Signed contract received — ready for exchange — {address}

Your signed contract is with your solicitor.

Your solicitor has received your signed contract documents and is holding them ready for exchange. They will have explained the commitment this represents — the legally binding moment is exchange, not signing.

Once the buyer's solicitor also confirms ready, your solicitors will coordinate exchange and agree a completion date. Your agent can help facilitate if needed.

→ View your portal
```

**purchaser:**
```
Subject: Seller has signed the contract — {address}

A significant step on your purchase.

The seller has signed and returned their contract documents to their solicitor. Both sides need signed contracts in their solicitors' hands before exchange can happen.

Once your contract is also signed and returned, exchange can be coordinated.

→ View your portal
```

**vendorAgent:**
```
Subject: Seller signed and returned contract — {address}

Quick update on {address}.

Seller has signed and returned their contract to their solicitor.

→ View in dashboard
```

**progressor:**
```
Subject: VM17 complete: Seller signed and returned contract — {address}

Logged on {address}.

Vendor has confirmed signed contract returned to solicitor.

→ View transaction
```

---

#### PM22 — Buyer's solicitor has issued contract documents to the buyer
[portal-copy.ts:1378](../../lib/portal-copy.ts#L1378) · `who: "you"` · prereq: `PM21`
**Chase digest label:** `Contract documents issued to you` (`labelOther: "Contract documents issued to buyer"`)
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Your contract is ready to sign — {address}

Your contract documents have arrived.

Your solicitor has sent you the contract documents to review and sign. You're now moving towards exchange of contracts.

Read the contract carefully. Check the purchase price, the proposed completion date, and the list of fixtures and fittings included in the sale. Your solicitor will explain exactly what signing means and what you're committing to — exchange is the legally binding moment. Once you're happy, sign and return it.

→ View your portal
```

**vendor:**
```
Subject: Buyer has been issued their contract — {address}

Quick update on your sale.

The buyer's solicitor has issued the contract documents to the buyer for review and signature. Things are moving into the final stretch before exchange.

Once the buyer signs and returns the contract, we're effectively ready to exchange.

→ View your portal
```

**progressor:**
```
Subject: PM22 complete: Contract issued to buyer — {address}

Logged on {address}.

Buyer's solicitor has issued contract documents to purchaser for signature.

→ View transaction
```

🅥 **Voice flag — subject collision:** VM16 vendor and PM22 purchaser share the **exact same subject** `Your contract is ready to sign — {address}`. Both are correct for their respective recipient ("you" being the seller in one, buyer in the other), and they fire on different events (one when seller's sol issues; one when buyer's sol issues). On a typical file they're 1–2 weeks apart and going to different people, so collision in practice is unlikely. But on a fast file where the same agent is reading both inboxes, the subjects are indistinguishable. Worth disambiguating subjects → `Your sale contract is ready to sign` / `Your purchase contract is ready to sign`.

---

#### PM23 — Buyer's solicitor has received the signed contract documents back from the buyer
[portal-copy.ts:1409](../../lib/portal-copy.ts#L1409) · `who: "you"` · prereq: `PM22`
**Chase digest label:** `Sign and return contract documents` (`labelOther: "Buyer signed and returned contract"`)
**Fan-out:** vendor, purchaser, vendorAgent, progressor

**purchaser:**
```
Subject: Signed contract received — ready for exchange — {address}

Your signed contract is with your solicitor.

Your solicitor has received your signed contract documents and is holding them ready for exchange. They will have explained what signing means — the legally binding moment is exchange, not this step.

Make sure your deposit is on its way to your solicitor's client account if it isn't already — it needs to be there as cleared funds before exchange can happen.

→ View your portal
```

**vendor:**
```
Subject: Buyer has signed and returned their contract — {address}

Good news on your sale.

The buyer has signed their contract documents and returned them to their solicitor. Both sides are now very close to being ready to exchange.

Once the deposit is in place and both solicitors confirm readiness, exchange can happen. We'll keep you updated.

→ View your portal
```

**vendorAgent:**
```
Subject: Buyer has signed and returned their contract — {address}

Good news on {address}.

Buyer has signed and returned contract to their solicitor. Both sides are close to exchange readiness.

→ View in dashboard
```

**progressor:**
```
Subject: PM23 complete: Buyer signed and returned contract — {address}

Logged on {address}.

Purchaser has confirmed signed contract returned to solicitor.

→ View transaction
```

🅥 **Voice flag — subject collision:** VM17 vendor and PM23 purchaser share `Signed contract received — ready for exchange — {address}`. Same observation as VM16/PM22 collision — disambiguate.

---

### PHASE 13 — Deposit

---

#### PM24 — Buyer has transferred the deposit
[portal-copy.ts:1448](../../lib/portal-copy.ts#L1448) · `who: "you"` · prereq: `PM23` · `canBeMarkedNr: auto_only` (NRs on `cash_from_proceeds`)
**Chase digest label:** `Transfer the deposit` (`labelOther: "Buyer transferred the deposit"`)
**Fan-out:** vendor, purchaser, progressor

**purchaser:**
```
Subject: Deposit received — ready for exchange — {address}

Your deposit is in place.

Your solicitor has confirmed receipt of your deposit as cleared funds. This is one of the final requirements before exchange of contracts can take place.

Everything is now in place on your side. We're coordinating exchange with the seller's solicitor — you could be exchanging very soon.

→ View your portal
```

**vendor:**
```
Subject: Buyer's deposit is in place — {address}

Good news on your sale.

The buyer has transferred their deposit to their solicitor's client account as cleared funds. This is one of the final requirements before exchange can take place.

Everything on the buyer's side is in place. Exchange is very close.

→ View your portal
```

**progressor:**
```
Subject: PM24 complete: Buyer transferred deposit — {address}

Logged on {address}.

Purchaser has confirmed deposit transferred to solicitor's client account.

→ View transaction
```

---

### PHASE 14 — Ready to exchange (existing auto-confirm gate)

---

#### VM18 — Seller's solicitor has confirmed readiness to exchange
[portal-copy.ts:592](../../lib/portal-copy.ts#L592) · `who: "solicitor"` · `typicalDuration: "typically 1–5 days after signing"` · **Agent-only confirm** (no client portal — see `PORTAL_AGENT_ONLY_CODES`)
**Chase digest label:** Excluded from client digest (`PORTAL_AGENT_ONLY_CODES`)
**Fan-out:** vendor, purchaser, progressor

**vendor:**
```
Subject: Your solicitor is ready to exchange — {address}

Your solicitor has confirmed they're ready.

Your solicitor has everything in place to exchange contracts. They've confirmed to us that they're ready to proceed as soon as the buyer's side is ready too.

We're now working to ensure the buyer's side is also ready to exchange. Once both solicitors confirm, exchange can be arranged quickly — make sure you're reachable.

→ View your portal
```

**purchaser:**
```
Subject: The seller's solicitor is ready to exchange — {address}

The seller's side is ready.

The seller's solicitor has confirmed they're ready to exchange contracts. If your solicitor is also ready, exchange can be coordinated imminently.

Make sure your deposit is in your solicitor's client account as cleared funds, and that your signed contract has been returned. We'll be in touch as soon as exchange is confirmed.

→ View your portal
```

**progressor:**
```
Subject: VM18 complete: Vendor solicitor ready to exchange — {address}

Logged on {address}.

Vendor's solicitor has confirmed readiness to exchange.

→ View transaction
```

---

#### PM25 — Buyer's solicitor has confirmed readiness to exchange
[portal-copy.ts:1479](../../lib/portal-copy.ts#L1479) · `who: "solicitor"` · `typicalDuration: "typically 1–5 days after signing"` · **Agent-only confirm**
**Chase digest label:** Excluded from client digest
**Fan-out:** purchaser, vendor, progressor

**purchaser:**
```
Subject: Your solicitor is ready to exchange — {address}

Your solicitor has confirmed they're ready.

Your solicitor has everything in place to exchange contracts. They've confirmed to us that they're ready to proceed as soon as the seller's side confirms the same.

We're now coordinating with the seller's solicitor to confirm exchange. Make sure you're reachable — exchange can sometimes happen very quickly once both sides are ready.

→ View your portal
```

**vendor:**
```
Subject: The buyer's solicitor is ready to exchange — {address}

The buyer's side is ready.

The buyer's solicitor has confirmed they're ready to exchange contracts. If your solicitor is also ready, exchange can be coordinated imminently.

We'll be coordinating exchange with both solicitors. Make sure you're reachable.

→ View your portal
```

**progressor:**
```
Subject: PM25 complete: Buyer solicitor ready to exchange — {address}

Logged on {address}.

Buyer's solicitor has confirmed readiness to exchange.

→ View transaction
```

🅥 **Voice flag — subject collision:** VM18 vendor and PM25 purchaser share `Your solicitor is ready to exchange — {address}`. Same disambiguation point as the earlier collisions. Sale vs purchase context resolves who-it's-from but not from the subject preview alone.

---

### PHASE 15 — Exchange (existing bilateral auto-confirm — separate "completion pack" send path)

---

#### VM19 / PM26 — Contracts exchanged
[portal-copy.ts:623](../../lib/portal-copy.ts#L623) (VM19) · [portal-copy.ts:1510](../../lib/portal-copy.ts#L1510) (PM26) · `eventDateRequired: true` on PM26 · **Agent-only confirm**
**Chase digest label:** Excluded from client digest
**Fan-out:** Special path via `sendExchangeCompletionPack` ([portal.ts:1090](../../lib/services/portal.ts#L1090)) — `vendor` and `purchaser` variants are the headline parts. Already auto-confirms the counterpart per `BILATERAL_PAIRS`.

**VM19 vendor:**
```
Subject: Contracts exchanged — your sale is legally committed — {address}

Contracts have exchanged on your sale.

Both solicitors have formally exchanged signed contracts, and the sale is now legally binding. Neither side can withdraw without significant financial penalty. The completion date is now fixed.

Between now and completion, you should arrange to have everything ready to leave the property by the agreed time on completion day. Your solicitor will manage the legal transfer of funds — you'll hear from them on the day.

→ View your portal
```

**VM19 purchaser:**
```
Subject: Contracts exchanged — your purchase is legally committed — {address}

Contracts have exchanged on your purchase.

Both solicitors have formally exchanged signed contracts, and your purchase is now legally binding. The completion date is fixed.

Now is the time to confirm your removal firm and start planning your move in detail. Buildings insurance: risk in the property usually passes to you on exchange — check with your solicitor whether this applies to your purchase, as for new-builds and many leaseholds the freeholder's policy covers the building. Your solicitor will manage the final transfer of funds on completion day.

→ View your portal
```

**VM19 vendorAgent:**
```
Subject: Exchange confirmed — {address}

Exchange confirmed on {address}.

Contracts have exchanged. Both parties are now legally committed. Completion is set for {completionDate}.

→ View in dashboard
```

**VM19 progressor:**
```
Subject: VM19 complete: Contracts exchanged — {address}

Exchange confirmed on {address}.

Contracts exchanged. Both parties legally committed. Completion date fixed. Reconcile any outstanding milestones and confirm the completion date is recorded.

→ View transaction
```

**PM26 purchaser:**
```
Subject: Contracts exchanged — your purchase is legally committed — {address}

Contracts have exchanged on your purchase.

Both solicitors have formally exchanged signed contracts, your deposit has been transferred, and your purchase is now legally binding. The completion date is fixed.

Now is the time to confirm your removal firm and start planning your move in detail. Buildings insurance: risk in the property usually passes to you on exchange — check with your solicitor whether this applies to your purchase, as for new-builds and many leaseholds the freeholder's policy covers the building. Your solicitor will manage the final transfer of funds on completion day.

→ View your portal
```

**PM26 vendor:**
```
Subject: Contracts exchanged — your sale is legally committed — {address}

Contracts have exchanged on your sale.

Both solicitors have formally exchanged signed contracts, and your sale is now legally binding. The completion date is fixed — neither side can withdraw without significant financial penalty.

Between now and completion, arrange to have everything ready to leave the property by the agreed time on completion day. Your solicitor will manage the legal transfer of funds.

→ View your portal
```

**PM26 progressor:**
```
Subject: PM26 complete: Contracts exchanged — {address}

Exchange confirmed on {address}.

Contracts exchanged. Both parties legally committed. Completion date fixed. Reconcile any outstanding milestones and confirm the completion date is recorded.

→ View transaction
```

🅥 **Voice flag — vendor body near-duplication:** VM19's vendor body and PM26's vendor body are 90%+ identical but with one substantive difference: VM19 reads "Neither side can withdraw without significant financial penalty"; PM26 reads "The completion date is fixed — neither side can withdraw without significant financial penalty." Since VM19 and PM26 auto-confirm together, **only ONE of these fires per file** — the chosen variant depends on which side was the "primary" confirm. Worth confirming that the dispatch logic picks consistently (likely both rows are written but only one event triggers fan-out). Not necessarily a bug; just an artefact of having effectively the same email twice in the source.

---

### PHASE 16 — Completion

---

#### VM20 / PM27 — Sale / Purchase completed
[portal-copy.ts:662](../../lib/portal-copy.ts#L662) (VM20) · [portal-copy.ts:1541](../../lib/portal-copy.ts#L1541) (PM27) · `eventDateRequired: true` on PM27 · **Agent-only confirm**
**Chase digest label:** Excluded from client digest
**Fan-out:** Same dual-write pattern as VM19/PM26.

**VM20 vendor:**
```
Subject: Sale complete — congratulations — {address}

Congratulations — it's done.

Your sale has completed. The purchase funds have been transferred, your mortgage has been redeemed by your solicitor, and ownership of the property has transferred to the buyer. The sale is legally concluded.

Your solicitor will send you a completion statement showing the final figures. If you're also buying, the net proceeds will be passed to your purchase solicitor. Keep your completion statement safely for your records — you may need it for tax purposes.

→ View your portal
```

**VM20 purchaser:**
```
Subject: Sale completed — {address}

Completion confirmed on your purchase property.

The sale of {address} has completed. The property now belongs to your seller and the transaction is legally concluded.

→ View your portal
```

🅥 **Voice flag — confusing recipient:** VM20 PURCHASER variant reads as if the buyer is being told they've completed on a property — but VM20 is the seller-side completion. The line "The property now belongs to your seller" is grammatically right-but-weird; the buyer is being told the sale completed and the property "now belongs to your seller" — which is incorrect ("your seller" = the seller of the buyer's purchase = the same person, but the property is now the buyer's). Worth a rewrite. Possibly remove the VM20 purchaser variant entirely — since PM27 fires its own purchaser variant, this might be double-emailing the buyer with conflicting framings.

**VM20 vendorAgent:**
```
Subject: Completion confirmed — {address}

Completion confirmed on {address}.

Sale completed on {address}. If you haven't already, contact your vendor and buyer to confirm completion and coordinate key handover with the buyer.

→ View in dashboard
```

**VM20 progressor:**
```
Subject: VM20 complete: Sale completed — {address}

Completion confirmed on {address}.

Sale completed. Transaction closed. Reconcile any outstanding milestones and confirm all fees are recorded.

→ View transaction
```

**PM27 purchaser:**
```
Subject: Purchase complete — welcome to your new home — {address}

Congratulations — it's done.

Your purchase has completed. The funds have been transferred, ownership has passed to you, and the keys are yours. Your solicitor will now arrange for your ownership to be registered at HM Land Registry.

Keep your completion statement and transfer documents safely for your records — you may need them for future legal or tax purposes. Your solicitor will send confirmation of Land Registry registration once it's been processed, which can take several months.

→ View your portal
```

**PM27 vendor:**
```
Subject: Completion confirmed on your sale — {address}

Completion confirmed.

The purchase of {address} has completed. The property has transferred to the buyer and the transaction is legally concluded.

→ View your portal
```

**PM27 progressor:**
```
Subject: PM27 complete: Purchase completed — {address}

Completion confirmed on {address}.

Purchase completed. Transaction closed. Reconcile any outstanding milestones and confirm all fees are recorded.

→ View transaction
```

---

## 5. Cross-cutting voice findings

A consolidated summary of flags raised inline. None are show-stoppers; all are tightening opportunities surfaced by reading the matrix end-to-end.

### 5.1 Subject collisions across pairs (4 instances)

| Subject string | Codes that fire it |
|---|---|
| `Your contract is ready to sign — {address}` | VM16 vendor + PM22 purchaser |
| `Signed contract received — ready for exchange — {address}` | VM17 vendor + PM23 purchaser |
| `Your solicitor is ready to exchange — {address}` | VM18 vendor + PM25 purchaser |
| `Management pack received — {address}` | VM9 vendor + PM12 vendor |

These collisions are correct for each recipient individually (the subject is true for them) but on a fast-moving file where the same household reads both, the subjects are indistinguishable. Disambiguating them with `your sale` vs `your purchase` (or equivalent phrasing) would let inbox previews show two distinct events. Out of scope for the hand-off feature; tiny tickets to file.

### 5.2 Low-signal "FYI on the other side's process" emails (5 candidates)

Several vendor/purchaser variants fire purely because something happened on the *other* side, with nothing for the recipient to do and minimal implication. Candidates worth reviewing for "do we even need to send this?":

- VM3 purchaser ("Seller is engaging with their solicitor")
- VM4 purchaser ("Seller's ID checks complete")
- VM5 purchaser ("Seller is gathering property information")
- PM3 vendor ("Buyer's ID checks complete")
- PM5 vendor ("Buyer's mortgage application is in")

These are not off-voice per the guidelines (each is correctly written), but they're system-self-reporting on process moves rather than guiding the recipient to an action. They compete with the bilateral hand-off philosophy: only nudge the other side when there's an implication or call to action. Worth a separate review pass to trim where the recipient has nothing to do.

### 5.3 PM2 asymmetry (no vendor variant)

PM2 fires no vendor email. VM2 fires both vendor and purchaser. The asymmetry is defensible (MOS is a single event sent to both sides simultaneously, so the second-side confirm is redundant) but is the only place in the matrix where a milestone has one fewer recipient than its symmetric counterpart. Either (a) deliberately rely on VM2's purchaser variant to cover both events, or (b) add a vendor variant to PM2 for consistency. Decision call.

### 5.4 VM20 purchaser variant — misframed

VM20 purchaser body refers to "the property now belongs to your seller" — confusing framing for a buyer reading about a seller-side completion. Suspect this whole variant should be removed since PM27 purchaser fires its own (better) variant for completion. Buyer probably gets two completion emails today, one of them awkwardly worded. Worth a focused check + likely deletion.

### 5.5 Progressor subjects all lead with internal codes

Every `progressor` variant subject starts `{CODE} complete: {label} — {address}`. That's technically a system self-reference (Rule 1) and uses schema language as UI nouns (Rule 2). The audience IS internal — they speak in codes — so this is justifiable. Worth a one-line acknowledgement in the voice guide that internal-only progressor copy is exempt from those rules.

### 5.6 "Meaningful update" filler

Three instances across the matrix (VM1 vendor, PM1 purchaser, possibly more). Same pattern as Artifact 2 (already polished there). Worth a sweep across portal-copy.ts to replace with specific next-event language.

### 5.7 Bilateral hand-off copy reads naturally in context

Reading the 10 hand-off cells beside the existing copy for each pair: the new copy uses the same conversational openings ("Quick update on your sale", "Good news on your purchase"), the same closing structure, and the same industry vocabulary. The two stylistic additions — the "Could you do one quick thing?" sentence and the "The confirm button is highlighted, waiting for you" sentence — are new shapes not present in the existing copy, but they're the load-bearing parts of the hand-off (the call to action that distinguishes a nudge from a passive FYI), and they read naturally in voice. No regression.

The one stylistic divergence: the enquiries-default informational nudges (§6.A.4, §8.A.4) lead with "A quick heads up on your sale" instead of "Quick update on your sale" (the existing pattern). "Heads up" is slightly more conversational and forward-leaning; "Quick update" is the calmer existing phrasing. Either works — flag for Ellis preference.

---

## 6. What this document does NOT cover

For the avoidance of doubt:

- **Auth, register, invite, claim, magic-link emails** — fire on user/account events, not milestone completion.
- **Billing emails** (payment-fail warning, grace period, charge confirmation) — fire from the billing system, anchored on exchange but not milestone-fan-out per se.
- **Survey / valuation third-party emails** — sent by lenders/surveyors, not by the platform.
- **Retention emails** (first-exchange celebration, hub-engagement nudges) — fire from `lib/services/retention.ts` on its own triggers, not the milestone fan-out.
- **Internal admin emails** (medians-ready, weekly digests) — Command Centre / progressor admin events.
- **Push notifications** — separate channel; mentioned in `confirmMilestoneAction` but not part of the email fan-out scope.
- **Outbound messages logged via the OutboundMessage table** (manual chase emails, AI-drafted emails, parse-chat imports) — agent-authored, not system-fan-out.

If completing a milestone sends it, it's above. If not, it isn't.

---

## 7. Sign-off

This document is read-only inventory + voice flags. No decisions or sign-off required to use it — it's a reference for the Artifact 2 review and (eventually) for Artifact 3 implementation. If a voice flag here triggers a copy edit, the source is `lib/portal-copy.ts` at the line number cited per code.
