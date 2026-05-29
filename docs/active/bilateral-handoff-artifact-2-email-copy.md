# Bilateral hand-off — Artifact 2: Email copy (verbatim)

> Status: **awaiting Ellis sign-off in full.** No code begins until this document is approved. This is the trust mechanism of the product, not a sub-section of the implementation plan.
>
> Companion artefacts: [bilateral-handoff-brief.md](bilateral-handoff-brief.md) (the spec) and Artifact 1 directions (in-chat, pending sign-off).

---

## 0. Reading guide — what's in here and how to scan it

This document contains the **verbatim text of every email** the hand-off feature sends, as it will land in the inbox. Subject + body fully written out. Address placeholder is `{address}`; first-name placeholder is `{First}`; otherwise the copy is complete.

The matrix has **three axes** and one shared dimension:

1. **Pair** (5): VM7↔PM7, VM10↔PM14, VM12↔PM15, VM13↔PM17, VM15↔PM18.
2. **Direction** (2 per pair): "default" = the natural first-actor confirms first (per Artifact 1); "inverse" = the wrong-side-confirms-first edge case.
3. **Confirmer path × reader**: six confirmer paths × all readers per pair. **The acted-side acknowledgement varies by confirmer-path** (client-via-portal vs agent-on-behalf vs SP-on-behalf — three distinct cells). **The opposite-side nudge is stable across confirmer paths for a given direction** — to the person being nudged, who clicked on the far side is invisible. **FYI emails** (vendorAgent, progressor) are stable across confirmer paths within a direction; they're internal records of "the milestone happened" and don't change shape based on who clicked.

To keep the document reviewable rather than redundant:

- **Two cross-cutting templates** (progressor internal log, agent FYI dashboard log) are defined once in §3 and then referenced per-pair with just the substituted phrase. These templates are unchanged from how they exist today in `lib/portal-copy.ts`.
- **The acted-side three-variant rule** (§4) is defined once. Each pair section then shows the three variants in full with verbatim copy.
- **The opposite-side nudge** is the new, distinctive part of this feature. It is written in full per direction.
- **Shared cells** are marked `→ shared with §X.Y`. Don't re-read those — they are byte-identical to the referenced cell.

Voice anchor: [docs/polish-pass/VOICE_GUIDELINES.md](../polish-pass/VOICE_GUIDELINES.md). Portal-audience calibration applies (calmer, plainer, more reassuring than agent copy). House style summary: no em-dashes in subjects; address-first or event-first subject; active, present, specific; never "system has computed"; industry terms (exchange, completion, solicitor, enquiries) stay technical.

### Asymmetry note: enquiries pairs in default direction (added v2)

The five pairs are not perfectly symmetric. For the **issue→receive pairs** (VM7/PM7, VM12/PM15, VM15/PM18), the receiving side can be told "X has arrived with your solicitor" with reasonable confidence — paperwork transit is essentially instant in modern conveyancing (email / DocuSign / portal). For the **raise→receive enquiries pairs** (VM10/PM14, VM13/PM17) in **default direction** (PM14/PM17 confirms first), the seller's solicitor may not actually have received the enquiries yet when we send the nudge. Asking the seller to confirm receipt — or pressing a highlighted confirm button that asserts receipt — would be claiming something untrue.

Treatment by direction (per Ellis review 2026-05-27):

| Pair shape | Direction | Nudge style | Confirm button highlighted? | Chase replaced? |
|---|---|---|---|---|
| Issue→receive (pack / replies) | Default (issuer first) | Confirm-push: "X has arrived, please confirm" | Yes | Yes |
| Issue→receive (pack / replies) | Inverse (receiver first) | Confirm-push: "X has reached, please confirm you sent" | Yes | Yes |
| Raise→receive (enquiries) | **Default (raiser first)** | **Informational only: "on the way, your solicitor will confirm when they arrive"** | **No** | **No — chase stays live for the receiver** |
| Raise→receive (enquiries) | Inverse (receiver first) | Confirm-push: "received on other side, please confirm you raised" | Yes | Yes |

So 8 of the 10 pair-directions are full hand-offs; 2 (the enquiries defaults — §6.A and §8.A) are informational heads-ups that don't replace the chase or highlight the confirm button. The platform stays honest — no email asks for confirmation of something whose truth isn't yet established.

### Pulse-vs-words note (added v2)

Earlier drafts described the nudge button as "gently pulsing." Under `prefers-reduced-motion: reduce` there's no pulse — a static highlight ring stands in. The copy now describes the **outcome** ("highlighted, waiting for you") not the **mechanism** ("pulsing"), so the words hold whether the button animates or sits static. If the visual treatment ever changes, the copy doesn't have to.

---

## 1. Confirmer paths & matrix axes

### 1.1 The six confirmer paths

| Path | Confirmer | Side they can confirm |
|---|---|---|
| 1 | Agent self-progressing (director or negotiator at the agency) | seller-side (VM*) |
| 2 | Agent self-progressing | buyer-side (PM*) |
| 3 | Sales Progressor / admin (internal, outsourced files) | seller-side |
| 4 | Sales Progressor / admin | buyer-side |
| 5 | Buyer via their portal | buyer-side only |
| 6 | Seller via their portal | seller-side only |

So per pair × direction, three confirmer paths can plausibly confirm the acting side: agent / SP / client-portal. The acknowledgement copy varies across these three.

### 1.2 What the matrix actually is, per pair × direction

For one pair, one direction (worked example — VM7 confirms first):

- **Acted-side (vendor) acknowledgement** — 3 cells (paths 1, 3, 6) — *varies by confirmer*
- **Opposite-side (purchaser) hand-off nudge** — 1 cell — *stable across confirmer paths*
- **Vendor agent FYI** — 1 cell — *stable* (referenced template, §3.2)
- **Sales Progressor FYI** — 1 cell — *stable* (referenced template, §3.1)
- **Before/after — chase-digest bullet** — 1 block — shows the bullet that disappears from the buyer-contact digest

Six cells per pair-direction. Five of those are new or revised; one (the digest before/after) documents a removal. Across 5 pairs × 2 directions, that's 60 cells total — but many are templated. The actual original copy you're asked to review:

- 30 acted-side acknowledgements (5 pairs × 2 directions × 3 confirmer variants — though Variant C is shared with Variant B in every cell, so 20 distinct)
- 10 opposite-side nudges (8 confirm-push hand-offs + 2 informational heads-ups for enquiries-default — see §1 asymmetry note)
- 10 before/after digest-bullet blocks (8 show bullet removed; 2 show bullet retained)

= **~40 cells of distinct original copy** + the two cross-cutting templates. Estimate: ~30 minutes to review thoroughly.

---

## 2. Pre-flight: how chases work TODAY (the "before")

Discovery during this draft: the client-facing automated chase email is **not** a per-milestone email. It is a **rolled-up digest** generated by [lib/email/client-chase-digest.ts](../../lib/email/client-chase-digest.ts), sent per contact per file. The digest aggregates every chaseable due milestone for that contact, with subject `"{address}: N updates needed"` and bullets grouped as either:

- "Yours to do" (DIY tone) — bullets for milestones the client themselves can move
- "Sitting with your solicitor right now" (nudge tone) — bullets for milestones gated on the solicitor

The bilateral milestones in scope (VM7/PM7, VM10/PM14, VM12/PM15, VM13/PM17, VM15/PM18) are **all solicitor-driven**, so they always land in the "sitting with your solicitor" bullet group of the relevant contact's digest. They are never DIY for the client.

**Therefore "before/after" for this feature is not the replacement of a standalone email — it is the removal of a bullet from the relevant digest, paired with the addition of a new dedicated hand-off email to the same recipient.** Each pair-direction section spells out exactly which bullet disappears from which contact's digest.

The agent-app side has a parallel concept: reminder logs become chase tasks, which surface in the Reminders tab. Under hand-off, the chase task on the opposite-side milestone is replaced by a "baton handed — awaiting agent confirm" log state, NOT removed. The agent still sees it. The pulsing portal button (Artifact 3 scope) is the client-facing replacement for the digest bullet.

There is also the existing **on-confirm portal email**, fired by `sendAdminMilestoneNotificationToPortal` ([lib/services/portal.ts](../../lib/services/portal.ts)), defined per-milestone in `lib/portal-copy.ts`. Today, when VM7 confirms, the purchaser variant of that email fires — a calm "the pack has arrived with your solicitor" FYI. **Under hand-off, this on-confirm purchaser email is REPLACED by the opposite-side hand-off nudge written below.** The two are the same "moment of communication" — we are not adding a third email, we are rewording and re-purposing the existing on-confirm email to be the baton handover.

---

## 3. Cross-cutting templates

Two recipients get a stable, internal-shaped email regardless of confirmer path and direction. Defined once here, referenced per-pair.

### 3.1 Sales Progressor (internal log) — TEMPLATE

Unchanged from today's `progressor` variant in `lib/portal-copy.ts`. Single canonical shape, code-substituted per milestone. Goes to the assigned internal progressor and, where applicable, admin.

```
Subject: {CODE} complete: {short-label} — {address}
Hero label: {CODE} — {short-label}
Opening: Logged on {address}.
What happened: {one-line factual summary}.
What next: (none)
Action button: View transaction
```

For each pair-direction, the substitutions are:

| Code | Subject suffix | Hero label | What happened |
|---|---|---|---|
| VM7 | Contract pack issued | VM7 — Draft contract pack issued | Vendor solicitor has issued draft contract pack to buyer's solicitor. |
| PM7 | Contract pack received | PM7 — Draft contract pack received | Buyer's solicitor has confirmed receipt of draft contract pack. |
| VM10 | Initial enquiries received | VM10 — Initial enquiries received | Buyer's solicitor has raised initial enquiries with vendor's solicitor. |
| PM14 | Initial enquiries raised | PM14 — Initial enquiries raised | Buyer's solicitor has raised initial enquiries with vendor's solicitor. |
| VM12 | Initial replies sent | VM12 — Initial replies sent | Vendor solicitor has sent initial enquiry replies to buyer's solicitor. |
| PM15 | Initial replies received | PM15 — Initial replies received | Initial enquiry replies received from vendor's solicitor. |
| VM13 | Additional enquiries received | VM13 — Additional enquiries received | Buyer's solicitor has raised additional enquiries. |
| PM17 | Additional enquiries raised | PM17 — Additional enquiries raised | Buyer's solicitor has raised additional enquiries. |
| VM15 | Additional replies sent | VM15 — Additional replies sent | Vendor solicitor has sent additional enquiry replies to buyer's solicitor. |
| PM18 | Additional replies received | PM18 — Additional replies received | Additional enquiry replies received from vendor's solicitor. |

No copy change vs today. **The only thing that may shift on the progressor email under hand-off is whether it fires once or twice per pair.** Recommendation: it fires once per code that's been confirmed — same as today. Both VM7 and PM7 confirming will produce two distinct progressor log emails, the same way they would today. No de-duplication; the progressor wants the full event log.

### 3.2 Agent FYI (vendorAgent / purchaserAgent variant) — TEMPLATE

For self-managed files, the agency director/negotiator who owns the file gets a brief "milestone complete" FYI. Unchanged from today's `vendorAgent` (and equivalent `purchaserAgent` where it exists) variant.

```
Subject: {short-label} — {address}
Hero label: Milestone complete
Opening: Quick update on {address}.
What happened: {one-line factual summary, written from the agent's external POV}.
What next: (none)
Action button: View in dashboard
```

Substitutions follow the same shape as §3.1, with the body line written in the third-person professional voice the agent expects ("Seller's solicitor has issued the draft contract pack to the buyer's solicitor"). For pairs where today's `lib/portal-copy.ts` lacks an explicit `vendorAgent`/`purchaserAgent` entry, **the hand-off does not introduce a new email** — it inherits whatever the existing routing rule produces. (Today: agent-FYI emails fire on a per-code basis based on what's defined; adding new variants is out of scope for this hand-off feature.)

### 3.3 Why these templates are stable

