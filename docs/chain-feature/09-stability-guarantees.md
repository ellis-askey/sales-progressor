# Chain Feature — Stability Guarantees

## Principle

Every existing code path must behave identically when no chain is involved. A transaction with no chain attached must work exactly as it does today — same flows, same emails, same UI, same DB queries. The chain layer is purely additive.

This document lists the touch points and the strategy for each.

## Files / routes / components that this feature TOUCHES

### Modified (existing code changed)

1. **`prisma/schema.prisma`** — extend existing `PropertyChain` and `ChainLink` models, add `chainLinkId` field to `PropertyTransaction`. See `01-data-model.md`. Strategy: additive only (new fields, no field removal or type change). Single migration.

2. **`/agent/transactions/new` page** — add chain section between Notes and Who-will-progress. See `03-add-sale-integration.md`. Strategy: chain section defaults to collapsed and inactive. If the user never expands it, the form's behaviour and submitted data are byte-identical to current. The new server-action logic for chain creation runs *only if* chain section data is present in the submitted payload.

3. **Transaction detail page — View Chain entry point** — replace the existing `ChainWidget` invocation with the new drawer trigger. Strategy: the View Chain button itself stays in the same location with the same visual; only what it opens changes. Behaviour for transactions with no chain shows the empty state (see `04-view-chain-drawer.md`) — no error, no breakage.

4. **`components/chain/ChainWidget.tsx`** and **`components/chain/ChainMap.tsx`** — these are replaced by the new drawer. Strategy: do not delete the existing files in v1. Move them to `components/chain/_legacy/` and stop importing them. Confirms zero import-time breakage if anything else in the codebase still references them. Delete in a follow-up after v1 is stable.

### Added (new code, no existing code touched)

- New routes: `/claim`, `/claim/signup`, `/claim/login`, `/claim/confirm`, `/claim/decline`
- New API routes: `/api/chains`, `/api/chains/[id]/links`, `/api/chains/[id]/links/[linkId]`, `/api/claim`
- New components: `components/chain/ChainSection.tsx` (for new transaction page), `components/chain/ChainDrawer.tsx`, `components/chain/AddNodeDrawer.tsx`, `components/chain/LinkCard.tsx`, claim flow components
- New email template: chain invite + bounce notification
- New library functions: `lib/chain/permissions.ts`, `lib/chain/positions.ts`, `lib/chain/duplicate-detection.ts`
- New types: `types/chain.ts` (or extend Prisma-generated types)

## Files / routes / components that this feature MUST NOT TOUCH

The following are explicitly out of scope. Any change to these requires escalation back to the user before proceeding.

