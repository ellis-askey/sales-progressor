# NEW_SALE_FLOW_BUILD_PLAN.md

**Commissioned:** 2026-05-09  
**Status:** Awaiting sign-off before Phase B commences  
**Spec reference:** `docs/done/new-sale-flow-v2/spec.md`  
**Safety invariant:** The existing `/agent/transactions/new` route and `NewTransactionForm.tsx` remain fully functional and untouched throughout every phase of this build.

---

## 0. Audit findings

Before any phase breakdown, here is what the audit found. These findings inform every architectural decision below.

### 0.1 Existing form

| Item | Detail |
|---|---|
| Route | `app/agent/transactions/new/page.tsx` — 127 lines, server component |
| Form component | `components/transactions/NewTransactionForm.tsx` — **1,723 lines**, single client component |
| State hooks | 37 `useState` hooks, all inlined in one file |
| Draft panel | `DraftFloatingPanel` — inner component defined inside the same file |
| Memo upload banner | `MemoUploadBanner` — inner component, same file |
| Overlay | `CreatingOverlay` — inner component, same file |

The existing form is a monolith. All state, all sub-UIs, all handlers live in one file. The new flow will not touch this file — it is the permanent fallback.

### 0.2 Memo parse API

`app/api/agent/memo-parse/route.ts` — 105 lines. POST only. Returns a **single JSON blob** when Claude finishes; there is no streaming. The field-ticking UI in the spec must be simulated client-side: animate the checklist sequentially once the full response arrives. The API is used as-is — no changes to it in this build.

Response shape (directly usable):
```typescript
{
  streetAddress: string | null;
  city: string | null;
  postcode: string | null;
  purchasePricePence: number | null;
  tenure: "freehold" | "leasehold" | null;
  vendors: { name: string; phone?: string; email?: string }[];
  purchasers: { name: string; phone?: string; email?: string }[];
  vendorSolicitor: { firm?: string; name?: string; phone?: string; email?: string } | null;
  purchaserSolicitor: { firm?: string; name?: string; phone?: string; email?: string } | null;
  // storage fields appended server-side:
  mosStoragePath?: string;
  mosFileSize?: number;
  mosMimeType?: string;
  mosFilename?: string;
}
```

### 0.3 createTransactionAction

`app/actions/transactions.ts`. The action signature is stable and covers everything the new flow needs — including `forceCreate`, MOS fields, chain stubs, and contacts. No changes required.

### 0.4 Draft actions

`saveDraftAction` and `discardDraftAction` in `app/actions/transactions.ts`. The draft schema (`PropertyTransaction` with `status: "draft"`) is stable. The new flow uses the same actions. The page.tsx server component already queries and normalises drafts before passing them as props — the new route page does the same.

### 0.5 Solicitor auto-fill

The existing `autoFillSolicitor()` function (lines ~850–1000 of `NewTransactionForm.tsx`) searches for existing firms/handlers and creates them if absent. This is 150+ lines of inline logic. It is **not extracted** to a shared utility — it lives only inside the existing monolith. The new flow needs this capability.

Decision: **Extract to `lib/utils/solicitor-autofill.ts`** during Phase B. This is the one case where Phase B touches a non-new-flow file, but extraction is strictly additive (the existing form keeps importing the same inline version — the new utility is separate). After full cutover, the inline version in the old form can be deleted.

Actually, simpler: duplicate the logic into the new flow's component during Phase B. It is self-contained and touches no external state. Extraction to a shared util is Phase E cleanup, not a Phase B prerequisite. **Judgment call: duplicate in Phase B, extract in Phase E.** This keeps the new flow's development isolated.

### 0.6 Shared components (import directly — no changes)

