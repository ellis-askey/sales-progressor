# Inventory: New Sale (new-v2)

**Route:** `/agent/transactions/new-v2`  
**Stage 1 status:** Stage 3 approved 2026-05-11. Stage 4 deferred — awaiting trigger (see WORKFLOW.md). Frozen. Do not re-open Stage 2 without explicit instruction from Ellis.  
**Amendments:** *(empty — appended if mid-flight discoveries occur in Stage 2)*

---

## 1. Page identity

| Field | Value |
|---|---|
| Route | `/agent/transactions/new-v2` |
| File | `app/agent/transactions/new-v2/page.tsx` |
| Component type | Mixed — server page + `"use client"` root component (`NewSaleFlow`) |
| Who sees it | Director, Negotiator |
| How they reach it | "+ New sale" button in AgentShell sidebar (link to `/agent/transactions/new-v2`). Also reachable by direct URL. |
| Reachable without a transaction? | Yes — this IS the transaction creation page |

**Code smell noted (per PAGE_LIST.md):** `app/agent/transactions/new-v2/page.tsx` uses `prisma as any` cast on line 7 (`const db = prisma as any`) to access `agencyRecommendedSolicitor`. Filed in `docs/TODO.md` — do not fix in this pass.

**No `loading.tsx`** exists for this route. No skeleton will show during the server fetch. The page renders blank until all four parallel data fetches resolve.

---

## 2. Components rendered

| Component | File | Notes |
|---|---|---|
| `AgentShell` | `components/layout/AgentShell.tsx` | Layout wrapper: sidebar, topbar, toaster. Not listed individually below. |
| `PageHeader` | `components/layout/PageHeader.tsx` | Renders "New Sale" h1 + subtitle above the form |
| `NewSaleFlow` | `components/transactions-v2/NewSaleFlow.tsx` | Root client component. Owns all state and orchestrates everything below. |
| `HeroCard` | `components/transactions-v2/HeroCard.tsx` | Drop zone + "Fill in manually" button + draft resume. Shown in `flowState === "hero"` only. |
| `MemoStatusBar` | `components/transactions-v2/hero/MemoStatusBar.tsx` | Status card shown during extraction and after. Shown in `flowState === "extracting"` or `"extracted"`. |
| `Stage1Fields` | `components/transactions-v2/form/Stage1Fields.tsx` | Address, tenure, purchase type, who-progresses fields. Shown in Stage 1 (manual) and as expandable panel in Stage 2. |
| `Stage1SummaryBar` | `components/transactions-v2/form/Stage1SummaryBar.tsx` | Compact read-only summary of Stage 1 values + Edit button. Shown in Stage 2 of both flows. |
| `Stage2Sections` | `components/transactions-v2/form/Stage2Sections.tsx` | Orchestrates all Stage 2 accordion sections with staggered animation. |
| `OutsourcedBanner` | `components/transactions-v2/form/OutsourcedBanner.tsx` | Coral banner shown in Stage 2 when `progressedBy === "progressor"`. |
| `PortalInvitePrompt` | `components/transactions-v2/form/PortalInvitePrompt.tsx` | Dismissable info card shown in Stage 2 when `progressedBy === "agent"`. Dismissed per session via `sessionStorage`. |
| `ContactsRow` | `components/transactions-v2/form/ContactsRow.tsx` | Two-panel wrapper for vendor + purchaser contact carousels. |
| `ContactCarousel` | `components/transactions-v2/form/ContactCarousel.tsx` | Per-party contact entry: single-card or swipeable carousel (2–4 contacts). |
| `ContactCard` | `components/transactions-v2/form/ContactsSection.tsx` | Individual contact row: name, phone, email fields. Also contains `ContactGroup` (not used in new-v2 — `ContactCarousel` supersedes it). |
| `SectionAccordion` | `components/transactions-v2/form/SectionAccordion.tsx` | Accordion wrapper used for Solicitors & Broker (expanded by default). |
| `SolicitorSection` | `components/transactions-v2/form/SolicitorSection.tsx` | Seller's solicitor + Buyer's solicitor pickers, referral checkboxes, and Mortgage broker picker. |
| `SolicitorPicker` | `components/solicitors/SolicitorPicker.tsx` | Search-and-select picker for solicitor firms/contacts. Not read in depth — standard picker. |
| `BrokerPicker` | `components/brokers/BrokerPicker.tsx` | Search-and-select picker for broker firms. Not read in depth — standard picker. |
| `FieldIndicator` | `components/transactions-v2/form/FieldIndicator.tsx` | Green ✓ (extracted) or amber dot (failed) inline icon next to field labels. |
| `FieldHint` | `components/transactions-v2/form/FieldIndicator.tsx` | Amber or grey helper text below fields indicating extraction state. |
| `CollapsibleSection` | `components/transactions-v2/form/CollapsibleSection.tsx` | Collapsed-by-default accordion used for Price & Fees, Notes, Chain. |
| `PriceFeesSection` | `components/transactions-v2/form/PriceFeesSection.tsx` | Sale price, agent fee (fixed/percent toggle, VAT toggle), live calc line, net-to-agency strip. |
| `NotesSection` | `components/transactions-v2/form/NotesSection.tsx` | Single textarea for transaction notes. |
| `FormChainSection` | `components/transactions-v2/form/FormChainSection.tsx` | Thin wrapper around `ChainSection`. |
| `ChainSection` | `components/chain/ChainSection.tsx` | Chain position selector, stub cards stack, add-above/add-below buttons, `AddNodeDrawer` trigger. |
| `AddNodeDrawer` | `components/chain/AddNodeDrawer.tsx` | Drawer for entering chain stub data. Not read in depth — opens when "Add sale above/below" clicked. |
| `FilePreview` | `components/transactions-v2/FilePreview.tsx` | Right column: live preview card showing property, parties, price, milestone list. Sticky. |
| `ResearchPanel` | `components/transactions-v2/ResearchPanel.tsx` | Right column: property research panel with postcode lookup input and feature explainer. |
| `PropertyDossier` | `components/transactions-v2/PropertyDossier.tsx` | Right column: replaces ResearchPanel when intel lookup succeeds. Shows last sold, EPC, tenure, recent local sales. |
| `DraftPanel` | `components/transactions-v2/DraftPanel.tsx` | Fixed bottom-left floating panel listing saved drafts. Hidden when `flowState === "hero"` (HeroCard handles drafts inline). |
| `ChangeFileModal` | `components/transactions-v2/form/ChangeFileModal.tsx` | Confirmation modal before resetting extracted form with a new MOS file. Portal-rendered. |
| `DuplicateAddressModal` | `components/transactions-v2/DuplicateAddressModal.tsx` | Warning modal when submitted address matches existing active file. Portal-rendered. |

---

## 3. Data dependencies

| Data | Source | Shape | Notes |
|---|---|---|---|
| `recommendedFirms` | `agencyRecommendedSolicitor.findMany({ where: { agencyId } })` | `{ id: string; defaultReferralFeePence: number \| null }[]` | Controls "Referred by us" checkbox visibility and pre-fills referral fee. Empty array on error (catch → []). |
| `preferredBrokerRow` | `prisma.agencyPreferredBroker.findUnique({ where: { agencyId } })` | `{ defaultReferralFeePence: number \| null; brokerFirm: { id, name } } \| null` | Pre-populates broker picker with agency's preferred broker. Null if none set. |
| `drafts` | `prisma.propertyTransaction.findMany({ where: { agencyId, agentUserId: session.user.id, status: "draft" } })` | `DraftEntry[]` | Up to 10 most recent drafts. Empty array on error. |
| `allMilestoneDefinitions` | `prisma.milestoneDefinition.findMany({ orderBy: { orderIndex: "asc" } })` | `{ id, code, name, side, orderIndex }[]` | Used by FilePreview to render live milestone list. Empty array on error. |
| `session.user` | `requireSession()` | `{ id, agencyId, role, name }` | Redirect to login if missing. |

**Null / missing data:**
- `recommendedFirms` empty → "Referred by us" checkbox never appears for any solicitor. No user-visible error.
- `preferredBrokerRow` null → broker picker shows no pre-populated firm. No user-visible error.
- `drafts` empty → hero screen shows no "Resume" button; draft panel never renders.
- `allMilestoneDefinitions` empty → FilePreview skips the milestones section (milestone count = 0).
- No `error.tsx` or `loading.tsx` in this route directory. Server fetch failures bubble to the nearest parent error boundary.

**Client-side data fetches:**
- `POST /api/agent/memo-parse` — triggered by file drop/select. Returns `ExtractedMemoData`.
- `usePropertyIntel` hook — calls Land Registry + EPC APIs via internal endpoint. Triggered by postcode entry or MOS extraction.
- `saveDraftAction` / `discardDraftAction` — server actions for draft persistence.
- `createTransactionAction` — server action on final submission. Returns `{ id, mosAutoConfirmed, chainFailed }`.

---

## 4. States

### Flow states (top-level `flowState`)

