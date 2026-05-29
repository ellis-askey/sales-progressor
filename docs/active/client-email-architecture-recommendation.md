# Client email architecture — recommendation for shape × route × recipient expansion

> Status: architecture decision doc, read-only investigation. No code yet. Read me before authoring any of the ~400–700 email bodies the expansion requires.

---

## 1. The choice in one sentence

**Model A** = author every email body as an independent frozen string in a big keyed map.
**Model B** = author per-milestone *skeletons* of conditional segments and let the send path *assemble* the situation-correct body at render time.

The codebase today is Model A with one micro-extension (PM6 has pre-computed shape-aware substring vars). At 400–700 bodies the maintenance cost of pure A becomes the rate-limiting factor for trust in the copy. **My honest recommendation: Model B, with a render-all snapshot tool so the result is reviewable as if it were A.**

---

## 2. What the current architecture is — exactly

**Storage:** `lib/portal-copy.ts` exports a flat `Record<code, PortalCopy>`. Each milestone has an `emailCopy: MilestoneEmailCopy` with up to five recipient-keyed variants (`vendor` / `purchaser` / `vendorAgent` / `vendorAgentPortal` / `progressor`). Each variant is six template strings: `subject`, `heroLabel`, `opening`, `whatHappened`, `whatNext`, `action`.

