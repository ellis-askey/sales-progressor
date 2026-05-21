# New Sale Flow v2 — Complete Redesign Plan

**Status:** Awaiting approval before any code is written
**Route:** `/agent/transactions/new-v2` (feature flag `NEXT_PUBLIC_NEW_SALE_V2=true`)
**Supersedes:** F1/F2/F3/F4 plan in `docs/done/new-sale-flow-v2/v1-redesign-plan.md` (F2 shipped, F1 shipped and now retiring, F3/F4 cancelled)
**Safety pattern:** `/agent/transactions/new` and `NewTransactionForm.tsx` untouched throughout. All server actions, memo-parse API, draft system, and submission wiring untouched.

---

## Open questions — resolve before sub-phases begin

### OQ1 — Council tax band data source

The spec asks for council tax band in the property dossier panel. Audit finds zero existing implementation. Options:

| Option | Source | Cost | Reliability |
|---|---|---|---|
| **A — VOA portal** | `gov.uk/council-tax-bands` | Free | No API. Scraping is fragile and legally grey (ToS). Not viable. |
| **B — GetAddress.io / Ideal Postcodes** | Commercial postcode enrichment APIs | ~£0.01–0.05/lookup | Reliable, GDPR-compliant, but paid per call. Adds dependency + ops cost. |
| **C — Land Registry EPC data** | EPC certificate data includes local authority reference, not band | Free | Indirect — doesn't reliably yield the band. |
| **D — Static postcode→band lookup table** | Compiled from historical VOA bulk data | Free (one-time) | Stale by months, ~90% coverage. Not suitable for a professional tool. |
| **E — Defer for MVP** | — | £0 | Panel shows the cell as "—" with "Check with client" hint |

**Recommendation:** Defer for MVP (Option E). The dossier is supplementary data — agents already know or can ask. A stale static table is worse than a clear gap. Council tax is a natural G2+ addition once a commercial API budget is agreed.

**Decision required before G2:** Is council tax band in or out for MVP?

---

### OQ2 — Sale history mini-chart

One Land Registry SPARQL query for `fetchPricePaid(postcode, paon)` returns the full price-paid history for the property (no additional calls needed — `PricePaidEntry[]` already comes back as an array). The chart would plot these points over time.

**Cost:** Zero additional API calls. The data is already in the `pricePaid` array.
**Chart library dependency:** A minimal sparkline (no axis labels, just the trend line) can be done with an inline SVG path calculation — no Recharts needed.

**Recommendation:** Include the mini-chart in G2 using a pure-SVG sparkline. It's free data and meaningful context.

**Decision required before G2:** Include sparkline (inline SVG) or skip?

---

### OQ3 — Market pulse

"Avg days on market, YoY change" — this is not available from Land Registry (which records sold prices, not listing-to-sale durations). Sources: Rightmove/Zoopla data (no public API), third-party property data providers (Hometrack, TwentyCI — enterprise pricing).

**Recommendation:** Skip market pulse for MVP. The panel already has tenure, last sold, EPC, and (if approved) council tax. Market pulse is a future enrichment. Show a "Coming soon" placeholder or omit the row.

---

### OQ4 — Right column mode transition: dossier → file preview

Two candidate triggers:
- **A — Continue button:** Dossier transitions to File preview when Stage 2 becomes visible (Continue clicked). Simple, explicit.
- **B — Threshold:** Transition when some fraction of Stage 2 fields are filled (e.g. contacts + solicitors). More nuanced but requires computing "fill score" continuously.

**Recommendation:** Option A — Continue click as the trigger. It's the natural semantic boundary ("I've confirmed Stage 1, I'm now building the full file"). The transition is instant; no polling or scoring needed. In the extracted-path flow (no stage gate), transition to file preview immediately when extraction completes and the form reveals.

---

### OQ5 — "Milestones that will apply" preview query

`MilestoneDefinition` has no tenure/purchaseType fields. The schema is a flat list. Filtering is application logic per spec §6.1:

| Auto-NR condition | Milestone codes removed |
|---|---|
| Tenure = freehold | VM8, VM9, PM12 |
| Purchase type = cash_buyer OR cash_from_proceeds | PM5, PM6, PM11 |

