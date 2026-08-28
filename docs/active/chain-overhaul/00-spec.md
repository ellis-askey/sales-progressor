# Chain Overhaul + Intro Drawer — Spec (v1)

Status: **LOGIC AGREED with Ellis (2026-08-28). Nothing built yet.** This is the
working source of truth for the arc. Written plain-English-first (the logic, the
privacy, who-sees-what) with a technical appendix for build reference. Migrations
staging-first (Law 3). One concern per PR (Law 5).

Related, folded-in spec: `docs/active/onward-visibility/00-discovery.md` (fully
agreed, unbuilt). This arc *reads from* that tracker; it does not rebuild it.
Branching (see Part 9) is explicitly a **separate later arc**, not part of this one.

---

## Decisions locked (Ellis, 2026-08-28)

1. "Your team can edit chains" was an overclaim. Today you can only edit an *empty*
   stub, the edit button only shows to whoever typed it, and none of the wanted
   fields exist. This arc builds the real edit surface + the fields.
2. Editing follows **file ownership**: the sale's creator, the assigned negotiator
   (overseer), the agency's director, and internal team. Never another agency's
   claimed node.
3. Unclaimed stubs stay editable by whoever added them (+ internal team). Already
   true today; we surface the control to the wider owner set.
4. Progress stays shown as the **% bar exactly as now**. No predicted timescale on
   the shared card. "Expected timescale / delays" is a private own-side field only.
5. **Chain-free / first-time-buyer / cash-buyer status IS shown** to other agencies
   in the chain.
6. Break-chain intel + chain notes + last-checked + timescale are **private to our
   side and the owning agency of that node ONLY**. Never other agencies, never the
   client.
7. **Onward visibility is folded in** as a shared data home the chain card reads
   from. Not rebuilt here.
8. **Intro-call checklist is internal-team-only** for now.
9. **Adding your own files to the chain** (self-link) is in scope: joins as a
   fully-claimed link immediately, no invite, both ends editable.
10. **Branching (tree) is deferred to its own arc**, after this one + the intro
    drawer ship.

---

## Part 1 — Why (the gap today)

- A claimed property in the chain (a real file) has **nothing to edit** on the
  chain card. The only editable thing is an unclaimed grey stub's address / agent /
  notes.
- The edit control only renders for the person who added a stub, not for the
  internal team or the file's wider owners, even though the back end allows them
  (`canEditLink` grants internal staff, but `LinkCard` only draws the button on
  `isOriginator && isUnclaimed`).
- None of the chain intelligence Ellis wants (break-chain willingness, conditions,
  timescale, chain notes, last-checked date) exists as fields anywhere.
- There is no intro-call script/checklist concept in the codebase at all.

## Part 2 — Already there vs genuinely new

**Already there (build on it):**
- Per-node address, agency name, agent name, agent email, agent phone, node notes
  (the `stub*` fields on `ChainLink`).
- Buyer position via `PurchaseType` (mortgage / cash_buyer / cash_from_proceeds).
- Onward, funds source (incl. LISA), first-time-buyer, deposit/mortgage figures
  (`ClientMoveInfo` + `Costs` card) — already "progressor-only, never shared".
- Internal notes = `OutboundMessage` rows `type = internal_note` via
  `lib/services/activity.ts` — clients never see them.
- Automatic chain split machinery (`lib/chain/split.ts`) — used today only by the
  withdrawal cascade.

**Genuinely new:**
- Break-chain intel fields + chain notes + last-checked + expected timescale.
- A real edit surface (the expand panel inside the card) with the ownership rules.
- The intro-call checklist / script + "introduction complete" note.
- Self-linking your own files as claimed nodes.
- (Later arc) branching a node into a tree.

## Part 3 — Editing model (who can edit a node's chain details)

- **Claimed node (a real file):** the sale's **creator**, the **assigned
  negotiator** (overseer), the **director** of that node's agency, and the
  **internal team**. No other agency in the chain can edit it.
- **Unclaimed stub:** whoever **added** the stub, plus the **internal team**.
  (Already true; we widen where the button renders.)
- Other agencies never edit your node; you never edit theirs.