The progressor and agent-FYI emails are records of "X happened on Y file." They do not vary by confirmer because the *audience* is internal — they care about the event, not the click. They do not vary by hand-off direction because the milestone code is the same (VM7 confirming is VM7 confirming, regardless of whether it's a default or inverse direction in the hand-off model).

---

## 4. The acted-side three-variant rule

This is the new bit. When one side of a pair confirms, the email to the acting client (vendor or purchaser) acknowledges the confirmation. The phrasing changes based on **who actually clicked confirm**, because reading "Thanks — you've confirmed your solicitor has X" when you didn't click anything reads false.

Three variants per acted-side cell, applied identically across all 10 pair-directions:

### 4.1 Variant A — Client confirmed via their own portal (paths 5 or 6)

Opening reads in first-person. "You've confirmed" is honest because they actually clicked.

- Opening: "Thanks — you've confirmed [event]."
- Tone: warm acknowledgement that they did the action.
- Where the event was actually performed by their solicitor (which is true for all 10 codes in scope — these are all solicitor actions), the phrasing is "you've confirmed your solicitor has [done X]" — the client is confirming the fact of their solicitor's action, not claiming to have done it themselves.

### 4.2 Variant B — Agent confirmed on behalf (paths 1 or 2)

The agency's own staff (director or negotiator) ticked it off on the file. The acting client didn't click anything; they may not even be aware the confirmation happened. The phrasing reflects that.

- Opening: "We've recorded that your solicitor has [event]."
- Never "you've confirmed" — they didn't.
- Tone: calm record-keeping, plus reassurance about what comes next.

### 4.3 Variant C — Sales Progressor / admin confirmed on behalf (paths 3 or 4)

Functionally identical to Variant B from the client's perspective. The acting client didn't click; the platform team handled it. The phrasing is identical to Variant B — there's no client-facing reason to distinguish "agent" from "Sales Progressor" in the copy. **Variant C body is shared with Variant B in every cell.** Each pair-direction section marks it as `→ shared with Variant B`.

Recommendation: keep the two variants conceptually separate in the data model (different `confirmerPath` enum values) but render identical copy. Avoids forking copy unnecessarily; lets us diverge later if the product wants to.

---

## 5. Pair 1: VM7 ↔ PM7 — Draft contract pack

- **VM7** "Seller's solicitor has issued the draft contract pack"
- **PM7** "Buyer's solicitor has received the draft contract pack"
- **Default direction (Artifact 1):** vendor → purchaser (VM7 confirms first, hand-off to PM7)
- **Current chase rules being modified:** "Chase: Draft contract pack received by buyer's solicitor" (targets PM7, anchor VM7) [seed.ts:360]

### 5.A — Direction A: VM7 confirms first → hand-off to purchaser

#### 5.A.1 — Acted-side (vendor): Variant A — Seller via portal

```
Subject: You've confirmed the contract pack is on its way — {address}

Hi {First},

Thanks — you've confirmed your solicitor has sent the draft contract
pack across to the buyer's solicitor. That's the bundle of documents
that forms the legal foundation of the sale — the contract itself,
your property information forms, title documents, and any relevant
certificates.

The buyer's solicitor will now review everything carefully and is
likely to raise enquiries — questions about the property and the
documents. Your solicitor will handle these, though they may need
your input on some points. We'll be in touch when the buyer's
enquiries come back.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 5.A.2 — Acted-side (vendor): Variant B — Agent confirmed on behalf

```
Subject: Your contract pack is on its way to the buyer's side — {address}

Hi {First},

A quick update on your sale. We've recorded that your solicitor has
sent the draft contract pack across to the buyer's solicitor. That's
the bundle of documents that forms the legal foundation of the sale —
the contract itself, your property information forms, title documents,
and any relevant certificates.

The buyer's solicitor will now review everything carefully and is
likely to raise enquiries — questions about the property and the
documents. Your solicitor will handle these, though they may need
your input on some points. We'll be in touch when the buyer's
enquiries come back.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 5.A.3 — Acted-side (vendor): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §5.A.2 (Variant B). Byte-identical.**

#### 5.A.4 — Opposite-side (purchaser): Hand-off nudge

> **Stable across all confirmer paths for Direction A.**
>
> **Replaces** the existing on-confirm purchaser email at `lib/portal-copy.ts` VM7 → `emailCopy.purchaser` (subject "The contract pack has arrived with your solicitor — {address}"). The new copy is more action-forward and pairs with a pulsing confirm button on the buyer's portal (per brief §5).

```
Subject: Please confirm receipt of the contract pack — {address}

Hi {First},

Good news on your purchase. The seller's solicitor has sent the
contract pack across to your solicitor — the full bundle of legal
documents that will form the basis of your purchase. Your solicitor
will now review everything in detail and start raising enquiries.

On your end, there's one quick thing: open your portal and confirm
you're aware the pack is now with your solicitor. The confirm button
is highlighted, waiting for you. It takes about ten seconds and it
helps keep the file moving.

Open your portal: {portalUrl}

While you wait, it's worth checking your mortgage application is
progressing and any searches have been ordered. We'll be in touch
when your solicitor's enquiries go across.

Thanks,
Sales Progressor
```

#### 5.A.5 — Vendor Agent FYI

→ **Template §3.2 with VM7 substitutions.** Unchanged from current `lib/portal-copy.ts` VM7 → `emailCopy.vendorAgent`. No hand-off addition.

#### 5.A.6 — Progressor internal log

→ **Template §3.1 with VM7 substitutions.** Unchanged from current `lib/portal-copy.ts` VM7 → `emailCopy.progressor`.

#### 5.A.7 — Before/after — chase digest bullet (buyer contact)

**Before (today):** The buyer contact's chase digest, fired by `lib/email/client-chase-digest.ts`, contains a bullet under the "Sitting with your solicitor right now" group:

```
  • Draft contract pack received
```

…in an email whose subject reads `"{address}: N updates needed"`. The body line above the bullet group reads "One thing is sitting with your solicitor right now that we haven't seen confirmed yet:" or similar (varies by `overallTone`).

**After (under hand-off):** The PM7 bullet is **removed** from the buyer contact's chase digest. In its place, the dedicated hand-off email (§5.A.4) lands at the moment VM7 is confirmed by the seller side. If the digest still contains other bullets (e.g. PM4 outstanding for the buyer's own DIY), it fires as normal — just shorter. If PM7 was its only bullet, the digest doesn't fire that day.

The buyer's portal Overview and Progress pages show the pulsing confirm button on PM7 (Artifact 3 scope).