**Approach:** Fetch all `MilestoneDefinition` rows server-side in `page.tsx` (static seed table, ~30 rows). Pass to `NewSaleFlow`. Client-side filter against form state (tenure + purchaseType) to compute the preview list dynamically as the agent fills in the form. No additional API call needed.

---

## What to keep from F2

- `.new-sale-two-col` CSS class and grid structure — keep as structural foundation
- `min-width: 0` on both columns
- **One change required in G1:** Update the right-column hide breakpoint from `max-width: 1024px` to `max-width: 1280px`. Below 1280px the grid collapses to a single column and the right column hides. The form takes full width at those sizes.

---

## What to retire in G1

| Item | Action |
|---|---|
| `components/transactions-v2/HeroIllustration.tsx` | Delete |
| `components/transactions-v2/StatsStrip.tsx` | Delete |
| `components/transactions-v2/RecentFilesTile.tsx` | Delete |
| `lib/services/platform-stats.ts` | Delete |
| `.hero-drop-border-ring` CSS (conic animation) | Remove from `agent-system.css` |
| `@property --hero-angle` CSS | Remove from `agent-system.css` |
| `@keyframes hero-border-rotate` | Remove from `agent-system.css` |
| `.hero-zone-row` CSS class | Remove from `agent-system.css` |
| Hero zone `maxWidth: 960` expansion | Revert to `maxWidth: 700` (or remove — new hero card is different) |
| `import` statements for deleted components in `NewSaleFlow.tsx` | Remove |
| `platformStats` and `recentFiles` props | Remove from `NewSaleFlow` Props type and `page.tsx` |

---

## Six page-level states — reference

| State | When | Left column | Right column |
|---|---|---|---|
| 1 — Empty hero | Cold landing | Conversational card | Empty research panel |
| 2 — Memo extracted | File uploaded + parsed | Extraction banner + full form | Property dossier (FROM MEMO) |
| 3 — Manual Stage 1 | "Fill in manually" clicked | Stage 1 fields + Continue gate | Empty research panel (→ dossier on lookup) |
| 4 — Outsourced | `progressedBy = progressor` selected | Outsourced banner + form | Dossier or file preview |
| 5 — Self-progress | `progressedBy = agent` selected | Portal-invite prompt + form | Dossier or file preview |
| 6 — Stage 2 | Continue clicked / extraction complete | Compact Stage 1 bar + full form | File preview (LIVE badge) |

States 4 and 5 are overlaid on top of States 2, 3, or 6 — they modify the form presentation, not replace it.

---

## Sub-phase breakdown

### G1 — Layout shell, hero card, F1 retirement

**What ships:**
- Delete F1 components + lib/services/platform-stats.ts
- Remove F1 CSS classes from agent-system.css
- Update right-column breakpoint to 1280px
- Remove `platformStats` and `recentFiles` props from NewSaleFlow + page.tsx
- New conversational hero card (State 1):
  - Small breathing AI dot above card (CSS pulse, `agent-coral-deep`)
  - "Ready to add a sale?" headline (h2, 24px semibold)
  - "Drop a memo and we'll fill the form for you." sub-copy (muted, 14px)
  - Three action buttons beneath (stacked, full-width):
    - "Drop a memo of sale" — primary gradient button, coral glow
    - "Fill in manually" — secondary glass button
    - "Resume · {address truncated to 32 chars} · {relativeTime}" — tertiary text button, only if `drafts.length > 0`; shows most recent draft
  - "View all drafts ({N})" link beneath tertiary button if `drafts.length > 1`; tapping expands inline draft list (replaces DraftPanel floating widget for State 1)
  - Hidden file input behind the "Drop a memo" button (existing drag-and-drop logic moves here)
  - The entire hero card accepts drag-over with subtle coral tint (same dragOver state as existing)
- Right column static shell: `<div className="new-sale-right-col">` renders the empty research panel (State 1 only — just the search field and "you can check" list, no data). Implemented as a placeholder component `ResearchPanel.tsx` in G1; data wired in G2.
- `tsc --noEmit` clean

**Files changed:**
- Delete: HeroIllustration.tsx, StatsStrip.tsx, RecentFilesTile.tsx, lib/services/platform-stats.ts
- Modify: agent-system.css, NewSaleFlow.tsx, page.tsx
- Create: components/transactions-v2/ResearchPanel.tsx (placeholder)

