# Voice-consistency sweep — catalogue (gate)

Pre-rewrite inventory of cumulative-template patterns across the 47-milestone Model B email corpus. Harvested from the live skeleton source rather than the rendered output — every pattern below is a real string that ships in production once `EMAIL_SKELETON_MODE` flips. **Surfacing this as the gate before any rewriting.**

Categories are ordered roughly by severity (how much cumulative templating the reader actually experiences).

---

## 1. Closing constructions — the biggest cluster

**"We'll let you know…" / "We'll be in touch…" / "you'll hear from us…" / "We'll keep you posted…"** appears in ~24 bodies across the corpus — essentially every milestone has one. The construction has become the corpus-default sign-off.

Sentence-start "We'll let you know" (14+ instances):

- PM15 purchaser: *"We'll let you know what your solicitor concludes as soon as they've worked through it."*
- PM23 purchaser: *"We'll let you know the moment exchange happens."*
- PM23 vendor: *"We'll let you know the moment it happens."*
- PM24 purchaser: *"We'll let you know the moment they agree it and confirm the exchange has happened."*
- VM4 purchaser: *"We'll let you know when the contract pack is ready to go."*
- VM6 vendor: *"We'll let you know when that's done."*
- VM9 vendor: *"We'll let you know when that lands on their side."*
- VM9 purchaser: *"…we'll let you know when that lands."*
- VM11 vendor: *"We'll let you know when that's been done."*
- VM11 purchaser: *"We'll let you know when they do."*
- VM12 vendor: *"We'll let you know either way once the review's complete."*
- VM14 vendor: *"We'll let you know when they go."*
- VM14 purchaser: *"…we'll let you know when they do."*

Sentence-start "We'll be in touch" (4 instances):

- PM24 vendor: *"We'll be in touch the moment exchange happens."*
- VM1 purchaser: *"We'll be in touch when there's a meaningful update on your side."*
- VM19 vendor: *"We'll be in touch with the completion-day specifics and what you need to do…"*

Mid-sentence "we'll be in touch if so" / "we'll let you know if…" (8 instances):

- PM7 vendor inverse, PM8 vendor, PM9 vendor, PM10 vendor, PM12 vendor, PM26 purchaser, VM7 vendor, VM9 purchaser

"You'll hear from us" / "We'll keep you posted" (3 instances):

- PM25 purchaser, VM17 vendor, VM18 vendor

**Reader experience:** the seller reading their inbox end-to-end gets the same kind of "we'll let you know" closing on virtually every email. By the third or fourth one the closing has stopped registering — and worse, when something actually IS meaningfully time-bound (exchange, completion), the same phrase is doing the heavy lifting that should carry extra weight.

**Severity: high.** This is the single biggest source of cumulative templating in the corpus.

---

## 2. Vendor opening cluster — pre-flagged in batch 9

**"[Qualifier] signal/movement on your sale"** — 6+ instances:

- PM4 vendor: *"Strong signal on your sale."*
- PM5 vendor: *"Positive movement on your sale."*
- PM8 vendor: *"Positive signal on your sale."*
- PM11 vendor: *"Strong signal on your sale."*
- PM23 vendor: *"Real signal on your sale — the buyer has signed."*
- PM24 vendor: *"Strong commitment signal — the buyer's deposit is in."*

Adjacent mirror on the buyer side:

- VM17 purchaser: *"Strong signal on your purchase — the seller has signed."*

**"Update on your sale" / "Update on the buyer's side":** 3+ instances:

- PM6 vendor: *"Update on your sale."*
- PM9 vendor: *"Update on your sale."*
- PM13 vendor: *"Update on the buyer's side."*
- VM16 purchaser: *"Update on your sale's counterpart."*

**Severity: high.** Already named at batch 9; full inventory above.

---

## 3. "Good news on your [sale/purchase]" cluster

6 instances spread across vendor + purchaser:

- PM1 vendor: *"Good news on your sale."*
- PM3 vendor: *"Good news on your sale."*
- VM1 purchaser: *"Good news on your purchase."*
- VM4 purchaser: *"Good news on your purchase."*
- VM9 vendor: *"Good news on your sale — the management pack is back from the freeholder."*
- VM15 purchaser nudge: *"Good news. The seller's solicitor has issued…"*

Also adjacent: VM12 purchaser nudge: *"Good news on your purchase. The seller's solicitor has issued the formal replies…"* and PM7 purchaser (cash_buyer + cash_from_proceeds shapes): openings using a similar "Good news on your purchase" register.

**Severity: medium.** Cross-recipient, so neither reader hits more than 3–4 instances, but distinctive enough that those 3–4 register as a template.

---

## 4. "Quick update on your [sale/purchase]" — bilateral inverse-edge cluster

7+ instances, heavily concentrated on bilateral inverse-direction nudges (all using essentially the same construction):