| Component | Import path | Notes |
|---|---|---|
| `PriceInput` | `@/components/ui/PriceInput` | Pence-based, `size="sm"` used everywhere |
| `SolicitorPicker` | `@/components/solicitors/SolicitorPicker` | Full search/create/handler flow built in |
| `AddFirmModal` | `@/components/solicitors/AddFirmModal` | Invoked by `SolicitorPicker` internally — no direct import needed |
| `createTransactionAction` | `@/app/actions/transactions` | Stable API, no changes |
| `saveDraftAction` | `@/app/actions/transactions` | Stable API |
| `discardDraftAction` | `@/app/actions/transactions` | Stable API |

### 0.7 Things to extract (new shared utilities)

| Utility | Destination | Consumed by |
|---|---|---|
| UK postcode regex + validation | `lib/utils/address.ts` | `parseAddress()` already in `EditSaleDetailsDrawer` uses a local copy; the new flow makes it a third copy. Extract in Phase E. Duplicate in Phase B. |
| Contact "phone or email required" validation | Inline in new flow components | Simple enough not to need extraction |
| Duplicate address modal | `components/transactions-v2/DuplicateAddressModal.tsx` | New flow only. The existing modal is baked into `NewTransactionForm.tsx` — not extracted. |

### 0.8 Sidebar link (feature flag target)

`components/layout/AgentShell.tsx`. The `+ New sale` button is a `<Link href="/agent/transactions/new">` rendered unconditionally. The feature flag controls which href this Link renders.

---

## 1. Feature flag mechanism

**Recommendation: `NEXT_PUBLIC_NEW_SALE_V2` env var.**

```
NEXT_PUBLIC_NEW_SALE_V2=true
```

**Why this over the alternatives:**

| Option | Verdict |
|---|---|
| `NEXT_PUBLIC_*` env var | ✓ Zero DB migration. Instant per-environment toggle via Vercel dashboard. Embedded at build time — no runtime overhead. |
| User-level DB field | ✗ Requires schema migration. Overkill for a feature still in active development. Use for gradual rollout *after* the feature is stable, if needed. |
| Cookie / query param | ✓ Good for ad-hoc testing alongside the env var, not as the primary mechanism. |

**How it works:**

`AgentShell.tsx` reads `process.env.NEXT_PUBLIC_NEW_SALE_V2` and conditionally renders the link:

```tsx
const newSaleHref = process.env.NEXT_PUBLIC_NEW_SALE_V2 === "true"
  ? "/agent/transactions/new-v2"
  : "/agent/transactions/new";
```

The new route `/agent/transactions/new-v2` is always accessible by direct URL — this lets you test in production without enabling for all agents. The flag only controls where the sidebar button points.

**Production rollout sequence:**
1. Build ships with flag off. New route exists but sidebar points to old form.
2. Internal testing: navigate to `/agent/transactions/new-v2` directly.
3. Flag flips to `true` in staging → test with real Vercel preview.
4. Flag flips to `true` in production → new flow is default for all agencies.
5. Old form remains at `/agent/transactions/new` for a burn-in period (4–6 weeks of zero reported issues).
6. Old form deleted in a final cleanup PR.

---

## 2. Component architecture

### 2.1 Directory structure

```
app/
  agent/
    transactions/
      new/               ← EXISTING — do not touch
        page.tsx
      new-v2/            ← NEW ROUTE
        page.tsx

components/
  transactions-v2/       ← ALL new-flow UI lives here
    NewSaleFlow.tsx          — orchestrating client component
    hero/
      HeroZone.tsx           — State 1: drop zone
      MemoStatusBar.tsx      — State 2: status bar + field tick list
    form/
      Stage1Fields.tsx       — Stage 1: address + tenure + type + who
      Stage2Sections.tsx     — Stage 2: full form reveal
      ContactsSection.tsx    — Vendor + Purchaser two-column rows
      SolicitorSection.tsx   — Solicitor picker pair
      PriceFeesSection.tsx   — Price & fees collapsible
      NotesSection.tsx       — Notes collapsible
      ChainSection.tsx       — Chain collapsible
      SectionAccordion.tsx   — Shared collapse/expand wrapper
    DuplicateAddressModal.tsx — Duplicate guard modal
    DraftPanel.tsx            — Floating draft list (bottom-left)

lib/
  utils/
    address.ts            ← NEW (Phase E) — postcode regex, parseAddress
    (existing files untouched)
```

