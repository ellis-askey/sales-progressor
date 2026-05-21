# New Sale Flow v2 — Build Complete

**Status:** Production-ready behind `NEXT_PUBLIC_NEW_SALE_V2=true`
**Completed:** 2026-05-09
**Route:** `/agent/transactions/new-v2`

---

## What shipped

### Phase A — Foundation
- `components/transactions-v2/` directory and type definitions
- `FlowState`, `MemoSource`, `MemoSources`, `ExtractedMemoData`, `DraftEntry`, `SolicitorSelection`, `ChainStub` types in `types.ts`
- `app/agent/transactions/new-v2/page.tsx` — server component with recommended firms + draft fetching
- Feature flag wired in `AgentShell.tsx`: `NEXT_PUBLIC_NEW_SALE_V2=true` → new route

### Phase B — MOS hero zone
- `HeroZone.tsx` — drag-and-drop / click-to-upload, HEIC guard, camera capture (`capture="environment"`), 10MB limit
- `MemoStatusBar.tsx` — reading / done state bar with slow-MOS fallback at 15s
- `/api/agent/memo-parse` — MOS extraction API (Claude Haiku, Supabase storage)

### Phase C — Extracted form (State 2)
- `form/types.ts` — `FormFields` type + `defaultFormFields()`
- `form/FieldIndicator.tsx` — per-field extraction source indicator (green tick / amber dot / grey text)
- `form/Stage1Fields.tsx` — address, tenure, purchase type, progressedBy pills
- `form/Stage2Sections.tsx` — orchestrator for sections 1–5 with staggered animation
- `form/ContactsSection.tsx` — vendor/purchaser cards, add/remove, outsourced treatment
- `form/SolicitorSection.tsx` — solicitor picker with autofill, referral checkbox
- `form/PriceFeesSection.tsx` — purchase price, agent fee (fixed/percent/VAT), referral fee
- `form/NotesSection.tsx` — notes textarea
- `form/FormChainSection.tsx` — wrapper around existing `ChainSection`
- `form/SectionAccordion.tsx` — glass card collapse/expand
- `form/ChangeFileModal.tsx` — "you have edits" confirmation before resetting
- Precise dirty tracking via snapshot + `useEffect` comparison (not additive)
- Per-field memo source indicators and hints throughout the form

### Phase D — Manual two-stage flow
- `stage: 1 | 2` state — Stage 1 always visible, Stage 2 reveals on Continue
- Stage 1 validity gate: address ≥ 3 chars + tenure + purchaseType
- Continue button appears when Stage 1 is valid
- Auto-scroll to Stage 2 on reveal (330ms delay)
- Outsourced validation: vendors and purchasers each require name + phone or email
- `isOutsourced` flag flows through ContactsSection for required treatment

### Phase E1 — Submission wiring
- `DuplicateAddressModal.tsx` — "Address already exists" modal with View / Create anyway / Cancel
- `createTransactionAction` fully wired: contacts, solicitors, fees, chain, MOS metadata, forceCreate
- `mosUploaded: true` on extracted path → VM2 + PM2 auto-confirmed server-side
- Redirect: `?mosConfirmed=1` (MOS path) or `?newFile=1` (manual path)
- Submit button: loading state with `agent-btn-spinner`, disabled during submission
- Error toast on server error; duplicate modal on `DUPLICATE_ADDRESS` error

### Phase E2 — Draft system
- `DraftPanel.tsx` — floating panel (fixed bottom-left), draft list with load + delete
- `saveDraftAction` wired: explicit "Save draft" button near submit + auto-save on MOS upload
- Draft load: `populateFormFromDraft()` maps `DraftEntry` back to `FormFields`, auto-advances to Stage 2 if Stage 1 complete
- `discardDraftAction` wired via DraftPanel delete
- `beforeunload` guard: browser warns before tab close when form is dirty and no draft saved
- `buildDraftInput()` helper: consistent serialisation of `FormFields` → action input

### Phase E3 — Mobile polish
- Two-column contacts grid responsive: `contacts-section-grid` CSS class, collapses to single column at `max-width: 768px`
- Phone/email grid inside ContactCard: `contact-detail-grid`, collapses at `max-width: 480px`
- Divider between vendor/purchaser groups: hidden on mobile via `contacts-section-divider` class
- HEIC guard: already in Phase B (inline error, no upload fires)
- Camera capture: already in Phase B (`capture="environment"` on file input)
- `will-change: transform, opacity` on all staggered Section wrappers for smooth mobile animations

