# Buyer "Related Sale" tracker — build spec (v1)

Status: **LOGIC AGREED with Ellis. Step copy awaiting Ellis sign-off (Law 21 + the
onward precedent: Ellis approves this voice before it ships).** Nothing built yet.
Mirrors the seller onward-visibility feature. Migrations staging-first (Law 3).

## What it is (plain)

The mirror of the seller's onward tracker, on the buyer side. A buyer who is also
selling a property to fund their purchase (their "related sale", the chain link
BELOW them) reports that sale's progress, exactly as a seller reports their onward
purchase (the link ABOVE). The buyer is the SELLER on the related sale, so we track
the SELLING (vendor / VM) steps.

## Locked decisions (Ellis)

1. **Completion = Option A.** No block on the related sale's completion; the buyer
   marks it done when it happens (it naturally completes before/with our purchase,
   funds flow up). We do NOT gate the real file's milestones. (Option B — gating our
   real PM27 on the related sale — is a separate later call.)
2. **Who is "selling":** cash_from_proceeds AND mortgage buyers can be selling.
   Signal (mirror of the seller's buyingOnward), no jarring UI toggle:
   - derived: purchaseType = cash_from_proceeds, OR a chain link BELOW exists, OR
     fundsSource = "sale";
   - plus the same soft onboarding question sellers get ("Are you also selling a
     property?") as the catch-all for mortgage buyers who are selling.
3. **Reuse, not duplicate:** extend the ONE onward tracker to be direction-aware
   (onward-above vs related-sale-below) rather than a parallel model.

## Reuse map (from the two investigations)

Already symmetric / no work:
- "Your team" chain-agent surface: a buyer already gets "Your selling agent" (link
  below, position+1), can add/change it (updateMyChainAgentAction), pure cash buyer
  already excluded. (getPortalChainAgent, PortalTeamCard, PortalEditDrawer.)
- computeAutoNrCodes is side-agnostic (only tenure → VM8/VM9 bites vendor-side).
- Reconciliation-on-claim already handles BOTH vendor + purchaser sides.

Direction-aware changes (extend the shared code):
- Schema: add `kind` to OnwardTracker (`onward_purchase` default | `related_sale`);
  flip `@unique(transactionId)` → `@@unique([transactionId, kind])` (one file can
  have BOTH: its seller's onward + its buyer's related sale). Add `buyer` to
  OnwardConfirmSource (or a neutral `client`).
- Step set: parameterise loadPurchaserDefs → loadDefs(side); swap exchange-gate
  PM25 → VM18; swap prefix PM → VM in makeIsSatisfied; swap exchange/completion
  PM26/PM27 → VM19/VM20.
- Type facts: a related SALE has only TENURE (+ share of freehold). No purchaseType
  axis (a seller isn't "buying").
- Portal: mirror portal-onward.ts with a resolvePurchaser gate; render in the
  side==="purchaser" slot on the Progress tab; chain link below.
- Agent card: generalise OnwardPurchaseCard with a `direction` prop (Law 4).
- Exchange cascade: our buyer's exchange (PM26) → mark related sale VM19; add to the
  existing PM26 arm in milestones.ts.
- Inheritance: buyerAboveTransactionId (position-1); at claim filter side==="vendor";
  supersede/withdraw twins.
- Signal: getRelatedSaleSignalForFile (link below OR cash_from_proceeds OR the buyer
  "selling" flag) + a new ClientMoveInfo purchaser field (e.g. sellingRelated).

Privacy: identical to onward — private to our side, labelled "reported", never
cross-agency, never the other party.

## Step copy — the buyer's voice about THEIR sale (awaiting Ellis sign-off)

Mirror of lib/onward-copy.ts. Second person, about "your sale" (the property the
buyer is selling). Displayed set follows the onward's curation (main weighted steps;
enquiry sub-replies grouped). Leasehold-only steps (VM8/VM9) show only for leasehold.

| Step | Label | Subtext |
|---|---|---|
| VM1  | You've instructed your solicitor | They'll handle the legal side of the property you're selling. |
| VM2  | The memorandum of sale has been issued | This confirms your sale's details and gets the legal process going. |
| VM3  | You've had the welcome pack from your solicitor | The paperwork to get your sale started has arrived. |
| VM4  | You've done your ID and money-laundering checks | Your solicitor has what they need to act on your sale. |
| VM5  | Your solicitor has sent you the property forms | The forms about the property you're selling are ready to fill in. |
| VM6  | You've returned your completed property forms | Your solicitor can now put the contract pack together for your buyer's side. |
| VM7  | Your solicitor has issued the draft contracts | The legal pack for your sale has gone to your buyer's solicitor. |
| VM8  | Your solicitor has requested the management pack | For a leasehold sale, this gathers what the buyer's side needs. |
| VM9  | Your solicitor has received the management pack | Now on its way to your buyer's solicitor. |
| VM10 | Your buyer's solicitor has raised enquiries | These are the legal questions your side now answers. |
| VM21 | The enquiries on your sale are answered | The legal questions on your sale have been resolved. |
| VM16 | Your solicitor has sent you the contract to sign | Sign and return this and your sale can move to exchange. |
| VM17 | You've returned your signed contract | Your solicitor has your signed contract ready for exchange. |
| VM18 | Your sale is ready to exchange | Everything's in place on your sale for contracts to exchange. |
| VM19 | You've exchanged contracts on your sale | Your sale is now legally binding and the completion date is set. |
| VM20 | You've completed your sale | Your sale is done and the funds are released. |

## Build stages (each shippable, seller flow protected + verified)

1. Schema: `kind` + `@@unique([transactionId, kind])` + source enum. Migration.
2. Service: make lib/services/onward.ts direction-aware (step-set side, gate code,
   prefix, exchange/completion codes). Verify the seller onward path is unchanged.
3. Related-sale copy (lib/related-sale-copy.ts) + the buyer signal + ClientMoveInfo field.
4. Portal panel (purchaser slot on Progress) + portal actions (resolvePurchaser).
5. Agent card generalisation (direction prop) on the file.
6. Exchange cascade (PM26 → related VM19) + inheritance on claim (position-1, vendor).

## Management pack — DECIDED (Ellis, 2026-08-29): Option A

Keep only VM8 (requested) + VM9 (received). No new milestone (stay aligned with the
core model). VM9 subtext hints it's passed on ("Now on its way to your buyer's
solicitor.") so the "issued" is implied without a separate step.

## Copy status: SIGNED OFF (Ellis, 2026-08-29)
VM6 corrected (no premature buyer-questions reference); VM9 subtext hints hand-off.
Build may proceed. Ellis re-reviews if any wording surfaces wrong during build.

## Build status: ALL STAGES SHIPPED to staging (2026-08-29), NOT pushed to prod

Stages 1-6 + the signal writers committed on the staging branch (unpushed):
- Stage 1: schema `kind` + `@@unique([transactionId, kind])` + `related_sale` enum
  + `buyer` source; migration `20260829140000_related_sale_tracker_kind` (applied
  to staging DB). Every onward query scoped to `onward_purchase` (seller flow
  byte-for-byte unchanged).
- Stage 2: lib/services/onward.ts direction-aware via a DIRECTION config + trailing
  `kind` param.
- Stage 3: lib/related-sale-copy.ts (signed-off VM voice) + getRelatedSaleSignalForFile
  + ClientMoveInfo.sellingRelated (migration `20260829150000`, applied to staging).
- Stage 4: app/actions/portal-related-sale.ts + PortalOnwardPanel `direction` prop
  + purchaser Progress-tab "Your sale" panel.
- Stage 5: OnwardPurchaseCard `direction` prop + related agent actions +
  OverviewPanel renders both cards.
- Stage 6: PM26 -> related VM19 exchange cascade; getRelatedSaleInheritanceForLink
  (link above, vendor steps) merged into the claim wizard head-start;
  supersede/withdraw twins wired in claim route + withdrawal cascade.
- Signal writers: portal "Are you also selling?" question + intro-call toggle.

Remaining: push staging -> prod (Vercel runs `migrate deploy` for the two
migrations); Ellis eyeballs the buyer portal "Your sale" panel + the file's
"Related sale" card on a real staging file. Neighbour-update (chain activity feed)
for the related sale is NOT wired (onward-only) - a possible follow-up.