### 2.2 State machine

`NewSaleFlow.tsx` is the orchestrator. It owns one top-level state: `flowState: "hero" | "extracting" | "extracted" | "manual"`.

```
hero        → user drops a file         → extracting
extracting  → API responds (ok)         → extracted  (State 2)
extracting  → API responds (fail)       → manual     (State 3, pre-filled with whatever came back)
extracted   → user clicks "Change file" → hero       (with reset confirmation if fields edited)
hero        → user clicks "Fill manually" → manual   (State 3, blank)
manual      → always stays manual
```

Within `manual` and `extracted`, a second state drives the two-stage form reveal: `stage: 1 | 2`. `stage` advances to `2` when the user clicks "Continue" from Stage 1.

**State management approach:** Two or three `useState` hooks at the orchestrator level (`flowState`, `stage`, `extractedData`). Form field state lives in `Stage1Fields` and `Stage2Sections` and is lifted to `NewSaleFlow.tsx` via callbacks — same pattern as the existing form but distributed across components rather than one 1,700-line monolith.

### 2.3 Form state shape (lifted to NewSaleFlow.tsx)

```typescript
// Stage 1 (always needed)
streetAddress, city, postcode, tenure, purchaseType, progressedBy

// Stage 2
vendors[], purchasers[]                    // up to 4 each
vendorSolicitor, purchaserSolicitor        // SolicitorSelection | null
purchasePrice, agentFeeType, agentFeeAmount, agentFeePercentStr, agentFeeVat
referredFirmId, referralFee
notes
chainStubs[], sendChainInvites

// MOS metadata (from extraction)
mosStoragePath, mosFileSize, mosMimeType, mosFilename
memoFields: Set<string>                    // which fields were AI-extracted
```

---

## 3. Sub-phase breakdown

### Phase A — Audit + skeleton + feature flag (CURRENT)
**Deliverable:** `docs/done/new-sale-flow-v2/build-plan.md` (this document) + skeleton files committed.

Code shipped in Phase A:
- `app/agent/transactions/new-v2/page.tsx` — server page shell (copies data-fetching pattern from existing page; renders `<NewSaleFlow />` placeholder)
- `components/transactions-v2/NewSaleFlow.tsx` — placeholder client component that renders "Phase B in progress"
- Feature flag wired in `AgentShell.tsx` — conditional href based on `NEXT_PUBLIC_NEW_SALE_V2`
- `NEXT_PUBLIC_NEW_SALE_V2` added to `.env.example` and `docs/active/ELLIS_MANUAL_TODO.md`

No UI visible to agents (flag off by default). The route is accessible by direct URL for local testing.

**Sign-off gate:** Build plan reviewed and approved.

---

### Phase B — State 1: Hero zone + MOS upload end-to-end
**Goal:** The drop zone works. Drag-drop or click to upload. API call fires. In-progress UI animates. Result arrives and is stored in component state. No State 2 transformation yet — print the raw extraction result to a debug panel so we can verify extraction is working.

**Components built:**
- `HeroZone.tsx` — drag/drop zone, click-to-upload, drag-over highlight (coral border, icon scale, copy change), mobile `capture="environment"` input
- `MemoStatusBar.tsx` — collapses hero zone, shows "Reading your memo…" with animated field-tick list (sequential reveal simulation — see §4.2 below), then "✓ Memo read — N of M fields filled"
- Status: `flowState` transitions `hero → extracting → extracted`

**API integration:**
- POST to `/api/agent/memo-parse` with the file
- Store `extractedData` in state
- On failure: transition to `manual` state with whatever partial data came back (per locked decision: partial extraction always pre-fills)

