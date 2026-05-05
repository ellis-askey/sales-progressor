# Claude Code — Chain Feature Implementation Prompt

Copy the entire prompt below and paste it into Claude Code. Do not modify it without understanding the implications.

---

## Context

You are implementing a chain visibility and collaboration feature for The Sales Progressor — a Next.js (App Router) + TypeScript + Prisma + Supabase Postgres application deployed on Vercel.

The full specification lives in `docs/chain-feature/`. Read it before writing any code.

The application is stable and in production use. Your single most important constraint is: **do not break existing functionality**. The chain feature is purely additive — every existing code path must behave identically when no chain is involved.

## Required reading order

Before writing any code, read these documents in order:

1. `docs/chain-feature/00-overview.md` — what we're building and why
2. `docs/chain-feature/09-stability-guarantees.md` — what you can and cannot touch, and the regression checks
3. `docs/chain-feature/01-data-model.md` — schema changes (read alongside the existing `prisma/schema.prisma`)
4. `docs/chain-feature/02-permissions.md` — permission rules (server-side enforcement is non-negotiable)

Then read these as you implement each section:

5. `docs/chain-feature/03-add-sale-integration.md` — when working on the new transaction page
6. `docs/chain-feature/04-view-chain-drawer.md` — when working on the chain drawer
7. `docs/chain-feature/05-add-node-drawer.md` — when working on the add-node form
8. `docs/chain-feature/06-invite-flow.md` — when working on the invite email and send logic
9. `docs/chain-feature/07-claim-flow.md` — when working on claim landing/signup/login/confirm
10. `docs/chain-feature/08-copy.md` — every user-facing string (use these verbatim)
11. `docs/chain-feature/10-deferred.md` — what's NOT in v1 scope (do not implement these)

## Codebase inspection — do this before any implementation

Before implementing each chunk, inspect existing code to understand patterns:

- **Existing chain code**: `prisma/schema.prisma` (lines ~647–671 for `PropertyChain`/`ChainLink`, line ~179 for `PropertyTransaction`), `components/chain/ChainWidget.tsx`, `components/chain/ChainMap.tsx`. Understand what's there before extending.
- **Style system**: `app/globals.css` for `glass-card`, `glass-subtle`, `glass-sidebar` classes. `components/ui/` for shared primitives (`PriceInput`, `StatusBadge`, `PageHeader`, `EmptyState`, `Avatar`, `ToastContext`, `TimelineIcon`). Use these — do not roll your own.
- **Existing form patterns**: inspect the new transaction page (`/agent/transactions/new`) to understand current form handling, draft saving, validation, and submit logic.
- **Existing email infrastructure**: find where milestone emails are sent. Use the same transport. Find existing email templates and match their wrapper structure (header, footer, branding).
- **Existing auth**: find the signup and login implementations. The claim flow reuses the underlying account-creation and authentication functions but lives at separate routes.
- **Existing drawer/modal patterns**: find any existing drawer components. Match their accessibility, focus-trap, escape-key behaviour.
- **Existing button/badge styles**: do not introduce new style variants. Use whatever exists.

If you cannot find the patterns described, ask before inventing.

## Implementation order

Implement in these chunks. Each chunk should be a separate commit (or small group of commits) so any individual chunk can be reverted cleanly.

### Chunk 1: Schema migration

- Read existing `PropertyChain` and `ChainLink` models
- Extend per `01-data-model.md`. Add fields, do not modify existing field types or names
- Add `chainLinkId` to `PropertyTransaction`
- Add all required indexes
- Generate Prisma migration
- Regenerate Prisma client
- Verify migration applies cleanly to a local fresh DB
- Commit

### Chunk 2: Permission and helper libraries