---

### 5.B — Direction B: PM7 confirms first → hand-off to vendor (inverse)

The buyer's solicitor confirms receipt before the seller's solicitor has confirmed dispatch. Realistic scenario: the seller's solicitor is slow with their portal but the pack genuinely went out; buyer's side processes it first.

#### 5.B.1 — Acted-side (purchaser): Variant A — Buyer via portal

```
Subject: You've confirmed the contract pack has arrived — {address}

Hi {First},

Thanks — you've confirmed your solicitor has received the contract
pack from the seller's solicitor. That's the bundle of documents
that forms the legal foundation of your purchase — the draft
contract, title documents, property information forms, and any
relevant certificates.

Your solicitor will now review everything carefully and start
raising enquiries — questions about the property and the documents
that need clarifying. In the meantime, it's worth checking your
mortgage application is progressing and any searches have been
ordered.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 5.B.2 — Acted-side (purchaser): Variant B — Agent confirmed on behalf

```
Subject: The contract pack is with your solicitor — {address}

Hi {First},

A quick update on your purchase. We've recorded that your solicitor
has received the draft contract pack from the seller's solicitor —
the full bundle of legal documents your solicitor will work from. They
will now review everything carefully and start raising enquiries.

In the meantime, it's worth checking your mortgage application is
progressing and any searches have been ordered. We'll be in touch
when the next meaningful step lands.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 5.B.3 — Acted-side (purchaser): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §5.B.2.**

#### 5.B.4 — Opposite-side (vendor): Hand-off nudge (inverse direction)

> **Stable across all confirmer paths for Direction B.**
>
> Replaces the existing on-confirm vendor email at `lib/portal-copy.ts` PM7 → `emailCopy.vendor` (subject "Your contract pack has arrived with the buyer's solicitor — {address}").
>
> Voice note: the seller is being told the pack made it to the other side *before they themselves confirmed dispatch*. The copy acknowledges this gently — it's not unusual, and the action they need to take is a portal confirmation that the pack did go out.

```
Subject: Please confirm the contract pack has gone out — {address}

Hi {First},

Quick update on your sale. The buyer's solicitor has confirmed they've
received the draft contract pack — so it sounds like your solicitor
has sent it across as planned, even if it hasn't been logged on our
side yet.

Could you do one quick thing? Open your portal and confirm you're
aware the pack has been sent. The confirm button is highlighted,
waiting for you. It takes about ten seconds and it helps keep the
file's records in sync.

Open your portal: {portalUrl}

The buyer's solicitor will be reviewing the pack now and is likely to
raise enquiries in the next week or two. Your solicitor will handle
those — they may need your input on some points, and we'll be in
touch if so.

Thanks,
Sales Progressor
```

#### 5.B.5 — Purchaser Agent FYI

→ **Template §3.2 with PM7 substitutions.** Unchanged from current `lib/portal-copy.ts` PM7 (no explicit `purchaserAgent` defined today; this hand-off does not introduce one).

#### 5.B.6 — Progressor internal log

→ **Template §3.1 with PM7 substitutions.** Unchanged.

#### 5.B.7 — Before/after — chase digest bullet (seller contact)

**Before (today):** The seller contact's chase digest contains a bullet under "Sitting with your solicitor right now":

```
  • Draft contract pack issued
```

**After (under hand-off):** The VM7 bullet is removed from the seller contact's chase digest. The dedicated hand-off email (§5.B.4) lands at the moment PM7 is confirmed by the buyer side. The seller's portal Overview and Progress pages show the pulsing confirm button on VM7.

---

## 6. Pair 2: VM10 ↔ PM14 — Initial enquiries

- **VM10** "Seller's solicitor has received initial enquiries"
- **PM14** "Buyer's solicitor has raised initial enquiries to the seller's solicitor"
- **Default direction (Artifact 1):** purchaser → vendor (PM14 confirms first, hand-off to VM10)
- **Current chase rules being modified:** "Chase: Initial enquiries received by seller's solicitor" (targets VM10, anchor PM14) [seed.ts:343]

### 6.A — Direction A: PM14 confirms first → hand-off to vendor

#### 6.A.1 — Acted-side (purchaser): Variant A — Buyer via portal

```
Subject: You've confirmed your solicitor has raised enquiries — {address}

Hi {First},

Thanks — you've confirmed your solicitor has raised their initial
enquiries with the seller's solicitor. These are the questions about
the property, the title, and the documents in the contract pack — a
completely normal and important part of the conveyancing process.

The seller's solicitor will now work through the questions and reply.
Your solicitor will review the replies when they come back and let
you know if any further questions are needed.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 6.A.2 — Acted-side (purchaser): Variant B — Agent confirmed on behalf

```
Subject: Your solicitor has raised enquiries with the seller's side — {address}

Hi {First},

A quick update on your purchase. We've recorded that your solicitor
has raised their initial enquiries with the seller's solicitor —
questions about the property, the title, and the documents in the
contract pack. This is a completely normal and important part of
conveyancing.

The seller's solicitor will now work through the questions and reply.
We'll let you know when the replies are back with your solicitor.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 6.A.3 — Acted-side (purchaser): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §6.A.2.**

#### 6.A.4 — Opposite-side (vendor): Informational heads-up (NOT a confirm-push)

> **Stable across all confirmer paths for Direction A.**
>
> **Different shape from the issue→receive pairs** — see §1 asymmetry note. The seller's solicitor may not have received the enquiries yet, so this email does **not** ask for a confirmation and the portal confirm button does **not** get highlighted at this point. The existing VM10 chase **stays live** — when the seller's solicitor actually receives the enquiries, the chase confirms them the normal way.
>
> This sits **in addition to** today's existing on-confirm vendor email at `lib/portal-copy.ts` VM10 → `emailCopy.vendor` rather than replacing it. (Or — implementation call for Artifact 3 — the existing on-confirm email fires only when VM10 itself is confirmed; this new email fires when PM14 is confirmed. They never collide because they're triggered by different events.)

