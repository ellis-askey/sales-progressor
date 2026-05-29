# Skeleton authoring pattern (pilot reference)

This is the structural pattern proven on VM1 and VM7 in the pilot. All other skeleton rewrites must follow it for snapshot output to match the FINAL files.

## Field mapping (FINAL inbox text → skeleton TS)

The renderer in `scripts/render-email-snapshot.ts` and the send path in `lib/services/portal.ts` both produce this layout:

```
Hi {First},

[opening section text]

[whatHappened section text]

[whatNext section text, if any]

→ {action section text}
```

For each FINAL email block:
- **Subject** line in FINAL → `subject` section. Pattern: `<descriptive subject>, {address}`. Commas only — never em dashes.
- **First sentence/short paragraph** after "Hi Alex," → `opening` section (one sentence or one short paragraph).
- **Middle body paragraph(s)** → `whatHappened` section.
- **Final body paragraph (the "what to do next" / "what comes next" framing)** → `whatNext` section.
- **`→ View your portal` / `→ Open your portal`** → `action` section text (without the arrow — renderer adds it).
- **`heroLabel`** is the HTML H1, not visible in inbox text. **Preserve existing heroLabel text unchanged** — do not invent new ones.

If a FINAL email is only two paragraphs (opening + one body para), put the body in `whatHappened` and omit `whatNext` for that variant.

## Conditional sections (`when` clauses)

Use `when` on individual sections to fire shape-specific paragraphs. The four condition keys (`tenure`, `purchaseType`, `route`, `direction`) AND together. Use:
- `tenure: "freehold"` or `tenure: "leasehold"`
- `purchaseType: "cash_buyer"`, `purchaseType: "mortgage"`, `purchaseType: "cash_from_proceeds"`, or `purchaseType: { in: [...] }`
- `route: "client_portal"` or `route: { in: ["agent", "sales_progressor"] }` (the FINAL files call the second case "internal route")
- `direction: "default"` (FINAL calls this "natural order") or `direction: "inverse"`

**Disjointness rule**: within one paragraph slot (e.g. `whatHappened`), make `when` clauses mutually exclusive so at most one fires per shape. The assembler doesn't enforce this — if two sections both match, both render and the body reads as if duplicated. Common pattern: one section gated `tenure: "freehold"` and another gated `tenure: "leasehold"` covers the full tenure axis.

## Bilateral milestones

The five bilateral pairs are VM7/PM7, PM14/VM10, VM12/PM15, PM17/VM13, VM15/PM18 (see `lib/email-skeletons/journey-order.ts`).

For each bilateral milestone, the acted-side gets **four variants**:
- `direction: "default"` × `route: "client_portal"`
- `direction: "default"` × `route: { in: ["agent", "sales_progressor"] }`
- `direction: "inverse"` × `route: "client_portal"`
- `direction: "inverse"` × `route: { in: ["agent", "sales_progressor"] }`

The opposite-side (counterpart) gets **one hand-off nudge**, direction-gated:
- If the milestone is the **natural first-actor** of its pair, the counterpart hand-off is `direction: "default"` only.
- If the milestone is the **natural second-actor**, the counterpart hand-off is `direction: "inverse"` only.

Natural first-actors are listed in `HANDOFF_DEFAULT_ACTOR` in `journey-order.ts`. The natural first-actor for each pair:
- VM7 (contract pack issued) — VM7's vendor side
- VM10 / PM14 (initial enquiries) — PM14's purchaser side raises first
- VM12 / PM15 (initial replies) — VM12's vendor side issues first
- VM13 / PM17 (follow-up enquiries) — PM17's purchaser side raises first
- VM15 / PM18 (follow-up replies) — VM15's vendor side issues first

So:
- VM7.vendor = 4 acted-side variants; VM7.purchaser = default-only hand-off
- PM7.purchaser = 4 acted-side variants; PM7.vendor = inverse-only hand-off
- PM14.purchaser = 4 acted-side variants; PM14.vendor = default-only hand-off
- VM10.vendor = 4 acted-side variants; VM10.purchaser = inverse-only hand-off
- VM12.vendor = 4 acted-side variants; VM12.purchaser = default-only hand-off
- PM15.purchaser = 4 acted-side variants; PM15.vendor = inverse-only hand-off
- PM17.purchaser = 4 acted-side variants; PM17.vendor = default-only hand-off
- VM13.vendor = 4 acted-side variants; VM13.purchaser = inverse-only hand-off
- VM15.vendor = 4 acted-side variants; VM15.purchaser = default-only hand-off
- PM18.purchaser = 4 acted-side variants; PM18.vendor = inverse-only hand-off

## Inverse-direction acted-side: shortest variant

The FINAL files show the inverse-direction × internal-route variant has the *shortest* body — typically just opening + next-steps paragraph, no pack-composition / scope-explanation paragraph (the reader has already had the matter introduced via the other side's prior flow). Match this faithfully: leave `whatHappened` empty for that variant if the FINAL file has no middle paragraph there.

## Auto-suppressed phases

The send path suppresses entire milestones based on shape via `lib/milestone-auto-nr.ts`. **Do not** add `when` clauses to suppress whole milestones — that's already handled. Specifically:
- Phase 5 (PM5, PM6, PM11) — suppressed on `cash_buyer` and `cash_from_proceeds`
- Phase 7 (VM8, VM9, PM12) — suppressed on `freehold`
- PM24 — suppressed on `cash_from_proceeds`

Author copy for these as if they fire normally; the suppression layer above stops them from being sent on the wrong shapes.

## Progressor & vendorAgent variants

**Preserve unchanged.** The FINAL files only define `vendor` and `purchaser` copy. Do not touch the existing `progressor` or `vendorAgent` blocks in the current skeleton — they're internal-log copy that doesn't need rewriting.

## Verification

Per milestone, after rewriting:
1. `npx tsc --noEmit` must pass.
2. Run `npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true}' scripts/render-email-snapshot.ts`.
3. Open `docs/active/email-snapshots/{CODE}.md` and diff against the FINAL file for one representative shape.

VM1 (`lib/email-skeletons/vm1.ts`) and VM7 (`lib/email-skeletons/vm7.ts`) are the proven reference patterns. VM1 = non-bilateral, tenure + purchaseType conditionals. VM7 = bilateral, all four condition keys.