- Create `lib/chain/permissions.ts` with all helper functions per `02-permissions.md`
- Create `lib/chain/positions.ts` with position-shift logic per `01-data-model.md`
- Create `lib/chain/duplicate-detection.ts` with address matching per `07-claim-flow.md`
- Create `lib/chain/status.ts` with `getChainLinkStatus(link, userId)` discriminated union helper per `01-data-model.md`
- Unit tests for each helper
- Commit

### Chunk 3: API routes for chain CRUD

- `POST /api/chains` — create chain
- `GET /api/chains/[id]` — fetch chain with all links (with permission check)
- `POST /api/chains/[id]/links` — add link (above/below)
- `PATCH /api/chains/[id]/links/[linkId]` — edit unclaimed stub
- `DELETE /api/chains/[id]/links/[linkId]` — remove link
- `POST /api/chains/[id]/links/[linkId]/invite` — send/resend invite
- All routes call permission helpers; return 403 on denial
- Integration tests for each route
- No UI yet
- Commit

### Chunk 4: View Chain drawer (replaces existing widget)

- Move `components/chain/ChainWidget.tsx` and `ChainMap.tsx` to `components/chain/_legacy/`. Do not delete.
- Create `components/chain/ChainDrawer.tsx` per `04-view-chain-drawer.md`
- Create `components/chain/LinkCard.tsx` for the compact card variants
- Empty state when no chain exists
- Update the View Chain button on the transaction detail page to open the new drawer
- Verify transactions with no chain show the empty state cleanly (no errors)
- Verify transactions with the legacy chain data still render correctly (or document migration path)
- Commit

### Chunk 5: Add Node drawer

- Create `components/chain/AddNodeDrawer.tsx` per `05-add-node-drawer.md`
- Wire into View Chain drawer's "+ Add sale above/below" buttons
- Both create and edit modes
- Validation per spec
- Commit

### Chunk 6: Chain section on new transaction page

- Create `components/chain/ChainSection.tsx` per `03-add-sale-integration.md`
- Insert into the new transaction page between Notes and Who-will-progress
- Default collapsed state, expandable
- Position selector + add buttons
- In-memory chain state held in form (no API calls until Create transaction)
- Invite checkbox next to Create transaction button (conditionally shown)
- Helper text variants per spec
- Server action extension: when transaction is created with chain data, create chain + stubs in single transaction
- Verify: creating a transaction without expanding chain section produces zero chain rows in DB, behaves identically to current
- Commit

### Chunk 7: Invite email and send logic

- Create chain invite email template (HTML + plain text) per `06-invite-flow.md`
- Hook into existing email transport
- Implement `sendChainInvite(linkId)` function
- Implement bounce webhook handler (or extend existing if there is one)
- Implement bounce notification email to originator
- Toast for "invites sent" using existing `ToastContext`
- Commit

### Chunk 8: Claim landing page

- `/claim?token={token}` route, public
- Server-side token validation
- Render landing page per `07-claim-flow.md`
- Branch routes for already-claimed / already-declined / invalid
- Decline endpoint and confirmation page
- Commit

### Chunk 9: Claim signup flow

- Refactor existing signup to extract `createUserAccount(input)` if not already extracted (separate commit before this chunk if needed; verify existing signup unchanged)
- Create `/claim/signup?token={token}` route per `07-claim-flow.md`
- Pre-fill from stub data
- On account creation, immediately claim the link
- Redirect to claimed transaction's detail page
- Commit

### Chunk 10: Claim login flow

- Refactor existing login to extract auth function if not already
- Create `/claim/login?token={token}` route per `07-claim-flow.md`
- On successful login, claim the link
- Commit

### Chunk 11: Claim confirm flow + duplicate detection

- `/claim/confirm?token={token}` for logged-in users
- Run duplicate detection per `07-claim-flow.md`
- Show "create new file" or "link existing file" UI based on detection results
- Server action handles both branches
- Commit

### Chunk 12: Final wiring and polish

- Wire toast notifications for all chain events
- Verify all copy matches `08-copy.md` exactly
- Mobile responsive check on all new UI
- Run full regression checklist from `09-stability-guarantees.md`
- Commit