```
Subject: Heads up: enquiries on the way to your solicitor — {address}

Hi {First},

A quick heads up on your sale. The buyer's solicitor has raised their
first round of enquiries — questions about the property and the
documents in the contract pack. They'll be on their way to your
solicitor now (or already with them — these things move quickly).
This is a completely normal part of the process and doesn't indicate
any problem.

There's nothing for you to do right now. Your solicitor will let you
know when the enquiries land and may need your input on some points
— if they reach out, please respond as quickly as you can. Delays on
enquiries are one of the most common reasons transactions slow down.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 6.A.5 — Vendor Agent FYI

→ **Template §3.2 with VM10 substitutions.**

#### 6.A.6 — Progressor internal log

→ **Template §3.1 with VM10 substitutions.**

#### 6.A.7 — Before/after — chase digest bullet (seller contact)

**Before:** Seller contact's digest bullet under "Sitting with your solicitor right now":

```
  • Initial enquiries received by your solicitor
```

**After:** Bullet **stays** in the seller's digest. §6.A.4 fires as an **additional** informational email; the existing VM10 chase continues as normal until the seller's side actually confirms receipt. The portal confirm button on VM10 does **not** highlight at this point — it'd be asking the seller to assert receipt that may not yet have happened. The highlight kicks in only via the normal "chase eligible" path (i.e. graceDays elapsed from anchor as today). See §1 asymmetry note.

---

### 6.B — Direction B: VM10 confirms first → hand-off to purchaser (inverse)

The seller's solicitor confirms receipt before the buyer's solicitor has confirmed they raised the enquiries. Less likely scenario than 6.A but plausible if the seller-side workflow is faster.

#### 6.B.1 — Acted-side (vendor): Variant A — Seller via portal

```
Subject: You've confirmed enquiries have come in from the buyer — {address}

Hi {First},

Thanks — you've confirmed your solicitor has received the buyer's
first round of enquiries. These are questions about the property and
the documents in the contract pack — a normal part of the process
and not a sign of any problem.

Your solicitor will work through them and may need your input on
some points. If they reach out, please respond as quickly as you
can — delays on enquiries are one of the most common reasons
transactions slow down.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 6.B.2 — Acted-side (vendor): Variant B — Agent confirmed on behalf

```
Subject: The buyer's enquiries are with your solicitor — {address}

Hi {First},

A quick update on your sale. We've recorded that the buyer's solicitor
has raised their first round of enquiries with your solicitor —
questions about the property, the title, and the documents in the
contract pack. This is a completely normal part of conveyancing.

Your solicitor will work through them and may need your input on
some points. If they reach out, please respond as quickly as you
can — delays on enquiries are one of the most common reasons
transactions slow down.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 6.B.3 — Acted-side (vendor): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §6.B.2.**

#### 6.B.4 — Opposite-side (purchaser): Hand-off nudge (inverse direction)

> **Stable across all confirmer paths for Direction B.**
>
> Voice note: the buyer is being told the enquiries have already landed on the seller's side before their own solicitor confirmed dispatch. The implication is "your solicitor has sent them — please log it."

```
Subject: Please confirm your solicitor has raised the enquiries — {address}

Hi {First},

Quick update on your purchase. The seller's solicitor has confirmed
they've received the first round of enquiries — so your solicitor
has clearly raised them, even if that step hasn't been logged on our
side yet.

Could you do one quick thing? Open your portal and confirm your
solicitor has raised the enquiries. The confirm button is
highlighted, waiting for you. It takes about ten seconds and it
helps keep your file's records in sync.

Open your portal: {portalUrl}

The seller's solicitor will work through the questions and your
solicitor will review the replies when they come back. We'll keep
you posted.

Thanks,
Sales Progressor
```

#### 6.B.5 — Purchaser Agent FYI

→ **Template §3.2 with PM14 substitutions.** Today's `lib/portal-copy.ts` PM14 defines `vendorAgent`; this hand-off does not introduce a new variant.

#### 6.B.6 — Progressor internal log

→ **Template §3.1 with PM14 substitutions.**

#### 6.B.7 — Before/after — chase digest bullet (buyer contact)

**Before:** Buyer contact's digest bullet:

```
  • Initial enquiries raised by your solicitor
```

**After:** Bullet removed; replaced by §6.B.4 at the moment VM10 confirms. Buyer's portal shows pulsing confirm on PM14.

---

## 7. Pair 3: VM12 ↔ PM15 — Initial replies

- **VM12** "Seller's solicitor has issued initial responses to the buyer's solicitor"
- **PM15** "Buyer's solicitor has received initial replies from the seller's solicitor"
- **Default direction (Artifact 1):** vendor → purchaser (VM12 confirms first, hand-off to PM15)
- **Current chase rules being modified:** "Chase: Initial replies received by buyer's solicitor" (targets PM15, anchor VM12) [seed.ts:368]

### 7.A — Direction A: VM12 confirms first → hand-off to purchaser

#### 7.A.1 — Acted-side (vendor): Variant A — Seller via portal

```
Subject: You've confirmed the enquiry replies have gone out — {address}

Hi {First},

Thanks — you've confirmed your solicitor has sent their replies to
the buyer's solicitor's initial enquiries. The buyer's solicitor
will now review the answers and may come back with further questions —
this is completely normal in conveyancing.

There's nothing for you to do right now. If another round of
questions arrives, we'll let you know.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 7.A.2 — Acted-side (vendor): Variant B — Agent confirmed on behalf

```
Subject: Your solicitor's replies have gone out — {address}

Hi {First},

A quick update on your sale. We've recorded that your solicitor has
sent their replies to the buyer's solicitor's initial enquiries. The
buyer's solicitor will now review the answers and may come back with
further questions — completely normal in conveyancing.

There's nothing for you to do right now. If another round of
questions arrives, we'll let you know.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 7.A.3 — Acted-side (vendor): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §7.A.2.**

#### 7.A.4 — Opposite-side (purchaser): Hand-off nudge

> **Stable across all confirmer paths for Direction A.**
>
> Replaces the existing on-confirm purchaser email at `lib/portal-copy.ts` VM12 → `emailCopy.purchaser` (subject "The seller has replied to your solicitor's enquiries — {address}").

```
Subject: Please confirm receipt of the seller's replies — {address}

Hi {First},

Progress on your purchase. The seller's solicitor has sent their
replies to your solicitor's initial enquiries. Your solicitor will
now review the answers and decide whether further questions are
needed.

