# Raw findings — Onward Portal Mirror (agent ab91376)

Scope: lib/services/onward.ts, portal-twin.ts, progressing-team.ts, app/portal/[token]/progress/page.tsx (buildNeighbourStepsPanel), components/portal/PortalMilestoneList.tsx, PortalReadOnlyProvider.tsx, app/actions/portal.ts, docs/active/onward-portal-mirror.md.

## OPM-1 Confirming a mirrored step ticks, confetti, then silently reverts — LOGIC — Small — Confirmed
page.tsx:76-93 nested list runs under twin.portalToken; app/actions/portal.ts:68-70 revalidates /portal/{neighbourToken}, NOT the source token the client is on. useOptimistic falls back to stale un-ticked prop after transition settles. Full reload shows correct. Fix: revalidate both tokens' progress paths on neighbour confirm.

## OPM-2 Read-only mirror shows live Confirm/Skip/Upload controls that do nothing — DEAD END — Small — Confirmed
page.tsx:110-121 wraps in PortalReadOnlyProvider readOnly, but PortalMilestoneList.tsx:399 canConfirm = saleActive && available && !agentOnly — never consults readOnly. Confirm button, "Skip survey", help ?, PM10 SearchesUpload dropzone all render live. Tapping Confirm opens sheet; sheet Confirm just closes (:178). No "View only" badge (other-side panel has one at :493; onward mirror doesn't). Worst-affected = genuine untied client. Law 13 dead-control. Fix: thread readOnly into canConfirm; add View-only badge + "we'll confirm these for you" note.

## OPM-3 Mirror panel shows bare steps, no property address/heading — MISSED CONNECTION — Small — Confirmed
page.tsx:84-94 & :110-121 return lone PortalMilestoneList; stand-in PortalOnwardPanel gets onwardAddress (:196/:218) but richer mirror shows none. Seller can't tell which property the checklist is for; two tabs look interchangeable. Fix: header with neighbour propertyAddress above mirrored list.

## OPM-4 Twin matching by name has no role-side guard — LOGIC — Medium — Confirmed(behaviour)/Possible(likelihood)
portal-twin.ts:79-83 candidates = ALL neighbour contacts, role-blind; :50-59 name match. onward_purchase should only tie to neighbour's purchaser. If true purchaser has different/missing name and neighbour's vendor (stranger) shares title-stripped 2-word name, single-hit name match ties to stranger and renders their side under their token. Only place feature crosses client boundary. Email match safe; name-only branch is soft spot. Fix: constrain candidates to required role before matching; gate name-only branch behind stored/agent-confirmed tie.

## OPM-5 Swipe-inside-swipe: full PortalMilestoneList nested in outer panel — UNFINISHED UI — Medium — Visual
mirror passed as onwardPanel page.tsx:180/:201, rendered PortalMilestoneList.tsx:347-350; two independent height ResizeObservers + two nested scrollSnapType:x containers. Spec flags nested layout as the one open risk. Possible height jump/settle-nudge on confirm/expand; drag feel off. Fix: visual pass 1280px+375px on tied pair; if jank, leaner presentational variant (no swipe/observer).

## OPM-6 On-hold neighbour fully confirmable through mirror — PROBABLY NOT CONSIDERED — Small — Confirmed(behaviour)/Possible(problem)
onward.ts:468 resolver accepts active AND on_hold; portal.ts:1004 PORTAL_WRITE_BLOCKED_STATUSES={withdrawn,completed} (on_hold not blocked); page.tsx:91,118 saleActive only checks withdrawn/completed. Client can confirm steps on a paused file from mirror, firing its real emails/chase the agent meant to suspend. Fix: decide — render on_hold read-only, or document it's intentional.

## OPM-7 Kill switch drops mid-flow client to "set up your onward" prompt — PROBABLY NOT CONSIDERED — Small — Confirmed
page.tsx:62,69 kill switch → null; fallback :181-197 stand-in renders in SETUP mode (onwardLinkKnown true, no tracker row). Flipping ONWARD_PORTAL_MIRROR_ENABLED=false shows seller "Tell us about your onward purchase" (tenure/method) — looks like progress vanished. Not graceful. Fix: neutral "progress will appear here" state when switch off and neighbour would've resolved.

## OPM-8 Read-only fallback calls survey-booking lookup with empty token — EASY WIN — Small — Confirmed
PortalMilestoneList.tsx:160-164 openSheet PM9 calls getPortalSurveyBookingOptions(token) with token="" (page.tsx:113). Wrapped in catch so harmless but wasted/failing round-trip, only reachable because dead Confirm renders. Resolved by fixing OPM-2.

## Solid (no action)
- Revert-on-withdrawal free (onward.ts:468 gates live status).
- Fail-safe try/catch page.tsx:122-127 + kill switch real, default-on.
- Agent-preview inertness inherited correctly (confirmable path doesn't wrap own provider).
- isSameProgressingTeam handles 3 service models; won't treat different business on same agency as "ours".

TOP 2 before sign-off: OPM-1 (confirm reverts), OPM-2 (dead controls). Both Small.