## Hard rules

1. **Do not touch milestone engine, milestone email templates, smart rules, reminders, ID/AML, contract pack handling, or solicitor flows.** These are explicitly out of scope. If you think you need to, stop and ask.

2. **Do not modify the existing `/signup` or `/login` routes' behaviour.** You may refactor them to extract reusable functions, but the user-facing behaviour at those routes must be byte-identical before and after your changes. Verify with manual testing before committing the refactor.

3. **All permission checks happen server-side.** The UI hides actions users can't perform, but the server must independently verify on every mutation. A malicious user crafting API calls directly must be blocked.

4. **Use existing primitives.** No new card styles, no new badge variants, no new button variants. Use `glass-card`, `glass-subtle`, `StatusBadge`, `EmptyState`, etc. If you genuinely need a new primitive, ask first.

5. **Use copy verbatim from `08-copy.md`.** Do not paraphrase, do not invent new strings. If something isn't covered in the copy doc, ask.

6. **Email is optional on stubs.** A stub without an email is valid — it sits in the chain visible to all members but no invite is sent until an email is added. Do not require email at any point.

7. **Address matching for duplicate detection is conservative.** Only flag matches when postcode AND first numeric component agree. Better to miss a match than false-match.

8. **No live updates in v1.** Chain data is fetched on drawer open. No WebSockets, no polling, no real-time anything.

9. **No notification emails in v1 except bounce-to-originator.** All other "notifications" are in-app toasts at the moment of action.

10. **Implement deferred features' schema hooks but no logic.** Per `10-deferred.md`, fields like `withdrawalStatus` and `holdStatus` exist in the schema but no v1 code reads or writes them.

## Stop conditions

Stop and ask the user before proceeding if:

- The existing schema for `PropertyChain` or `ChainLink` differs significantly from what `01-data-model.md` describes, in a way that requires renaming or repurposing existing fields
- You cannot find the existing email transport infrastructure
- You cannot find the existing auth/signup pattern
- The existing draft-saving mechanism on the new transaction page is unclear
- You discover existing production data using the legacy `PropertyChain` schema in a way that the new schema would break
- A spec doc contradicts another spec doc
- A spec doc contradicts what you find in the codebase (e.g. spec says use `glass-card` but no such class exists)
- You're about to modify any file listed in the "MUST NOT TOUCH" section of `09-stability-guarantees.md`

## Definition of done

The feature is complete when:

- All 12 chunks above are implemented and committed
- The full regression checklist in `09-stability-guarantees.md` passes
- A manual end-to-end smoke test passes:
  1. Create a transaction with a chain (2 nodes above, 1 node below). Verify chain saves, invites send.
  2. Open the invite email in a fresh browser. Click claim. Sign up. Verify claim succeeds and dashboard shows the new transaction.
  3. From a third account, claim another link in the same chain. Verify chain visibility updates.
  4. As originator, edit an unclaimed stub. Verify changes persist.
  5. As originator, resend an invite. Verify new token is generated.
  6. Open View Chain drawer from claimed transaction. Verify all link cards render with correct status.
  7. Create a transaction without using the chain section. Verify no chain rows in DB and behaviour is identical to pre-feature.
- `tsc --noEmit` reports no errors
- ESLint reports no new warnings
- All new UI tested at mobile and desktop viewports
- Legacy `ChainWidget`/`ChainMap` files moved to `_legacy/`, no imports remain

## Output expectations

After each chunk:
- Commit with a clear message describing what was done
- Print a brief summary of files added/modified
- Note any deviations from the spec and why
- Note any questions that arose

After all chunks:
- Print a final summary
- Print the regression checklist with pass/fail for each item
- Print any items where you made implementation choices not explicitly covered by the spec, so the user can review

---

Begin by reading the four required-first documents, then inspect the existing codebase, then start with Chunk 1.
