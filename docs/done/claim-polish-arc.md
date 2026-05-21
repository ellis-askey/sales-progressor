# Claim Route Polish Arc — Stage 0 capture

Investigation only. No code changes. Each item has a root-cause read or current-state documentation; we work through fixes together after Ellis reviews.

---

## BUGS

### Bug 1 — Adding a chain link "above" doesn't appear until hard refresh

**Two separate issues**, exactly as Ellis suspected.

**(a) The state isn't reactively re-rendering — real bug.**

Root cause: `POST /api/chains/[id]/links` returns the updated chain data, but `AddNodeDrawer.tsx` discards the response — it only calls `onSaved()` on success, which closes the AddNodeDrawer. Meanwhile `ChainDrawer.tsx` fetches the chain once on mount via `useEffect` and never re-fetches.

The exact code path:
- [components/chain/AddNodeDrawer.tsx:243-251](components/chain/AddNodeDrawer.tsx#L243-L251) — `fetch(...)` → `if (!res.ok) return` → `onSaved()`. The response body (which contains the updated chain) is never read.
- [components/chain/ViewChainButton.tsx:57](components/chain/ViewChainButton.tsx#L57) — `onSaved={handleCloseAddNode}` → `setAddNode(null)`. Closes the add drawer but doesn't tell the chain drawer to refresh.
- [components/chain/ChainDrawer.tsx:78-93](components/chain/ChainDrawer.tsx#L78-L93) — `fetchChain()` runs only inside the initial `useEffect`. No `revalidatePath`, no `router.refresh()`, no exposed re-fetch hook.

Net effect: the new link sits in the database, but the drawer's local state still holds the pre-add chain. Only a hard refresh runs `fetchChain()` again. Same problem for "add below" — same code path.

**(b) Missing reveal animation.**

Even if the state issue were fixed, new links wouldn't fade in. `.agent-reveal-in` is defined in `agent-system.css` (per `docs/ANIMATION_STANDARDS.md`) but is never applied to chain-link cards in the drawer. The drawer would just snap the new row into the list.

**Fix shape (for discussion):** AddNodeDrawer reads the response and passes the new chain back; ChainDrawer accepts an `onChainUpdated` callback OR reuses `router.refresh()` on success; new links get a transient marker that adds `.agent-reveal-in` for one render.

---

### Bug 2 — Postcode/phone formatting doesn't match the new-sale flow

**Location is the chain-drawer add-link form**, not the `/claim/*` pages (the `/claim/*` flow doesn't collect postcode/phone). Ellis's "claim" reference covered the whole post-claim experience including the chain drawer.

The main new-sale form has proper UK formatters:
- [lib/utils/address.ts](lib/utils/address.ts) — exports `formatPostcode()` (uppercase + standard space) and `formatUKPhone()`.
- [components/transactions-v2/form/Stage1Fields.tsx:249](components/transactions-v2/form/Stage1Fields.tsx#L249) — postcode formatted on blur.
- [components/transactions-v2/form/ContactsSection.tsx:123-127](components/transactions-v2/form/ContactsSection.tsx#L123-L127) — phone cleaned on change, formatted on blur.

The chain-drawer add-link form does NOT use these:
- [components/chain/AddNodeDrawer.tsx:313-319](components/chain/AddNodeDrawer.tsx#L313-L319) — property-address field uses `applyTitleCase()` on blur but no postcode detection. Postcode embedded in the address line stays as the agent typed it.
- [components/chain/AddNodeDrawer.tsx:369-374](components/chain/AddNodeDrawer.tsx#L369-L374) — `stubAgentPhone` field is a plain `tel` input. No `formatUKPhone` call on blur, no `cleanPhone` on change.

**Net effect:** divergent input handling. The new-sale form polishes inputs while the chain-drawer form doesn't. Why they diverged: the chain-drawer form was built earlier (or by a different pass) before `lib/utils/address.ts` formatters became the canonical pattern, and was never back-ported.

**Fix shape:** wire `formatPostcode` + `formatUKPhone` into AddNodeDrawer's onBlur handlers, matching the new-sale form's pattern exactly. Detect-postcode-inside-address-line is a slightly stronger ask than the simple field formatters; check whether the new-sale form does that or only formats a dedicated postcode field. (TODO: confirm.)

---

### Bug 3 — Email didn't auto-send on "claim → add link above"

**Confirmed: NOT in `/api/claim/route.ts`.** During the reconciliation arc Commit 6 I reviewed the entire claim route end-to-end and noted there is no invite-send code path there. That observation was correct.

**Real location: `POST /api/chains/[id]/links/route.ts`.**

The data flow:
1. ✓ Agent claims via `/api/claim` → transaction created, chain link CLAIMED.
2. ✓ Agent adds a stub above via AddNodeDrawer. The drawer correctly sets `sendInviteNow: isExistingChain && hasValidEmail && !isEditMode` ([AddNodeDrawer.tsx:241](components/chain/AddNodeDrawer.tsx#L241)).
3. ✗ `POST /api/chains/[id]/links` at [app/api/chains/[id]/links/route.ts:27-74](app/api/chains/[id]/links/route.ts#L27-L74) parses the request body — but `sendInviteNow` is **received and silently ignored**. The handler only calls `addChainLink()`.
4. ✗ `addChainLink()` at [lib/services/chains.ts:331-367](lib/services/chains.ts#L331-L367) creates the stub. No `sendChainInvite()` call. No invite logic at all.
5. ✗ Email never goes out until the agent manually clicks the "Send invites" button in the chain drawer, which calls a different endpoint (`/api/chains/[id]/links/[linkId]/invite`) — proving the send infrastructure exists.

`sendChainInvite()` lives at [lib/chain/invite.ts:35-57](lib/chain/invite.ts#L35-L57) and is fully functional (used by the manual resend path).

**Why the flag is plumbed but ignored:** likely an incomplete refactor — the client was updated to send the flag before the server handler was updated to act on it. No comment or TODO explains it.

**Fix shape:** in `POST /api/chains/[id]/links/route.ts`, read `sendInviteNow` from the body; if true AND the new link has a valid email, call `sendChainInvite(newLink.id)` after `addChainLink()` returns. Match the email validity check the AddNodeDrawer uses so client and server agree on "when to fire."

---

## POLISH (canonical classes per `docs/ANIMATION_STANDARDS.md`)

### Polish 4 — Buttons audit vs `.agent-btn`

`.agent-btn` (canonical) provides `scale(0.98)` push-down on `:active`, `120ms ease` transitions, defined focus ring.

The claim pages use `.claim-btn` (defined at [app/claim/styles/claim-flow.css:251-275](app/claim/styles/claim-flow.css#L251-L275)). That class has a `translateY(-1px)` on hover, `translateY(0)` on `:active`, transition on `all .15s ease`. **Different pattern from `.agent-btn`**: lift instead of push-down.

Every claim CTA uses `.claim-btn`:
- `app/claim/page.tsx:322`, `:335`
- `components/claim/ClaimConfirmForm.tsx:246`, `:282`, `:353`
- `components/claim/ClaimSignupForm.tsx:245`, `:315`
- `components/claim/ClaimLoginForm.tsx:180`

Segment pills (`.claim-segment-pill`) and duplicate-option radios (`.claim-dup-option`) intentionally diverge from `.agent-btn` — they're toggle controls, not action buttons. Out of scope.

**Decision needed before fixing:** is the claim pages' intended pattern (a) lift-on-hover matching the marketing-site aesthetic, or (b) push-down matching the agent-app standard? Ellis flagged "buttons have some hover but it's NOT tied to the canonical `.agent-btn` push-down" — implying (b). If so: rewrite `.claim-btn` to mirror `.agent-btn`'s `scale(0.98)` active transform. The `.claim-btn` class stays (for namespacing) but adopts the canonical interaction.

### Polish 5 — Floating text vs cards

Audit of `/claim/*` pages: **all body text already sits inside cards.** Specifically:
- `.claim-hero` wraps the chain visual
- `.claim-summary` wraps the summary rows
- `.claim-form-card` wraps the form
- `.claim-decline-body` wraps decline copy

Detached elements that LOOK like floating text but are deliberate:
- `.claim-context-strip` — sticky breadcrumb header (intentional separation)
- `.claim-support`, `.claim-about` — footer-style text outside cards (intentional)

**Possible Ellis intent:** he may have meant the panel on `/claim/signup` where the chain visual sits to the right of the form. The address/agency text inside that panel sits in chips/cards. Need to revisit with Ellis on which exact panel/text he means — investigation didn't find an obvious offender on the `/claim/*` pages themselves.

**Decision needed:** could Ellis point at the exact text block he means (screenshot or page name)? Audit can be re-run once the target is precise.

### Polish 6 — "You're in" / claimed confirmation

There is **no dedicated "you're in" screen on the claim flow.** Successful claim redirects to `/agent/transactions/{transactionId}?claimed=1`, which fires:

- `ClaimedToast` ([components/transaction/ClaimedToast.tsx](components/transaction/ClaimedToast.tsx)) — a `sonner` toast saying "Claimed: {address}" with a 5s duration.
- `ClaimWelcomeModal` ([components/transaction/ClaimWelcomeModal.tsx](components/transaction/ClaimWelcomeModal.tsx)) — only fires when `?newUser=1` is also present (new-signup path). Shows a "You're in the chain" modal.

The `ClaimWelcomeModal` is the closest thing to a "you're in" screen. Reading its current content:
- Header: "You're in the chain"
- Body paragraphs about the chain context
- CTA: "Take me in"
- No glowing green dot pattern
- No em-dashes in the current copy (flagged: needs re-read after voice pass)

**Green dot pattern reference (Ellis's "add-new-sale dot"):** searched for it but didn't surface a clear match. Candidates worth checking before implementing: `.ms-dot-done` (milestone-complete green dot, [agent-system.css](app/agent/styles/agent-system.css)) is the closest "green dot" pattern in the app. There may be a different add-new-sale variant Ellis is thinking of — need a pointer.

**Em-dash flag in adjacent copy:**
- [app/claim/decline/page.tsx:215](app/claim/decline/page.tsx#L215) — *"We've let them know this isn't your sale. Estate agencies are busy — that helps."* → contains em-dash. **For Ellis review** (not auto-stripped per his rule).

**Decision needed:** which specific green-dot pattern should the welcome modal echo? And does the welcome modal copy itself need any phrasing tweaks (Ellis flagged "check phrasing")?

### Polish 7 — Background + logo

**Background (current state):**
- Flat warm cream: `--claim-bg: #FDF9F5` at [app/claim/styles/claim-flow.css:10](app/claim/styles/claim-flow.css#L10).
- `.claim-page` applies this as a solid `background` ([line 25](app/claim/styles/claim-flow.css#L25)).
- The ONLY non-flat treatment in the claim styles is `.claim-decline-bloom` (a static radial gradient at `opacity: 0.12`, only on the decline page). [lines 646-657](app/claim/styles/claim-flow.css#L646-L657).
- No moving orbs exist in the codebase yet. Need to either build them or import a pattern from elsewhere (marketing site? main app? — neither has a moving-orb implementation I found).

**Decision needed:** Ellis wants to "see options before committing." Options to mock for review:
1. Static radial bloom (like the decline page) but on every claim page, very subtle (opacity 0.06-0.10)
2. Two-orb gradient (one coral, one amber) drifting slowly via CSS `@keyframes` translate
3. Subtle noise texture overlay (no motion)
4. Marketing-site-style gradient mesh background

Recommend mocking 2-3 of these as separate branches/preview commits so Ellis can A/B them visually before deciding.

**Logo link (current state):**
- [app/claim/page.tsx:10-14](app/claim/page.tsx#L10-L14) — `<span className="claim-wordmark">The Sales Progressor</span>`. Plain text span, **NOT a link**.
- Same wordmark Shell pattern in [app/claim/confirm/page.tsx](app/claim/confirm/page.tsx), [app/claim/signup/page.tsx](app/claim/signup/page.tsx), [app/claim/login/page.tsx](app/claim/login/page.tsx), [app/claim/decline/page.tsx](app/claim/decline/page.tsx).
- `.claim-wordmark` style ([claim-flow.css:58-64](app/claim/styles/claim-flow.css#L58-L64)) is pure typography.

**Fix shape:** wrap the wordmark in `<a href="https://www.thesalesprogressor.co.uk">` on every Shell. External link → `target="_blank" rel="noopener"` (or not, depending on whether Ellis wants in-tab navigation away from the claim flow).

---

## DECISIONS (current state + question for Ellis)

### Decision 8 — Chain numbering

**Current behaviour:**

**Storage** ([prisma/schema.prisma](prisma/schema.prisma) line ~763): `ChainLink.position Int`. Unique on `(chainId, position)`.

**Assignment at chain creation** ([lib/services/chains.ts:238-298](lib/services/chains.ts#L238-L298), `createChainV2`):
- Above stubs get positions `0` to `aboveStubs.length - 1`.
- Originator (the user who created the chain, claimed link) sits at `aboveStubs.length`.
- Below stubs get `originatorPosition + 1`, `+2`, …
- Comment on the helper file is explicit: *"Positions are 0-indexed, top of chain = 0."* ([lib/chain/positions.ts:3](lib/chain/positions.ts#L3))

So: **lower number = closer to the top of the chain. Position 0 = top.**

**Re-numbering on insert** ([lib/services/chains.ts:331-367](lib/services/chains.ts#L331-L367), `addChainLink`):
- Insert ABOVE → all existing links shift `+1` (via `shiftPositionsUp`), new link gets position `0`.
- Insert BELOW → new link gets `max(positions) + 1`, no re-numbering.

**Display surfaces (1-indexed, computed as `position + 1`):**

1. [components/chain/LinkCard.tsx:128](components/chain/LinkCard.tsx#L128) — *"Position {link.position + 1} of {totalLinks}"* in the chain drawer.
2. [lib/chain/invite.ts:96-117, 161](lib/chain/invite.ts#L96-L161) — invite email: *"You're #{stubPosition + 1} of {totalLinks} in this chain."* Plus a `positionDesc` of *"sale above"* or *"sale below"* relative to the originator.
3. [components/claim/ClaimSignupForm.tsx:137](components/claim/ClaimSignupForm.tsx#L137) — referenced position area on the side panel (chain visual). Renders `position + 1` per link.

**Question for Ellis:**

Currently: position 0 = top of chain, displayed as "1 of N" at the top. Ellis's instinct: *"1 = bottom of chain, counting upwards"* — i.e. reverse the displayed convention so the bottom (start of the chain, first-time buyer) is #1 and the top (last seller, end-of-chain) is #N.

If we flip the displayed convention:
- **Database stays the same** (positions still 0-indexed top-down; only display changes).
- **Computed display becomes `totalLinks - position`** instead of `position + 1`.
- **Surfaces to update:** LinkCard, invite email, ClaimSignupForm panel, and any portal/buyer-view that shows position (none surfaced in this audit but worth a second grep before implementation).
- **Email copy implications:** *"You're #X of Y"* meaning changes. Invite email's `positionDesc` ("sale above"/"sale below") logic also needs review — relative phrasing would need to invert.

**Decide:**
- (A) Keep current display (top = 1, bottom = N). No change.
- (B) Flip display only (bottom = 1, top = N). One-line formula change in each display surface, plus copy review on invite email.
- (C) Flip both storage and display. Bigger refactor, touches `shiftPositionsUp`, all sort orders, etc. Not recommended unless you want #position to be a domain-meaningful 1-indexed key everywhere.

My read: option (B) is what Ellis is reaching for — cleaner cognitive model ("first buyer is #1") without churn on the storage layer.

### Decision 9 — Cash vs Cash-from-Proceeds on the claim flow

**Current state:**

`PurchaseType` enum ([prisma/schema.prisma](prisma/schema.prisma) lines ~236-240) defines **3 values**: `mortgage`, `cash_buyer`, `cash_from_proceeds`.

**The full new-sale flow** ([components/transactions-v2/form/Stage1Fields.tsx:99,107](components/transactions-v2/form/Stage1Fields.tsx#L99)) accepts and offers all 3.

**The claim flow** ([components/claim/ClaimSignupForm.tsx:252-256](components/claim/ClaimSignupForm.tsx#L252-L256), same pattern in `ClaimLoginForm.tsx` and `ClaimConfirmForm.tsx`) offers **only 2**: `Mortgage` and `Cash purchase`. `cash_from_proceeds` is absent from the picker.

**API validation** ([app/api/claim/route.ts:129-136](app/api/claim/route.ts#L129-L136)) accepts all 3 values — the server-side allows `cash_from_proceeds`. The error message *"purchaseType is required (mortgage or cash_buyer)"* is stale; the validation array includes `cash_from_proceeds` despite the message claiming otherwise.

**Why claim diverges:** no git comment, no code comment, no documented decision. Hypothesis: claim flow was scoped to "the two most common purchase types" for fast claim onboarding. `cash_from_proceeds` (buying with funds from a parallel sale) is a less common path that's most relevant on chain-typical files.

**Question for Ellis:**

Either:
- (A) Add `cash_from_proceeds` to all three claim forms' purchase-type picker. Match the new-sale form 1:1. Update the API error message string while we're there.
- (B) Keep claim's 2-option simplification and document it as deliberate (would need to add a comment + maybe a "this is intentional" line in the manual TODO).

My read: option (A) is the right call — chains specifically attract chain-of-three-or-more files where `cash_from_proceeds` is common, and the API already accepts it so this is purely a UI gap. The stale error message is a minor bug to clean up alongside.

---

## Summary

| # | Item | Status | Action |
|---|---|---|---|
| 1 | Add link state refresh + reveal animation | Bug, two root causes confirmed | Fix shape sketched — needs Ellis approval |
| 2 | Postcode/phone formatting in chain drawer | Bug, location confirmed (AddNodeDrawer not /claim/*) | Wire `formatPostcode` / `formatUKPhone` from existing utils |
| 3 | Auto-send invite on add-above | Bug, confirmed in `/api/chains/[id]/links/route.ts` | Hook up the already-sent `sendInviteNow` flag |
| 4 | Button audit | Polish, `.claim-btn` ≠ `.agent-btn` | Decision needed: lift vs push-down |
| 5 | Floating text vs cards | Polish, no clear offender on `/claim/*` | Decision needed: Ellis to point at specific text block |
| 6 | "You're in" screen | Polish, exists as `ClaimWelcomeModal` | Decision needed: which green-dot pattern + copy tweaks |
| 7 | Background + logo link | Polish, current = flat cream + non-link wordmark | Decision needed: which background option (1/2/3/4); logo gets wrapped in anchor |
| 8 | Chain numbering | Decision, current = top-down 0-indexed displayed as 1-indexed | Decision needed: keep, flip display, or flip both |
| 9 | Purchase type options on claim | Decision, claim offers 2/3 | Decision needed: add cash_from_proceeds to claim picker, yes/no |

**Doc written. Ready for Ellis's review and rulings before any code lands.**