**Risks:** The file input (drag-and-drop) currently lives in `HeroZone.tsx`. The new hero card absorbs that logic. `HeroZone.tsx` can be deleted or gutted — confirm before G1 build.

---

### G2 — Right column research panel + property dossier

**What ships:**
- New API route: `GET /api/property-intel-lookup?address={encoded}` — accepts address string, no transactionId required. Calls `extractPostcode` + `extractPaon` from the existing lib, then `fetchPricePaid` + `fetchEpc`. Returns same shape as the existing route. Auth required (session check), no agencyId scoping (public registry data).
- `usePropertyIntel(address: string)` hook — debounced 800ms, triggers when `isValidUKPostcode(extractPostcode(address))` is true. Silent failure (returns null on error). Cancels in-flight requests on new address.
- `PropertyDossier.tsx` component — renders within right column when data available:
  - Address pill (postcode extracted)
  - 2×2 grid:
    - **Last sold** — price + date (from `pricePaid[0]`), formatted as "£285,000 · Mar 2024"
    - **EPC rating** — letter + score ("C · 72"), potential in muted below ("B · 82 potential")
    - **Council tax** — "–" with "Check with client" hint (MVP; see OQ1)
    - **Tenure** — from Land Registry (if `pricePaid[0]?.propertyType` available) with cross-reference treatment (see below)
  - Sale history sparkline (if ≥2 price-paid entries): inline SVG path, 120px wide × 40px tall, coral stroke on transparent background. X-axis = sale date, Y-axis = price. No labels — just the trend shape.
  - Source attribution: "Source: HM Land Registry · EPC Register" in 10px muted text, bottom of panel
  - "FROM MEMO" badge on panel header when data sourced from extraction (not manual lookup)
- Tenure cross-reference: when Land Registry `propertyType` (T/S/D/F = terraced/semi/detached/flat) implies leasehold (flats) or when there's explicit Land Registry tenure data that differs from or fills a gap in the form's selected tenure:
  - Green-bordered card: "Land Registry shows: Leasehold · Use this →" button that writes the value into `formFields.tenure`
  - Only appears when there's a meaningful discrepancy or gap
- Panel mode transitions:
  - State 1 (cold): empty research panel (static checklist)
  - Address field gains valid postcode (extracted or typed): panel switches to dossier (loads via hook)
  - Stage 2 visible (Continue clicked or extraction complete): panel switches to file preview (G7)
- `milestoneDefinitions` fetched server-side in page.tsx and passed as prop — needed by G7 but fetched here to avoid a second round-trip later

**Files changed:**
- Create: app/api/property-intel-lookup/route.ts
- Create: components/transactions-v2/usePropertyIntel.ts
- Create: components/transactions-v2/PropertyDossier.tsx
- Modify: components/transactions-v2/NewSaleFlow.tsx (right column wiring)
- Modify: components/transactions-v2/ResearchPanel.tsx (now receives data from hook)
- Modify: app/agent/transactions/new-v2/page.tsx (add milestone definitions fetch)

**Open question dependencies:** OQ1 (council tax), OQ2 (sparkline), OQ3 (market pulse). Sparkline included by default (free data). Council tax deferred (placeholder cell). Market pulse omitted.

---

### G3 — Form layout reshape

**What ships:**
- **Extraction banner** (State 2 only): replaces `MemoStatusBar` "done" state. Green-bordered card at top of left column: "Memo read — 8 of 10 fields filled · mos-filename.pdf · Change file". Field count computed server-side in the memo-parse response (count non-null extracted fields). "Change file" links to existing `ChangeFileModal`.
- **Compact Stage 1 summary bar** (Stage 6 — after Continue in manual flow): collapses Stage 1 fields into a single-row chip strip showing address (truncated) + pills for tenure + purchase type + progressedBy. "Edit" link on right that expands Stage 1 fields again. Stage 1 always editable (locked decision — no lockdown). In extracted flow, this bar is always shown (no Continue gate).
- **Stage 2 vendors/purchasers placement**: contacts sections sit in the full width of the left column, but internally use the two-column `contacts-section-grid` already in CSS. No layout change needed — already ships from Phase E3.
- **Solicitors side-by-side card layout** (refinement of existing SolicitorSection):
  - Two columns (seller left, buyer right) within SolicitorSection — already two-column; this phase refines the populated state visual only
  - Populated state: glass card per solicitor. Firm name bold at top with building icon (Phosphor `Buildings`). Handler name in white sub-card (`agent-surface`) beneath. Contact details (phone, email) in muted text. Green tick on section label. Long firm names ellipsis-truncated.
  - Empty state (no solicitor picked): dashed-border card with search icon + "Search or add buyer's solicitor" prompt. Identical to existing empty state but with explicit dashed border.
  - Type-ahead dropdown (when SolicitorPicker active): each option renders firm name + "Used {n} times" in muted text (derive from `AgencyRecommendedSolicitor` count or SolicitorFirm transaction count) + "+ Add new firm" at bottom. This requires a small addition to the `/api/solicitor-firms?q=` search response.