## Part 4 — The fields and where they live

Rule: a fact is stored next to the thing it's about; the card *reads* facts that
live elsewhere rather than copying them.

- **On the chain node (`ChainLink`), new fields, private own-side:** seller
  prepared to break chain; may break if required; conditions around breaking;
  expected timescale / delays; chain notes; last chain check date.
- **Client circumstances stay in their existing home** (`ClientMoveInfo` /
  `PurchaseType` / costs). The card reads them: buyer position, chain-free /
  first-time / cash, onward purchase.
- **Onward purchase progress** reads from the onward tracker (Part 7). Not copied.

## Part 5 — Privacy grid (who sees what)

Audiences: **Internal** (SP/admin/superadmin), **Own agency** (creator / assigned
neg / director of this node), **Other agencies** in the chain, **Client** (own side
only, in portal).

| Field | Internal | Own agency | Other agencies | Client (own side) |
|---|---|---|---|---|
| Property address | see/edit | see/edit | see | see |
| Estate agent / agency | see/edit | see/edit | see | see |
| Agent contact name / phone | see/edit | see/edit | no | no |
| Seller name(s) | see/edit | see/edit | no | own side |
| Buyer name(s) | see/edit | see/edit | no | own side |
| Buyer position (cash/mortgage/proceeds) | see/edit | see/edit | **see (status)** | own |
| Chain-free / first-time-buyer | see/edit | see/edit | **see (status)** | own |
| Onward purchase / property | see | see | no | own |
| **Prepared to break chain** | see/edit | see/edit | **never** | **never** |
| **May break chain if required** | see/edit | see/edit | **never** | **never** |
| **Conditions around breaking** | see/edit | see/edit | **never** | **never** |
| Expected timescale / delays | see/edit | see/edit | no (only the % bar, as now) | no |
| Chain notes | see/edit | see/edit | no | no |
| Last chain check date | see/edit | see/edit | no | no |

The three break-chain fields are negotiating leverage. They are visible only to
internal team + the owning agency of that node. On outsourced files, internal =
us, and we run the whole chain, so in practice we hold intel on every link.

Engineering note: there is **no central field-level privacy switch** in the app.
Every new field defaults to internal/own-side. Anything we choose to expose to
another agency (only the chain-free / FTB / cash *status*, per Decision 5) must be
threaded deliberately through the cross-agency strip in `lib/services/chains.ts`.

## Part 6 — The chain card UI + intro drawer

- **Card unchanged at rest.** Looks like today (the screenshot). Click to expand a
  reveal panel *inside* the card.
- **Expand content is viewer-dependent.** Own node (or any node for internal team):
  full intel + read-through of onward/funds/position. Another agency's node: only
  the shareable basics (address, agency, claim status, % bar, and the chain-free /
  FTB / cash status).
- **Intro-call checklist = a carousel toggle** inside that panel: flip from
  "details" to "call script". A guided list of questions to work through on the
  phone that saves straight into the fields. Seller calls ask seller questions,
  buyer calls ask buyer questions (driven by `roleType`). Internal-team-only for
  now.
- **"Introduction complete"** button stamps the file and writes an automatic
  internal note ("Intro call completed by {name} on {date}") — tracked, saved,
  client never sees it.

## Part 7 — Folding in onward visibility

The onward-visibility spec is fully agreed and unbuilt. Folding = **one shared
onward data home; the chain card reads from it; the portal writes to it.** We do
not build a second onward store.

In plain terms, the onward tracker: when a seller is buying onward, a private
tracker opens on their file capturing the onward's type (freehold/leasehold) and
payment method, then a simple buyer-step checklist the seller ticks in their portal
(or the team fills in), all labelled "as reported". Visible to internal team + the
seller only, **never** other agencies, never the buyer. Onward exchanges when our
sale exchanges; onward can't complete before our sale completes. When the onward
agent later joins the chain, the seller's report pre-fills their reconciliation
wizard, then the tracker retires. One level only.

The chain card's "onward purchase" section reads the tracker's address, type, and
current status. Break-chain intel and chain notes sit alongside it, same own-side
privacy rule.

## Part 8 — Self-linking your own files

