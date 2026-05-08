# Discovery: Creating a sale (Article 9)

**Date:** 2026-05-08  
**Sources read:** `app/agent/transactions/new/page.tsx`, `components/transactions/NewTransactionForm.tsx`, `app/api/agent/memo-parse/route.ts`, `app/actions/transactions.ts`, `lib/services/transactions.ts`, `lib/services/milestones.ts`, `components/chain/ChainSection.tsx`

---

## 1. Route verification and page identity

- **Route:** `/agent/transactions/new`
- **Server component:** `app/agent/transactions/new/page.tsx` (67 lines)
- **Form component:** `components/transactions/NewTransactionForm.tsx` (1616 lines, `"use client"`)
- **H1 (verbatim):** "New Transaction"
- **Subtitle (verbatim):** "Fill in the details below to create a new property file."
- **Shell:** AgentShell (agent app surface)
- No redirect guard on the page itself — any authenticated agent reaching the URL will see the form

---

## 2. Entry points (confirmed by code grep)

| Surface | Location | Button label |
|---|---|---|
| Hub header | `app/agent/hub/page.tsx:153, 328` | "New sale" |
| Hub empty state | `app/agent/hub/page.tsx:188` | "New sale" |
| All Files header | `app/agent/transactions/page.tsx:156` | "New sale" |
| All Files empty state | `app/agent/transactions/page.tsx:250` | "New sale" |
| Dashboard header | `app/agent/dashboard/page.tsx:76` | "New sale" |
| Dashboard empty state | `app/agent/dashboard/page.tsx:105` | "New sale" |
| Analytics empty state | `app/agent/analytics/page.tsx:115` | "+ Submit your first sale" |
| `/agent/quick-add` | `app/agent/quick-add/page.tsx:4` | (redirect — no button) |

The `/agent/quick-add` route is a bare redirect; it was likely used historically and is now an alias.

---

## 3. Page-level data loading (server)

`app/agent/transactions/new/page.tsx` fetches:

- **`recommendedFirms`** — from `agencyRecommendedSolicitor` table, scoped to the agency. Passed to the form to drive the referral checkbox: if a solicitor firm the user selects is in this list, the referral checkbox appears.
- **`drafts`** — all `PropertyTransaction` records with `status: "draft"` belonging to the agency. Passed as `initialDrafts` to populate the `DraftFloatingPanel`.
- **`userRole`** — `session.user.role` — passed to the form component.
- **`redirectBase`** — hardcoded `"/agent/transactions"`. Controls where the user is sent after file creation.

---

## 4. Overall form layout

Two-column layout:

- **Left glass-card (main form):** memo upload section, address, tenure, purchase type, purchase price, agent fee, notes, chain section, progressor toggle, submit button.
- **Right column (stacked):** contacts card, then solicitors card below it.

The right column is always visible — there is no scroll lock or step-based flow. The user can fill either column in any order.

---

## 5. Memo of sale upload

File input at the top of the left glass-card. This is the only drag-and-drop / file-input area on the form.

**API route:** POST `/api/agent/memo-parse`

**Accepted file types:** PDF, JPEG, PNG, WEBP, GIF  
**Max size:** 10 MB

**What happens:**
1. File is uploaded to Supabase Storage at path `mos/{agencyId}/{uuid}.{ext}`
2. File is passed to Claude API (`claude-sonnet-4-6`) for content extraction
3. Claude returns a structured JSON object: `streetAddress`, `city`, `postcode`, `purchasePricePence`, `tenure`, `vendors[]` (name, phone, email), `purchasers[]` (name, phone, email), `vendorSolicitor`, `purchaserSolicitor`
4. The form auto-fills any matching fields with the extracted values

**Auto-fill tracking:** `memoFields: Set<string>` records which form fields were populated from the memo. Each auto-filled field label shows a **`MemoTag`** badge — a purple star with "auto-filled" text. Users can override auto-filled values.

**Error messages (verbatim from route):**
- "Please upload a PDF or image (JPG, PNG, WEBP)" — wrong file type
- "File too large — please use a file under 10 MB" — over limit
- "Couldn't extract data from this document — try a clearer scan" — extraction failure

**Effect at submission (if MOS was uploaded):**
- VM2 ("Seller has received the memorandum of sale") and PM2 ("Buyer has received the memorandum of sale") are auto-confirmed as complete milestones immediately on file creation.
- The MOS file is stored as a `TransactionDocument` record with `source: "mos"`.
- Return value includes `mosAutoConfirmed: true`, which drives the redirect suffix `?mosConfirmed=1` (vs `?newFile=1` when no MOS was uploaded).