- **Price & Fees collapsible**: collapsed by default in Stage 2, showing a summary chip. SectionAccordion already handles collapse — this adds the summary chip content.
  - Summary chip format: "£285,000 · £3,000 fee · No referral" (fixed, no ref), "£285,000 · 1.5% fee · £500 referral" (percent, with ref), etc.
  - Chip computed from `formFields` in the accordion header
- **Notes collapsible**: already collapses via SectionAccordion. No change needed.
- **Chain collapsible**: already collapses. Summary chip added: "Top of chain", "3-link chain", "Bottom of chain" based on chain stubs.

**Files changed:**
- Create: components/transactions-v2/ExtractionBanner.tsx
- Create: components/transactions-v2/Stage1SummaryBar.tsx
- Modify: components/transactions-v2/form/SolicitorSection.tsx (populated state, empty state, type-ahead enhancement)
- Modify: app/api/solicitor-firms/route.ts (add "usedCount" to search response)
- Modify: components/transactions-v2/form/SectionAccordion.tsx (accept `summaryChip` prop for header)
- Modify: components/transactions-v2/NewSaleFlow.tsx (integrate new components)

---

### G4 — Vendors / Purchasers carousel

**What ships:**
- Carousel activates at 2+ entries; 1 entry uses existing card layout (no change)
- `ContactCarousel.tsx` — new component wrapping the existing contact cards
- Section header when carousel active: "VENDORS · {activeIndex + 1} of {total}" in `agent-section-label` style
- Active card: existing ContactCard layout with X (remove) button added top-right (16px × 16px, ghost)
- Behind-card hint: 2 thin slivers (8px visible, full width, decreasing opacity) stacked behind the active card using `position: absolute` + `translateX` offset. Pure CSS, no library.
- Navigation row: left chevron (Phosphor `CaretLeft`, disabled when `activeIndex === 0`) · dot indicators (active = 24px wide pill, inactive = 6px circle, all coral) · right chevron
- Slide animation: `transform: translateX()` CSS transition, 200ms ease-out, replaces content on index change
- Keyboard: ArrowLeft/ArrowRight when any element within the carousel is focused
- Mobile swipe: `touchstart` / `touchend` delta ≥50px triggers navigation. No library.
- Cap at 4: existing "Add another" button disabled and grayed when length = 4

**Files changed:**
- Create: components/transactions-v2/form/ContactCarousel.tsx
- Modify: components/transactions-v2/form/ContactsSection.tsx (render ContactCarousel when vendors.length >= 2 or purchasers.length >= 2)

---

### G5 — Price & Fees calculator strip

**What ships:**
- When SectionAccordion for Price & Fees is expanded, replaces existing PriceFeesSection layout with a calculator-strip visual:
- **Sale price** — large £ symbol + amount input. Hero treatment: 28px semibold, `agent-input-lg`. Label in `agent-section-label` style above.
- **Agent fee** — inline toggle "Fixed £" vs "Percent %" on the label row (two pills, active state = coral background). Value input below. VAT toggle on the same row as the value: "Inc VAT" vs "+ VAT" (two pills).
- **Live calculation strip** beneath: "£3,262.50 total inc. VAT at 20%" computed from inputs. Updates on every keystroke. Shown only when fee type + VAT mode is clear.
- **Divider line** between agent fee and referral fee.
- **Referral fee block**: toggle switch (off by default). When off: single collapsed row "No referral fee". When on: expands to firm picker (pre-selects the referred firm if vendorSolicitor or purchaserSolicitor is a recommended firm) + amount input.
- **Net to agency strip** (bottom, green-bordered): "Net to agency: £2,762.50 on a £285,000 sale" — live calc = fee - referral. Shown when fee is set and referral state is clear.
- Collapsed summary chip (from G3): "£285,000 · £3,000 fee · No referral"