Add a file you already own into the chain as a **fully-claimed link immediately**
(no invite, no wait), positioned above/below like any node. Both ends stay editable
by your side. Saves re-entering data and speeds up chains where we hold two sales.

## Part 9 — Branching (DEFERRED, separate arc)

A property splitting into two onward paths (e.g. a couple separating, one sale
funding two purchases) turns the chain from a straight line into a tree. The whole
model is currently a single ordered line (`@@unique([chainId, position])`, no FK
between transactions). A branch breaks that assumption in rendering, invites,
split, and notifications. **Own design round, built after this arc + the intro
drawer.**

## Part 10 — Build order (each stands alone; one concern per PR)

1. **Chain intel fields + real edit surface** (break-chain, notes, last-checked,
   timescale) with the ownership editing rules. All private own-side. Fixes "I
   can't edit the chain." — **DONE 2026-08-28, on staging (commit f251fcec).**
2. **Show chain-free / FTB / cash status** across the chain (Part 1, buyer-position
   badge — **DONE 2026-08-28**), and surface a compact onward summary on the card
   (Part 2 — see correction below).
3. ~~The onward tracker~~ — **CORRECTION (2026-08-28): the onward-visibility tracker
   is ALREADY BUILT AND SHIPPED to staging + prod (stages 1-3, 2026-08-22, no
   feature flag).** Full service `lib/services/onward.ts`, agent card
   `components/transaction/OnwardPurchaseCard.tsx` already rendered on the file
   OverviewPanel, seller portal panel, and all event wiring live. So step 3 is not
   a build — it collapses into step 2 Part 2 as "read the existing tracker". The
   discovery doc header still wrongly says "nothing built"; trust the code + git.
4. **Intro-call checklist + "introduction complete" note** (internal-only).
5. **Self-linking your own files.**
6. **Branching tree** — separate arc.

### Part 2 duplication note

Because the onward card already lives on the file overview, showing the full onward
card again inside the chain drawer would duplicate it on effectively the same
screen (the drawer opens over the file). So Part 2 must be a compact *summary +
link-in*, not a second editable card — either a one-line reported status on the
viewer's own node, or on the link directly above (which IS their onward). Placement
to confirm with Ellis before building.

## Part 11 — Deferred / open

- Branching (Part 9).
- Whether the intro-call checklist ever opens to agency staff (currently
  internal-only, revisit later).
- Onward tracker's own deferred items (stub-contact viral nudge, client-chasing) —
  see the onward-visibility spec.

---

## Appendix — technical anchors (verified 2026-08-28)

- Chain models: `PropertyChain`, `ChainLink` (`prisma/schema.prisma` ~1743-1900).
  New intel fields land on `ChainLink`.
- Permissions: `lib/chain/permissions.ts` (`canEditLink`, `canViewChain`,
  `INTERNAL_ROLES_SEE_ALL_CHAINS`). Editing model in Part 3 extends the agency-side
  checks from "originator only" to creator / assigned-neg / director.
- Card UI: `components/chain/LinkCard.tsx` (edit buttons gated
  `isOriginator && isUnclaimed` — widen). Drawer: `components/chain/ChainDrawer.tsx`.
  Add/edit form: `components/chain/AddNodeDrawer.tsx`.
- Cross-agency strip (privacy): `lib/services/chains.ts` `getChainV2` (~490-538) —
  price/stuck nulled per-link. New shared status (chain-free/FTB/cash) added here.
- Access scope: `lib/security/access-scope.ts` (`scopeOwnershipWhere` etc.).
- Client circumstances: `ClientMoveInfo` (`prisma/schema.prisma` ~1587-1633),
  `PurchaseType` (~688-692), costs on `PropertyTransaction` (~301-323).
- Internal notes: `lib/services/activity.ts` (`type = internal_note`).
- Onward tracker: `docs/active/onward-visibility/00-discovery.md` Part 7
  (`OnwardTracker` + `OnwardStepConfirmation`).
- Split machinery (branching later): `lib/chain/split.ts`, `ChainLink.detachedAt` /
  `detachedFromChainId`.
</content>
</invoke>