---

## 6. Property details fields

All in the left glass-card.

| Field | Required for canSubmit | Type | Notes |
|---|---|---|---|
| Street address | Yes | Text input | Duplicate-checked at submit; normalized (lowercase, whitespace-collapsed) against active/on_hold files in the agency |
| Tenure | Yes | Enum select | `freehold` / `leasehold` / `share_of_freehold` — affects milestone initialization |
| Purchase type | Yes | Enum select | `mortgage` / `cash_buyer` / `cash_from_proceeds` / `shared_ownership` / `help_to_buy` / `first_home_scheme` — affects milestone initialization |
| Purchase price | No | Number (pence) | Displayed as £; needed for live fee % calculation |
| Agent fee | No | Toggle: amount or % | "Fixed £" or "percent" with live £ calculation; VAT toggle (inclusive / exclusive) |
| Notes | No | Free text | Internal notes on the file |

---

## 7. Tenure and purchase type milestone effects

Source: `lib/services/milestones.ts:initializeMilestoneCompletions` (called at line 119 of `app/actions/transactions.ts` when both tenure and purchaseType are set).

**Freehold → auto not_required:**
- VM8 — seller's solicitor has requested the management pack
- VM9 — (leasehold-specific milestone)
- PM12 — (leasehold-specific milestone)

**Cash buyer or cash from proceeds → auto not_required:**
- PM5 — buyer has submitted their mortgage application
- PM6 — buyer has received their mortgage offer
- PM11 — buyer's solicitor has received the mortgage deed

**Exchange gate milestones → always locked:**
- VM18 — vendor solicitor confirmed readiness to exchange
- PM25 — purchaser solicitor confirmed readiness to exchange

**All other milestones with no prerequisites (or all prereqs are auto-NR) → `available`**

**All other milestones with unsatisfied prerequisites → `locked`**

**Important edge case:** `initializeMilestoneCompletions` is only called `if (input.tenure && input.purchaseType)`. If either is null at creation (which cannot happen via the form since both are required for `canSubmit`, but could happen via `promoteDraftAction` if the draft lacked these), milestones are never initialized.

---

## 8. Contacts

Right-side contacts card.

- **Roles:** vendor (seller), purchaser (buyer)
- **Maximum:** 2 vendors, 2 purchasers (4 total)
- **Fields per contact:** name (required for the contact), phone (optional), email (optional)
- **Portal token:** each contact is assigned `portalToken: randomUUID()` at creation — this is the token used to authenticate the portal link sent to clients

**Conditional required-ness (`requiresContacts` logic):**
- When `isAgent && progressedBy === "progressor"`: at least one vendor AND one purchaser are required, each with a valid contact method (phone or email). `canSubmit` blocks until this is satisfied.
- When `isAgent && progressedBy === "agent"` (self-managed): contacts are optional at creation.

---

## 9. Solicitors

Right-side solicitors card, below contacts.

- **Vendor solicitor:** firm (select from known firms) + specific contact at that firm (optional)
- **Purchaser solicitor:** firm + contact (optional)
- All four fields are optional

**Referral checkbox:** appears when the selected solicitor firm matches one of the agency's `recommendedFirms`. If ticked, a referral fee amount field appears. The stored fields are `referredFirmId` and `referralFee`.

---

## 10. Progressor toggle (self-managed vs outsourced)

Source: `components/transactions/NewTransactionForm.tsx:915`, `app/actions/transactions.ts:59–60`

- **Visible to:** agents only (`isAgent = role === "negotiator" || role === "director"`)
- **Options:** "Self-progress" (agent) / "Send to progressor" (progressor)
- **Default:** "agent" (self-managed)

| Toggle value | `progressedBy` | `serviceType` | Contacts required? |
|---|---|---|---|
| Self-progress | `"agent"` | `"self_managed"` | No |
| Send to progressor | `"progressor"` | `"outsourced"` | Yes (vendor + purchaser) |

**Non-agent users (sales_progressor, admin):** `resolvedProgressedBy` is always `"progressor"` server-side, regardless of any form value.

**What happens after submission (verified against `docs/OUTSOURCED_WORKFLOW_AUDIT.md`):**

The agent-side creation is fully functional: `serviceType = "outsourced"`, `progressedBy = "progressor"`, `assignedUserId = null` are correctly persisted. The agent sees the service type badge on their dashboard and file view.

What happens next on the internal side is a chain of built-but-broken pieces:

- An amber "unassigned files" banner exists on `/dashboard` (`app/dashboard/page.tsx` lines 39–83) — the code is correct, but the upstream `listTransactions(session.user.agencyId)` returns zero rows for internal staff because their `agencyId = null` (coerced to `""` in the JWT).
- The "Assign →" link in the banner targets `/transactions/{id}`, which 404s for internal staff (`getTransaction(id, "")` returns null → `notFound()`).
- An `AssignControl` component exists on the internal transaction detail page — but internal staff cannot reach that page.
- `assignUserAction` exists but also gates on `agencyId: session.user.agencyId` → throws "Transaction not found" for internal staff.
- No read path (`findMany({ where: { assignedUserId: session.user.id } })`) exists anywhere to show an internal staff member their assigned files.
- No notification fires when an outsourced file is submitted — no email, push, or in-app alert.

**Root cause of all broken items:** `session.user.agencyId === ""` for internal staff (null in DB → coerced to `""` in JWT). Every Prisma ownership check uses `agencyId: session.user.agencyId`. Transactions have real CUID `agencyId` values. `"" !== realAgencyId` → all lookups fail.

**For the article:** describe "Send to progressor" as handing the file off for Sales Progressor's team to manage. Do not describe the admin assignment flow (it isn't operational). Frame it as "the file is handled by the Sales Progressor team" without describing internal routing mechanics.

---

## 11. Chain section

Source: `components/chain/ChainSection.tsx`

**Collapsed state (default):** Shows label "Chain (optional)" and a link "+ Add chain".

**Expanded state — position selector:**
Four radio options:
- Top of chain — no sale above this one (hides "Add above" button)
- Bottom of chain — no sale below this one (hides "Add below" button)
- Middle of chain
- I don't know yet

Changing position when stubs already exist in the affected direction triggers a browser `confirm()` dialog.

**Stub fields (one per chain node):** property address, agency name, agent name, agent email, agent phone, notes. Agent email is required for invite sending.

**In-memory storage:** stubs are held in React state only. They are not persisted to DB until the form is submitted.

**On submission:**
1. `createChainV2` creates the `PropertyChain` and `ChainLink` records
2. If `sendInvites: true`: `sendChainInvite` is called for each stub with a valid email
3. Chain failure is **non-fatal**: `chainFailed: true` is returned in the action result; the transaction is created regardless

**Collapsing with stubs:** triggers browser `confirm()` — "Discard chain and N added nodes?"

---

## 12. Drafts

**`DraftFloatingPanel`:** fixed bottom-left overlay visible at all times while on the form. Shows count of saved drafts. Expands to a list with address, Edit and Discard buttons per draft.

**Navigation guard:** active whenever the form has unsaved content. Intercepts:
- `beforeunload` (browser navigation)
- Anchor clicks (internal navigation)

Shows a modal with three options:
- Save as draft
- Leave without saving
- Stay on page

**`saveDraftAction` (server action):**
- Creates a new `status: "draft"` transaction or updates an existing draft (by `draftId`)
- Saves: `propertyAddress`, `tenure`, `purchaseType`, `purchasePrice`
- Saves first vendor and first purchaser only (name, phone, email)
- **Does NOT save:** fee, notes, chain stubs, solicitor selections, second contacts, MOS metadata

**`discardDraftAction`:** deletes the draft via `deleteMany` where `{ id, agencyId, status: "draft" }`.

**`promoteDraftAction` (used by quick-add flow):** promotes a draft to `status: "active"`, runs `evaluateTransactionReminders`. Not used by the main form's submit flow.

---

## 13. Submission flow

Source: `app/actions/transactions.ts:createTransactionAction`

**`canSubmit` gate (client-side):**
- `!!streetAddress && !!tenure && !!purchaseType`
- Additionally: `(!requiresContacts || (hasVendor && hasPurchaser)) && contactMethodsValid`

**Server-side sequence:**

1. **Duplicate address check** — normalize address (lowercase, collapse whitespace); query active/on_hold files in the same agency. If match found and `!forceCreate`: throw `Error("DUPLICATE_ADDRESS")` with `duplicateId` and `assignedTo` attached.
   - Form response: `duplicateModal` appears with three buttons: "View existing file" (navigates), "Create anyway" (re-submits with `forceCreate: true`), "Cancel".

2. **`createTransaction` service** — creates the `PropertyTransaction` row:
   - `expectedExchangeDate` = now + 84 days (12 weeks) — set automatically, not shown to user at creation
   - `twelveWeekTarget` = same value
   - `serviceType`: `"self_managed"` if `progressedBy === "agent"`, otherwise `"outsourced"`
   - `agentUserId`: set to `session.user.id` for agents; null for internal staff
   - `assignedUserId`: set to `session.user.id` for internal staff; `undefined` (null) for agents