**Phase B also includes:**
- **15-second slow-extraction escape**: Status bar shows an additional text link "Taking longer than expected — cancel and fill manually?" after 15s. Clicking it aborts the in-flight request (`AbortController`), returns to State 1 (hero zone), no extraction data retained. This is part of the upload UX, not Phase E polish.

**Not in Phase B:**
- The actual form (Stage 1 / Stage 2) — those are Phase D
- Green tick indicators per field — Phase C
- "Change file" confirmation flow — Phase C
- Solicitor auto-fill on extraction — Phase C

**Sign-off gate:** Upload a real PDF memo. Watch field ticking animate. Inspect state to confirm extraction data.

---

### Phase C — State 2: Post-extraction form transformation
**Goal:** After extraction, the form expands below the status bar. Every extracted field is pre-filled and marked with a green tick. Fields the AI couldn't read are flagged per the field expectation matrix in the spec. "Change file" link appears in the status bar.

**Components built / modified:**
- `MemoStatusBar.tsx` — add "Change file" link + reset confirmation modal (if any Stage 1 or Stage 2 fields have been manually edited since extraction)
- Field indicator layer — each form field receives a prop `memoSource: "extracted" | "not_on_memos" | "extraction_failed" | null` which drives the small indicator beneath its label
- State 2 form reveal — `Stage1Fields` + `Stage2Sections` expand below the status bar (same components as Phase D, re-used here)
- Populate Stage 1 + Stage 2 state from `extractedData`
- Partial failure path: if `flowState` = `manual` and `extractedData` is non-null (partial extraction), pre-fill what we have and skip to Stage 3 manual form

**Field expectation matrix** (governs indicator copy):

| Field | On memos? | If AI returned null | If AI returned value |
|---|---|---|---|
| Street address | Usually | "We couldn't read this — please add" (amber) | Green tick |
| City | Usually | "We couldn't read this — please add" (amber) | Green tick |
| Postcode | Usually | "We couldn't read this — please add" (amber) | Green tick |
| Purchase price | Usually | "We couldn't read this — please add" (amber) | Green tick |
| Tenure | Usually — category A | "We couldn't read this — please add" (amber) | Green tick |
| Purchase type | Never | "Not on memos — please complete" (muted) | — |
| Vendor name/contact | Usually | "We couldn't read this — please add" (amber) | Green tick |
| Purchaser name/contact | Usually | "We couldn't read this — please add" (amber) | Green tick |
| Vendor solicitor | Usually | "We couldn't read this — please add" (amber) | Green tick |
| Purchaser solicitor | Usually | "We couldn't read this — please add" (amber) | Green tick |
| Agent fee | Never | "Not on memos — still needed" (muted) | — |
| Who progresses | N/A | Default shown, no indicator | — |

**Sign-off gate:** Upload a real memo. Form expands with pre-filled fields and correct indicators. "Change file" navigates back to State 1 with confirmation when fields are dirty.

---

### Phase D — State 3: Manual two-stage form
**Goal:** The full manual path. Stage 1 → Continue → Stage 2 reveal. All sections built. Outsourced validation. State entirely driven from `NewSaleFlow.tsx`.

**Components built:**
- `Stage1Fields.tsx` — address trio (street, city, postcode) + tenure pill picker + purchase type pill picker + who progresses pill picker + Continue button with validation gate
- `Stage2Sections.tsx` — orchestrates section order: Vendors/Purchasers, Solicitors, Price & Fees, Notes, Chain
- `ContactsSection.tsx` — two-column Vendors + Purchasers layout (desktop), stacked (mobile). Each side: up to 4 rows (Name, Phone, Email), "Add another" link below, section label with asterisk if outsourced
- `SolicitorSection.tsx` — two `SolicitorPicker` instances (vendor + purchaser), expanded by default
- `PriceFeesSection.tsx` — `PriceInput` + fee type pills + VAT toggle + referral section, collapsed by default
- `NotesSection.tsx` — single textarea, collapsed
- `ChainSection.tsx` — chain stub list + invite toggle (copy from existing form), collapsed
- `SectionAccordion.tsx` — shared collapse/expand wrapper with summary chip when collapsed and has data
- Stage 1 → Stage 2 animation: `Stage2Sections` renders with `opacity: 0; transform: translateY(16px)` → `opacity: 1; transform: translateY(0)` on mount, sections stagger by 80ms each using `animation-delay`