On your end, one quick thing: open your portal and confirm you're
aware the replies have come back. The confirm button is highlighted,
waiting for you. It takes about ten seconds.

Open your portal: {portalUrl}

If anything in the replies needs your attention, your solicitor will
be in touch. Otherwise, they'll continue working through the
remaining points before you move towards exchange.

Thanks,
Sales Progressor
```

#### 7.A.5 — Vendor Agent FYI

→ **Template §3.2 with VM12 substitutions.**

#### 7.A.6 — Progressor internal log

→ **Template §3.1 with VM12 substitutions.**

#### 7.A.7 — Before/after — chase digest bullet (buyer contact)

**Before:** Buyer contact's digest bullet:

```
  • Initial replies received from the seller's solicitor
```

**After:** Bullet removed; replaced by §7.A.4 at the moment VM12 confirms. Buyer's portal shows pulsing confirm on PM15.

---

### 7.B — Direction B: PM15 confirms first → hand-off to vendor (inverse)

The buyer's solicitor confirms receipt before the seller's solicitor logged dispatch. Plausible if the seller-side workflow is slow.

#### 7.B.1 — Acted-side (purchaser): Variant A — Buyer via portal

```
Subject: You've confirmed the replies have arrived — {address}

Hi {First},

Thanks — you've confirmed your solicitor has received the seller's
solicitor's replies to your initial enquiries. Your solicitor will
now review the answers and assess whether everything has been
addressed satisfactorily.

Your solicitor may come back with further questions, or they may be
satisfied and begin working towards exchange. Either way, we'll keep
you posted.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 7.B.2 — Acted-side (purchaser): Variant B — Agent confirmed on behalf

```
Subject: The seller's enquiry replies are with your solicitor — {address}

Hi {First},

A quick update on your purchase. We've recorded that your solicitor
has received the seller's solicitor's replies to the initial
enquiries. Your solicitor will now review the answers and assess
whether everything has been addressed satisfactorily.

Your solicitor may come back with further questions, or they may be
satisfied and begin working towards exchange. Either way, we'll keep
you posted.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 7.B.3 — Acted-side (purchaser): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §7.B.2.**

#### 7.B.4 — Opposite-side (vendor): Hand-off nudge (inverse direction)

> **Stable across all confirmer paths for Direction B.**

```
Subject: Please confirm your replies have gone out — {address}

Hi {First},

Quick update on your sale. The buyer's solicitor has confirmed they've
received the replies to their initial enquiries — so it sounds like
your solicitor has sent them across as planned, even if it hasn't
been logged on our side yet.

Could you do one quick thing? Open your portal and confirm you're
aware the replies have gone out. The confirm button is highlighted,
waiting for you. It takes about ten seconds and it helps keep the
file's records in sync.

Open your portal: {portalUrl}

The buyer's solicitor will review the replies and may come back with
further questions — that's normal. We'll keep you updated.

Thanks,
Sales Progressor
```

#### 7.B.5 — Purchaser Agent FYI

→ **Template §3.2 with PM15 substitutions.**

#### 7.B.6 — Progressor internal log

→ **Template §3.1 with PM15 substitutions.**

#### 7.B.7 — Before/after — chase digest bullet (seller contact)

**Before:** Seller contact's digest bullet:

```
  • Initial replies sent to the buyer's solicitor
```

**After:** Bullet removed; replaced by §7.B.4 at the moment PM15 confirms. Seller's portal shows pulsing confirm on VM12.

---

## 8. Pair 4: VM13 ↔ PM17 — Further enquiries

- **VM13** "Seller's solicitor has received additional enquiries"
- **PM17** "Buyer's solicitor has raised additional enquiries"
- **Default direction (Artifact 1):** purchaser → vendor (PM17 confirms first, hand-off to VM13)
- **Current chase rules being modified:** "Chase: Further enquiries received by seller's solicitor" (targets VM13, anchor PM17) [seed.ts:346]

### 8.A — Direction A: PM17 confirms first → hand-off to vendor

#### 8.A.1 — Acted-side (purchaser): Variant A — Buyer via portal

```
Subject: You've confirmed your solicitor has raised further questions — {address}

Hi {First},

Thanks — you've confirmed your solicitor has raised a further round
of enquiries with the seller's solicitor. Most transactions go
through at least two rounds of questions before everything is
resolved — this doesn't indicate a problem.

The seller's solicitor will work through the additional questions
and reply. Your solicitor will then review and let you know if all
points have been resolved.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 8.A.2 — Acted-side (purchaser): Variant B — Agent confirmed on behalf

```
Subject: Your solicitor has raised further questions with the seller's side — {address}

Hi {First},

A quick update on your purchase. We've recorded that your solicitor
has raised a further round of enquiries with the seller's solicitor.
Most transactions go through at least two rounds of questions before
everything is resolved — this doesn't indicate a problem.

The seller's solicitor will work through the additional questions
and reply. We'll let you know when the replies are back with your
solicitor.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 8.A.3 — Acted-side (purchaser): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §8.A.2.**

#### 8.A.4 — Opposite-side (vendor): Informational heads-up (NOT a confirm-push)

> **Stable across all confirmer paths for Direction A.**
>
> **Different shape from the issue→receive pairs** — see §1 asymmetry note. The seller's solicitor may not have received the further enquiries yet, so this email does **not** ask for a confirmation and the portal confirm button does **not** highlight at this point. The existing VM13 chase **stays live**.

```
Subject: Heads up: further enquiries on the way to your solicitor — {address}

Hi {First},

A quick heads up on your sale. The buyer's solicitor has raised a
further round of enquiries with your solicitor. Most transactions go
through at least two rounds of questions before everything is
resolved, so this is completely normal — not a sign of any problem.
They'll be on their way to your solicitor now (or already with them).

There's nothing for you to do right now. Your solicitor will work
through the additional questions and may need your input on some
points. If they reach out, please respond as promptly as you can.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 8.A.5 — Vendor Agent FYI

→ **Template §3.2 with VM13 substitutions.**

#### 8.A.6 — Progressor internal log

→ **Template §3.1 with VM13 substitutions.**

#### 8.A.7 — Before/after — chase digest bullet (seller contact)