| State | Trigger condition | What the user sees |
|---|---|---|
| **Hero** | Initial render; or after cancel/reset | HeroCard with drop zone, "Fill in manually" button, optional draft resume. Right column shows ResearchPanel or PropertyDossier. No Stage 1 fields, no submit button. |
| **Extracting** | File dropped or selected | MemoStatusBar in "reading" mode (animated tick-through of 7 fields). HeroCard replaced. Right column unchanged from hero. |
| **Extracted** | MOS parse returns successfully | MemoStatusBar in "done" mode. Stage 1 summary bar (compact). Stage 2 sections fully visible. Submit button and Save draft button visible. Right column switches to FilePreview. |
| **Manual** | "Fill in manually" clicked; or extraction fails | Stage 1 fields visible (address, tenure, purchase type, who-progresses). No MemoStatusBar. Right column shows ResearchPanel. When Stage 1 valid, "Continue — add contacts & details" button appears. |

### Stage within non-hero flows

| Stage | Applies to | What the user sees |
|---|---|---|
| **Stage 1** | manual flow only | Full Stage1Fields card. No Stage 2 sections. No submit button. "Continue" button appears when `streetAddress ≥ 3 chars && tenure && purchaseType` all set. |
| **Stage 2** | manual flow (after Continue); always in extracted flow | Stage1SummaryBar + Stage2Sections (contacts, solicitors, price, notes, chain). Submit button visible. Edit button on summary bar re-expands Stage1Fields. |

### MemoStatusBar sub-states (extracted flow)

| State | Trigger | Top border | What the user sees |
|---|---|---|---|
| **Reading** | `flowState === "extracting"` | Coral | Spinner + "Reading your memo…" + animated field tick-through. Slow timeout (15s) shows "cancel and fill manually?" link. |
| **Done, all filled** | Extraction success + no missing fields | Green | Green ✓ + "Memo read · all fields filled" + "Change file" link. |
| **Done, some missing** | Extraction success + ≥1 field absent | Amber | Amber ⚠ + "Memo read · N field(s) need attention" + "Change file" link + tappable amber pills for each missing field. |
| **Error** | Extraction API error | Amber | Amber ⚠ + error message. Flow transitions to `"manual"` immediately. |

### Right column states

| State | Trigger | What the user sees |
|---|---|---|
| **ResearchPanel — idle** | `intel.state === "idle"` (default) | Postcode search input + feature explainer bullets + attribution |
| **ResearchPanel — loading** | `intel.state === "loading"` | Skeleton blocks pulsing |
| **ResearchPanel — error** | `intel.state === "error"` | "We couldn't find data for this address." + "Try again" |
| **PropertyDossier** | `intel.state === "success"` | Last sold price, EPC, tenure tiles. Recent local sales list. "From memo" badge if auto-triggered. |
| **FilePreview** | `rightColumnMode === "preview"` | Sticky live preview card: property, parties, price, milestones. Switches to this on extraction or after Stage 1 complete in manual mode. |
| **Tab strip** | `flowState === "extracted"` or `(flowState === "manual" && stage === 2)` | "Property Research" / "File Preview" tab strip above right column. |

### DraftPanel states

| State | Trigger | What the user sees |
|---|---|---|
| **Hidden** | `flowState === "hero"` OR `drafts.length === 0` | Not rendered |
| **Open (default)** | `drafts.length > 0 && flowState !== "hero"` | Fixed bottom-left card listing all drafts; coral dot toggle |
| **Collapsed** | User clicks "Hide drafts" | Only toggle button with draft count visible |
| **Current draft highlighted** | `currentDraftId` matches a draft | That row has a coral-tinted background |

### Submit / outsourced states

| State | Trigger | What the user sees |
|---|---|---|
| **Submitting** | `isSubmitting === true` | Button shows spinner + "Creating…"; button is disabled |
| **Outsourced — no vendor name** | `isOutsourced` + no vendor entry with a name set | Submit button: "Add 1 vendor to continue". `OutsourcedHintCard` above button: same text. Button disabled. |
| **Outsourced — vendor name, no contact** | `isOutsourced` + vendor has name but no phone or email | Submit button: "Add a contact method to continue" (vendor check). `OutsourcedHintCard`: same. Button disabled. |
| **Outsourced — no purchaser name** | `isOutsourced` + vendor check passes + no purchaser entry with a name | Submit button: "Add 1 purchaser to continue". `OutsourcedHintCard`: same. Button disabled. |
| **Outsourced — purchaser name, no contact** | `isOutsourced` + vendor check passes + purchaser has name but no phone or email | Submit button: "Add a contact method to continue" (purchaser check). `OutsourcedHintCard`: same. Button disabled. |
| **Duplicate address** | `createTransactionAction` throws `DUPLICATE_ADDRESS` | `DuplicateAddressModal` opens with address, existing file link, and "Create anyway" option |
| **Submit error** | `createTransactionAction` throws non-duplicate | Toast: "Something went wrong — your file wasn't created. Try again or contact support." |

**Note on outsourced states:** Each of the four outsourced states displays the same text in both the submit button AND the `OutsourcedHintCard` directly above it — two visible message instances per state, eight message instances across all four states. Stage 2 must render all four states explicitly.

### ChangeFileModal state

Shown when `showChangeFileModal === true`. Triggered when "Change file" is clicked in MemoStatusBar and `manuallyEditedFields.size > 0`. If no manual edits, resets immediately without modal.

### Portal invite prompt states

- Shown in Stage 2 when `progressedBy === "agent"` and not dismissed in this session
- Hidden immediately and permanently (for session) when dismissed via sessionStorage

### Loading state — new for this pass

**Decision:** No `loading.tsx` exists for this route. The current result is a blank white screen during the four parallel server fetches. Adding `loading.tsx` is **in scope for Stage 2** — not deferred.

**What `loading.tsx` renders:**

The loading skeleton matches the shape of the hero state (what the user is about to see), not generic horizontal bars.

| Column | What to render |
|---|---|
| Form column (65fr) | Card-shaped skeleton matching `HeroCard`'s footprint: one heading bar (~40px high, 180px wide), one sub-copy bar (~16px high, 260px wide), two button-shaped blocks (~40px high, ~80% and ~60% width), one optional draft-row bar (~24px high, 160px wide) |
| Right column (35fr) | Card-shaped skeleton matching `ResearchPanel`'s footprint: one header bar (~20px high, 120px wide), one input bar (~40px high, full-width), four feature-bullet bars (~14px high, staggered widths 140–220px), one attribution bar (~12px high, 160px wide) |
| Layout | Same `.new-sale-two-col` grid (65fr / 35fr, 32px gap) as the live page |
| Right column on mobile | Hidden at < 1024px — same `display: none` as the live page |
| Animation | `agent-skeleton-pulse 1.5s ease-in-out infinite` (existing keyframe in `agent-system.css`, already used in `ResearchPanel`) — staggered delays per bar |
| Reduced-motion | Pulse disabled when `data-rm="true"` on `<html>` — per existing pattern |

This is the **Loading** standard state for this page.

---

## 5. Interactive elements