- PM7 vendor (inverse): *"Quick update on your sale. The buyer's solicitor has confirmed…"*
- PM15 vendor (inverse): *"Quick update on your sale. The buyer's solicitor has confirmed…"*
- PM18 vendor (inverse): *"Quick update on your sale. The buyer's solicitor has confirmed…"*
- VM10 purchaser (inverse): *"Quick update on your purchase. The seller's solicitor has confirmed…"*
- VM13 purchaser (inverse): *"Quick update on your purchase. The seller's solicitor has confirmed…"*
- VM3 purchaser: *"Quick update on your purchase."*
- VM5 purchaser: *"Quick update on your purchase."*

**Severity: medium.** The inverse-edge nudges are rare-fire bodies (only on direction-mismatched files), so individual readers rarely hit more than one. But within the 5 bilateral pairs, the inverse nudges are structurally identical templates — the same skeleton replicated for each pair. If the bilateral feature is meant to feel hand-crafted, this is where it visibly isn't.

---

## 5. Within-milestone identical openings — PM2 / VM2

Same opening fires across multiple bodies on the same milestone, meaning ONE reader gets the SAME opener twice in close sequence:

- PM2 purchaser: *"The legal process has officially started."*
- VM2 vendor: *"The legal process has officially started."*
- VM2 purchaser: *"The legal process has officially started."*

PM2 fires when the buyer's solicitor receives MoS. VM2 fires when the seller's solicitor receives it. The two fire close together (often within a day of each other). The buyer reads PM2 purchaser then VM2 purchaser, both opening with the identical phrase. The seller reads only VM2 vendor (so they only see it once).

**Severity: medium-high for the buyer specifically.** Within-milestone-pair seam that would be invisible if you only read one body at a time.

---

## 6. "There's nothing for you to do in the meantime" — stock no-action sign-off

4 instances in buyer-side bodies as a "no action needed" closer:

- PM8 purchaser: *"There's nothing for you to do in the meantime — this runs in the background while the enquiries side progresses."*
- PM14 purchaser: *"There's nothing for you to do in the meantime; this runs alongside the other moving pieces."*
- PM17 purchaser: *"Nothing for you to do in the meantime."*
- VM9 purchaser: *"There's nothing for you to do in the meantime."*

Functions as a stock "passive update" sign-off whenever a buyer-side email reports something that doesn't need their action.

**Severity: low-medium.** Less frequent than the "We'll let you know" cluster but instantly recognisable when read back-to-back.

---

## 7. "On the [funding] side…" — mortgage-variant opening pattern

4+ instances of "On the mortgage side…" opening a mortgage-conditional paragraph:

- PM3 purchaser mortgage: *"…your lender will reference your completed ID and AML as part of their underwriting too, so keep your mortgage application progressing in parallel…"*
- PM4 purchaser mortgage: *"On the mortgage side, make sure your application is progressing in parallel…"*
- PM13 purchaser mortgage: *"On the mortgage side, your lender may want to see how any material findings are being resolved…"*
- PM16 purchaser mortgage: *"On the mortgage side, if this round produced follow-up enquiries that extend the timeline, keep an eye on your mortgage offer's validity period…"*

**Severity: medium.** A buyer on a mortgage file reads "On the mortgage side…" 4+ times across their journey, always as a paragraph opener for a funding-conditional add-on. The construction itself has become a visible scaffold for "here's the mortgage hook." Worth varying so the funding paragraphs don't all introduce themselves the same way.

---

## 8. "On a leasehold sale/purchase like this" — leasehold conditional opening pattern

10+ instances opening leasehold-conditional paragraphs:

- VM1 vendor: *"On a leasehold sale like this, your solicitor will also…"*
- VM2 vendor: *"On a leasehold sale like this, your solicitor will also be requesting…"*
- VM5 vendor: (similar register inside paragraph)
- VM6 vendor: *"On a leasehold sale like this, the contract pack also needs…"*
- VM7 vendor: *"On a leasehold sale like this, the pack also includes…"*
- PM7 purchaser: *"On a leasehold like this one, the management pack…"*
- VM7 purchaser slim: *"On a leasehold like this one, the management pack…"*
- PM14 purchaser: *"On a leasehold purchase like this one…"*
- PM1 purchaser: *"One thing worth flagging on the leasehold side…"* (variant)
- VM2 purchaser: *"One thing to flag on a leasehold purchase like this…"* (variant)

**Severity: medium-high for leasehold readers.** A buyer or seller on a leasehold file reads "On a leasehold sale/purchase like this" 10+ times throughout their journey. This is the most frequent paragraph-opener in the corpus for shape-conditional content. Some variation already exists (`"One thing worth flagging on the leasehold side…"`, `"One thing to flag…"`) — but the core construction recurs heavily and the variants cluster too.

---

## 9. Temporal-ordering assumption — VM17 vendor (one new instance found)

The batch 10 fix flagged this as a new category. Sweeping the corpus for non-bilateral pairs where prose bakes in a specific firing order:

**VM17 vendor whatNext:**