**Interpolation:** [lib/services/portal.ts:915–917](../../lib/services/portal.ts#L915):

```ts
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
```

That's the whole engine — pure regex substitution. No conditionals, no branching, no joins. Just `{var}` → `value` lookups.

**Branching happens upstream of the template, not inside it.** PM6's physical-vs-desktop is implemented as four pre-computed strings — `eventDate`, `eventDateClause`, `vendorVisitNote`, `purchaserPhysicalNote` — built by ternary in [portal.ts:1012–1030](../../lib/services/portal.ts#L1012) and passed in as `extraVars`. The template then references `{vendorVisitNote}` etc. From the template's POV, all conditioning is invisible — it just inlines whatever string was computed.

**Assembly:** subject → greeting → opening → whatHappened → optional whatNext → CTA, joined with newlines. Five fields rendered to one email.

**So today's model is:** Model A with a thin "compute-then-substitute" escape hatch that one milestone (PM6) uses. Everything else is flat strings keyed by `code × recipient`.

---

## 3. The realistic expanded count — per category

Counting bodies that fully expand on all relevant axes for that code. Internal-recipient variants (`vendorAgent`, `progressor`) are listed separately because they realistically stay shape-stable — they're factual logs, not customer-facing voice.

### 3.1 Non-bilateral codes (33 of 47)

The non-bilateral set: VM1–VM6, VM8, VM9, VM11, VM14, VM16, VM17, VM18, VM20, PM1–PM6, PM8–PM13, PM16, PM19–PM25, PM27. (VM7, VM10, VM12, VM13, VM15, PM7, PM14, PM15, PM17, PM18 are the new bilateral set; VM19/PM26 are the existing exchange auto-confirm bilateral.)

Three sub-buckets by how shape gates the milestone:

| Sub-bucket | Codes | Shape combos that fire | Client variants per code | Internal | Total per code |
|---|---|---|---|---|---|
| Universal (every shape fires) | 26 codes | 6 (2 tenure × 3 funding) | 2 recipients × 6 shapes = 12 | + 2 internal | **14** |
| Leasehold-only (freehold auto-NRs) | 3 codes (VM8, VM9, PM12) | 3 (leasehold × 3 funding) | 2 × 3 = 6 | + 2 | **8** |
| Mortgage-only basic (cash/CFP auto-NR) | 2 codes (PM5, PM11) | 2 (mortgage × 2 tenure) | 2 × 2 = 4 | + 2 | **6** |
| Mortgage-only with sub-state (PM6) | 1 code (PM6) | 2 × 2 sub-states (physical/desktop) | 2 × 2 × 2 = 8 | + 2 | **10** |
| PM24 (suppressed only on CFP) | 1 code | 4 (2 funding × 2 tenure) | 2 × 4 = 8 | + 2 | **10** |

Non-bilateral subtotal: 26×14 + 3×8 + 2×6 + 1×10 + 1×10 = **420**

### 3.2 New bilateral codes (10 codes — VM7/PM7, VM10/PM14, VM12/PM15, VM13/PM17, VM15/PM18)

Per the Artifact 2 spec, bilateral codes have:
- **Acted-side client recipient**: 3 confirmer routes × 6 shape combos = 18
- **Opposite-side client recipient** (hand-off nudge): direction-stable but shape-conditional → 1 × 6 = 6
- **Internal vendorAgent** (where defined): shape-stable → 1
- **Internal progressor**: shape-stable → 1

Per bilateral code: 18 + 6 + 1 + 1 = **26**

Bilateral subtotal: 10 × 26 = **260**

Caveat: §6.A.4 and §8.A.4 of Artifact 2 are informational nudges (no confirm-push), which means their direction-stable single body might collapse to 6 shape combos like the others — no change in count. Whichever shape gates the milestone applies (e.g. mortgage-only milestones in the set don't have a freehold-mortgage × cash split — only mortgage shapes).

### 3.3 Existing bilateral codes (4 codes — VM19/PM26, VM20/PM27)

These use a separate `sendExchangeCompletionPack` code path. Today each has ~3 recipient variants. Multiplied by 6 shapes: 4 × 3 × 6 = **72**

But these are "milestone reached" celebration emails — content varies less by shape (exchange is exchange). A pragmatic expansion is more like 4 × 3 × 2 = **24** (only major shape splits, e.g. leasehold-specific freeholder-policy footer).

### 3.4 Total realistic count

| Category | Codes | Bodies |
|---|---|---|
| Non-bilateral universal | 26 | 364 |
| Non-bilateral leasehold-only | 3 | 24 |
| Non-bilateral mortgage-only | 2 | 12 |
| PM6 (mortgage + sub-state) | 1 | 10 |
| PM24 (not-CFP) | 1 | 10 |
| New bilateral | 10 | 260 |
| Existing bilateral exchange/completion | 4 | 24–72 |

**Realistic total: 700–750 bodies if shape × route × recipient is fully expanded.**

Your "300–400+" gut estimate is achievable only if **most non-bilateral milestones get one universal client body each** rather than six shape variants. That's a perfectly defensible choice — many of the 26 universal codes genuinely don't have shape-relevant content (e.g. VM4 "ID/AML checks complete" — the body reads the same regardless of tenure/funding). Aggressive pruning of universal-by-recipient cells brings it to ~450.

Either way: **400 is the floor; 700 is the ceiling.** That order of magnitude is where the architecture choice matters most.

---

## 4. Model A — what we have today, scaled up

**Shape:** add new entries to `MilestoneEmailCopy` keyed by composite key — e.g. `vendor_freehold_mortgage`, `vendor_leasehold_cash_buyer`, etc. Or restructure to `emailCopy.vendor[tenure][purchaseType]` — same idea, nested.

Send path additions: in `sendRichMilestoneEmails`, after looking up `emailCopy[recipientKey]`, descend by `tx.tenure` and `tx.purchaseType` to pick the right leaf. For bilateral acted-side variants, descend further by `confirmerPath`.

**Pros:**
- Each cell is independent. You can read a final email by opening one file at one location.
- No abstraction tax — the string you see is the string that fires.
- Polish a single variant in isolation without worrying about side effects.
- Trivial render path: no change to `interpolate`, just a deeper lookup.
- Reviewable by humans visually — Ellis can scan all 700 cells in a long doc.

**Cons:**
- The same idea is re-authored 5–20 times. "Your solicitor will work through the contract pack and raise enquiries" appears in (say) 16 variants of PM7's bodies if 16 shape × route combinations fire.
- Voice drift over time. A future editor improves one cell, leaves the others. Six months in, the matrix has subtle inconsistencies. At 400+ cells this becomes effectively impossible to police.
- Bulk edits are dangerous. If you decide all PM7 emails should soften "make sure that's in hand" to "worth checking that's in hand," that's 16 grep-and-replace operations across nested strings.
- Adding a seventh shape value later (e.g. shared-ownership funding) multiplies every existing cell — every code gets re-authored.

**At 50 bodies Model A is fine.** At 700 it is a maintenance liability. The codebase has 47 bodies today (one per milestone-recipient) and we already see voice drift in spots — duplicate subject lines, "meaningful update" filler scattered, mortgage assumptions in flat strings (per the file-shape doc).

---

## 5. Model B — what it actually looks like in this codebase

The current `interpolate` regex is tiny (one function, two lines). The compose-and-assemble model needs more, but not much. Concrete proposal:

### 5.1 Replace each string field with a section array

Today:
```ts
PM7: {
  emailCopy: {
    purchaser: {
      subject: "Contract pack received by your solicitor — {address}",
      opening: "The legal documents are with your solicitor.",
      whatHappened: "Your solicitor has received the contract pack from the seller's solicitor. ...",
      whatNext: "Your solicitor will work through the contract pack and raise enquiries. ... In parallel, keep your mortgage application and survey progressing.",
    },
  },
}
```

Model B:
```ts
PM7: {
  emailCopy: {
    purchaser: {
      subject: [
        { text: "Contract pack received by your solicitor — {address}" },
      ],
      opening: [
        { text: "The legal documents are with your solicitor." },
      ],
      whatHappened: [
        { text: "Your solicitor has received the contract pack from the seller's solicitor. This is the bundle of documents that forms the legal foundation of the purchase — the draft contract, title documents, property information forms, and any relevant certificates. Your solicitor will now review everything carefully." },
      ],
      whatNext: [
        { text: "Your solicitor will work through the contract pack and raise enquiries. If you haven't already ordered searches, make sure that's in hand — your solicitor needs your payment on account before they can do so." },
        { text: "In parallel, keep your mortgage application and survey progressing.", when: { purchaseType: "mortgage" } },
        { text: "Your survey is the other big thing in flight — make sure that's progressing.", when: { purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] } } },
        { text: "Your survey is the other big thing in flight — and your concurrent sale's exchange is the gating step on your end, since your deposit comes from those proceeds.", when: { purchaseType: "cash_from_proceeds" } },
      ],
      action: [
        { text: "View your portal" },
      ],
    },
  },
}
```

Sections that have no `when` are universal. Sections with `when` fire only when the current shape matches.

### 5.2 The `when` condition type

```ts
type ShapeCondition = {
  tenure?: Tenure | { in: Tenure[] } | { not: Tenure };
  purchaseType?: PurchaseType | { in: PurchaseType[] } | { not: PurchaseType };
  isShareOfFreehold?: boolean;
  route?: ConfirmerRoute | { in: ConfirmerRoute[] };       // bilateral acted-side
  direction?: "default" | "inverse";                        // bilateral hand-off
};
```

Implicit AND across keys. Operators (`in`, `not`) cover the common cases.

### 5.3 The assembler — small addition to portal.ts

```ts
function assembleField(sections: Section[], shape: FileShape): string {
  return sections
    .filter(s => !s.when || matches(s.when, shape))
    .map(s => s.text)
    .join(" ");
}

function matches(cond: ShapeCondition, shape: FileShape): boolean { ... }
```

Then in `sendRichMilestoneEmails`, before calling `interpolate`, run `assembleField` on each of subject / opening / whatHappened / whatNext / action. The output is a flat string — `interpolate` works on it unchanged. Existing `{address}` etc. still substitutes.

Net new code: ~80 lines (the assembler + condition matcher + a render-all snapshot util). Zero change to the rest of the send infrastructure.

### 5.4 What this gets you

- **One idea, one place.** The "your survey is the other big thing in flight" sentence is authored once. If you later want to change it to "your survey is the next thing to chase," you edit one line.
- **Composability.** Adding a new shape value (say `funding: help_to_buy`) means adding a `when: { purchaseType: "help_to_buy" }` section to relevant skeletons — without re-authoring the rest. Universal sections are reused for free.
- **Voice consistency by default.** Because shared paragraphs aren't duplicated, they can't drift.
- **Surface area for review** drops by 3–4×. ~700 final bodies → roughly 200 authored sections (universal + shape-conditional).

### 5.5 The real cost

- **You can't read an email by reading the source.** A skeleton with five `when`-conditional sections has 32 possible final shapes. Reviewing requires running the assembler.
- **Mitigation: a render-all snapshot tool.** A script that emits every final body to a single markdown file, grouped by code/recipient/shape/route. Reviewers see ~700 fully-rendered bodies as if it were Model A — but the authoring source stays Model B. Same affordance for Ellis as A; same maintenance discipline as B.
- **Join points need authoring care.** If a conditional paragraph is dropped, the surrounding paragraphs need to flow. Practical rule: each section is a complete paragraph, conditions are paragraph-granular not phrase-granular. Reviewer scans the snapshot, not the skeleton, for grammar.
- **The condition language has to be tight.** If `when` grows to support disjunctions, custom predicates, or per-recipient logic, complexity creeps. Keep it to the four keys above. If a shape can't be expressed in `when`, add a new field — don't introduce arbitrary callbacks.

---

## 6. Honest recommendation

**Model B, with a render-all snapshot tool. Ship the snapshot before authoring the bodies.**

The maintenance economics are the deciding factor. At 50 bodies, A is fine — humans can keep voice aligned by visual scan. At 700, A becomes a slow-motion drift problem. Six months after launch the matrix will have subtle inconsistencies that erode the "every email knows the situation" promise — and "knows the situation" is the whole point of doing this at all.

B preserves the promise by making it structural: a shared phrase about "your mortgage application progressing" lives in one place and either fires or doesn't, never reads two slightly different ways across recipients. The cost is one piece of infrastructure (assembler + snapshot) and the discipline of authoring at paragraph granularity rather than at full-string granularity.

Two specific things that make B the right call in *this* codebase:

1. **Most of the shape-conditional content is paragraph-shaped, not phrase-shaped.** Looking at the cells that need branching: PM7 purchaser `whatNext`'s "keep your mortgage application progressing" is a sentence-or-two insert. Same for PM21's "any conditions attached to your mortgage offer." Same for the bilateral hand-off nudges' "the confirm button is highlighted." These are all paragraph-granular swaps — exactly what B handles cleanly. Phrase-level interpolation (inline word substitution) is rare enough that the existing `{var}` mechanism covers it for the few cases that exist.

2. **The send path is already set up for composition.** `sendRichMilestoneEmails` reads each field as a string and joins them. Replacing "string" with "list of sections that assemble to a string" is a one-call insertion (`assembleField(sections, shape)` upstream of `interpolate`). The infrastructure cost is genuinely small.

If you want a fallback for risk: author one milestone end-to-end in Model B as a proof, render its full snapshot (every variant rendered to a single doc), and check that the assembly produces copy as polished as if it had been authored as flat strings. If the join points read awkwardly, abandon and revert to A. The proof costs one milestone's authoring time and gives a definitive read on the model.

---

## 7. What this does NOT recommend

- **Don't go pure-A** at 700-body scale. The drift cost is real and unrecoverable.
- **Don't go full template-DSL** with disjunctions, custom predicates, runtime callbacks. Keep `when` to the four keys.
- **Don't store skeletons in the DB.** They're code, not content. The shape-and-route surface area is bounded by the schema; the skeletons evolve with releases. Static module wins.
- **Don't try to auto-generate skeletons from the existing copy.** The existing copy has the bugs the new matrix is meant to fix (PM7 mortgage-assumption etc.). Start from intent, not from current strings.
- **Don't author bodies before the assembler exists.** The skeletons depend on the condition language. Building it first is a few hours; refactoring 200 sections to match a settled language later is days.

---

## 8. Concrete next step (if you adopt B)

Build order I'd recommend, before any of the 700 bodies are written:

1. **Define the FileShape type** (one source of truth): `{ tenure, purchaseType, isShareOfFreehold, serviceType }`. Construct it once per send from the `PropertyTransaction` row.
2. **Define `Section` + `ShapeCondition` types.** ~30 lines.
3. **Write `matches(cond, shape)`.** ~40 lines. Unit-test against the 6-combo matrix.
4. **Write `assembleField(sections, shape)`.** ~20 lines.
5. **Patch `sendRichMilestoneEmails`** to call `assembleField` on each of the five fields before `interpolate`. ~10 lines diff.
6. **Write the render-all snapshot script.** Iterates every milestone × recipient × shape × route, calls the assembler with mock vars, writes a single markdown grouped by code. ~150 lines. **This is the artefact Ellis reviews.**
7. **Convert one existing milestone to Model B** as a proof. Snapshot it. Compare against the original. If voice holds, proceed to the full authoring.
8. **Author the 200ish sections** that comprise the 700 final bodies. Use the snapshot at every step.

The decision you need to make right now is just between A and B. If B, the infrastructure work above is a 1–2-day spike before authoring begins. If A, no infrastructure, but 700 bodies of authoring with no compositional reuse and an ongoing voice-drift exposure.

---

## 9. TL;DR

| Question | Answer |
|---|---|
| Which model does the current architecture support? | Model A natively. B is a small additive patch on top of `interpolate`. |
| What does B look like in this codebase? | Replace each `whatHappened` string with `Section[]`, each section optionally tagged with a `when: ShapeCondition`. Add `assembleField` call before `interpolate`. ~80 lines new infrastructure. |
| Realistic expanded count? | **700 ± 50** with aggressive shape × route × recipient expansion; **~450** with sensible pruning of "universal" milestones to single client variants. |
| Recommendation? | **B, with a render-all snapshot tool reviewed as if it were A.** A's authoring drift becomes the dominant cost at 400+ bodies. |
| Risk to manage in B? | Awkward join points between conditional paragraphs. Mitigated by paragraph-granular sections + snapshot review. |