**Before:** Seller contact's digest bullet:

```
  • Further enquiries received by your solicitor
```

**After:** Bullet **stays** in the seller's digest. §8.A.4 fires as an **additional** informational email; the existing VM13 chase continues as normal until the seller's side actually confirms receipt. The portal confirm button on VM13 does **not** highlight at this point. The highlight kicks in only via the normal "chase eligible" path. See §1 asymmetry note.

---

### 8.B — Direction B: VM13 confirms first → hand-off to purchaser (inverse)

#### 8.B.1 — Acted-side (vendor): Variant A — Seller via portal

```
Subject: You've confirmed further enquiries are in from the buyer — {address}

Hi {First},

Thanks — you've confirmed your solicitor has received a further round
of enquiries from the buyer's solicitor. Most transactions go through
at least two rounds of questions before everything is resolved, so
this is completely normal.

Your solicitor will work through the additional questions and may
need your input on some points. If they reach out, please respond as
promptly as you can.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 8.B.2 — Acted-side (vendor): Variant B — Agent confirmed on behalf

```
Subject: Further buyer enquiries are with your solicitor — {address}

Hi {First},

A quick update on your sale. We've recorded that the buyer's
solicitor has raised a further round of enquiries with your
solicitor. Most transactions go through at least two rounds of
questions before everything is resolved, so this is completely
normal — not a sign of any problem.

Your solicitor will work through the additional questions and may
need your input on some points. If they reach out, please respond
as promptly as you can.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 8.B.3 — Acted-side (vendor): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §8.B.2.**

#### 8.B.4 — Opposite-side (purchaser): Hand-off nudge (inverse direction)

> **Stable across all confirmer paths for Direction B.**

```
Subject: Please confirm your solicitor has raised the further enquiries — {address}

Hi {First},

Quick update on your purchase. The seller's solicitor has confirmed
they've received your solicitor's further round of enquiries — so
your solicitor has clearly raised them, even if that step hasn't
been logged on our side yet.

Could you do one quick thing? Open your portal and confirm your
solicitor has raised the further enquiries. The confirm button is
highlighted, waiting for you. It takes about ten seconds and it
helps keep your file's records in sync.

Open your portal: {portalUrl}

The seller's solicitor will work through the questions and your
solicitor will review the replies when they come back. We'll keep
you posted.

Thanks,
Sales Progressor
```

#### 8.B.5 — Purchaser Agent FYI

→ **Template §3.2 with PM17 substitutions.**

#### 8.B.6 — Progressor internal log

→ **Template §3.1 with PM17 substitutions.**

#### 8.B.7 — Before/after — chase digest bullet (buyer contact)

**Before:** Buyer contact's digest bullet:

```
  • Further enquiries raised by your solicitor
```

**After:** Bullet removed; replaced by §8.B.4 at the moment VM13 confirms. Buyer's portal shows pulsing confirm on PM17.

---

## 9. Pair 5: VM15 ↔ PM18 — Further replies

- **VM15** "Seller's solicitor has issued additional responses to the buyer's solicitor"
- **PM18** "Buyer's solicitor has received additional replies"
- **Default direction (Artifact 1):** vendor → purchaser (VM15 confirms first, hand-off to PM18)
- **Current chase rules being modified:** "Chase: Further replies received by buyer's solicitor" (targets PM18, anchor VM15) [seed.ts:371]

### 9.A — Direction A: VM15 confirms first → hand-off to purchaser

#### 9.A.1 — Acted-side (vendor): Variant A — Seller via portal

```
Subject: You've confirmed the further replies have gone out — {address}

Hi {First},

Thanks — you've confirmed your solicitor has sent replies to all
outstanding enquiries from the buyer's solicitor. Both sides are now
working towards exchange of contracts.

The next steps are your solicitor sending you the contract to sign
and confirming they're ready to exchange. We'll be in touch when
there's an update.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 9.A.2 — Acted-side (vendor): Variant B — Agent confirmed on behalf

```
Subject: Your solicitor's further replies have gone out — {address}

Hi {First},

A quick update on your sale. We've recorded that your solicitor has
sent replies to all outstanding enquiries from the buyer's solicitor.
Both sides are now working towards exchange of contracts.

The next steps are your solicitor sending you the contract to sign
and confirming they're ready to exchange. We'll be in touch when
there's an update.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 9.A.3 — Acted-side (vendor): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §9.A.2.**

#### 9.A.4 — Opposite-side (purchaser): Hand-off nudge

> **Stable across all confirmer paths for Direction A.**
>
> Replaces the existing on-confirm purchaser email at `lib/portal-copy.ts` VM15 → `emailCopy.purchaser` (subject "The seller has replied to all enquiries — {address}").

```
Subject: Please confirm receipt of the further replies — {address}

Hi {First},

The enquiry stage is winding up. The seller's solicitor has replied
to all of your solicitor's enquiries. Your solicitor will now review
the additional replies and work through any remaining outstanding
points.

On your end, one quick thing: open your portal and confirm you're
aware the replies have come back. The confirm button is highlighted,
waiting for you. It takes about ten seconds.

Open your portal: {portalUrl}

Once your solicitor is satisfied with all the replies, they'll
prepare their final report to you and confirm they're ready to move
towards exchange.

Thanks,
Sales Progressor
```

#### 9.A.5 — Vendor Agent FYI

→ **Template §3.2 with VM15 substitutions.**

#### 9.A.6 — Progressor internal log

→ **Template §3.1 with VM15 substitutions.**

#### 9.A.7 — Before/after — chase digest bullet (buyer contact)

**Before:** Buyer contact's digest bullet:

```
  • Further replies received from the seller's solicitor
```

**After:** Bullet removed; replaced by §9.A.4 at the moment VM15 confirms. Buyer's portal shows pulsing confirm on PM18.

---

### 9.B — Direction B: PM18 confirms first → hand-off to vendor (inverse)

#### 9.B.1 — Acted-side (purchaser): Variant A — Buyer via portal

```
Subject: You've confirmed the further replies have arrived — {address}

Hi {First},

Thanks — you've confirmed your solicitor has received the seller's
solicitor's replies to the further enquiries. Your solicitor will
now review the answers.

Your solicitor will assess whether all points have now been
addressed. If they're satisfied, they'll move towards preparing their
final report to you.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 9.B.2 — Acted-side (purchaser): Variant B — Agent confirmed on behalf

```
Subject: The seller's further replies are with your solicitor — {address}