**Solicitor auto-fill (memo path via State 2):**
Copy the `autoFillSolicitor()` logic from `NewTransactionForm.tsx` into `SolicitorSection.tsx` for the new flow. No extraction — verbatim copy + type-check. Phase E extracts it to a shared util.

**Outsourced validation:**
If `progressedBy === "progressor"`: at least one vendor with name + (phone or email), at least one purchaser with name + (phone or email). Validation fires on "Create transaction" submit, not on Continue. Inline error appears below the relevant section label.

**Continue button logic:**
Stage 1 valid when: `streetAddress.trim()` non-empty, `tenure` set, `purchaseType` set, `progressedBy` set. Button visible only when valid (per spec). Clicking advances `stage` to 2 and scrolls to Stage 2.

**Sign-off gate:** Full manual flow: 4 fields → Continue → Stage 2 → create transaction → redirect to file. Outsourced path: attempt submit without contacts → inline error.

---

### Phase E — Submission + draft system + polish + cutover
**Goal:** Both paths (MOS and manual) submit via `createTransactionAction`. Draft save/load works. Mobile is tested. Utility extraction done. Feature flag enabled for testing, then production cutover.

**Work items:**
1. **Submission wiring** — connect "Create transaction" button to `createTransactionAction`. Handle `DUPLICATE_ADDRESS` error → show `DuplicateAddressModal`. Handle success → redirect. Handle server error → toast.
2. **Draft system** — `DraftPanel.tsx` (floating bottom-left), `saveDraftAction` on address blur / memo upload, `discardDraftAction` on delete. Navigation guard (`beforeunload` or Next.js route change interceptor) if form is dirty and no draft saved.
3. **MOS auto-confirm** — the action already handles this (`mosUploaded: true` completes VM2 + PM2). Just pass the flag correctly.
4. **Mobile polish** — test `capture="environment"` on iOS + Android. HEIC format guard (reject before upload with clear error). Two-column → single-column stack verified on 375px viewport.
5. **Utility extraction** — move postcode regex to `lib/utils/address.ts`. Move `autoFillSolicitor` to `lib/utils/solicitor-autofill.ts` (imported by both old and new flow — or just new flow after old is deleted).
6. **Drawertest page** — add `NewSaleFlow` stub entry if useful for testing themes.
7. **Draft load auto-advance**: When a draft is loaded and all four Stage 1 fields (street address, tenure, purchase type, progressedBy) are valid, auto-advance to Stage 2 on load — skip the Continue click. The agent's mental model is "I left off in vendors," not "I left off at Stage 1."
8. **autoFillSolicitor drift check**: Before extracting the duplicated logic to a shared util, diff it against the original copy in `NewTransactionForm.tsx`. Drift over Phases B–D is possible; worth a 5-minute check before extraction.
9. **Feature flag cutover** — set `NEXT_PUBLIC_NEW_SALE_V2=true` in Vercel staging → smoke test → production. Old form remains at `/agent/transactions/new`.
8. **Old form deletion** (separate PR, after burn-in) — delete `NewTransactionForm.tsx`, the old route's page.tsx, and clean up the flag conditional in `AgentShell.tsx`.

**Sign-off gate:** End-to-end on a real transaction: memo upload → created file with VM2/PM2 confirmed. Manual path → created file. Draft save → navigate away → resume → submit. Mobile: camera tap opens rear camera, photo uploads, extracts.

---

## 4. Design and implementation notes

### 4.1 State 1 → State 2 transition

