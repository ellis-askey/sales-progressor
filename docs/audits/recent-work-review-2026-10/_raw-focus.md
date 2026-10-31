# Raw findings — Focus page rebuild (agent a383c32)

Scope: components/focus/FocusClientComms.tsx, FocusRightRail.tsx, app/agent/focus/page.tsx, lib/services/focus.ts, app/actions/weekly-touch.ts, components/ui/Popover.tsx Tooltip.

## FOC-1 Pending touch write dropped if you leave page within 5s undo window — LOGIC (data loss) — Medium — Confirmed
FocusClientComms.tsx:155-156,181-190. resolve() shows success + hides side immediately but delays DB write behind 5s setTimeout. Unmount cleanup clears every pending timer WITHOUT flushing. Log a call+note then tap property photo (router.push unmounts) before 5s → logSideCall never runs, note gone, side reappears untouched. Thumbnail sits next to Contact menu so act-then-click is natural. Fix: flush pending timers on unmount (run action immediately) or fire write up-front with Undo as compensating action; at min flush on beforeunload/route change.

## FOC-2 "Connect to WhatsApp" driven by message history not actual connection — LOGIC — Medium — Confirmed
page.tsx:72 showWhatsApp=left.whatsappInUse → focus.ts:205-210 whatsappInUse = waAny != null → passed as whatsappConnected into ContactMenu, gates readout column AND menu CTA. Agency that connected WA but not sent yet sees "Connect to WhatsApp" everywhere; one stale imported WA msg flips whole book to connected offering wa.me links. Fix: resolve real WA connection state separately; keep whatsappInUse only for readout column render.

## FOC-3 On touch, tapping populated channel navigates away instead of showing detail popover (#298) — DEAD END — Medium — Confirmed(behaviour)
FocusClientComms.tsx:543-546,482-486; Popover.tsx:260 Tooltip anchor onClick. Channel button has own onClick (navigate/open modal), wrapped by Tooltip whose anchor onClick pins tooltip on tap. Coarse pointer: both fire; router.push navigates before pinned detail seen. Only empty ghost channels (no onClick) show tapped detail. #298 mobile affordance broken for every populated channel. Fix: on coarse pointers first tap pins + suppresses nav, nav on second tap or explicit action inside tooltip.

## FOC-4 Orphaned .fcl-tip CSS from Tooltip migration — EASY WIN — Small — Confirmed
FocusClientComms.tsx:837-843 + reduced-motion rule 885 + @media(max-width:560px){.fcl-tip{display:none}} 886. ChannelUnit now renders via <Tooltip> (portalled FloatLayer); .fcl-tip container/::after arrow/.fc-u:hover/.fc-u.tip-open target non-rendered element. fcl-tip-h/state/when/snip/empty content classes still used — keep those. ~8 lines dead incl misleading mobile display:none. Fix: delete container/arrow/hover/tip-open + .fcl-tip tokens in 2 media queries.

## FOC-5 "Awaiting reply" counts automated chases as your outreach regardless of toggle — LOGIC — Small — Confirmed(intent is Q)
focus.ts:223 outreach = !inbound && method!=="phone" (no isAutomated check), 252-258. Include-automated toggle (#297) only affects readout/quiet clock, not this view. Side that only received automated chases and never replied appears under "Awaiting reply" subtitled "You've been in touch, but haven't heard back" — untrue. Overstates tab count. Fix: exclude automated from outreach (human-only simplest; toggle state not available server-side).

## FOC-6 "Searches N days overdue" uses days-since-ordered not days past expected return — LOGIC — Small — Confirmed
focus.ts:350 `Searches ${s.daysAgo} days overdue` where daysAgo=days since ordered (401). Overdue threshold 21d, so ordered 25d ago is ~4d overdue but says "25 days overdue". Contradicts right rail "Ordered 25 days ago". Fix: say "ordered N days ago" or compute daysAgo - SEARCH_OVERDUE_DAYS.

## FOC-7 "Needs you most" float-to-top uses raw quiet, ignores Include-automated toggle — PROBABLY NOT CONSIDERED — Medium — Confirmed
isHot FocusClientComms.tsx:205,210 uses s.quiet; vs effQuiet per-side 422-425. With toggle ON a side can be de-quieted (no chip) but list sort still floats it to top with flame via raw s.quiet. Toggle changes chip but not ranking → looks arbitrary. Fix: factor include-automated into staleness/hot computation (lift out of SideBlock) or document ordering is human-contact-only.

## FOC-8 anyQuiet threaded to client component but never used — EASY WIN — Small — Confirmed
FocusCommsFile.anyQuiet type :36, populated page.tsx:46, never read (ordering uses isHot/worst). Dead data plumbing; intended ordering/badge superseded by needsYou/worst, left half-wired. Fix: remove or use as tiebreaker.

## Smaller notes
- Focus actions revalidate wrong path: logSideCall/logSideEmailed/markSideNotRequiredThisWeek revalidatePath("/agent/to-do") not /agent/focus; page stays fresh only via client router.refresh(). Only addSideContactPhone revalidates /agent/focus. (weekly-touch.ts:46,59,71,89)
- Neutralised Contact-menu CSS: after AnchoredPanel migration inline style on .fc-pop (:640) forces position:static;transform:none;opacity:1 overriding .fc-pop entry-animation rules (794-795). Partially dead.
- Flame reason only on hover: title attr (:458), no tap affordance mobile.

## Correctly wired (no action)
- Logging call/email goes through createCommunicationRecord → lands on real file activity/comms + feeds gone-quiet/weekly-touch (weekly-touch.ts:50-73).
- Composer refreshes on close (:313); sent email ticks side via comms recency.
- Searches card round-scoped so relisted file's withdrawn-round PM13 can't wrongly mark results received (focus.ts:378-384).
