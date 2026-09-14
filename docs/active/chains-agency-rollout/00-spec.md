# Chains — agency rollout readiness

Owner: Ellis · Drafted 2026-09-14 · Status: **built** (blockers 1–2 + cleanups 3–4 shipped; rollout gate NOT yet widened — still internal + Taylor allowlist, pending Ellis's breadth call)

Follow-up left out of scope (flagged to Ellis): adding a node above/below a link
(`canAddAbove` / `canAddBelow`) is still person-based, so a director who can now
VIEW a colleague's chain can't add nodes to it. Not in the approved scope
(blocker 2 = view, cleanup 3 = invite/share/photo). Widen the same agency way if
wanted.

Goal: let customer agency staff (director / negotiator) use the `/agent/chains`
workspace for their own in-house progression, the same way we're opening
Enquiries. Today Chains is gated to internal staff plus a one-name email
allowlist (`lib/chain/chains-access.ts`).

The workspace itself is well-built and the list views are already agency-scoped.
Two issues block a customer rollout, and two are consistency cleanups. **All four
share one root cause:** the chain *permission* layer (`lib/chain/permissions.ts`)
is person-based (keyed on the individual who created/claimed a link), while the
chain *intel* layer (`lib/chain/intel.ts`) is already agency-aware (keyed on the
owning agency, with a director/overseer model). The fix is to bring the chain
gates onto the agency-aware model intel already implements.

Decision taken 2026-09-14 (Ellis): **the whole agency sees its chains** — any
director/negotiator can open and work a chain that one of their agency's files
sits in.

---

## Blocker 1 — cross-agency leak of stub contacts + private notes

**What happens.** When two different agencies share a chain, the data sent to
each includes the *other* agency's stub contact fields and private stub notes —
the field the add-form labels "Only you can see this"
(`components/chain/AddNodeDrawer.tsx`).

**Where.** `getChainV2` in `lib/services/chains.ts` carefully strips the private
*intel* fields (`breakChainStance`, `breakChainConditions`, `expectedTimescale`,
`chainNotes`, `lastChainCheckAt`) off each link and re-adds them only for viewers
who pass `canViewNodeIntel` (chains.ts ~668–713). But the destructure at
chains.ts:668–679 does **not** pull off `stubAgentEmail`, `stubAgentName`,
`stubAgentPhone`, `stubNotes` (selected in `LINK_V2_SELECT`, chains.ts:319–322),
so they ride the `...linkRest` spread straight onto the wire for every chain
participant (chains.ts:722, 767). The type comment already warns these are
"Private fields — callers must gate on `canViewStubDetails` before exposing"
(chains.ts ~120), but that gating today is **client-side only** in `LinkCard`
(display), not server-side (transport).

Dormant today because only internal staff (who legitimately see everything) open
chains. It becomes a live cross-agency data leak the moment an agency user can
open a shared chain.

**Fix.** Mirror the intel treatment exactly:
- Pull `stubAgentEmail / stubAgentName / stubAgentPhone / stubNotes` into the
  destructure at chains.ts:668–679 so they leave the default wire shape.
- Re-add them only when the viewer may see them, reusing the same per-viewer
  ownership already computed (`ownership` + `canViewNodeIntel`, or a dedicated
  `canViewStubDetails(viewer, ownership)` on the agency model). Contacts/notes
  follow the same "owning agency of the stub only" rule as intel.
- Both return branches (unclaimed link chains.ts:720–735, claimed link
  chains.ts:766–794) must apply it.

Small, contained, and directly parallel to code already there.

---

## Blocker 2 — a director can be locked out of their own agency's chain

**What happens.** Chain visibility is keyed on the individual person. Internal
staff bypass; a customer director/negotiator does not. So if a **negotiator**
builds a chain and the **director** opens it, `/api/chains` returns
`notAParticipant: true` and the drawer shows "Only agents in the chain can see
the details. Ask the person who added it…" — a director told to go ask their own
junior about their own agency's sale.

**Where.** `canViewChain` (`lib/chain/permissions.ts:98–107`): internal roles
return true; everyone else must have personally created or claimed a link
(`l.claimedByUserId === userId || l.createdByUserId === userId`). The route acts
on this at `app/api/chains/route.ts` (the `notAParticipant` branch ~58–60); the
drawer renders the lockout copy in `components/chain/ChainDrawer.tsx` (~731–737).

**Fix (whole-agency, per decision).** Make chain participation agency-aware,
reusing the ownership facts intel already computes:
- A viewer is a participant if they are internal staff **or** their agency owns
  or created any link in the chain (`o.txAgencyId === v.agencyId`, or for an
  unclaimed stub `o.linkCreatedByAgencyId === v.agencyId`). This is exactly the
  `canViewNodeIntel` "owning agency" test, applied across the link set.
- `getChainV2` already builds a `ChainNodeOwnership` per link, so the participant
  decision can be computed from those objects rather than extending the thin
  `ChainLinkSummary` shape. Keep the existing person-based test as a fallback for
  legacy callers that don't pass agency/viewer context.

---

## Cleanup 3 — inconsistent team permissions (decision needed)

**What happens.** Within one agency team the rules disagree:
- Stub **edit / remove** go through the agency-aware `canEditNodeIntel`
  (`lib/chain/intel.ts:67`) — a director may edit/remove a colleague's stub.
- **Invite / share-link / photo** go through the person-based `canSendInvite` /
  `canEditLink` (`lib/chain/permissions.ts:44–55`) — **originator only**.

So a director can edit and remove a negotiator's stub but cannot send its invite,
add its photo, or copy its share link. Confusing for a real team; not a data
risk.

**Fix (recommended).** Align invite / share / photo onto the same agency-aware
ownership as edit/remove (reuse `canEditNodeIntel`'s unclaimed-stub branch:
internal, the creator, or a same-agency director). This matches the "whole agency
sees its chains" decision — the people who can see and edit a stub should also be
able to invite/share/photo it. Routes affected: `…/[linkId]/invite`,
`…/[linkId]/share`, `…/[linkId]/photo`.

---

## Cleanup 4 — legacy edit/delete routes

- `PATCH /api/chains/[id]` uses an ad-hoc `chain.agencyId !== session.user.agencyId`
  filter (`app/api/chains/[id]/route.ts` ~45) — the exact pattern Law 7 bans
  (breaks for internal staff whose `agencyId` is null). Route it through the
  access-scope helper or remove if unused.
- `DELETE /api/chains/[id]` checks `createdByUserId !== session.user.id && role
  !== "admin"` (~89) — omits `superadmin` and blocks a director from deleting a
  chain their own negotiator created. Align to the agency model + add
  `superadmin`.

---

## Rollout gate

Once 1–4 are done, widen `canSeeChains` (`lib/chain/chains-access.ts`).
Options for Ellis:
- **Controlled** — keep the email allowlist, add the first few agencies by hand
  (matches how Chains rolled out so far; lowest risk).
- **Self-managed agencies** — mirror Enquiries: show to any director/negotiator
  with self-managed files. Broader, only do once 1–4 verified.

Recommend controlled first (a named agency or two), then widen.

---

## Verification

- Unit: extend the permissions tests for the new agency-aware participant + stub
  gates (a same-agency director sees; a different agency does not).
- Data: on a real shared chain (two agencies), confirm agency A's response JSON
  contains none of agency B's `stubAgentEmail/Name/Phone/stubNotes` (blocker 1),
  and that a director sees a chain their negotiator built (blocker 2).
- `npx tsc --noEmit` clean; staging deploy; walk one shared chain as a director.

## Non-goals

- No change to the shared, by-design signals (address, status, % progress,
  predicted exchange, buyer-position label, aggregate chain value).
- No change to the cascade-on-withdrawal propagation (intended cross-agency
  writes).
- Not the chain-overhaul logic work (`docs/active/chain-overhaul/00-spec.md`) —
  this is purely the agency-rollout safety pass.