The hero zone doesn't "fly away" — it **collapses** into the `MemoStatusBar`. Implementation:
- `HeroZone` renders at full height initially (`min-height: 360px` per spec)
- On file drop, `flowState` moves to `extracting`
- `HeroZone` unmounts (or `display: none`)
- `MemoStatusBar` mounts with `"Reading your memo…"`
- The form below is not yet mounted
- When extraction resolves: `flowState` moves to `extracted`; the form mounts with a stagger-in animation

### 4.2 Field-ticking simulation

The API returns one blob. To make the tick list feel alive during the 2-5 second wait:

```
On file drop: start the API call.
Simultaneously: start a tick animation that cycles through the field names
  at ~400ms per field.
When the API resolves: stop the animation, show real results.
  Any field the API returned a value for gets ✓.
  Any field that returned null gets the appropriate indicator.
"N of M fields filled" — N = fields with non-null values, M = total expected.
```

This is pure cosmetic choreography. The data is real; only the progressive reveal is simulated.

### 4.3 "Change file" confirmation

In State 2, `MemoStatusBar` shows a "Change file" text link. Clicking it:
- If no Stage 1 or Stage 2 fields have been manually edited since extraction: immediately return to State 1 (hero zone) and clear `extractedData`.
- If any fields have been manually edited: show a small inline confirmation: "Changing the memo will reset your edits. [Continue] [Cancel]".

Detection of "manually edited": track `manuallyEditedFields: Set<string>` in `NewSaleFlow.tsx`. Any `onChange` on a pre-filled field that differs from the extracted value adds that field to the set.

### 4.4 Stage 1 → Stage 2 reveal

```tsx
{stage === 2 && (
  <div style={{ animation: "stage2-reveal 400ms ease-out both" }}>
    <Stage2Sections ... />
  </div>
)}
```

The `@keyframes stage2-reveal` is `from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); }`. Each child section inside `Stage2Sections` has its own stagger delay (0ms, 80ms, 160ms, 240ms, 320ms, 400ms).

Add the keyframe to `app/agent/styles/agent-system.css` alongside `agent-drawer-in` and `agent-modal-in`.

### 4.5 Two-column Vendors/Purchasers

```tsx
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
  <ContactsGroup side="vendor" label="Vendors" ... />
  <ContactsGroup side="purchaser" label="Purchasers" ... />
</div>
```

Mobile breakpoint (`max-width: 768px`): `gridTemplateColumns: "1fr"`. Purchasers section moves below Vendors.

### 4.6 Summary chips in collapsed sections

When a `SectionAccordion` is collapsed and has data, it renders a small chip summarising the content:
- Price & Fees: "£350,000 · 1.5% + VAT"
- Notes: "Note added"
- Chain: "2 links"
- Solicitors: "2 set"

This is purely display logic based on the form state passed as props.

### 4.7 Draft compatibility

The new flow uses `saveDraftAction` with the same input shape as the existing form. Drafts saved from the old form can be loaded into the new flow and vice versa — the data model is identical. However, note: a draft loaded into the new flow will start in `manual` mode at Stage 1 (even if it was saved from Stage 2). The address, tenure, and type fields will be populated in Stage 1; the Continue button will be immediately valid; clicking it reveals Stage 2 with the rest of the draft data.

