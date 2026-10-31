# Raw findings — Menus consolidation Phase 3 (agent aed777c)

## MN-1 Typeahead pickers render BEHIND the Relist modal (z-index regression) — DEAD END — Small — Confirmed
RelistFileModal.tsx:568,907,912 firm/broker pickers; SolicitorPicker.tsx:303/354; BrokerPicker.tsx:181; root Popover.tsx:150-216. RelistFileModal createPortal to body zIndex:1500. Pickers migrated onto AnchoredPanel which also portals to body but hardcodes zIndex??1400 (Popover.tsx:71) and exposes NO zIndex prop. modal 1500 > panel 1400 → firm typeahead results + case-handler dropdown paint behind modal. Relist fallen-through sale, type solicitor firm → results occluded. Core recovery flow, picker unusable. Fix: add zIndex prop to AnchoredPanel (mirror Popover), pass 1600 from pickers in escalated modals.

## MN-2 AnchoredPanel has no zIndex escape hatch (API asymmetry with Popover) — PROBABLY NOT CONSIDERED — Small — Confirmed
Popover.tsx:86-99 has zIndex (used EmailDetailDrawer.tsx:580 zIndex=1600) vs :150-171 AnchoredPanel does not — pinned at 1400. Works in ChaseDrawer only because that drawer uses inline zIndex:1000 (ChaseDrawer.tsx:747). Root cause of MN-1, latent trap for every future AnchoredPanel in escalated chrome. Fix: add zIndex?:number to AnchoredPanel, thread to FloatLayer.

## MN-3 Dead .wtc-emenu CSS after Popover migration — EASY WIN — Small — Confirmed
WeeklyTouchCard.tsx:206-212 .wtc-emenu* rules. Migrated onto Popover (825f24cc) but old dropdown styles remain; wtc-emenu only in this file, never in JSX. Fix: delete 5 orphaned rules.

## MN-4 WeeklyTouchCard email-options chevron doesn't rotate when open — UNFINISHED UI — Small — Confirmed
WeeklyTouchCard.tsx:117-125 <button className="c"> chevron. Caret rotation restored 2 ways: CSS allow-list (.fm-caret,.act-caret,.ce-caret,.rem-chase-caret svg agent-system.css:5368-5371) or inline transform via function-trigger (StatusControl.tsx:187 etc). This uses plain static trigger + bare svg in neither → stays still while sibling split-button carets animate. Fix: switch to trigger={(open)=>…} + inline rotate, or class + allow-list.

## MN-5 Caret rotation relies on hand-maintained 4-class allow-list (fragile) — LOGIC — Small — Confirmed
agent-system.css:5365-5371 hardcoded to .fm-caret,.act-caret,.ce-caret,.rem-chase-caret svg. Primitive stamps data-open on every anchor but only these 4 consume it. Any migrated trigger whose caret isn't named (and not using inline form) silently won't rotate — exactly how MN-4 slipped. Fix: generic `.ui-pop-anchor[data-open] [data-pop-caret]{transform:rotate(180deg)}` + mark carets with data-pop-caret, retire per-class list.

## MN-6 Tooltip adds tabIndex=0 stop (+ nested focusable inside row link) on every transaction row — PROBABLY NOT CONSIDERED — Small — Confirmed(code)/visual(keyboard)
Popover.tsx:251-254 anchor always tabIndex=0; consumer TransactionRowView.tsx:332-338 JourneyHover often block, inside a row that is itself a link. Every row gets extra keyboard tab stop that only shows tooltip + focusable span nested in <a> (a11y smell). All Files 40 rows → 40 extra do-nothing stops. Old bespoke hover had pointer-events:none, not a tab stop (stale comment :329-331). Fix: Tooltip focusable opt-out (focusable={false}) for decorative/row tips, or only add tabIndex when not inside interactive ancestor.

## MN-7 Inconsistent aria-expanded across migrated triggers — EASY WIN — Small — Confirmed
Has it: StatusControl.tsx:182, RowActionMenu.tsx:68, account pill AgentShell.tsx:209. Missing: FilterMenu.tsx:40, MonthlyTargetMenu.tsx:30, SnoozeMenu.tsx:60-68, ChaseSplitButton.tsx:39-47, WeeklyTouchCard.tsx:122. Popover anchor is generic span so each consumer must declare aria-expanded; ~half do. SR collapsed/expanded state now a coin-flip. Fix: Popover stamps aria-expanded on .ui-pop-anchor span, or document requirement.

## MN-8 Account menu re-implements locked glass recipe inline (drift risk) — PROBABLY NOT CONSIDERED — Medium — Confirmed
AgentShell.tsx:287-291 .uacc-card glass block vs canonical surfaceStyle() Popover.tsx:43-52. Account pill grandfathered off Popover to keep morph (Law-19, d107644c/f0a81c83) — legit. But hand-copies locked surface (rgba 0.30, blur(30px) saturate(200%), night 20,26,36) not a shared token. If locked recipe changes, this silently won't follow. Also zIndex:150 (drawers cover it) while AgentBell in same topbar rides Popover 1400 — undocumented split. Fix: extract glass values to shared constant/CSS var consumed by both surfaceStyle() + .uacc-card; leave morph bespoke. (Flag only.)

## Held up well
- use-anchored-position.ts flips/shifts with edge gutter, recomputes on capture-phase scroll.
- useExitAnimation uses timer not animationend so reduced-motion can't strand a layer.
- StatusControl clean reference (caret + check-mark + bold selected + disabled).
- ChaseSplitButton/RowActionMenu/SnoozeMenu render trigger bare when disabled so disabled control can't open.
Strongest: MN-1 (+ root cause MN-2).
