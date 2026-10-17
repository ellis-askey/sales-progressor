# Client-portal preview ("See an example")

Status: spec for sign-off, 2026-10-17. Not started. Author: Ellis + Claude.

## The idea

A button on the client-portal settings page (agency side **and** external-SPB side) that opens — and gives a copyable link to — a **fully-populated example seller portal**. An agent clicks it to see what their client's portal looks like before they add a real sale; a sales progressor sends the link to a prospect to show them what their clients would get, branded as the progressor.

It looks and behaves exactly like a real client portal. Everything inside it is fake, and the fake data is sealed off so none of it ever appears in real production data.

## Locked decisions (Ellis, 2026-10-17)

1. **No "demo" marker** anywhere a viewer can see. It reads as a normal live client portal.
2. **Seller first.** Buyer preview is a later addition.
3. **Resets once a day** to pristine. One shared example per org; within a day, viewers share its interactive state.
4. **Shareable link never expires**, with a "regenerate" option.
5. **No personalisation** (Option A, chosen 2026-10-17). Everyone sees the same polished example. Dropped because swapping the address text while the house photo stayed the preset would mismatch, and it wasn't worth the fiddle.
6. **Absolute rule: everything inside the example is fake, and fake stays inside the example.** No fake solicitor firm, contact, or sale may surface in any real list, picker, metric, email, or invoice.

## What we reuse (don't rebuild)

The existing **demo-sale system** (`lib/services/demo-sale.ts`, `docs/active/demo-sale/SPEC.md`) already gives us the quarantine: `isDemo` transactions are excluded from billing, chasing, reminders, work-queue, access-scope lists and adoption metrics, and milestone confirms on them suppress every email/event. We build the preview as a **sibling** of the onboarding demo, reusing that machinery — not a new sandbox.

Difference from the onboarding demo: that one only appears when an agency has **zero** real sales and self-destructs in ~a week. The preview is the opposite — always available, persistent link, one per org, branded to the acting org.

## Data isolation (the core of this feature)

### Known leak to fix first
`SolicitorFirm` is a **global, shared-by-name table** (no agency scope, no demo flag). The onboarding demo find-or-creates "Harpenden & Ellwood LLP" / "Verulam Legal" into it (`demo-sale.ts:146`), and the Partners page lists **all** firms unfiltered (`app/agent/partners/page.tsx:148`). So those fakes already show up in every agent's firm directory today. This spec fixes that.

### Rule
The preview's solicitor firm, solicitor contacts, client contacts and the sale itself are all **demo-tagged** and **filtered out of every real list, picker, directory, metric, and send path**. A real user never sees them.

## Schema changes (two small ones — staging first, per Law 3)

1. **`PropertyTransaction.demoKind`** `String?` — `null` for real sales, `"onboarding"` for the showcase chain, `"portal_preview"` for this feature. Keeps the preview from colliding with the onboarding demo's "one demo at a time / only if no real sales" logic. The preview sets `demoExpiresAt = null` so the daily `demo-cleanup` cron (which deletes only **expired** demos) never removes it. *(Implementation check: confirm cleanup keys on `demoExpiresAt` being non-null and past.)*
2. **`SolicitorFirm.isDemo`** `Boolean @default(false)` and **`SolicitorContact.isDemo`** `Boolean @default(false)` — so demo firms/contacts can be hidden. Then:
   - Filter `isDemo: false` at every firm/contact **list/picker/directory** site (start: `app/agent/partners/page.tsx:148`; audit all `solicitorFirm.findMany` / firm search / handler pickers).
   - A one-off sweep to tag the existing leaked demo firms so today's leak is cleaned up too.
   - Demo sales reference these demo-tagged firms; real sales never create or see them.

## Build phases

**Phase 0 — migrations + isolation (staging first).** Add `demoKind`; add `isDemo` to `SolicitorFirm`/`SolicitorContact`; filter demo firms/contacts out of all real lists/pickers; sweep existing leaked firms. Verify on staging.

**Phase 1 — the preview sale + the button.**
- `createPreviewSale({ ownerScope })` in `demo-sale.ts`: a **single** seller-focused `isDemo` + `demoKind:"portal_preview"` file (reuse the Beaumont Rise preset, trimmed to one file), with demo-tagged solicitors, a vendor contact (Sarah Whitfield) carrying a stable `portalToken`, owned/managed by the existing fake agent (Charlotte Hayes). `demoExpiresAt = null`.
- **Branding by owner scope:** for an agency director the file's `agencyId` = their agency (`progressionBusinessId = null`) → the portal shows the agency's branding + portal toggles. For an SPB owner the file's `progressionBusinessId` = their business → the portal shows the business's branding + toggles. (Uses the responsible-party portal resolution shipped 2026-10-15.)
- Find-or-create: **one preview per acting org**.
- UI: a "Preview your client portal" block on both client-portal settings pages — **Open preview** (opens the vendor portal in a new tab), **Copy link**, and **Regenerate link** (rotates the vendor `portalToken` if a link leaks).

**Phase 2 — daily reset.** A nightly job re-applies the preset milestone completions and clears any client-entered values (deposit/mortgage figures, `lastVisitedPortalAt`, portal confirmations, suppress flags) on the preview file — **keeping the transaction and the vendor `portalToken` stable** so shared links never break.

## No-email guarantee (verify before ship)
Trace every portal-triggered action for the preview file and confirm each is a no-op for `isDemo`: milestone confirm (already guarded in `app/actions/milestones.ts`), any chase respond link, survey-quote, the "email your conveyancer" mailto (client-side only — fine). List each in the PR with evidence.

## Security
- Public portal token like any portal; the preview holds no real data. Regeneratable.
- Consider light rate-limiting on the preview token if abuse appears (not v1).

## Access / gating
- Create action available to any **agency director** or **SPB owner**, regardless of real-sale count. SPB side flag-gated (`progressionBusinessesEnabled`).
- Hidden from all real file lists via `isDemo` (access-scope already excludes it); the settings button is the only entry point.

## Future (not now)
- **Buyer preview** (purchaser portal) via a side toggle.
- **"Your prospect opened it" signal** to the SPB (opt-in, quiet; mild privacy consideration).
- **"Reset preview now"** button for the agent, on top of the nightly reset.

## Build map (anticipated)
- `prisma/schema.prisma` + migration — `demoKind`, `SolicitorFirm.isDemo`, `SolicitorContact.isDemo`.
- `lib/services/demo-sale.ts` — `createPreviewSale`, demo-tag the solicitors, single-file preset; daily-reset helper.
- Firm/contact list sites — add `isDemo:false` filter (`app/agent/partners/page.tsx`, firm pickers, handler search).
- `app/actions/portal-preview.ts` — find-or-create, build personalised link, regenerate token.
- Client-portal settings pages (agency + SPB) — the preview block.
- `app/api/cron/*` — nightly preview reset (or extend `demo-cleanup`).

## Open questions
None outstanding — personalisation dropped (Option A). Remaining items are implementation detail inside the phases above.