---

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **MOS tick simulation feels fake on slow connections** | Medium | The simulation paces to match typical extraction time (400ms per field × 12 fields ≈ 5 seconds). If the API responds faster than the animation completes, cut the animation short and show the real result immediately. Never show more ticks than actually resolved. |
| **`autoFillSolicitor` duplication becomes divergent** | Low | Acceptable for Phase B-D (new flow is behind a flag). Phase E extraction before cutover prevents permanent divergence. |
| **`capture="environment"` on iOS returns HEIC** | Medium | Client-side guard: check `file.type` before upload. If HEIC detected, show inline error: "iPhone photos need to be saved as JPEG. Use the 'Files' option to find the memo instead." |
| **Stage 2 stagger animation jank on slow devices** | Low | Use CSS animations (not JS). `will-change: transform` on animated containers. Test on a mid-range Android device. |
| **Feature flag in a client component** | Low | `NEXT_PUBLIC_*` env vars are embedded at build time and available in client components — no extra wiring needed. The `AgentShell.tsx` conditional is two lines. |
| **Draft hydration state mismatch** | Low | The new flow always starts drafts in Stage 1 regardless of where they were saved. Stage 2 data is present and will reveal after Continue is clicked. This is a minor UX quirk, not a data loss risk. |
| **Postcode regex false positives on Scottish postcodes** | Low | The existing regex covers standard UK format including Scotland. Matches existing behaviour in `NewTransactionForm.tsx` and `EditSaleDetailsDrawer.tsx`. |
| **"Change file" reset confirmation edge case** | Medium | Must reliably detect manual edits vs. auto-filled values. Implementation: shallow-compare current field value against extracted value on every `onChange`. Track in a `Set`. Clear the set if extraction is re-run. |
| **Outsourced validation timing** | Low | Validation fires on submit only (not live). The error message is inline, below the section label, using the existing `agent-chain-callout` error styling. |
| **Duplicate address modal in new route** | Low | `DuplicateAddressModal` is re-implemented in `components/transactions-v2/`. The existing inline version in `NewTransactionForm.tsx` is not extracted — new flow owns its copy. After old form is deleted, there is one canonical version. |

---

## 6. Open questions — resolved 2026-05-09

1. **Stage 1 "Continue" vs. direct submit**: ✓ Locked — Continue is explicit, no direct Stage 1 submit.
2. **Draft panel visual refresh**: ✓ Resolved — use new design tokens (`glass-card`, `agent-section-label`, `agent-btn-color-primary`, themed accent line). Do not replicate old form's ad-hoc inline styling.
3. **Auto-fill solicitor on failure**: ✓ Resolved — surface with amber hint: "We found [firm name] on the memo — tap to search manually." Do not fail silently.
4. **Who progresses in the MOS path**: ✓ Confirmed — defaulted to self-progress, no extraction indicator. No flag needed.
5. **Solicitor auto-fill timing**: ✓ Resolved — Phase C, not Phase B. Phase B gate stays clean: upload, animate, verify extraction data.

---

## 7. Phase A skeleton — files to create

The following files are created in Phase A to establish the skeleton. Contents are placeholder shells.

### `app/agent/transactions/new-v2/page.tsx`

Server component. Copies the data-fetching pattern from the existing `new/page.tsx`:
- Fetch session + security
- Query `recommendedFirms`
- Query and normalise `initialDrafts`
- Render `<NewSaleFlow>` with those props

### `components/transactions-v2/NewSaleFlow.tsx`

Placeholder client component. Renders:
```tsx
<div className="glass-card p-8 text-center">
  <p className="text-slate-900/50 text-sm">New sale flow — Phase B in progress</p>
</div>
```

### `AgentShell.tsx` change

One conditional in the `+ New sale` link:
```tsx
const newSaleHref = process.env.NEXT_PUBLIC_NEW_SALE_V2 === "true"
  ? "/agent/transactions/new-v2"
  : "/agent/transactions/new";
```

### `docs/active/ELLIS_MANUAL_TODO.md` entry

Add: "Set `NEXT_PUBLIC_NEW_SALE_V2=true` in Vercel environment variables when ready to enable new sale flow for testing. Default is unset (old form)."

---

## 8. Build sequence summary

| Phase | Deliverable | Sign-off gate |
|---|---|---|
| **A** | This document + skeleton route + flag | Plan reviewed and approved |
| **B** | Working hero zone + MOS upload + field ticking | Upload a real memo, verify extraction data in state |
| **C** | State 2 form with field indicators + "Change file" | Green ticks and amber indicators correct across 3+ memo samples |
| **D** | Full manual two-stage form + outsourced validation | Complete manual transaction creation end-to-end |
| **E** | Submit wiring + drafts + mobile + cutover | Created transaction in prod with MOS auto-confirm; draft round-trip; mobile camera test |