3. **Create contacts** — each contact row created with `portalToken: randomUUID()`.

4. **`initializeMilestoneCompletions`** — called if both `tenure` and `purchaseType` are set. Sets all milestone completions to `available`, `locked`, or `not_required` per rules in §7.

5. **MOS auto-confirm** — if `mosUploaded`: complete VM2 and PM2 immediately via `completeMilestone`. Sets `mosAutoConfirmed = true`.

6. **Store MOS document** — `TransactionDocument` created with `source: "mos"`. Failure is swallowed with `.catch(console.error)`.

7. **Reminders** — `createInitialRemindersInline` (synchronous, batch query) then `evaluateTransactionReminders` (async, fire-and-forget).

8. **Chain** (if stubs provided) — `createChainV2` then `sendChainInvite` per eligible stub. Failure caught; `chainFailed = true` returned.

9. **Return:** `{ id, mosAutoConfirmed, chainFailed }`.

10. **Redirect:** `${redirectBase}/${id}?mosConfirmed=1` (MOS uploaded) or `?newFile=1` (no MOS).

**`CreatingOverlay`:** full-screen animated modal shown during submission. Displays 4 cycling step labels.

---

## 14. Director vs negotiator differences

**Code-level:** `isAgent = session.user.role === "negotiator" || session.user.role === "director"` — both are treated identically throughout the form and server action.

Neither role has form fields hidden from the other. The progressor toggle is visible to both. Contacts are conditionally required for both when toggle is "Send to progressor".

Post-creation ownership: `agentUserId = session.user.id` regardless of whether the creator is a director or negotiator. A director creating a file owns it in the same way a negotiator does.

**Visibility post-creation:** whether a negotiator can see a file they created depends on their "Can view all files" permission — but this is not part of the creation flow.

---

## 15. Items worth flagging to the article author

1. **Draft save fixed (Phase 1)** — `saveDraftAction` now preserves all form fields: address, tenure, purchase type, purchase price, notes, both contacts per side, both solicitors, fee (amount or percent + VAT), MOS upload state, and chain stubs. The article can describe drafts as preserving everything.

2. **Navigation guard triggers on any link click** — the guard intercepts all anchor clicks, not just back/forward navigation. A user who has typed a single character and then clicks "Hub" in the sidebar will see the draft modal. This is by design but may surprise users.

3. **Expected exchange date is set silently** — 84 days from now is applied automatically. The user never sees or sets this during creation. The article may want to mention it is editable after creation on the Overview tab.

4. **MOS GIF is technically accepted** — the API accepts GIF as a file type. Not worth documenting but odd.

5. **"Chain failed" behaviour** — `chainFailed: true` is returned in the action result. Worth confirming what the form shows in that case before the article describes the chain section's save behaviour.

6. **Referral fee unit** — `referralFee` is stored as a number. Check whether this is pence or pounds before writing the article's referral subsection.

7. **Milestone initialization skipped without both tenure and purchaseType** — practically impossible via the main form (canSubmit requires both), but possible if the file is created via the API or the draft promotion path without these fields. May not need documenting but worth knowing.

---

## 16. Pre-existing assumptions in article 3 to verify

Article 3 (the portal article) includes claims about what happens when a sale is created:

- "Contacts receive portal access automatically when the file is created" — **Confirmed true.** Each contact row is created with `portalToken: randomUUID()` in `createTransactionAction`. Whether the invite email is sent at that point still needs verification (check `sendPortalInvite` or similar).
- "MOS upload on the form automatically starts the milestone clock" — **Partially confirmed.** VM2 and PM2 are auto-completed, but "milestone clock" is vague. The more accurate claim is that these two milestones are marked complete, which may unlock subsequent milestones.
- "The file is immediately visible in All Files after creation" — **Confirmed.** `revalidatePath("/agent/transactions")` is called in `createTransactionAction`.

---

## Summary for spec writing

The new-sale form has five distinct areas that need coverage in the article:

1. **Memo upload** — the centrepiece of the "smart" creation flow; auto-fills fields, auto-confirms MOS milestones
2. **Property details** — address (duplicate check), tenure, purchase type (both affect milestone shape), price, fee, notes
3. **Contacts and solicitors** — max 2 per side; contacts get portal tokens; solicitors drive referral logic
4. **Chain** — optional, in-memory until submit, position selector, invite sending
5. **Self-managed vs outsourced toggle** — changes `serviceType`, changes contact requirements, currently has a known platform gap for the outsourced path

The submission is a multi-step server sequence that can fail gracefully at chain creation (non-fatal) but will hard-error on duplicate address without `forceCreate`.