**Note:** This replaces the layout of `PriceFeesSection.tsx` internals. Per the spec, form component internals are "unchanged" — however, PriceFeesSection's visual layout is entirely presentation (no business logic), so reshaping it here is in scope. The `onChange` prop signatures stay identical.

**Files changed:**
- Modify: components/transactions-v2/form/PriceFeesSection.tsx (layout reshape only; all onChange props untouched)

---

### G6 — Outsourced state + self-progress portal-invite

**What ships:**

**State 4 — Outsourced (`progressedBy === "progressor"`)**
- Coral-tinted banner above contacts sections: coral border, headphones icon (Phosphor `Headset`), "Our team will progress this file" headline, "We need at least one vendor and one purchaser with a phone or email so we can reach them." body copy. Banner replaces the existing inline error pattern (no changes to validation logic).
- Section labels for Vendors and Purchasers gain pill badges:
  - "VENDORS · NEEDED" (amber) when no valid vendor present; "VENDORS · READY" (green) when at least one valid vendor present
  - Same for purchasers
- Filled rows: beneath contact details, small green text "We can reach this vendor ✓" when `name + (phone || email)` present
- Empty contact card in outsourced mode: dashed-border glass card with gentle copy ("Add a vendor so we can reach them") instead of blank inputs
- Submit button states:
  - No valid vendor: "Add 1 vendor to continue" (disabled, amber hint below button)
  - Vendor OK, no purchaser: "Add 1 purchaser to continue" (disabled)
  - Both valid: "Create transaction" (primary gradient, enabled)
  - No asterisks on individual fields — banner + badges + button do the work

**State 5 — Self-progress (`progressedBy === "agent"`)**
- Portal-invite prompt card beneath address card (non-blocking, soft white glass): link icon, "Share a live portal link with your clients?" + "Vendors and purchasers can track progress, upload documents, and message you directly." Body. Two buttons: "Learn more" (opens a modal or links to help article) and "Skip for now" (dismisses the card, stores preference in `formFields` or local state — preference only for this session, not persisted).
- Section labels: "VENDORS · OPTIONAL" pill (muted, no colour) — makes clear contacts aren't required
- Filled vendor row: small green text "Eligible for portal invite ✓" when name + contact present
- Submit button: fully active regardless of contact state. "Create transaction" enabled.

**Files changed:**
- Create: components/transactions-v2/OutsourcedBanner.tsx
- Create: components/transactions-v2/PortalInvitePrompt.tsx
- Modify: components/transactions-v2/form/ContactsSection.tsx (outsourced/self-progress badge + row states)
- Modify: components/transactions-v2/NewSaleFlow.tsx (pass outsourced/self-progress signals through, render new components)

---

### G7 — Right column file preview mode

**What ships:**
- `FilePreview.tsx` — new component rendered in right column during Stage 6 (after Continue or extraction)
- Panel header: "File Preview" label + "LIVE" badge (small coral pill, pulsing dot)
- **Property card hero**: address in 15px semibold, postcode in muted below, property type pill (from tenure + any Land Registry inference)
- **Vendor + purchaser pills**: small chips showing contact names. "J. Smith + 1 more" if multiple. Muted if empty ("No vendors added yet").
- **Sale price hero figure**: 32px semibold, "£285,000" centred. "Price not set" in muted if null.
- **Milestones that will apply preview**: section label "MILESTONES THAT WILL APPLY", list of first 5 milestone names (filtered from server-fetched `milestoneDefinitions` by tenure + purchaseType using the §6.1 rules). "+ {n} more" link beneath (non-interactive in v1). Each item: small circle dot + milestone name. Vendor milestones first, then purchaser.
- **"Ready to create" strip** at bottom: green-bordered row, green checkmark, "File ready to create" text. Shown when form is minimally valid (address + tenure + purchaseType present). Hidden otherwise (strip simply not rendered).
- Mode transitions (implemented here):
  - Right column renders `ResearchPanel` (empty) → `PropertyDossier` → `FilePreview` based on `flowState` and address validity
  - Transition: `opacity` fade + `translateY(8px → 0)` over 280ms

