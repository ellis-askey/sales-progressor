# New Sale Flow v2 — Phase F Redesign Plan

**Status:** Awaiting approval before any code is written
**Route:** `/agent/transactions/new-v2`
**Prerequisite:** Phase E is complete. This plan is purely additive — no Phase E behaviour is removed or broken.

---

## Overview

Phase F refines the v2 flow from functional to polished. Four sub-phases, each self-contained, each requiring sign-off before the next begins.

| Phase | What | Desktop only? | Build order |
|---|---|---|---|
| **F2** | Two-column form layout (States 2 + 3) | ≥1024px | **First — locks the structural wrapper** |
| **F1** | Hero zone redesign (State 1) | No | After F2 |
| F3 | Live preview companion panel | ≥1280px | After F1 |
| F4 | Inline Land Registry + EPC lookup | Desktop-friendly | After F3 |

> **Build order change (approved 2026-05-09):** F2 ships first because it establishes the structural wrapper that F1's hero, F3's preview panel, and F4's intel row all render inside. Landing the wrapper first means each subsequent phase slots into a known structure without being tested twice.

---

## F1 — State 1 hero redesign

### What changes

State 1 is the first thing an agent sees. Currently it's a plain drag-and-drop zone. F1 makes it feel like a product.

### Layout (full-width, no column split)

```
┌─────────────────────────────────────────────────────┐
│  [Illustration area — right side, decorative]       │
│                                                     │
│  "Open a new file"          [Social proof stats]    │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │        Drop your MOS here, or click         │   │
│  │          to upload · or take a photo        │   │
│  │                                             │   │
│  │              [drag-active state]            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Recent files tile — last 3 transactions]          │
└─────────────────────────────────────────────────────┘
```

### Components

**Illustration area**
- SVG or lottie-style illustration (house silhouette + document motif, coral on cream)
- **No external asset fetches.** Inline SVG only — no image CDN, no Replicate, no AI generation
- Purely decorative; hidden on mobile (`display: none` below 640px)
- Source the exact coral/cream values from `app/globals.css` — do not invent colours

**Social-proof stats strip**
- Three stats in a horizontal row: files opened this month, avg days to exchange, client portal logins
- Two options for data source:
  - **Option A (real data):** Server component fetches from DB in `page.tsx` — `COUNT` on transactions, `AVG` on exchange delta, `COUNT` on portal sessions this month. Passes as props.
  - **Option B (static):** Hardcoded "warm" numbers that don't require DB queries (e.g. "Files opened this week: 12")
  - **Recommendation: Option A.** The server component already fetches recommended firms and drafts; one additional query is trivial. Real numbers build trust; stale hardcoded numbers erode it.
  - **Fallback:** If DB returns null/zero for any stat, that stat is hidden (not shown as "0")

**Animated drop zone**
- Current drop zone: static dashed border
- F1: border animates to coral dashed on dragover (CSS `border-color` transition, no JS needed)
- `drag-active` class toggled in existing `HeroZone.tsx` logic (already tracks drag state for the grey overlay — reuse that)
- Subtle pulse animation on the upload icon when idle (CSS `@keyframes`, 2s loop, low amplitude)
- No animation libraries — pure CSS

**Recent files tile**
- Three most recent transactions for this agency, sorted by `createdAt DESC`
- Server-fetched in `page.tsx` alongside existing recommended firms query
- Each tile: address (truncated to 40 chars) + status badge (colour-coded) + "Open →" link
- Click navigates to `/agent/transactions/[id]`
- Hidden if agency has zero transactions (first visit)
- Mobile: stacks below the drop zone (already full-width)

**"Prefer to fill in manually" link**
- Already exists; F1 positions it below the hero zone, centered, unchanged behaviour

### What does NOT change in F1

- `HeroZone.tsx` internal logic (file handling, HEIC guard, camera capture, 10MB limit) — untouched
- `MemoStatusBar.tsx` — untouched
- All State 2 / State 3 / extracted form code — untouched

### Files changed (F1)

| File | Change |
|---|---|
| `app/agent/transactions/new-v2/page.tsx` | Add DB queries for stats + recent files; pass as props |
| `components/transactions-v2/HeroZone.tsx` | Illustration slot, stats strip, animated border, recent tiles |
| `app/agent/styles/agent-system.css` | New keyframe + drag-active border animation |