| Element | Location | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| "Drop a memo of sale" button | HeroCard | Opens hidden `<input type="file">` | Never | — |
| Drop zone (entire HeroCard) | HeroCard | Accepts file drop; triggers extraction | Never | — |
| "Fill in manually" button | HeroCard | Sets `flowState = "manual"`, clears form | Never | — |
| "Resume [draft]" button | HeroCard | Loads most recent draft into form | Never (only renders if draft exists) | — |
| "View all drafts (N)" / "Hide drafts" | HeroCard | Toggles draft list visibility | Never | — |
| Per-draft load button | HeroCard draft list | Loads that draft | Never | — |
| Per-draft × button | HeroCard draft list | Deletes that draft (calls `discardDraftAction`) | Never | — |
| "cancel and fill manually" link | MemoStatusBar — slow state | Resets to hero; aborts extraction | Shown only after 15s slow timeout | — |
| "Change file" link | MemoStatusBar — done states | Resets if no manual edits; shows ChangeFileModal if edits exist | Never | — |
| Missing field amber pills | MemoStatusBar — done+missing | Expands Stage1Fields (sets `stage1Expanded = true`) | Never (pills are always tappable when shown) | — |
| "Self-progress" / "Send to us" pills | Stage1Fields | Sets `progressedBy` | Never | — |
| "Look up this property" link | Stage1Fields | Triggers `usePropertyIntel` lookup with current postcode | When postcode isn't valid UK format | Greyed out text, pointer-events none |
| Street address input | Stage1Fields | Updates `streetAddress`; title-cases on blur | Never | — |
| City / Town input | Stage1Fields | Updates `city`; title-cases on blur | Never | — |
| Postcode input | Stage1Fields | Updates `postcode`; formats on blur; validates | Never | — |
| Tenure pills (Freehold / Leasehold) | Stage1Fields | Sets `tenure` | Never | — |
| Purchase type pills (Mortgage / Cash / Cash from Proceeds) | Stage1Fields | Sets `purchaseType` | Never | — |
| "Continue — add contacts & details" button | Stage1Fields — manual mode | Advances to Stage 2 | When Stage 1 not yet valid | Not rendered until valid |
| "Edit" button | Stage1SummaryBar | Sets `stage1Expanded = true` | Never | — |
| "Self-progress ⇄" / "Send to us ⇄" toggle pill | Stage1SummaryBar | Toggles `progressedBy` inline | Never | — |
| "↑ Done editing" button | Stage1Fields (expanded in Stage 2) | Collapses Stage1Fields (`stage1Expanded = false`) | Never | — |
| "Skip — I won't be using the portal" button | PortalInvitePrompt | Dismisses prompt for session | Never | — |
| "Tell me more" button | PortalInvitePrompt | No-op (no `onClick` handler wired) | Never | — |
| "+ Add vendor" / "+ Add purchaser" button | ContactCarousel — empty/single mode | Adds new empty contact entry | When at MAX_ENTRIES (4) | Greyed out, cursor not-allowed |
| "+ Add" button | ContactCarousel — carousel mode | Adds new contact | When at MAX_ENTRIES | Greyed out, cursor not-allowed |
| Contact carousel ← / → chevrons | ContactCarousel — carousel mode | Navigate between contact entries | First/last entry respectively | Low-opacity colour, cursor not-allowed. No tooltip text for disabled state — cursor change and reduced opacity only. `aria-label` remains "Previous" / "Next" unchanged when disabled. |
| Dot indicators | ContactCarousel — carousel mode | Jump to specific contact entry | Current contact (no jump needed) | Elongated (active) dot, non-interactive effectively |
| × remove button (per contact) | ContactCarousel — carousel mode (overlay) | Removes that contact entry | Never | — |
| Name input | ContactCard | Updates `name`; title-cases on blur | Never | — |
| Phone input | ContactCard | Updates `phone` (cleanPhone) | Never | — |
| Email input | ContactCard | Updates `email` | Never | — |
| "Change" button | SolicitorSection — populated firm | Clears solicitor selection | Never | — |
| SolicitorPicker search | SolicitorSection — empty state | Searches/creates solicitor firm + contact | Never | — |
| "Referred by us" checkbox | SolicitorSection — recommended firm only | Sets `vendorIsReferral` / `purchaserIsReferral`; auto-fills referral fee | Not rendered if firm not in `recommendedFirms` | — |
| BrokerPicker | SolicitorSection | Searches/selects mortgage broker | Never | — |
| "Purchaser referred to [firm]" checkbox | SolicitorSection | Sets `purchaserBrokerReferral` | Not rendered unless `purchaseType === "mortgage"` AND broker selected | — |
| "Fixed £" / "Percent %" toggle | PriceFeesSection | Switches `agentFeeType` | Never | — |
| Purchase price input | PriceFeesSection | Sets `purchasePricePence` | Never | — |
| Agent fee amount input | PriceFeesSection — fixed mode | Sets `agentFeeAmount` | Not rendered in percent mode | — |
| Agent fee percent input | PriceFeesSection — percent mode | Sets `agentFeePercentStr` | Not rendered in fixed mode | — |
| "+ VAT" / "Inc VAT" toggle | PriceFeesSection | Sets `agentFeeVat` | Never | — |
| Notes textarea | NotesSection | Updates `notes` | Never | — |
| CollapsibleSection headers (Price & Fees, Notes, Chain) | Stage2Sections | Toggle expand/collapse | Never | — |
| "Solicitors & Broker" accordion header | SectionAccordion | Toggle expand/collapse | Never | — |
| Chain: "+ Add chain" button | ChainSection — collapsed | Expands chain section | Never | — |
| Chain: "× Remove chain" button | ChainSection — expanded | Collapses chain; `confirm()` dialog if stubs exist | Never | — |
| Chain position radio (top/bottom/middle/don't know) | ChainSection — expanded | Sets position; `confirm()` dialog if stubs must be removed | Never | — |
| Chain: "+ Add sale above" / "+ Add sale below" | ChainSection — expanded | Opens `AddNodeDrawer` for that direction | Not rendered when position excludes that direction | — |
| StubCard "Edit" | ChainSection | Opens `AddNodeDrawer` in edit mode | Never | — |
| StubCard "Remove" | ChainSection | Removes that stub from memory | Never | — |
| Research postcode input | ResearchPanel — idle | Updates local query; Enter triggers lookup | Never | — |
| "Look up" button | ResearchPanel — idle | Triggers `intel.lookupImmediate()` | Not rendered until valid UK postcode format | — |
| "Try again" button | ResearchPanel — error | Retries last intel lookup | Never | — |
| "Use this" button | PropertyDossier — tenure mismatch | Sets form `tenure` from Land Registry value | Not rendered unless LR tenure differs from form tenure | — |
| × clear button | PropertyDossier | Clears intel data, returns to ResearchPanel | Never | — |
| "Property Research" / "File Preview" tabs | Right column | Sets `rightColumnMode` | Never | — |
| "Create transaction" submit button | Below form | Calls `handleSubmit()` | When `isSubmitting` or `!outsourcedReady` | Opacity 0.75 during submit; cursor not-allowed when outsourced not ready |
| "Save draft" button | Below form | Calls `saveDraft()` (upserts draft via server action) | When `isSavingDraft` | Shows "Saving draft…" text; cursor becomes default |
| DraftPanel per-draft load button | DraftPanel | Loads draft into form | Never | — |
| DraftPanel per-draft ✕ button | DraftPanel | Deletes draft | Never | — |
| "Hide drafts" / "N drafts" toggle | DraftPanel | Toggles panel open/closed | Never | — |
| "View existing file" link | DuplicateAddressModal | Navigates to existing transaction | Never | — |
| "Create anyway" button | DuplicateAddressModal | Calls `handleForceCreate()` (re-submits with `forceCreate: true`) | Never | — |
| "Cancel" button | DuplicateAddressModal | Closes modal | Never | — |
| "Change file" button | ChangeFileModal | Confirms reset to hero; closes modal | Never | — |
| "Cancel" button / Esc / backdrop click | ChangeFileModal | Closes modal, keeps form | Never | — |
| Swipe left/right | ContactCarousel (touch) | Navigate between contacts (≥50px delta) | Never | — |
| Arrow left/right keys | ContactCarousel | Navigate between contacts | Never (when contacts.length < 2, no-op) | — |

---

## 6. Conditional renders

```
{/* ── Hero card ──────────────────────────────────────────────────── */}
{flowState === "hero" && <HeroCard ... />}
{/* Shows: initial state */}
{/* Hides: once extracting, extracted, or manual */}

{/* ── MemoStatusBar ────────────────────────────────────────────── */}
{(flowState === "extracting" || flowState === "extracted") && <MemoStatusBar ... />}
{/* Shows: during and after MOS upload */}
{/* Hides: hero and manual states */}

{/* ── MemoStatusBar slow timeout message ─────────────────────── */}
{isSlow && <p>Taking longer than expected…</p>}
{/* Shows: 15 seconds after extraction begins */}

{/* ── Stage1Fields (extracted flow, Stage 1 expanded) ─────────── */}
{flowState === "extracted" && stage1Expanded && <Stage1Fields showContinueButton={false} ... />}
{/* Shows: when user clicks "Edit" on summary bar (extracted flow) */}
{/* Hides: when collapsed via "↑ Done editing" */}

{/* ── "↑ Done editing" button ───────────────────────────────── */}
{stage1Expanded && <button>↑ Done editing</button>}
{/* Shows: in both extracted and manual Stage 2 when Stage1Fields expanded */}

{/* ── Stage1SummaryBar ────────────────────────────────────────── */}
{(flowState === "extracted" || (flowState === "manual" && stage === 2)) && <Stage1SummaryBar ... />}
{/* Shows: Stage 2 of both flows */}

{/* ── Stage2Sections ──────────────────────────────────────────── */}
{flowState === "extracted" && <Stage2Sections ... />}
{flowState === "manual" && stage === 2 && <Stage2Sections ... />}
{/* Shows: Stage 2 of both flows */}

{/* ── OutsourcedHintCard (above submit button) ────────────────── */}
{isOutsourced && !outsourcedReady && !isSubmitting && <OutsourcedHintCard text={submitButtonText} />}
{/* Shows: outsourced + incomplete contacts + not currently submitting */}

{/* ── Submit + Save draft buttons ─────────────────────────────── */}
{/* Always visible when not in hero or extracting state, Stage 2 */}

{/* ── Manual flow — Stage 1 full fields ─────────────────────── */}
{flowState === "manual" && stage === 1 && <Stage1Fields showContinueButton={stage1Valid} ... />}
{/* Shows: manual flow, Stage 1 */}

{/* ── Continue button inside Stage1Fields ────────────────────── */}
{showContinueButton && <button>Continue — add contacts & details</button>}
{/* Shows: when stage1Valid (street ≥ 3 chars, tenure set, purchaseType set) */}
{/* Hides: not valid yet, or in Stage 2 expanded edit mode */}

{/* ── Right column tab strip ─────────────────────────────────── */}
{(flowState === "extracted" || (flowState === "manual" && stage === 2)) && <TabStrip />}
{/* Shows: in Stage 2 of either flow */}
{/* Hides: hero and extracting states; manual Stage 1 */}

{/* ── Right column content ───────────────────────────────────── */}
{rightColumnMode === "preview" ? (
  <FilePreview ... />
) : intel.state === "success" ? (
  <PropertyDossier ... />
) : (
  <ResearchPanel ... />
)}

{/* ── DraftPanel ──────────────────────────────────────────────── */}
{flowState !== "hero" && drafts.length > 0 && <DraftPanel ... />}
{/* Shows: any non-hero state with drafts */}
{/* Hides: hero (drafts shown inline in HeroCard) */}

{/* ── ChangeFileModal ─────────────────────────────────────────── */}
{showChangeFileModal && <ChangeFileModal ... />}

{/* ── DuplicateAddressModal ────────────────────────────────────── */}
{duplicateInfo && <DuplicateAddressModal ... />}

{/* ── OutsourcedBanner in Stage2Sections ─────────────────────── */}
{isOutsourced && <OutsourcedBanner />}
{/* Shows: Stage 2 + progressedBy === "progressor" */}
{/* Hides: self-progress mode */}

{/* ── PortalInvitePrompt in Stage2Sections ────────────────────── */}
{!isOutsourced && !dismissed && <PortalInvitePrompt />}
{/* Shows: Stage 2 + progressedBy === "agent" + not sessionStorage-dismissed */}
{/* Hides: outsourced mode, or dismissed for this session */}

{/* ── ContactCarousel — empty state ───────────────────────────── */}
{contacts.length === 0 && <EmptyStateCard ... />}

{/* ── ContactCarousel — single-entry mode ─────────────────────── */}
{contacts.length === 1 && <ContactCard ... canRemove={false} />}

{/* ── ContactCarousel — carousel mode (2+) ─────────────────────── */}
{contacts.length >= 2 && <CarouselMode ... />}

{/* ── Outsourced inline hint (single-entry ContactCarousel) ────── */}
{isOutsourced && contacts.length === 1 && (
  <p>At least one {singular} with name and contact method required</p>
)}

{/* ── ContactCard — per-row validation (outsourced) ────────────── */}
{mode === "progressor" && hasName && hasContact && <p>We can reach this {label}</p>}
{mode === "progressor" && hasName && !hasContact && <p>Add a phone or email so we can reach them</p>}
{mode === "agent" && hasName && hasContact && <p>Eligible for portal invite</p>}

{/* ── "Referred by us" checkbox ────────────────────────────────── */}
{isRecommended && <label>Referred by us</label>}
{/* Shows: only if selected solicitor firm is in agency's recommendedFirms */}

{/* ── Solicitor vendor hint (memo found firm but couldn't auto-fill) */}
{!isFillingVendor && !vendorSolicitor && vendorHint && (
  <p>We found {vendorHint} on the memo — search above to add</p>
)}
{/* Same pattern for purchaser solicitor */}

{/* ── Broker referral checkbox ─────────────────────────────────── */}
{purchaseType === "mortgage" && broker?.firmId && (
  <label>Purchaser referred to {broker.firmName}</label>
)}

{/* ── PriceFeesSection calc line ────────────────────────────────── */}
{calcLine && <p>{calcLine}</p>}

{/* ── PriceFeesSection net strip — states ─────────────────────── */}
{!purchasePricePence ? "— Add a sale price to calculate" : ...}
{netPence == null ? "— Add an agent fee to calculate" : "£X on a £Y sale..."}

{/* ── FilePreview milestones section ──────────────────────────── */}
{isStage1Done && milestones.length > 0 && <MilestonesList />}
{/* Shows: once address, tenure, and purchaseType are all set */}

{/* ── FilePreview "+ N more" ────────────────────────────────────── */}
{remaining > 0 && <p>+ {remaining} more</p>}

{/* ── PropertyDossier "From memo" badge ────────────────────────── */}
{fromMemo && <span>From memo</span>}

{/* ── PropertyDossier "Use this" button ──────────────────────── */}
{tenureMismatch && <button>Use this</button>}

{/* ── ChainSection collapsed state ──────────────────────────────── */}
{!expanded && <CollapsedCallout />}
{/* Shows: chain section not yet opened */}

{/* ── Chain position buttons constrained by position ──────────── */}
{showAddAbove /* position !== "top" */ && <button>+ Add sale above</button>}
{showAddBelow /* position !== "bottom" */ && <button>+ Add sale below</button>}

{/* ── DraftPanel open/closed ───────────────────────────────────── */}
{open && <DraftList />}

{/* ── HeroCard — single most-recent draft resume ────────────────── */}
{mostRecentDraft && <ResumeButton />}

{/* ── HeroCard — "View all drafts" expand ──────────────────────── */}
{drafts.length > 1 && <ShowAllToggle />}
{showAllDrafts && <FullDraftList />}

{/* ── HeroCard drag state overrides ───────────────────────────── */}
{dragOver ? "Drop it here." : "Ready to add a sale?"}
{dragOver ? " " : "Drop a memo and we'll fill the form for you."}
```

---

## 7. Copy inventory

**Verbatim rule:** Every string exactly as it renders. State variants are separate lines.

```
# Page header
"New Sale"                                    [h1 — page title]
"Drop your memo of sale to get started, or fill in manually."  [subtitle]

# HeroCard — normal state
"Ready to add a sale?"                        [heading]
"Drop a memo and we'll fill the form for you."  [sub-copy]
"Drop a memo of sale"                         [primary button]
"Fill in manually"                            [secondary button]
"Resume"                                      [prefix label before draft address]
[dynamic: draft address, truncated at 32 chars with "…"]
[dynamic: relative time — "just now" / "Xm ago" / "Xh ago" / "yesterday" / "X days ago" / "over a month ago"]
"Hide drafts"                                 [toggle button — expanded]
"View all drafts (N)"                         [toggle button — collapsed]
"Remove draft"                                [aria-label on × button]
"iPhone photos need to be saved as JPEG. Use the 'Files' option to pick the memo instead."  [file error — HEIC]
"Please upload a PDF or image (JPEG, PNG, WEBP)."  [file error — wrong type]
"File is too large — maximum 10 MB."          [file error — size]

# HeroCard — drag active state
"Drop it here."                               [heading overrides "Ready to add a sale?"]
" "                                           [sub-copy becomes a space character, opacity 0]

# MemoStatusBar — reading state
"Reading your memo…"                          [spinner label] ← FLAG: Rule 1 (system activity)
"Address"                                     [animated field]
"Purchase price"                              [animated field]
"Tenure"                                      [animated field]
"Vendor details"                              [animated field]
"Purchaser details"                           [animated field]
"Vendor solicitor"                            [animated field]
"Purchaser solicitor"                         [animated field]
"Taking longer than expected — "              [slow timeout prefix] ← FLAG: Rule 1 (system state)
"cancel and fill manually"                    [slow timeout link text]
"?"                                           [slow timeout suffix character]

# MemoStatusBar — done, no missing fields
"Memo read · all fields filled"              [success message]
"Change file"                                 [link]

# MemoStatusBar — done, missing fields
"Memo read · 1 field needs attention"         [singular warning]
"Memo read · N fields need attention"         [plural warning]
"Change file"                                 [link]
"Tenure"                                      [missing pill]
"Purchase type"                               [missing pill]
"Street address"                              [missing pill]
"City"                                        [missing pill]
"Postcode"                                    [missing pill]
"Price"                                       [missing pill]
"Vendors"                                     [missing pill]
"Purchasers"                                  [missing pill]

# MemoStatusBar — error state
"Couldn't read the memo — fill in the form below"  [error fallback] (default FieldHint override) ← FLAG: borderline Rule 1 (system describing its own parse failure)

# Stage1Fields — who-progresses section
"Who will progress this file?"                [section label]
"Self-progress"                               [pill label]
"You manage this file yourself"               [pill note]
"Send to us"                                  [pill label]
"Hand off to the progression team"            [pill note] ← FLAG: borderline Rule 2 ("progression team" = internal team name; customers see "our team" elsewhere)

# Stage1Fields — property address section
"Property address"                            [section label]
"Look up this property"                       [lookup link — enabled when postcode valid]
"Street address"                              [field label]
"e.g. 14 Hartwell Avenue"                     [placeholder]
"City / Town"                                 [field label]
"e.g. Bristol"                                [placeholder]
"Postcode"                                    [field label]
"e.g. BS6 7TH"                               [placeholder]
"Doesn't look like a valid UK postcode"       [validation error — invalid format on blur]

# Stage1Fields — tenure
"Tenure"                                      [section label]
"Freehold"                                    [pill label]
"Management pack not required"                [pill note]
"Leasehold"                                   [pill label]
"Management pack required"                    [pill note]

# Stage1Fields — purchase type
"Purchase type"                               [section label]
"not on memos"                                [annotation after label] ← FLAG: Rule 2 (developer jargon)
"Mortgage"                                    [pill label]
"All mortgage milestones apply"               [pill note] ← FLAG: Rule 2 ("milestones" — schema term)
"Cash"                                        [pill label]
"Mortgage milestones not required"            [pill note] ← FLAG: Rule 2 (both "milestones" and implies system logic)
"Cash from Proceeds"                          [pill label]
"Mortgage + deposit not required"             [pill note]

# Stage1Fields — continue gate
"That's enough to create the file — continue to add contacts and details"  [helper text above continue button] ← FLAG: Rule 1 (system commenting on its own readiness — "that's enough to create" announces the system's state, not the user's situation)
"Continue — add contacts & details"           [continue button]

# Stage1SummaryBar
"No address set"                              [address fallback]
"Freehold"                                    [tenure pill — freehold]
"Leasehold"                                   [tenure pill — leasehold]
"Tenure?"                                     [warning pill — tenure unset] ← FLAG: inconsistent capitalisation vs other pills
"Mortgage"                                    [purchase type pill]
"Cash"                                        [purchase type pill]
"Cash from Proceeds"                          [purchase type pill]
"Purchase type?"                              [warning pill — type unset]
"Self-progress ⇄"                             [toggle pill — agent mode, clickable]
"Send to us ⇄"                                [toggle pill — progressor mode, clickable]
"Edit"                                        [edit button]
"↑ Done editing"                              [collapse Stage1Fields button]

# OutsourcedBanner
"Outsourced — our team will progress this file"  [title] ← FLAG: "progress" as verb (internal term; Rule 2)
"We'll need at least one vendor and one purchaser with a name and contact method so we can reach out from day one."  [body] ← FLAG: Rule 1 ("we'll need" = system speaking of its needs); "reach out from day one" = informal

# PortalInvitePrompt
"Want to invite the buyer or seller to the client portal?"  [title]
"Add their contact details below and you can send portal invites once the file's created."  [body]
"Tell me more"                                [link button — NOTE: no onClick handler, does nothing]
"Skip — I won't be using the portal"          [dismiss button]

# ContactCarousel — section labels
"Vendors"                                     [section label — Vendors carousel]
"Purchasers"                                  [section label — Purchasers carousel]
"Needed"                                      [pill badge — outsourced, not yet filled] ← FLAG: "Needed" is system-facing (needed by whom?)
"Optional"                                    [pill badge — self-progress]
"· N of M"                                   [position indicator — carousel mode]

# ContactCarousel — empty states (self-progress)
"No vendors added · you can add them later"   [empty state — vendor, agent mode]
"No purchasers added · you can add them later"  [empty state — purchaser, agent mode]

# ContactCarousel — empty states (outsourced)
"Add a vendor"                                [empty state heading — vendor, progressor mode]
"Add a purchaser"                             [empty state heading — purchaser, progressor mode]
"We need a name and a phone or email to reach them."  [empty state body — outsourced] ← FLAG: Rule 1 ("We need")

# ContactCarousel — add buttons
"+ Add vendor"                                [add button]
"+ Add purchaser"                             [add button]
"+ Add"                                       [add button — carousel mode]
"Maximum 4 vendors"                           [disabled tooltip — at cap]
"Maximum 4 purchasers"                        [disabled tooltip — at cap]

# ContactCarousel — navigation
"Previous"                                    [aria-label — left chevron]
"Next"                                        [aria-label — right chevron]
"Go to vendor 1" etc                          [aria-label — dot navigation]
"Remove vendor 1" etc                         [aria-label — × remove in carousel mode]

# ContactCarousel — outsourced inline hint (single-entry)
"At least one vendor with name and contact method required"   [outsourced hint]
"At least one purchaser with name and contact method required"  [outsourced hint]

# ContactCard — field labels and placeholders
"Full name"                                   [label — self-progress]
"Full name*"                                  [label — outsourced (asterisk appended)]
"e.g. Sarah Johnson"                          [placeholder]
"Phone"                                       [label]
"07700 900000"                               [placeholder]
"Email"                                       [label]
"sarah@example.com"                           [placeholder]
"At least one required"                       [helper text below phone+email — outsourced] ← FLAG: Rule 1 ("required" with no stated subject — system-internal language)

# ContactCard — per-row feedback
"We can reach this vendor"                    [success — outsourced, vendor with name + contact] ← FLAG: Rule 1 ("we can reach" = system capability statement), Rule 2 ("vendor" = schema term in feedback copy)
"We can reach this purchaser"                 [success — outsourced, purchaser with name + contact] ← FLAG: Rule 1, Rule 2 (same)
"Add a phone or email so we can reach them"   [warning — outsourced, name but no contact] ← FLAG: Rule 1
"Eligible for portal invite"                  [info — agent mode, name + contact present] ← FLAG: borderline Rule 1 (system-determined eligibility with no stated criteria visible to user)

# Solicitors section header
"Solicitors & Broker"                         [accordion title]
"Seller's solicitor"                          [sub-label]
"Buyer's solicitor"                           [sub-label]

# Solicitors — loading state (autofill)
"Searching for solicitor…"                    [spinner text] ← FLAG: Rule 1 (system activity)

# Solicitors — populated state
"No case handler selected"                    [fallback when firm set but no contact] ← FLAG: Rule 2 ("case handler" = internal role term; agents know solicitor contacts, not "case handlers")
"Change"                                      [clear/reset button]
"Referred by us"                              [referral checkbox label]

# Solicitors — memo hint
"We found [firm name] on the memo — search above to add"  [amber hint] ← FLAG: Rule 1 ("on the memo" = system explanation)

# Mortgage broker sub-section
"Mortgage broker"                             [sub-label]
"Optional"                                    [badge]
"Purchaser referred to [firm name]"           [broker referral checkbox label]

# FieldIndicator / FieldHint (shown next to various fields)
"We couldn't read this — please add"          [default failed hint] ← FLAG: Rule 1 (system describing its own parse failure)
"Not on memos — please complete"              [default not-on-memos hint] ← FLAG: Rule 2 ("not on memos")
"Not on memos — still needed"                 [agent fee not-on-memos override] ← FLAG: Rule 2
"Not on memos — add"                          [custom override, purchase type] ← FLAG: Rule 2 (same)
"We couldn't read this — please add contact details"  [contacts failed hint] ← FLAG: Rule 1 (same pattern)

# NOTE — three near-twin strings confirmed as distinct:
# (1) MemoStatusBar error "Couldn't read the memo…" (above, in # MemoStatusBar — error state):
#     Full API failure — entire extraction failed. Renders as a single status bar replacing MemoStatusBar content.
# (2) FieldHint default "We couldn't read this — please add":
#     Per-field AI null. Renders under individual field labels (address, price, solicitor fields).
# (3) FieldHint contacts "We couldn't read this — please add contact details":
#     Same pattern as (2), different suffix. Scoped to contact fields (vendor/purchaser entries).
# All three are genuinely distinct strings in distinct rendering contexts — not copy-paste artifacts.

# CollapsibleSection headers
"Price & Fees"                                [section title]
"Notes"                                       [section title]
"Chain"                                       [section title]

# CollapsibleSection summaries (shown when collapsed)
"Set price and fees"                          [price section summary — nothing entered]
"£X · £Y fee + VAT"                          [price section summary — dynamic]
"with referral"                               [appended to price summary when referral set]
"No fee set"                                  [appended when price but no fee]
"Add any context about this transaction"      [notes summary — empty]
[first 60 chars of notes, truncated with "…"] [notes summary — with content]
"Add chain (optional)"                        [chain summary — no stubs]
"1 link added"                                [chain summary — singular]
"N links added"                               [chain summary — plural]

# PriceFeesSection
"Sale price"                                  [label]
"Agent fee"                                   [label]
"not on memos"                                [annotation] ← FLAG: Rule 2
"Fixed £"                                     [segment toggle option]
"Percent %"                                   [segment toggle option]
"%"                                           [unit — percent mode]
"0"                                           [placeholder — price and fee inputs]
"+ VAT"                                       [VAT toggle option]
"Inc VAT"                                     [VAT toggle option]
"Net to agency: "                             [label in green strip]
"— Add a sale price to calculate"             [green strip — no price]
"— Add an agent fee to calculate"             [green strip — price but no fee]
"£X on a £Y sale"                             [green strip — calculated]
"· +£Z solicitor referral"                   [green strip suffix — with referral]
"· +£Z broker referral"                       [green strip suffix — with broker referral]

# PriceFeesSection calc line (dynamic, shown below fee input)
"£X total inc VAT @ 20%"                     [fixed fee, exclusive VAT]
"£X ex VAT @ 20%"                             [fixed fee, inclusive VAT]
"Y% of £Z = £A + VAT (£B)"                   [percent fee, exclusive VAT]
"Y% of £Z = £A inc VAT"                       [percent fee, inclusive VAT]

# NotesSection
"Notes"                                       [label]
"Any context about this transaction…"         [placeholder]

# ChainSection — collapsed state
"Chain"                                       [heading]
"(optional)"                                  [annotation after heading]
"Is this property part of a chain?"           [body]
"Adding a chain sends invite links to the other agents involved."  [sub-body]
"+ Add chain"                                 [button]

# ChainSection — expanded state
"Chain"                                       [heading]
"(optional)"                                  [annotation]
"× Remove chain"                              [collapse button]
"Your sale's position in the chain"           [position selector label]
"Top of chain"                                [radio option]
"No sale above this one"                      [radio note]
"Bottom of chain"                             [radio option]
"No sale below this one"                      [radio note]
"Middle of chain"                             [radio option]
"I don't know yet"                            [radio option]
"Your file"                                   [badge on originator card]
"Your sale"                                   [fallback address text on originator card]
"Email needed to send invite"                 [stub card amber text — no valid email] ← FLAG: passive. Rule 3.
"Edit"                                        [stub card button]
"Remove"                                      [stub card button]
"+ Add sale above"                            [add button]
"+ Add sale below"                            [add button]

# ChainSection — browser confirm dialogs (not styled UI)
"Discard chain and N added node?" / "Discard chain and N added nodes?"  [confirm on Remove chain]
"You've added N node above. Remove them?" / "You've added N nodes above. Remove them?"  [confirm on position change]
"You've added N node below. Remove them?" / "You've added N nodes below. Remove them?"  [confirm on position change]

# FilePreview
"File Preview"                                [header label]
"LIVE"                                        [live badge]
"Property"                                    [section label]
"No address yet"                              [address fallback]
"Tenure?"                                     [dashed badge — tenure unset]
"Purchase type?"                              [dashed badge — type unset]
"Mortgage"                                    [purchase type pill]
"Cash buyer"                                  [purchase type pill]
"Cash from proceeds"                          [purchase type pill]
[dynamic: tenure — "freehold" / "leasehold" — rendered with textTransform: capitalize]
"Parties"                                     [section label]
"VENDORS"                                     [sub-label]
"PURCHASERS"                                  [sub-label]
"None"                                        [contacts fallback]
"Price & Fees"                                [section label]
"No price set"                                [price fallback]
[dynamic: formatted price, e.g. "£375,000"]
[dynamic: fee label, e.g. "£4,200 fee + VAT"]
"Milestones (N)"                              [section label — only shown when Stage 1 complete and milestones > 0]
"V"                                           [vendor-side milestone indicator]
"P"                                           [purchaser-side milestone indicator]
"+ N more"                                    [overflow count]
"Fill contacts and fees when ready, then create"  [status strip — Stage 1 done]
"Complete address, tenure and purchase type to continue"  [status strip — Stage 1 incomplete] ← FLAG: Rule 2 ("tenure", "purchase type" = schema field names)

# ResearchPanel — idle
"Property Research"                           [header]
"Enter postcode — e.g. BS6 7TH"              [input placeholder]
"Look up"                                     [search button — appears when valid postcode entered]
"Look up any property to see sale history, EPC rating, and more — before filling in the form."  [explainer]
"Last sold price & date"                      [feature bullet]
"EPC energy rating"                           [feature bullet]
"Freehold or leasehold"                       [feature bullet]
"Full sale price history"                     [feature bullet]
"Sources: HM Land Registry · EPC Register"   [attribution]

# ResearchPanel — error
"We couldn't find data for this address. The form still works as normal."  [error message]
"Try again"                                   [retry button]

# PropertyDossier
"Property Record"                             [header label — Mode B: specific property matched]
"Area Research · [postcode]"                  [header label — Mode A: postcode-level only]
"Postcode-level data — no specific property matched yet"  [Mode A subtitle] ← FLAG: borderline Rule 1 ("matched" = system activity language)
"From memo"                                   [badge — auto-triggered from MOS]
"Last sold"                                   [tile label]
"EPC rating"                                  [tile label]
"Tenure"                                      [tile label — when no mismatch]
"Tenure (Land Registry)"                      [tile label — when form tenure mismatches LR]
"EPC (postcode area)"                         [tile label — Mode A EPC]
[dynamic: last sold price, date, EPC rating, EPC score, EPC valid date, tenure value + since year]
"Use this"                                    [button — on tenure mismatch tile]
"Other recent sales in [postcode]"            [sales section label — Mode B]
"Recent sales nearby"                         [sales section label — Mode A]
"Address unknown"                             [fallback in sales row]
"No property data found for this address."    [no data fallback — Mode B]
"No property data found for this postcode."   [no data fallback — Mode A]
"Sources: HM Land Registry · EPC Register"   [attribution]
"Clear property research"                     [aria-label on × button]

# DraftPanel
"Saved drafts"                                [panel header]
[dynamic: draft propertyAddress or "Unnamed draft"]
[dynamic: relative time]
"Remove draft"                                [aria-label on ✕ button]
"Hide drafts"                                 [toggle — open]
"1 draft"                                     [toggle — closed, singular]
"N drafts"                                    [toggle — closed, plural]

# ChangeFileModal
"Change memo?"                                [title]
"Changing the memo will reset any edits you've made. The form will be re-populated from the new document."  [body]
"Change file"                                 [confirm button]
"Cancel"                                      [cancel button]
"Close"                                       [aria-label on × icon]

# DuplicateAddressModal
"Address already exists"                      [title]
"There's already an active file for [address]."  [body — no assignee]
"There's already an active file for [address]. It is assigned to [name]."  [body — with assignee]
"View existing file"                          [link — navigates to existing transaction]
"Create anyway"                               [secondary button]
"Cancel"                                      [close button]

# Submit area
"Create transaction"                          [submit button — ready]
"Creating..."                                 [submit button — loading]
"Add 1 vendor to continue"                    [submit button — outsourced, no vendor name] ← FLAG: Rule 1 ("to continue" = system gate language), Rule 2 ("vendor" = schema term; "1" = schema-numeric format)
"Add a contact method to continue"            [submit button — outsourced, vendor name but no phone/email] ← FLAG: Rule 1 ("to continue"), Rule 2 ("contact method" = developer abstraction — agents call these "phone" and "email", not a "contact method")
"Add 1 purchaser to continue"                 [submit button — outsourced, no purchaser name] ← FLAG: Rule 1, Rule 2 (same as vendor variant)
"Add a contact method to continue"            [submit button — outsourced, purchaser name but no phone/email] ← FLAG: Rule 1, Rule 2 (same)
"Save draft"                                  [save draft button — idle]
"Saving draft…"                               [save draft button — saving]

# OutsourcedHintCard (amber callout above submit when outsourced + incomplete)
[same text as submitButtonText — dynamic, same variants as submit button] ← FLAG: all four variants carry the same Rule 1 + Rule 2 flags as the submit button text above

# Toast messages
"Draft saved"                                 [success toast — on saveDraft]
"Couldn't save draft. Try again."             [error toast — on saveDraft fail]
"Couldn't remove draft."                      [error toast — on deleteDraft fail]
"Something went wrong — your file wasn't created. Try again or contact support."  [error toast — submit fail]
"Select tenure and purchase type to continue"  [error toast — Stage 2 submit, both missing] ← FLAG: Rule 1 ("to continue" = gate language), Rule 2 ("tenure", "purchase type" = schema field names)
"Select tenure to continue"                   [error toast — Stage 2 submit, only tenure missing] ← FLAG: Rule 1, Rule 2 (same)
"Select purchase type to continue"            [error toast — Stage 2 submit, only type missing] ← FLAG: Rule 1, Rule 2 (same)
```

---

## 8. Desktop view

| Field | Value |
|---|---|
| Breakpoint | Desktop applies at ≥ 1024px |
| Layout | Two-column: form col 65fr / right col 35fr, `gap: 32px`. Both columns start-aligned. |
| Navigation | AgentShell renders full sidebar, visible permanently |
| PageHeader | Full-width above the two-column grid. h1 "New Sale" + subtitle. |
| Right column | Sticky (`position: sticky; top: 24px`). Shows ResearchPanel, PropertyDossier, or FilePreview depending on state. Hidden on mobile. |
| Contacts grid | Two-column (vendor left, purchaser right) within the form column. |
| Solicitors grid | Two-column (seller's solicitor left, buyer's solicitor right). Full-width broker section below. |
| Contact detail grid | Two-column (phone left, email right) within each ContactCard. |
| Draft panel | Fixed bottom-left, `width: 272px`. Floats over page content. Not hidden at desktop. |
| Modals | Portal-rendered, centred with backdrop blur. `maxWidth: 440px` (duplicate), `maxWidth: 360px` (change file). |

```
Desktop layout:
┌─ AgentShell sidebar (fixed) ──┬─ main content area (fluid) ──────────────────────────────────┐
│  logo                         │  "New Sale" h1                                                │
│  nav links                    │  "Drop your memo of sale to get started, or fill in manually."│
│  user strip                   ├──────────────────────────────────────┬──────────────────────── ┤
│                               │  FORM COLUMN (65fr)                  │  RIGHT COLUMN (35fr)   │
│                               │  ┌ HeroCard (hero state)           ┐ │  ┌ ResearchPanel      ┐│
│                               │  │  breathing dot                   │ │  │  postcode search   ││
│                               │  │  "Ready to add a sale?"          │ │  │  feature bullets   ││
│                               │  │  [Drop a memo of sale]           │ │  └────────────────────┘│
│                               │  │  [Fill in manually]              │ │                        │
│                               │  │  [Resume draft…] (if drafts)     │ │                        │
│                               │  └──────────────────────────────────┘ │                        │
│                               │                                        │  [tab strip in Stage 2]│
│                               │  ┌ MemoStatusBar (extracted state) ┐   │  ┌ FilePreview       ┐│
│                               │  │  reading → done/error           │   │  │  LIVE badge       ││
│                               │  └──────────────────────────────────┘   │  │  property        ││
│                               │  ┌ Stage1SummaryBar (Stage 2)      ┐   │  │  parties         ││
│                               │  │  address · tenure · type · mode │   │  │  price           ││
│                               │  └──────────────────────────────────┘   │  │  milestones      ││
│                               │  ┌ Stage2Sections                  ┐   │  │  status strip    ││
│                               │  │  OutsourcedBanner / PortalPrompt│   │  └────────────────────┘│
│                               │  │  Contacts (2-col grid)          │   │                        │
│                               │  │  Solicitors & Broker (accordion)│   │                        │
│                               │  │  Price & Fees (collapsed)       │   │                        │
│                               │  │  Notes (collapsed)              │   │                        │
│                               │  │  Chain (collapsed)              │   │                        │
│                               │  │  [OutsourcedHintCard if needed] │   │                        │
│                               │  │  [Create transaction]           │   │                        │
│                               │  │  [Save draft]                   │   │                        │
│                               │  └──────────────────────────────────┘   │                        │
└───────────────────────────────┴────────────────────────────────────────┴────────────────────────┘
[DraftPanel — fixed bottom-left, 272px, floats over content]
```

### Theming

The agent app has six themes. The active theme is stored in `user.agentPreferences.theme` (JSON field on the User model) and defaults to `sunset`. Each agency's users can choose their own theme independently.

| Field | Value |
|---|---|
| Mechanism | `data-theme="[name]"` attribute on `.agent-shell-root` div — set in `AgentShell.tsx:167` via the `theme` prop |
| Theme resolution | `getAgentTheme(session.user.agentPreferences)` in `lib/agent/themes.ts:31` |
| Token file | `app/agent/styles/themes.css` — six `[data-theme="..."]` CSS attribute-selector blocks |
| Token count | ~100 tokens per theme, all prefixed `--agent-*` |
| Token names | Identical across all six themes — only values differ. Token name for brand/primary color is always `--agent-coral` / `--agent-coral-deep` regardless of actual hue |
| Default | `sunset` |

| Theme | Brand character | Background character |
|---|---|---|
| `sunset` (default) | Coral red (`#FF6B4A`) | Warm cream (`#FFF5EC`) |
| `coastal` | Teal (`#1F5A6E`) | Sea blue-grey (`#DBEAF0`) |
| `heritage` | Blue-violet (`#4A6FB5`) | Slate blue (`#DCE7F8`) |
| `slate` | Dark slate blue | Blue-grey |
| `emerald` | Forest green | Green-tinted cream |
| `claret` | Wine red (`#6E1F2E`) | Rose (`#F5DEDF`) |

**Production constraint:** Production components touched in Stage 4 must use only `--agent-*` CSS variables and `agent-*` CSS utility classes — no hardcoded hex or rgba values. The redesign must hold across all six themes.

**Stage 2 test page:** Theme coverage was absent in the initial test page build (no `data-theme` attribute, all inline colors hardcoded to sunset values). Fixed in this amendment — see Amendments below.

---

## 9. Mobile view

| Field | Value |
|---|---|
| Breakpoint | Mobile applies at < 1024px |
| Layout | Single column. Right column (`new-sale-right-col`) is `display: none` at < 1024px — hidden entirely. |
| Navigation | AgentShell sidebar collapses to mobile nav (hamburger or bottom bar — per AgentShell behaviour, not examined in this inventory). |
| Right column | **Hidden at all viewport sizes below 1024px.** FilePreview, ResearchPanel, PropertyDossier, and tab strip are all invisible on mobile. |
| Contacts grid | Two-column at > 768px; **single-column at ≤ 768px** (vendor then purchaser stacked). Vertical divider hidden. |
| Contact detail grid | Two-column (phone + email) at > 480px; **single-column at ≤ 480px**. |
| DraftPanel | Fixed bottom-left — still visible on mobile. May overlap form content at very small widths. |
| Modals | Portal-rendered, padded with `margin: 0 16px`. Centred vertically. Fit within 375px viewport. |
| MemoStatusBar | Full width, single column. Amber pills row is `overflowX: auto` — horizontally scrollable on mobile. |
| Stage1Fields | Single column within card. Tenure and purchase type pills stack vertically (column flex). City/postcode remain two-column (not explicitly broken at mobile — inspect needed). |

```
Mobile layout (375px):
┌─────────────────────────────────────────────┐
│ [hamburger/nav]  New Sale  [actions]         │  ← AgentShell topbar (sticky)
├─────────────────────────────────────────────┤
│                                             │
│  "New Sale" h1                              │
│  "Drop your memo of sale to get started…"  │
│                                             │
│  ┌ HeroCard (hero state) ─────────────────┐ │
│  │  breathing dot                         │ │
│  │  "Ready to add a sale?"                │ │
│  │  "Drop a memo and we'll fill…"         │ │
│  │  [Drop a memo of sale]                 │ │
│  │  [Fill in manually]                    │ │
│  │  [Resume…] (if draft)                  │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  (Right column: NOT RENDERED)               │
│                                             │
│  ┌ MemoStatusBar (if extracting/extracted) ┐ │
│  │  reading → done/missing/error          │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌ Stage1SummaryBar (Stage 2) ─────────────┐ │
│  │  address · tenure · type · Edit        │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌ Stage2Sections ────────────────────────┐ │
│  │  OutsourcedBanner / PortalPrompt       │ │
│  │  Contacts (SINGLE COLUMN at ≤768px)    │ │
│  │    [Vendors card]                      │ │
│  │    [Purchasers card]                   │ │
│  │  Solicitors & Broker                   │ │
│  │  Price & Fees (collapsed)              │ │
│  │  Notes (collapsed)                     │ │
│  │  Chain (collapsed)                     │ │
│  │  [Create transaction]                  │ │
│  │  [Save draft]                          │ │
│  └────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
[DraftPanel — fixed bottom-left, may overlap form]
```

**Critical mobile question — what agents cannot see:**  
The right column is entirely hidden on mobile. This means:
- **FilePreview** (live transaction preview) — not visible
- **ResearchPanel** (property research lookup) — not visible
- **PropertyDossier** (land registry / EPC data) — not visible

Agents on mobile receive no visual confirmation of what their file will look like until it's created. The MemoStatusBar missing-field pills and the summary bar are the only feedback. This is a known design trade-off, not a bug — document as is. Stage 2 should decide whether to surface a lighter mobile equivalent.

**Mobile-specific investigation needed in Stage 2:**
- City/postcode row inside Stage1Fields uses `gridTemplateColumns: "1fr 1fr"` with no explicit mobile breakpoint in the component. Appears to remain two-column even on mobile — confirm at 375px.
- DraftPanel fixed at `bottom: 24px; left: 24px` — may obscure the save/submit buttons at small heights. Confirm.

---

## 10. Animations / transitions already in place

| Element | Animation | Source |
|---|---|---|
| Breathing dot (HeroCard) | `agent-pulse-dot 2.4s ease-in-out infinite` | `agent-system.css` |
| LIVE pulse dot (FilePreview) | `agent-pulse-dot 2s ease-in-out infinite` | `agent-system.css` |
| MemoStatusBar spinner | `memo-spin 0.8s linear infinite` (local keyframe in component) | `MemoStatusBar.tsx` inline `<style>` |
| MemoStatusBar field tick-through | Opacity 0→1 per field, `transition: opacity 250ms` | `MemoStatusBar.tsx` |
| Solicitor autofill spinner | `agent-spin 0.7s linear infinite` | `agent-system.css` |
| Stage2Sections stagger | `agent-section-in 360ms cubic-bezier(0.16,1,0.3,1) Nms both` — each section delayed by 80ms increments | `Stage2Sections.tsx` + `agent-system.css` |
| Stage1Fields expand (in Stage 2) | `agent-section-in 360ms` | `NewSaleFlow.tsx` inline style |
| Stage1SummaryBar reveal | `agent-section-in 360ms` | `NewSaleFlow.tsx` inline style |
| Right column content switch | `right-col-fadein 220ms cubic-bezier(0.16,1,0.3,1) both` — keyed on `rightColumnMode` | `NewSaleFlow.tsx` + `agent-system.css` |
| ContactCarousel card slide | `carousel-slide-left 240ms` / `carousel-slide-right 240ms` — keyed on `animKey` | `ContactCarousel.tsx` + `agent-system.css` |
| ContactCarousel dot expansion | `transition: width 200ms cubic-bezier(0.16,1,0.3,1)` | `ContactCarousel.tsx` inline style |
| ChangeFileModal | `agent-modal-in 280ms cubic-bezier(0.34,1.56,0.64,1) both` (spring — slightly bouncy) | `ChangeFileModal.tsx` + `agent-system.css` |
| DuplicateAddressModal | `agent-modal-in 280ms cubic-bezier(0.16,1,0.3,1) both` | `DuplicateAddressModal.tsx` + `agent-system.css` |
| DuplicateAddressModal backdrop | `agent-backdrop-in 180ms ease both` | `DuplicateAddressModal.tsx` |
| ResearchPanel skeletons | `agent-skeleton-pulse 1.5s ease-in-out Xs infinite` (staggered) | `ResearchPanel.tsx` + `agent-system.css` |
| CollapsibleSection / SectionAccordion | **NEW — added in Stage 2 (Stage 4 Commit B production change):** `grid-template-rows: 0fr→1fr` + `opacity: 0→1` CSS transition on expand (200ms open / 150ms close), `cubic-bezier(0.16,1,0.3,1)`. Two-wrapper pattern: `.acc-wrap` (grid container) + `.acc-inner { overflow: hidden }`. Applies to Price & Fees, Notes, Chain (CollapsibleSection) and Solicitors & Broker (SectionAccordion). | New CSS utility classes in production component(s) |
| HeroCard drag-over | `transition: background 200ms, border 200ms` on card; `transition: color 200ms` on heading; `transition: opacity 200ms` on sub-copy | `HeroCard.tsx` inline style |

**Stage 4 Commit B spot-check note:** Three animations in the table above only fire on real state transitions — they are rendered as static mockups on the test page. The Commit B spot-check (step 7) must exercise all three:

1. **MemoStatusBar field tick-through** (`transition: opacity 250ms` per field) — requires a real MOS upload. Watch that each extracted field ticks in with the opacity transition as the AI response streams in.
2. **Stage1Fields expand** (`agent-section-in 360ms`) — triggers when Street Address + Tenure + Purchase Type all have values. Advance through Stage 1 fields on the real form to verify the expand animates rather than appearing instantly.
3. **Stage1SummaryBar reveal** (`agent-section-in 360ms`) — same trigger as Stage1Fields. Confirm the summary bar slides in as Stage 2 sections appear.

If any of these three animate incorrectly (or not at all) during the spot-check, treat it as a regression and do not proceed to Commit C.

4. **Voice alignment with transaction-detail Stage 3 approved copy** — Before Commit C, cross-check all user-facing strings in the new-sale-v2 production components against the three areas locked in the transaction-detail Stage 3 pass: (a) milestone→step language in any success toasts, confirmation labels, or button copy (e.g. "Step confirmed", "Step undone", "Skipped" — not "Milestone confirmed", "Milestone reversed", "Marked not required"); (b) not_required→Skipped consistency — every instance of the not_required state shown to users must read "Skipped", never "Not required" or "Marked not required"; (c) fee row format: where a per-file fee is displayed inline, use the "Self-managed · £59 inc. VAT" pattern (service label · amount inc./ex. VAT), not "Self-progressed (inc VAT) £59" or any variant. If any string drifts from the approved copy, fix it before Commit C — do not carry voice drift into production.

---

## 11. Known edge cases

- **Duplicate address guard:** Submitting with an address matching an existing `active` or `on_hold` file (same agency) triggers `DuplicateAddressModal`. Address comparison is case-insensitive, whitespace-collapsed. "Create anyway" bypasses the guard. The guard runs server-side only — no client-side check.

- **Outsourced contact validation is client-side only:** The server action does NOT re-validate outsourced contact requirements. A direct API call can create an outsourced file with no contacts. Not a Stage 4 concern — do not touch server actions in this pass.

- **MOS auto-save on upload:** When a file is dropped, the flow auto-saves a draft immediately (so the navigation guard doesn't fire). This draft may appear in the panel before the user has done anything intentional. The `currentDraftId` is set after this auto-save.

- **Navigation guard (`beforeunload`):** Active when `formIsDirty` (not hero/extracting) AND `currentDraftId` is null. If a draft has been saved (auto or manual), the guard is suppressed. This means a user who drops a file (auto-draft created) and then navigates away will NOT get the browser dialog, even if they've made additional edits beyond the MOS extraction.

- **MOS extraction "no confirmation step":** Extracted values are applied directly to form fields. There is no review/confirm step. The user sees the populated fields and can edit them, but there is no explicit "Accept these values" affordance.

- **Chain collapse `confirm()` dialog:** Clicking "× Remove chain" when stubs exist calls `window.confirm()` — a native browser dialog, not an agent-styled modal. Inconsistent with the rest of the UI. Not a Stage 4 concern (chain UI is deferred to the chain sweep). Note it in Stage 2.

- **"Tell me more" dead button:** `PortalInvitePrompt` renders a "Tell me more" button with no `onClick` handler. Clicking it does nothing. This is a functional gap — flag in Stage 2, file in `docs/TODO.md`, do not fix in the polish pass.

- **`prisma as any` cast:** `app/agent/transactions/new-v2/page.tsx` line 7. Already filed per PAGE_LIST.md note. Do not touch.

- **Stage 1 validity gate for loading draft:** When loading a draft, if Stage 1 fields are already valid, the form auto-advances to Stage 2. This means a partially-filled draft may present differently depending on how much was filled at save time.

- **Solicitor autofill race condition:** If two solicitors are extracted from the MOS, both `autoFillSolicitor` calls run in parallel. Each updates `formFields` independently. If both resolve nearly simultaneously, one update could overwrite the other. In practice this is unlikely but worth noting.

- **Right column hidden on mobile:** Not a regression — intentional design. See Section 9.

---

## 12. Out of scope for redesign

- **Four parallel server queries** (`agencyRecommendedSolicitor.findMany`, `agencyPreferredBroker.findUnique`, `propertyTransaction.findMany` for drafts, `milestoneDefinition.findMany`) — data fetching logic not touched; only the visible loading state during them is in scope (new `loading.tsx`)
- **`createTransactionAction`** — server action, milestone initialisation, contact creation, chain creation, email invites — not touched
- **`saveDraftAction` / `discardDraftAction`** — server actions — not touched
- **`POST /api/agent/memo-parse`** — AI extraction, Claude API call, Sonnet model selection — not touched
- **`usePropertyIntel` hook** — Land Registry + EPC API calls — not touched
- **`SolicitorPicker` / `BrokerPicker`** — search and selection components — not touched (out of scope for this pass)
- **`AddNodeDrawer`** — chain node entry drawer — not touched (deferred to chain sweep)
- **`ChainSection` polish** — deferred to chain sweep per PAGE_LIST.md
- **`ContactsSection` / `ContactGroup`** — legacy components still imported but superseded by `ContactCarousel` — not touched
- **Outsourced server-side validation gap** — not a UI concern for this pass
- **"Tell me more" dead button** — functional gap, not voice/design — file in `docs/TODO.md`, do not fix in pass
- **`prisma as any` cast** — code smell, not UI — filed, do not fix
- **Navigation guard suppression edge case** — functional concern, not UI

---

## Amendments

| Date | Discovery | Added to which section |
|---|---|---|
| 2026-05-10 | **Discovery 1 — Branch themes not inventoried.** The agent app has a six-theme system (`sunset`, `coastal`, `heritage`, `slate`, `emerald`, `claret`). Mechanism: `data-theme="[name]"` attribute on `.agent-shell-root` div (`AgentShell.tsx:167`), sourced from `getAgentTheme(user.agentPreferences)` in `lib/agent/themes.ts`. Each theme defines ~100 `--agent-*` CSS tokens in `app/agent/styles/themes.css`. The Stage 2 test page had no `data-theme` attribute and used hardcoded sunset values for all inline colors (constants `CORAL`, `TP`, `TS`, `TM`, `BORDER`, `GLASS`, `AMBER`, `SUCCESS` and the page/mobile-frame background gradients). Fixed: (a) `data-theme={theme}` added to test-page root div; (b) six-button theme switcher added to the top controls bar next to the reduced-motion toggle. Elements using `agent-glass` and other CSS utility classes now respond to the theme switcher. Hardcoded inline color constants reported to Ellis — pending decision on conversion (see Stage 2 session notes). | Section 8 (new "Theming" subsection) |
| 2026-05-10 | **Discovery 2 — Animation audit.** Full audit of all 15 animations in section 10 against the test page: 9 fully correct; 3 acceptable static-mockup limitations; 1 regression; 2 borderline. **Regression (fixed):** `right-col-fadein 220ms` (section 10 item 9) was not applied to the right-column content switch in Section G. Fixed: `key={rightV}` added to the wrapper div; animation applied. **Acceptable limitations (noted, not regressions):** (1) MemoStatusBar spinner uses `agent-spin` as a proxy — production uses a component-local `memo-spin` keyframe defined inside `MemoStatusBar.tsx` that cannot be imported into the test page; visual effect is identical. (2) Field tick-through (`transition: opacity 250ms` per field) and (3) Stage1Fields/SummaryBar reveal animations are point-in-time triggered events that cannot be reproduced in a static state-toggle view. **Accordion animation:** Ellis approved adding `grid-template-rows: 0fr→1fr` + `opacity: 0→1` CSS transition to `CollapsibleSection` and `SectionAccordion`. 200ms open / 150ms close, `cubic-bezier(0.16,1,0.3,1)`. CSS transitions only — no new keyframe. Shown on test page for Stage 2 verification. This is a Stage 4 Commit B production change. Full note added to section 10. | Section 10 (accordion row updated; Commit B spot-check note added) |
| 2026-05-11 | **Discovery 3 — Voice alignment spot-check added to Commit B.** During Stage 3 voice review of the transaction-detail test page, three areas were locked as canonical: (a) milestone→step in success messages and confirmations; (b) not_required→Skipped everywhere; (c) fee row format "Self-managed · £59 inc. VAT". A 4th item has been added to the Stage 4 Commit B spot-check note requiring these to be cross-checked against new-sale-v2 production components before Commit C proceeds. | Stage 4 Commit B spot-check note |