- Milestone engine (`lib/milestones/*` or wherever PM/VM/B logic lives — inspect before assuming path)
- Any milestone email template (the templates we worked on in earlier conversation must remain as-is)
- File progression logic, smart rules, reminders
- Solicitor flows
- ID/AML checks, contract pack handling
- Existing signup flow at `/signup` — the claim signup at `/claim/signup` must be a separate route/component that *calls* the same underlying account-creation function but does not modify the existing signup component
- Existing login flow at `/login` — same pattern: claim login is separate
- Existing transaction detail page logic, except for swapping the View Chain widget invocation
- Existing draft-saving mechanism for new transactions, except for adding chain fields to whatever payload is being drafted
- Existing email-sending infrastructure config (use it, don't reconfigure it)
- Database migrations not related to chain schema changes

## Strategy for shared concerns

### Account creation reuse

The claim signup needs to create a user account. Do NOT duplicate the signup logic. Refactor the existing signup to extract a `createUserAccount(input)` function (if not already extracted). Both `/signup` and `/claim/signup` call this function. The claim variant adds post-creation logic (claim the link).

If extracting the function requires modifying existing signup code, do the refactor as a separate commit *first*, with regression test confirming `/signup` still works identically. Only then add the claim variant.

### Login reuse

Same pattern. Extract `authenticateUser(email, password)` if not already, then reuse from `/claim/login`.

### Email sending reuse

Use the existing email service wrapper (whatever transport is used for milestone emails). Do not introduce a new email provider or wrapper. Add new templates to the existing template directory.

### Toast/notification reuse

Use the existing `ToastContext` from `components/ui/`. Do not create a new notification system.

### Style primitives reuse

All chain UI must use:
- `glass-card` for primary card surfaces
- `glass-subtle` for nested/secondary surfaces
- `StatusBadge` from `components/ui/`
- `EmptyState` from `components/ui/`
- `Avatar` from `components/ui/` if displaying users
- Existing button styles (inspect existing buttons on the new transaction page)
- Coral primary accent (`#FF6B4A`) for "Your file" highlights and primary CTAs

Do not introduce new card styles, badge variants, or button variants without explicit design approval.

## Regression test checklist

Before declaring the feature done, verify:

### Existing transaction creation

- [ ] Create a new transaction without expanding the chain section. Verify: transaction is created, no chain rows in DB for this transaction, redirect behaviour unchanged, transaction detail page renders normally.
- [ ] Create a new transaction with chain section expanded but no nodes added. Verify: transaction created, no chain rows.
- [ ] Save and finish later (draft) — chain state preserved if any was entered. Existing draft of non-chain fields preserved.

### Existing signup

- [ ] Visit `/signup`, create an account. Verify: signup flow identical to before (no claim-related fields appear).
- [ ] Visit `/login`, log in. Identical to before.

### Existing transaction detail page

- [ ] View a transaction with no chain attached. Verify: page renders, all sidebar widgets render, View Chain button shows empty state when clicked (does not crash).
- [ ] All milestone events on the transaction continue to fire correctly.
- [ ] All milestone emails continue to send unchanged.

### Existing chain (if any test data exists)

- [ ] Visit a transaction with an existing `PropertyChain` from the legacy data model. Verify: data displays correctly in new drawer, OR clean migration path documented if data is incompatible.

### Email infrastructure

- [ ] Existing milestone emails continue to send. Spot check 2–3 different milestone types.
- [ ] New chain invite email renders correctly in major clients (Gmail, Outlook, Apple Mail).
- [ ] Plain-text fallback renders.

### Permissions

- [ ] User A cannot edit User B's claimed link.
- [ ] User A cannot view stub email/notes on User B's originated link.
- [ ] User outside a chain cannot view the chain at all.
- [ ] All permission checks happen server-side (verify by attempting bypassed API calls).

### Database

- [ ] Migration applies cleanly to a fresh DB.
- [ ] Migration applies to a DB with existing data (use a backup of staging if available).
- [ ] No constraint violations under normal usage.
- [ ] Index performance acceptable for chain queries (chains of up to 10 links return in <100ms).

## Commit strategy

Implement in chunks that can be reverted independently:

1. Schema migration + Prisma client regeneration
2. Permission helpers (`lib/chain/permissions.ts`)
3. Position management helpers (`lib/chain/positions.ts`)
4. API routes for chain/link CRUD (no UI yet)
5. View Chain drawer component (replaces widget) + empty state
6. Add Node drawer component
7. Chain section on new transaction page
8. Invite email template + send logic + bounce webhook
9. Claim landing page
10. Claim signup flow
11. Claim login flow
12. Claim confirm flow + duplicate detection
13. Toast/notification wiring for chain events
14. Move legacy `ChainWidget`/`ChainMap` to `_legacy/`

Each chunk should be a separate commit with a clear message. If anything breaks, revert the offending commit cleanly.

## Rollback plan

If post-deploy issues arise:

- **UI-only issue**: revert the relevant component commit. Schema and API stay; users see old UI.
- **API/permission issue**: revert API commits. UI gracefully degrades (drawer shows error states).
- **Schema issue**: schema additions are additive and reversible. Write a down-migration that drops the new fields/indexes (no data loss for existing transactions because new fields are nullable or have defaults).
- **Total revert**: revert the merge commit; legacy widget reactivates because it was only moved, not deleted.

## Pre-merge checklist for the implementing developer

- [ ] All regression tests above pass
- [ ] Manual smoke test of full chain flow (create → invite → claim) completed end-to-end
- [ ] No existing tests broken (run full test suite)
- [ ] No new TypeScript errors (`tsc --noEmit` clean)
- [ ] No new ESLint warnings introduced
- [ ] Mobile viewport tested for new UI
- [ ] Accessibility check on claim landing page (Lighthouse or equivalent)
