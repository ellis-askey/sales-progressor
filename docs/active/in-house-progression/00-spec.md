# In-house progression — CM → progressor handoff within one agency

**Status:** spec (approved decisions, not yet built)
**Driver:** Boardwalk Property Co (self-managed agency with in-house progressors Laura Falk + Ruby Pomphrey)
**Last updated:** 2026-11-06

## Problem

At Boardwalk, **client managers (CMs)** agree sales and then hand them to an **in-house progressor** (Laura or Ruby). Everyone in the agency has an account. A sale therefore needs two owners at once — the CM who agreed it, and the progressor who runs it — and both must be able to find it. Either party may create the sale: a CM creates it and names the progressor (or drops it in a pile to be assigned); a progressor creates it and names the CM whose sale it is.

## The good news (what already exists)

Every `PropertyTransaction` already carries both owner slots — we reuse them, no new ownership field:

- `agentUserId` (reverse `User.agentFiles`) = the agency person who **agreed/created** the sale → **the CM**. Set to the creator by default; director-changeable today via `reassignAgentAction` ([app/actions/transactions.ts:1661](app/actions/transactions.ts#L1661)) + `ReassignOwnerControl`.
- `assignedUserId` + `assignedAt` (reverse `User.assignedTransactions`) = the individual **progressor** → our in-house progressor. Today only wired for outsourced/TSP files and blocked from agency users (`assignUserAction` is TSP/business-owner only, [app/actions/transactions.ts:1706](app/actions/transactions.ts#L1706)).

Visibility seam: agency "my files" filters on `agentUserId == me` only ([lib/services/agent.ts:108](lib/services/agent.ts#L108)); "all files" = whole agency. Driven by the nav **all/mine toggle** (`fileViewMode` in `agentPreferences`, [lib/services/agent.ts:46-58](lib/services/agent.ts#L46)) under a `canViewAllFiles` ceiling.

Reusable building blocks: `AgentPicker` + `listAssignableAgentsForAgency`, the `ReassignOwnerControl` modal pattern, and the outsourced "needs assigning" pile (`getHubUnassignedFiles`).

## Locked decisions (founder, 2026-11-06)

1. **Soft separation.** No hard access boundary. On **All files** everyone sees every agency sale; on **Mine** they see only theirs. The existing nav toggle is the mechanism — no change to `access-scope.ts`.
2. **Progressor pool = Laura Falk + Ruby Pomphrey.** The "who's progressing it" picker offers only flagged in-house progressors.
3. **Anyone can assign/reassign** either owner (CM or progressor) — provided every change is written to the **activity log**.
4. **Everyone stays "see all"** (`canViewAllFiles = true`); they toggle to **Mine** to focus. That's why the toggle exists.

## The model

**"Mine" = `agentUserId == me` OR `assignedUserId == me`.** A CM sees sales they agreed; a progressor sees sales assigned to them; someone who is both sees both. "All files" and director behaviour unchanged. This only *widens* the Mine view, so nothing is ever hidden.

Because a normal agency's self-managed files have `assignedUserId = null` and outsourced files point `assignedUserId` at a TSP/business progressor (never an agency negotiator), this widen is a **no-op for every other agency** — safe to apply universally, no flag.

### Workflows

- **CM creates the sale:** they're the agent (`agentUserId = self`, the default). New optional **"Who's progressing it?"** picker (pool only) sets `assignedUserId`. Leave blank → lands in the unassigned pile.
- **Progressor creates the sale:** new **"Who agreed this?"** picker sets `agentUserId` to the CM; they set the progressor (themselves or a colleague) via the same progressor picker.
- **Reassign later:** a "change progressor" control (clone of `ReassignOwnerControl`, writing `assignedUserId` + `assignedAt`) and the existing "change owner" control, both open to any agency user, both logged.
- **Unassigned pile:** self-managed files with `assignedUserId = null` surface in a "needs a progressor" card for anyone to assign/claim. Mirrors the outsourced pile but filtered to `serviceType: self_managed`.

## Data-model changes

- `User.isInHouseProgressor Boolean @default(false)` — marks the progressor pool. Set true for Laura + Ruby. (One additive migration.)
- **Gating:** an explicit agency opt-in so only Boardwalk gets the new creation pickers / assign UI / pile. Options: `Agency.inHouseProgressionEnabled Boolean` (per-agency, cleanest) **or** an `IN_HOUSE_PROGRESSION_AGENCY_IDS` env list (dark-launch friendly, matches the migrate-sale pattern). The **Mine-view widen (above) is NOT gated** — it's universal and harmless.

## Fail-safes

- Gated: every other agency's self-managed flow is byte-for-byte unchanged.
- Never touches the TSP/outsourced path — its unassigned bucket filters `serviceType: outsourced`, so self-managed sales can't leak in.
- Visibility change is widen-only — no one loses access.
- A sale with no progressor is still visible to its CM + directors + the pile — never orphaned.
- No `access-scope.ts` change — the security boundary (whole-agency) is untouched; this is all dashboard-level focusing.

## Phased build plan

- **P0 — data:** migration for `User.isInHouseProgressor` (+ agency gate flag); flag Laura + Ruby. Staging → verify → prod.
- **P1 — visibility (universal, safe):** `txWhere` Mine branch → `OR [agentUserId, assignedUserId]`. Progressors immediately see their assigned files under Mine.
- **P2 — assign/reassign (gated):** open `assignUserAction` to agency users on self-managed files with activity logging; mount a "change progressor" control; open "change owner" to all agency users (logged).
- **P3 — creation (gated):** add the two pickers to `NewSaleFlow` for enabled agencies (who-agreed + who-progresses, pool-limited, progressor optional).
- **P4 — unassigned pile (gated):** "needs a progressor" card for self-managed `assignedUserId = null`, assignable by anyone.
- **P5 — rollout:** enable Boardwalk; everyone stays see-all + toggles to Mine.

Each phase ships independently and is reversible.

## Open items

- Gate mechanism: Agency column vs env list (recommend the column for a real customer).
- Does the unassigned pile live on the Hub (like the outsourced one) or its own surface? (Lean: Hub Attention card, reusing the pattern.)
- Activity-log copy for the four events (owner set/changed, progressor set/changed).