> "Your solicitor will hold the signed documents in escrow and engage with the buyer's solicitor on exchange timing **once the buyer's side has reached the same point**."

VM17 (seller signed) and PM23 (buyer signed) can fire in either order — buyers can sign before sellers on some files. The phrase "once the buyer's side has reached the same point" presupposes they haven't yet. Reads wrong if PM23 fired before VM17.

**Other non-bilateral pairs swept:** Phase 12 (VM16/VM17/PM22/PM23) checked — only VM17 has the assumption. Phase 14 (VM18/PM25) already fixed in batch 10. Phase 15+16 fire on singular legal events so no ordering issue.

**Severity: high but narrow.** One body, but it's a factual bug on order-mismatched files.

---

## 10. "Movement on the…" — soft cluster on buyer-side connector events

2 instances, both on non-bilateral middle steps of the enquiry arcs:

- VM9 purchaser: *"Movement on the management pack."* (after I varied it away from "Update on the leasehold side")
- VM11 purchaser: *"Movement on the enquiries."*

**Severity: low.** Only two instances, and both deliberately introduced to vary off other patterns. Flagging in case it grows during the rewrite — if the sweep introduces more "Movement on…" constructions, that's a new cluster forming.

---

## 11. Symmetric-event mirror — PM1 / VM1

PM1 and VM1 both fire on the "X has instructed their solicitor" event for their respective party. The openings are partially mirrored:

- PM1 purchaser (you instructed): *"You've taken the first step."*
- VM1 vendor (you instructed): *"You've taken the first step."*

Each reader only sees one of these on their own milestone (buyer reads PM1 purchaser, seller reads VM1 vendor) — so no single reader gets the duplication directly. But the corpus contains the identical phrase used twice for what is structurally the same event for each side. Not a cumulative-template issue for the reader, just a corpus authoring symmetry that's visible from outside.

**Severity: very low.** Flagging for completeness. Not necessarily worth fixing.

---

# What's NOT a cluster (deliberately authored variation)

- **Buyer-side "Your [event]…" openings** (PM5/6/8/9/10/12/13/21/22/23/24): each names its specific event distinctly. The construction is buyer-side default but the noun phrase varies fully. Not a template.
- **Phase 15+16 exchange/completion openings**: each landed distinctly (VM19 "Exchange has happened — your sale is now legally binding", PM26 "your purchase is now legally binding", VM20 "Completion has happened. Your sale is done.", PM27 "Completion has happened. The property is yours.") Mirrored construction by design for the parallel legal moments. Not a templating concern.
- **Bilateral acted-side openings** ("Thanks — you've confirmed…"): consistent voice across route variants is intentional. The construction repeats but each instance is the same authored stance ("client confirmed via portal" vs "agent/SP confirmed on behalf"), not separate moments needing distinct voice.

---

# Scope decision for the rewrite

Proposed rewrite scope, in priority order:

1. **Cluster 1 (closings)** — most impactful single change. Goal: by the end of the sweep, no two adjacent client emails for the same reader close with "We'll let you know." Rewrite to event-specific or no-closing (some emails don't need one).
2. **Cluster 2 (vendor "X signal on your sale")** — pre-flagged. Each of the 6 openings rewritten to its specific moment, varied against each other deliberately.
3. **Cluster 3 ("Good news on your sale/purchase")** — 6 instances rewritten to event-specific openings.
4. **Cluster 4 (bilateral inverse-edge "Quick update on your…")** — the 5 inverse-edge nudges (PM7v / PM15v / PM18v / VM10p / VM13p) currently use near-identical templates. Each rewritten to its specific moment while staying tight (they're nudges, by design slim).
5. **Cluster 5 (PM2/VM2 identical opening)** — vary PM2 purchaser, VM2 vendor, VM2 purchaser away from "The legal process has officially started" so the buyer doesn't read it twice.
6. **Cluster 7 ("On the mortgage side…")** — 4 instances varied to different paragraph-opener constructions.
7. **Cluster 8 ("On a leasehold sale/purchase like this")** — the 10+ instances. Hardest cluster to vary because each opens a similar shape-conditional add-on. Goal: 4–5 different opening constructions distributed across the 10 sites, not 10 hand-crafted unique opens (which would over-vary).
8. **Cluster 9 (VM17 temporal-ordering)** — single-body fix, mechanical.
9. **Cluster 6 ("Nothing to do in the meantime")** — 4 instances varied or absorbed into other prose.

**Out of scope:** Clusters 10 and 11 (low severity, no fix needed).

**Total bodies touched:** approximately 35–40 across 25–30 skeleton files. Roughly half the corpus, but most edits are 1-line opener/closer swaps; structural prose stays as authored.

**Discipline lock-in:** rewrite as a coherent set, not file-by-file. Read every variant of each cluster together before writing the new constructions, so the rewrites vary against each other not just against the prior phrasing.

---

**Gate:** approve, scope-adjust, or redirect before I touch any skeletons.