**Files changed:**
- Create: components/transactions-v2/FilePreview.tsx
- Modify: components/transactions-v2/NewSaleFlow.tsx (right column mode logic: which of the three panels renders)
- Modify: app/agent/transactions/new-v2/page.tsx (pass milestoneDefinitions)

---

## Data source inventory

| Data | Source | Existing? | Notes |
|---|---|---|---|
| Last sold price + history | Land Registry SPARQL | ✓ `fetchPricePaid()` | Free, public, no auth |
| EPC rating | EPC OpenData Communities | ✓ `fetchEpc()` | Free; requires `EPC_API_EMAIL` + `EPC_API_KEY` env vars |
| Council tax band | None | ✗ | Deferred for MVP (see OQ1) |
| Tenure from Land Registry | Inferred from `pricePaid[0].propertyType` | Partial | `F` = flat → likely leasehold; `T/S/D` = likely freehold. Imprecise. Note this in UI. |
| Solicitor "Used N times" | `SolicitorFirm` ↔ `PropertyTransaction` join count | ✓ (data exists) | Need small query addition to solicitor-firms search API |
| Milestones preview | `MilestoneDefinition` seed table | ✓ (schema) | Fetch server-side; filter client-side by tenure/purchaseType |

---

## Risk callouts

| Risk | Severity | Mitigation |
|---|---|---|
| HeroZone.tsx deletion — drag-and-drop logic moves into new hero card | Medium | Audit all event handlers in HeroZone before deleting; transplant carefully in G1 |
| Carousel animation on Safari — CSS transforms on dynamically inserted elements can stutter | Low | Test on Safari before G4 sign-off; fallback to opacity-only if transform stutters |
| SolicitorFirm "Used N times" count — expensive join if firms have many transactions | Low | `COUNT` subquery with limit; add index if needed |
| Land Registry SPARQL rate limits — all agents hitting lookup on every page load | Low | Debounce 800ms + request cancellation (per OQ approach); SPARQL has no documented rate limit but be respectful |
| `MilestoneDefinition` seed data divergence — preview list depends on DB having up-to-date definitions | Medium | The seed is applied once at migration time; surface a warning if `milestoneDefinitions.length === 0` |
| G3 PriceFeesSection reshape touches "form component internals" — borderline per the safety pattern | Low | Only visual layout changes; all `onChange` prop signatures unchanged; tsc validates this |
| Right column 1280px breakpoint change breaks any agent on a 1280–1440px screen who was using the right column | Low | Previously the column was empty (F1 retired); no real loss. Log in commit message. |

---

## Build sequence with sign-off gates

```
G1 → [Ellis sign-off] → G2 → [Ellis sign-off] → G3 → [Ellis sign-off]
  → G4 → [Ellis sign-off] → G5 → [Ellis sign-off] → G6 → [Ellis sign-off]
  → G7 → [Ellis sign-off]
```

G2 and G3 are partially independent (G2 = right column data; G3 = left column layout). However G2's milestone definitions fetch (page.tsx addition) is needed by G7, so G2 must ship before G7 regardless. G3 has no dependency on G2 data. If needed, G2 and G3 could run in parallel, but sequential is safer given shared `NewSaleFlow.tsx` edits.

---

## Locked decisions (repeated for reference)

- Two-column layout ≥1024px desktop only
- Right column hidden below 1280px (G1 updates this breakpoint)
- Stage 1 fields stay editable in Stage 2 — no lockdown
- Continue button is explicit — no auto-advance
- Vendors/purchasers capped at 4 each
- Single seller + single buyer solicitor
- Carousel triggers at 2+ entries
- Brand theme tokens for all colours; semantic colours (green ticks, warning amber) fixed
- Failure modes silent — panel data never blocks form progression

---

## Files to delete in G1 (confirmed by audit)

```
components/transactions-v2/HeroIllustration.tsx
components/transactions-v2/StatsStrip.tsx
components/transactions-v2/RecentFilesTile.tsx
lib/services/platform-stats.ts
```

`HeroZone.tsx` is a candidate for full deletion in G1 (its drag-and-drop logic moves to the new hero card). Confirm scope before G1 build.