Hi {First},

A quick update on your purchase. We've recorded that your solicitor
has received the seller's solicitor's replies to the further
enquiries. Your solicitor will now review the answers.

Your solicitor will assess whether all points have now been
addressed. If they're satisfied, they'll move towards preparing their
final report to you.

View your portal: {portalUrl}

Thanks,
Sales Progressor
```

#### 9.B.3 — Acted-side (purchaser): Variant C — Sales Progressor confirmed on behalf

→ **Shared with §9.B.2.**

#### 9.B.4 — Opposite-side (vendor): Hand-off nudge (inverse direction)

> **Stable across all confirmer paths for Direction B.**

```
Subject: Please confirm your further replies have gone out — {address}

Hi {First},

Quick update on your sale. The buyer's solicitor has confirmed
they've received the replies to their further enquiries — so it
sounds like your solicitor has sent them across as planned, even
if it hasn't been logged on our side yet.

Could you do one quick thing? Open your portal and confirm you're
aware the replies have gone out. The confirm button is highlighted,
waiting for you. It takes about ten seconds and it helps keep the
file's records in sync.

Open your portal: {portalUrl}

The buyer's solicitor will now review the further replies and, if
they're satisfied, work towards preparing their final report — you're
in the home stretch before exchange.

Thanks,
Sales Progressor
```

#### 9.B.5 — Purchaser Agent FYI

→ **Template §3.2 with PM18 substitutions.**

#### 9.B.6 — Progressor internal log

→ **Template §3.1 with PM18 substitutions.**

#### 9.B.7 — Before/after — chase digest bullet (seller contact)

**Before:** Seller contact's digest bullet:

```
  • Further replies sent to the buyer's solicitor
```

**After:** Bullet removed; replaced by §9.B.4 at the moment PM18 confirms. Seller's portal shows pulsing confirm on VM15.

---

## 10. Non-bilateral regression check

The new acted-side three-variant phrasing rule (§4) and the new opposite-side hand-off nudges (§§5–9) MUST be scoped exclusively to the 10 milestone codes in the 5 pairs: **VM7, PM7, VM10, PM14, VM12, PM15, VM13, PM17, VM15, PM18**.

Every other milestone in `lib/portal-copy.ts` (37 codes — VM1–VM6, VM8, VM9, VM11, VM14, VM16–VM20, PM1–PM6, PM8–PM13, PM16, PM19–PM27) must continue to fire its existing on-confirm email exactly as it does today, with no acted-side variant logic, no hand-off nudge logic, and no chase-digest bullet removal.

The implementation plan (Artifact 3) must:

- Gate the new code paths on `code IN HANDOFF_PAIR_CODES`. Outside that set, fall through to the existing `sendAdminMilestoneNotificationToPortal` behaviour unchanged.
- Verify the digest-builder (`lib/email/client-chase-digest.ts`) only filters bullets for codes in the set. All other chase bullets continue to render.
- Verify VM9/PM12 (explicitly OUT per brief §3 — keeps its own chase live) is not in the set.
- Add a verification script (or extend an existing one) that confirms the 47-code matrix produces the expected (38 unchanged) + (10 hand-off-modified) split.

The verification doesn't belong in this artefact — flagging it as a checklist item for Artifact 3.

---

## 11. Open questions to surface in Artifact 3

These don't block sign-off of this copy; they're flagged here because the answers shape the implementation:

1. **Footer + unsubscribe.** All the new emails should carry the same footer + unsubscribe link as today's client emails. Confirm the email-sending wrapper handles this so the copy here doesn't need to repeat the boilerplate.
2. **`{portalUrl}` per recipient.** The portal URL is token-scoped per contact (not per file). The implementation must resolve the right `portalUrl` for each contact at send time. This is existing infrastructure (portal tokens) — no copy change, just a render-time substitution.
3. **`{First}` resolution.** Same as today — `buildGreeting()` in `lib/portal-copy.ts` covers titled names, multi-word names etc. Re-use it; do not introduce a new greeting helper.
4. **Email subject lengths.** Action nudge subjects now front-load "Please confirm…" so the call to action survives mobile preview-pane truncation (~40 chars). Informational heads-up subjects front-load "Heads up:…". Acted-side acknowledgement subjects are context-first ("You've confirmed…" / "Your contract pack is on its way…") — they're not action-bearing so truncation is less critical. Resolved in v2.
5. **Confirm-button-visual-emphasis copy.** Earlier draft said "the confirm button is gently pulsing" — coupled the copy to the animation. The button is *visually highlighted* under reduced-motion (static ring) and pulses otherwise; the copy now says "highlighted, waiting for you" so it holds either way. Resolved in v2.
6. **Sent-from address + display name.** Reuse existing — no change.
7. **Inverse-direction frequency.** In real usage, the inverse direction (B branches) will fire rarely — typically only when one side is significantly delayed in confirming what the other side has already logged. The copy still has to be excellent because *when* it fires, it's load-bearing (it's the moment the platform looks proactive instead of reactive). Worth a follow-up review against real prod data once a few have fired.
8. **Enquiries-default chase still active — does the seller-side reminder need any copy change?** The seller's chase digest bullet for VM10/VM13 stays as today. The added informational heads-up (§6.A.4, §8.A.4) means the seller may receive *two* emails about the same enquiries-in-flight event (the heads-up immediately on PM14/PM17 confirm, and later the digest if the seller's solicitor hasn't logged receipt by graceDays). Both are honest; both serve different purposes (heads-up = "expect this"; digest = "still hasn't landed"). Recommend ship as-is and re-check after prod data — if it reads as duplicate, the digest can suppress that specific bullet for, say, 5 days after the heads-up fired. Out of scope for v1.

---

## 12. Sign-off

When you sign this off, the Artifact 3 implementation plan can begin. Sign-off is in full — please flag any cells (by §-number) that need rework before approval.

Reviewer: Ellis Askey
Date: _____________
Decision: ☐ Approved as-is   ☐ Approved with edits (per inline notes)   ☐ Returned for revision