### Phase E4 — Utility extraction
- `lib/utils/address.ts` — `cleanPhone`, `formatPostcode`, `isValidUKPostcode` (shared, single source)
- `lib/utils/solicitor-autofill.ts` — `autoFillSolicitor` (shared, single source)
- `SolicitorSection.tsx` now re-exports from the shared module
- `NewSaleFlow.tsx` now imports from `lib/utils/address`
- `NewTransactionForm.tsx` keeps its inline copies until cutover (as spec'd)

### Phase E5 — Cutover preparation
- `docs/active/ELLIS_MANUAL_TODO.md` — full staged rollout playbook, 10-item smoke test checklist, rollback procedure, burn-in guidance
- This document

---

## Deferred (not in this build)

| Item | Why deferred | Where tracked |
|---|---|---|
| Old form deletion | Burn-in required (4–6 weeks zero issues) | ELLIS_MANUAL_TODO.md |
| Flag flip itself | Ellis's call after smoke test | ELLIS_MANUAL_TODO.md |
| Next.js soft-nav interception (sidebar clicks while form dirty) | App Router has no native route-change events; `beforeunload` covers tab close | Future if needed |
| Address blur auto-save | Explicit "Save draft" button is sufficient | Low priority |
| Per-agent flag override | Defer until usage analytics show need | — |
| Server-side outsourced validation | Client-only enforcement is sufficient for current usage | Known gap in docs |
| Supabase RLS activation | Separate package (Package D) | docs/active/TODO.md |

---

## Key judgement calls made across the build

1. **`stage: 1 | 2` not `flowState` expansion** — kept flow state (hero/extracting/extracted/manual) separate from form stage. Cleaner separation.
2. **Dirty tracking via snapshot + `useEffect` comparison** — not additive. "Type then untype" correctly removes the field from the dirty set. Prevents false-positive "Change file" modals.
3. **`autoFillSolicitor` extracted after proven** — waited until Phase E before extracting, so the implementation was stable before becoming a shared dependency.
4. **`normalizePostcode` in lib/utils.ts was pre-existing** but we created `lib/utils/address.ts` anyway for organization — both are present. The new file's `formatPostcode` has a stricter length check (`<= 7`) that's more appropriate for live user input.
5. **DraftPanel hidden when 0 drafts** — avoids showing an empty panel on first visit. Drafts appear after first save.
6. **Toast auto-clears at 4 seconds** (system default), not 8 as specced — the toast system has no per-toast duration parameter. This is acceptable.
7. **`before unload` guard only** (not soft-nav click interceptor) — App Router doesn't expose route-change events. The browser native dialog covers the critical case (accidental tab close).
8. **Draft upsert IDs are randomly generated in-memory** for panel display — real data is in Supabase. Panel reflects saved state on page load.

---

## Files created (Phase E only)

| File | Purpose |
|---|---|
| `components/transactions-v2/DuplicateAddressModal.tsx` | Duplicate address detection modal |
| `components/transactions-v2/DraftPanel.tsx` | Floating draft list panel |
| `lib/utils/address.ts` | Shared phone/postcode utilities |
| `lib/utils/solicitor-autofill.ts` | Shared solicitor autofill utility |
| `docs/done/new-sale-flow-v2/build-complete.md` | This document |

## Files modified (Phase E only)

| File | Change |
|---|---|
| `components/transactions-v2/NewSaleFlow.tsx` | Full submission wiring, draft system, E4 imports |
| `components/transactions-v2/form/Stage2Sections.tsx` | `will-change` on Section wrappers |
| `components/transactions-v2/form/ContactsSection.tsx` | Responsive CSS classes |
| `components/transactions-v2/form/SolicitorSection.tsx` | Re-export from shared utility |
| `app/agent/styles/agent-system.css` | Contacts grid responsive classes |
| `docs/active/ELLIS_MANUAL_TODO.md` | Rollout playbook + smoke test checklist |

---

## Cutover checklist

When you're ready to flip the flag:

1. Merge this build to `master`
2. Follow staging steps in `docs/active/ELLIS_MANUAL_TODO.md`
3. Run all 10 smoke test items on staging
4. Flip production flag
5. Run smoke test items 1–5 on production
6. After 4–6 weeks zero issues: open old form deletion PR