---

## F2 — Two-column form layout

### What changes

Once the agent moves past the hero (State 2 "extracting" or State 3 "extracted"/"manual"), the form currently renders full-width. F2 introduces a two-column layout on desktop: left column is the form, right column is empty in F2 (reserved for F3's preview panel).

### Breakpoint

- **≥1024px:** two-column grid (60% form / 40% right)
- **<1024px:** single column, unchanged from current behaviour (Phase E mobile layout)

### Stage gate behaviour

The Phase E flow has a stage gate: Stage 1 fields always visible, Stage 2 reveals on Continue. **F2 removes the stage gate in the extracted path only.**

| Path | Stage gate in F2? |
|---|---|
| **MOS-extracted path (State 3 = "extracted")** | No gate — all sections visible immediately. MOS parsed all the data; there's nothing to gate. |
| **Manual path (flowState = "manual")** | Gate preserved — Stage 1 → Continue → Stage 2. Manual entry without data still benefits from the progressive reveal. |

This is the cleanest UX split: if we have data, show it all; if we're asking the agent to type, keep the gate.

### Layout structure

```
New sale flow wrapper (≥1024px):
┌──────────────────────────────────────────────────┐
│  ← Back   "Open a new file"                       │
├───────────────────────┬──────────────────────────┤
│  FORM COLUMN (60%)    │  RIGHT COLUMN (40%)       │
│                       │  (empty in F2,            │
│  Stage1Fields         │   F3 panel goes here)     │
│  ─────────────────    │                           │
│  Stage2Sections       │                           │
│  (no gate on extract) │                           │
│                       │                           │
│  Submit + Draft btns  │                           │
└───────────────────────┴──────────────────────────┘
```

### How this interacts with existing components

- `NewSaleFlow.tsx` gets a wrapper div with class `new-sale-two-col` (CSS Grid: `grid-template-columns: 3fr 2fr`)
- The form content (existing JSX) moves into a `<div className="new-sale-form-col">` — no internal restructuring
- A new `<div className="new-sale-right-col">` sits adjacent — empty in F2, receives F3 content as a child
- `Stage2Sections.tsx` receives a new boolean prop `gated?: boolean` (defaults `true` for manual, `false` for extracted)
  - When `gated = false`, it renders all sections immediately with no Continue button

### What does NOT change in F2

- All Stage 1 validity logic — used in manual path
- All form field components internals
- Mobile layout — unchanged
- `DraftPanel` (fixed position, sits outside the grid flow)
- `DuplicateAddressModal` (portal, outside the grid flow)

### Files changed (F2)

| File | Change |
|---|---|
| `components/transactions-v2/NewSaleFlow.tsx` | Wrap in two-col grid; pass `gated={false}` on extracted path |
| `components/transactions-v2/form/Stage2Sections.tsx` | Accept `gated?: boolean`; skip Continue gate when false |
| `app/agent/styles/agent-system.css` | `.new-sale-two-col`, `.new-sale-form-col`, `.new-sale-right-col` grid classes |

---

## F3 — Live preview companion panel

### What changes

The right column (F2) gets a sticky companion panel that shows a formatted preview of the transaction as the agent fills in the form. Think "preview of what's being created" — not a document viewer, more like a summary card.

### Breakpoint

- **≥1280px:** right panel visible
- **<1280px:** right panel hidden (`display: none`); the grid collapses to full-width at this breakpoint too

### Panel content

The panel reflects live form state. It updates as the agent types — no submit required.

```
┌─────────────────────────────┐
│  NEW TRANSACTION PREVIEW    │
│                             │
│  123 Main Street            │ ← address
│  London, SW1A 1AA           │
│                             │
│  Freehold · Residential     │ ← tenure + purchaseType
│  £425,000                   │ ← purchase price
│                             │
│  VENDORS                    │
│  John Smith                 │ ← vendor contacts
│  jane@example.com           │
│                             │
│  PURCHASERS                 │
│  Alice Jones                │
│                             │
│  Seller's solicitor         │
│  Smith & Co Solicitors      │
│                             │
│  Buyer's solicitor          │
│  Jones LLP                  │
│                             │
│  Agent fee: £2,125 + VAT    │ ← computed from fee fields │
└─────────────────────────────┘
```

Empty fields are omitted (not shown as "—"). Panel has a "card not yet ready" state when address is blank.

### State ownership

**All state stays in `NewSaleFlow.tsx`.** The preview panel is a pure read component:

```typescript
function TransactionPreview({ fields, flowState }: { fields: FormFields; flowState: FlowState }) {
  // pure render — no state, no effects
}
```

No state lifting needed — `FormFields` is already at `NewSaleFlow` level.

### Agent fee computation

The panel computes the displayed fee from `formFields`:
```typescript
// Inside TransactionPreview or a small helper:
function computedFee(fields: FormFields): string | null {
  if (!fields.agentFee || !fields.purchasePrice) return null;
  if (fields.agentFeeType === "fixed") return formatCurrency(fields.agentFee);
  if (fields.agentFeeType === "percent") {
    const amount = (parseFloat(fields.agentFee) / 100) * parseFloat(fields.purchasePrice.replace(/[^0-9.]/g, ""));
    return isNaN(amount) ? null : formatCurrency(amount) + (fields.agentFeeVat ? " + VAT" : "");
  }
  return null;
}
```

### Visual style

- Sticky within the right column (`position: sticky; top: 24px`)
- Glass card (same `glass-card-sm` or inline equivalent from `docs/VISUAL_DIRECTION.md`)
- Section headings: 10px uppercase, `rgba(15,23,42,0.45)`, letter-spacing
- Values: 14px, `rgba(15,23,42,0.85)`
- Coral left border strip (3px) — visual signal this is a preview, not a form field
- No animations — it's a reference panel, not a hero

### What does NOT change in F3

- Form field components — no wiring changes
- Submission logic
- Mobile layout

### Files changed (F3)

| File | Change |
|---|---|
| `components/transactions-v2/NewSaleFlow.tsx` | Import + render `<TransactionPreview>` in the right column div |
| `components/transactions-v2/TransactionPreview.tsx` | New pure component |
| `app/agent/styles/agent-system.css` | Breakpoint rule: hide right col + collapse grid below 1280px |

---

## F4 — Inline Land Registry + EPC lookup

### What changes

When the agent has typed enough of an address (specifically: a valid UK postcode extracted from the address field), the right-column panel gains a section below the preview showing:
- Last sold price (from Land Registry SPARQL — already built)
- EPC rating (from EPC Register — already built)

This is read-only contextual data. It helps the agent sanity-check the purchase price against recent comparable sales.

### Existing infrastructure

`lib/services/property-intel.ts` already contains:
- `fetchPricePaid(postcode, paon?)` — Land Registry SPARQL, returns `PricePaidEntry[]`
- `fetchEpc(postcode, paon?)` — EPC Register, returns `EpcData | null`
- `extractPostcode(address)` — regex extractor
- `extractPaon(address)` — building number/name extractor

The existing `/api/property-intel` route requires a `transactionId` (post-creation). **This cannot be used pre-submission.** F4 needs a new route.

### New API route

`/api/property-intel-lookup` — GET, accepts `address` query param.

```typescript
// app/api/property-intel-lookup/route.ts
// Auth required (session check), no agencyId scoping needed (public registry data)
// Params: ?address=<URL-encoded full address>
// Calls: extractPostcode(address), extractPaon(address), fetchPricePaid, fetchEpc
// Returns: { pricePaid: PricePaidEntry[], epc: EpcData | null }
// On any fetch failure: returns { pricePaid: [], epc: null } — never 5xx
```

This route calls the same library functions as the existing route — no new external API calls. The only difference is input (address string → parse → lookup) vs (transactionId → DB read → lookup).

Auth: standard `getServerSession` check. No `agencyId` filter — Land Registry data is public.

### Client-side behaviour

- Debounce: 800ms after the address field stops changing
- Trigger condition: `isValidUKPostcode(extractPostcode(addressField))` must return true
- Results render in the right-column panel below the transaction preview
- Loading state: small spinner in the property intel section only — form is unaffected
- Silent failure: if the lookup returns empty/null, the section hides entirely (no error shown)
- No retry logic — if it fails, it fails silently; this is supplementary data

### Display in the panel

```
─────────────────────────────
PROPERTY INTEL
SW1A 1AA

Last sold: £385,000 (Mar 2024)
          £340,000 (Nov 2021)

EPC rating: C (72)
Potential:  B (82)
─────────────────────────────
```

- Max 2 price paid entries shown (most recent)
- Formatted as `£XXX,XXX (Mon YYYY)`
- EPC: letter rating + score, potential letter + score
- "Powered by Land Registry + EPC Register" in 10px grey — legally appropriate attribution

### Hook location

A new hook `usePropertyIntel(address: string)` in `components/transactions-v2/usePropertyIntel.ts`:

```typescript
function usePropertyIntel(address: string) {
  const [data, setData] = useState<{ pricePaid: PricePaidEntry[]; epc: EpcData | null } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // debounce 800ms
    // check isValidUKPostcode(extractPostcode(address))
    // if valid: fetch /api/property-intel-lookup?address=...
    // setData on success, no-op on error
  }, [address]);

  return { data, loading };
}
```

`NewSaleFlow.tsx` calls this hook with `formFields.address` and passes result to `TransactionPreview`.

### Files changed (F4)

| File | Change |
|---|---|
| `app/api/property-intel-lookup/route.ts` | New route — accepts address param, calls existing lib functions |
| `components/transactions-v2/usePropertyIntel.ts` | New hook — debounced fetch, silent fail |
| `components/transactions-v2/TransactionPreview.tsx` | Add property intel section at bottom of panel |
| `components/transactions-v2/NewSaleFlow.tsx` | Call hook; pass intel data to preview |

---

## Open questions (decisions needed before build)

### F1

1. **Stats: real DB data or static?** Recommendation: real data (Option A). If Ellis disagrees, static is faster.
2. **Illustration style:** Is an inline SVG acceptable, or does Ellis want to commission or provide a specific asset? If no asset is available, F1 ships without an illustration.
3. **Recent files tile:** Show for all agents (any transaction for the agency) or only transactions owned by the logged-in agent? Recommendation: agency-wide (shows all agency files), since this is a "recent activity" panel, not a personal task list.

### F2

4. **Stage gate removal for extracted path:** Confirmed in the locked decisions. Any objection?
5. **Grid ratio (60/40 vs 50/50):** 60/40 proposed (form gets more space). Would Ellis prefer 50/50 for symmetry?

### F3

6. **Preview panel position:** Right column proposed (form on left, preview on right). Alternative: left column (preview on left, form on right — less common but mirrors some document editors). Recommendation: right.
7. **Agent fee computation in preview:** If the fee field uses a percentage, the preview panel needs the purchase price to compute it. This is a derived value — fine to compute in the pure component. Any concern?

### F4

8. **Attribution requirement:** "Powered by Land Registry + EPC Register" is standard practice. Is this the right attribution text, or should it link to the data sources?
9. **EPC lookup authentication:** `lib/services/property-intel.ts` uses `EPC_API_EMAIL` + `EPC_API_KEY` env vars. If these aren't set, `fetchEpc` returns null — the F4 section just hides silently. This is acceptable as a first ship; EPC is supplementary. Confirmed acceptable?

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| F3 preview panel adds perceived latency (agents think they need to wait for it) | Low | Panel is purely read — no blocking, renders instantly with available data |
| F4 Land Registry SPARQL times out | Medium | 800ms debounce + silent failure means it never blocks form submission |
| F2 stage gate removal (extracted path) breaks existing milestone auto-confirm | None | Stage gate is purely UI; server action wiring is unchanged |
| Illustration SVG increases bundle size | Low | Inline SVG, no external dependency |
| Recent files tile in F1 leaks cross-agency data | None if implemented correctly | Query must filter by `agencyId` from session — same pattern as all other agent queries |

---

## Build order and sign-off gates

```
F1 → [Ellis review] → F2 → [Ellis review] → F3 → [Ellis review] → F4 → [Ellis review]
```

Each phase: code shipped, `tsc` clean, smoke tested on local dev before sign-off requested.

Phase F does not touch `NewTransactionForm.tsx` or `/agent/transactions/new` (old form). All work is on v2 path only.
