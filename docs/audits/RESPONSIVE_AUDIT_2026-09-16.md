# TSP — Mobile & Tablet Responsive Layout Audit

Date: 2026-09-16. Read-only audit; no code changed. Six parallel code-tracing passes covered: agent shell + hub, property file page, lists/forms/creation flows, chains + overlays, Command Centre, shared primitives + portal + global breakpoint inventory.

Width model used throughout: with the agent sidebar visible (≥768px), usable content = viewport − 220 (sidebar) − 64 (md:px-8 padding). So: 1280→996px, 1024→740px, 834→550px, 820→536px, 768→484px. Below 768 the sidebar becomes an overlay drawer and content = viewport − 32: 767→735px, 430→398px, 390→358px, 360→328px.

---

## Executive summary

**Overall state.** TSP's responsive implementation is genuinely attempted almost everywhere — nearly every surface has some breakpoint behaviour, the buyer/seller portal is properly mobile-first and healthy, and two features (chain fork stacking, people-card rows) already use container queries, the most robust pattern in the codebase. But the implementation has one systemic flaw that undermines a large share of it, plus a handful of outright breaks.

**Tablet is the bigger problem, not mobile.** Mobile (<768px) mostly works because dedicated `max-width: 767` rules exist and the sidebar gets out of the way. The pain is the **tablet dead zone (768–1023px)**: the 220px sidebar is present, every "desktop" grid is still active, and all breakpoints measure the viewport rather than the ~220–284px-narrower content column. The load-bearing number: **content is 484px wide at a 768px viewport but 735px at 767px** — the app has *less* room at iPad-portrait sizes than on a large phone, while running its desktop layouts. A second, independent dead zone exists on the file page at **1024–1290px**, where the 288px file sidebar reappears at `lg` and shrinks the main column from ~550px to ~432px.

**Recurring causes (in order of blast radius):**
1. Viewport-based breakpoints that ignore the persistent sidebar(s) — affects hub grids, files table, new-sale flow, chains workspace tiles, enquiries, milestone strip, Command Centre stat grids.
2. Fixed-px tracks/widths inside flexible layouts (files-table columns, CommsButton `minWidth: 88`, hero exchange editor, footer button rows).
3. Hover-only affordances and sub-40px tap targets with no `pointer: coarse` strategy — a functionality loss on tablets, which are a core audience.
4. No shared breakpoint tokens: 28 distinct values in product CSS, including 639/640, 767/768, and 1023/1024 coexisting as the "same" breakpoint.
5. Single-line truncation used where a two-line wrap is the honest answer (addresses as row headlines).

**Isolated or systemic?** Roughly 60% systemic (the sidebar/viewport mismatch plus the shared-primitive and touch issues account for most findings), 40% genuinely local. That is good news: perhaps six shared fixes resolve or downgrade the majority of the list.

**Count:** 35 meaningful findings — 3 Critical, 9 High, 13 Medium, 10 Low. Two are functional (not cosmetic): the new-sale flow hides fee/notes entry entirely below 1024px, and the files-table address column collapses to zero width on iPads.

---

## Responsive findings

### A. Systemic / shared-source

**A1 — Agent sidebar creates the 768–1023 tablet dead zone**
- **Component/file:** `app/globals.css:79-80` (`.agent-main-content` `margin-left: 220px`), `globals.css:988` (single mobile flip at ≤767); `components/layout/AgentShell.tsx:384`.
- **Affected widths:** 768–1023 (iPad portrait 768/820/834 squarely inside).
- **Current behaviour:** the 220px sidebar is fixed and visible from 768px up, with no intermediate state; every content grid keeps its desktop composition down to 767.
- **Problem:** content is narrower at 768 (484px) than at 767 (735px). The whole band renders desktop layouts into less width than mobile gets.
- **Recommended behaviour:** give the sidebar an icon-only rail (~64px) between 768–1023, or raise the shell's overlay-sidebar breakpoint to 1024.
- **Suggested breakpoint:** rail at ≤1023.
- **Shared impact:** fully or partially resolves B1, B2, B3, B4, C2, D2, E1, F1 below. The single highest-leverage change in the audit.
- **Priority:** Critical.

**A2 — File-page second dead zone at 1024–1290**
- **Component/file:** `components/transaction/PropertyFileTabs.tsx:222-246` — sidebar `hidden lg:block w-72 flex-shrink-0`, two-column at `lg` (1024).
- **Affected widths:** 1024–~1290.
- **Current behaviour:** crossing 1024 upward, the 288px file sidebar reappears while the 220px nav rail is already present; main column drops from ~550px (1023, single col) to ~432px (1024).
- **Problem:** every main-column surface (milestone strip, reminders, steps, overview cards) is most cramped exactly where the layout declares itself "desktop".
- **Recommended behaviour:** gate the file sidebar at `xl`-ish (~1180–1200) so the main column never falls below ~640px in two-column mode; or narrow the sidebar to ~240px at the low end.
- **Suggested breakpoint:** two-column ≥ ~1180.
- **Shared impact:** directly relieves C2 (milestone strip), C4 (reminders), C9 (sidebar accordion).
- **Priority:** High.

**A3 — No breakpoint system; 28 ad-hoc values, off-by-one duplicates**
- **Component/file:** inventory across `agent-system.css`, `globals.css`, `app/styles/*`, `claim-flow.css`; `tailwind.config.ts` defines no custom screens.
- **Current behaviour:** ~60 layout media queries over 28 distinct values. 639/640, 767/768, 1023/1024 all coexist; a long tail (420, 450, 500, 520, 560, 620, 650, 680, 700, 860, 900, 999, 1000, 1060, 1240, 1500) is used once each. Three container queries exist (`.chain-stack` 927/613, `.people-rows` 459) and are the healthiest pattern present.
- **Problem:** no shared tokens, so every component re-derives thresholds; viewport values silently disagree with actual available width.
- **Recommended behaviour:** define shared tokens (e.g. 480 / 768 / 1024 / 1280) plus a documented convention: *container queries for anything inside a column, viewport queries only for shell chrome*. Fold the off-by-one duplicates together as files are touched (not a bulk rewrite — Law 16).
- **Shared impact:** prevents recurrence of every class of finding here.
- **Priority:** Medium (enabler).

**A4 — Hover-only affordances have no touch path**
- **Component/file:** chain insert "+" markers `globals.css:1274-1299` (opacity 0 until `:hover`); stub-photo upload `globals.css:1400-1411`; hero edit pencils `HeroSaleFields.tsx:108-113`, `HeroExchangeCell.tsx:101`; service-swap arrow `.v2-swap-arrow` `agent-system.css:2781-2799`; files-list hover popovers `TransactionRowView.tsx:187-245, 286-367` (activity chip, people hover, risk popover); sort chevrons `TransactionTable.tsx:66` (`opacity-0 group-hover`).
- **Affected widths:** every touch device (all tablets + phones).
- **Problem:** on touch there is no hover: chain insert-between/branch-insert and stub-photo upload are effectively unreachable; buyers/sellers and activity detail in the files list are inaccessible; edit affordances are undiscoverable.
- **Recommended behaviour:** one shared `@media (pointer: coarse)` strategy — persistent low-opacity affordances, tap-to-open popovers, and mirror chain inserts into the LinkCard ⋯ menu (which is already tap-friendly and edge-clamped).
- **Priority:** High (functionality loss, not polish).

**A5 — Sub-40px tap targets clustered on the most-used controls**
- **Component/file:** reminder actions `RemindersSection.tsx:268-293` (four 28px-high buttons, 6px gaps); bespoke drawer closes at 22×22 (`ChainDrawer.tsx:793`, `AddNodeDrawer.tsx:460`, `ChaseNeighbourDrawer.tsx:316` — all `agent-icon-btn-sm`, vs the 32px primitive close); filter-chip clear-× at 14px `TransactionListWithSearch.tsx:116,190,283,358`; milestone "Change date"/"Undo"/"Not required" 11px text links `MilestoneRow.tsx:596-612, 762-783`; comms icon cluster 5px gaps.
- **Affected widths:** all touch.
- **Recommended behaviour:** `@media (pointer: coarse)` bump to ≥40px hit areas (padding + negative margin where visual size should stay) and ≥8px gaps.
- **Priority:** Medium.

**A6 — Modal/Drawer footers can't wrap**
- **Component/file:** `components/ui/Modal.tsx:329-345`, `components/ui/Drawer.tsx:378-394` — `flex justify-end gap-8`, no `flexWrap`, fixed 24px padding.
- **Affected widths:** ≤430, acute at 390/375/360.
- **Problem:** Cancel + a long-label primary (e.g. "Switch to TSP progression", "Not exchanging today") overflow the footer; `UndoMilestoneModal.tsx:183` already works around it with forced `flex-1` — the tell that the primitive default is wrong.
- **Recommended behaviour:** `flexWrap` by default plus stacked full-width buttons (primary on top) below ~420px; reduce padding to 16px there. Consumers' workarounds then come out.
- **Shared impact:** every modal/drawer consumer.
- **Priority:** Medium.

**A7 — CommsButton fixed `minWidth: 88`**
- **Component/file:** `components/ui/CommsButton.tsx:39` (labelled variant).
- **Problem:** three labelled buttons = 264px+ that overflow any card under ~300px; `compact` exists but each consumer must know to use it.
- **Recommended behaviour:** make the labelled variant shrink-tolerant or auto-collapse to compact below a container width.
- **Priority:** Medium.

**A8 — Primary-identifier truncation masking layout problems**
- **Component/file:** property address in the files row `TransactionRowView.tsx:606,609`; completions headlines `CompletionFileRowView.tsx:113`, `CompletedSection.tsx:76`; reminder titles `AgentRemindersList.tsx:229`; proposals `ProposalReview.tsx:284-285`; stuck-reason `RemindersSection.tsx:737` (tooltip-only recovery).
- **Problem:** single-line `nowrap` ellipsis on the row's identity or the actionable content; on narrow columns the information is simply lost. Table-cell truncation elsewhere (ChaseHub, Outbound, GlobalSearch) is legitimate and not flagged.
- **Recommended behaviour:** two-line wrap via container query for headline addresses/titles (the chain LinkCard already did exactly this correction — `LinkCard.tsx:667` comment).
- **Priority:** Medium.

### B. Hub + shell

**B1 — Hub `2fr 1fr` and `1fr 1fr` rows hold to 767**
- **Component/file:** `app/agent/hub/hub-view.tsx:500` (`.hub-grid-main`), `:510` (`.hub-grid-half`); collapse rules `globals.css:1046-1047` (≤767 only).
- **Affected widths:** 768–~1000.
- **Problem:** at 768 the Wins column is ~150px (tall-skinny) and the pipeline-health card ~310px while still holding a 4-cell stat row.
- **Recommended behaviour:** stack to one column ≤1024 (or container ≤640 on the hub content region).
- **Priority:** High (resolved by A1's rail; otherwise fix directly).

**B2 — Pipeline-health stat quartet with dividers**
- **Component/file:** `hub-view.tsx:825` (`.hub-stats-grid` `repeat(4,1fr)` + per-cell `borderLeft` at `:901`); 2-col only ≤767 (`globals.css:1048`).
- **Affected widths:** 768–~1000, compounded inside B1's narrowed column (~77px/cell).
- **Problem:** currency values ("£1,240,000" at 22px) wrap 3–4 lines against dividers.
- **Recommended behaviour:** container query on the card → 2-col below ~340px card width.
- **Priority:** High.

**B3 — Pipeline-at-a-glance column jumps (6→3→2) miscalibrated**
- **Component/file:** `components/hub/PipelineAtAGlance.tsx:84`; `agent-system.css:1613-1619` (6-col, →3 ≤1240, →2 ≤680).
- **Affected widths:** ~1240–1280 (6-col at ~156px/card) and 768–900 (3-col at ~150px/card with thumbnails still on — the ≤680 thumbnail hide is viewport-based and hasn't fired).
- **Recommended behaviour:** container-driven column count: 2 < ~460px, 3 < ~700, 4 < ~940, else 6; tie the thumbnail hide to the same container width.
- **Priority:** Medium.

**B4 — Topbar crowding at 768–900**
- **Component/file:** `AgentShell.tsx:318-370`; `.agent-topbar` `globals.css:83` (width = viewport − 244).
- **Problem:** at 768 the 524px bar holds search + "As of HH:MM" chip + theme + aurora + bell + avatar/name; search compresses to ~170px the instant desktop chrome switches on.
- **Recommended behaviour:** ≤900: icon-only refresh, hide the username (keep avatar), min-width ~160px on search.
- **Priority:** Medium.

**B5 — Decorative ghost-preview grids have no responsive fallback**
- **Component/file:** `hub-view.tsx:375, 378, 434` — inline `gridTemplateColumns` with no class, so no media query applies.
- **Problem:** the 0.35-opacity preview grids stay 4-col/2fr-1fr at every width; visibly broken on phones.
- **Recommended behaviour:** reuse `.hub-grid-main`/`.hub-stats-grid` classes or hide ≤767.
- **Priority:** Low.

**B6 — FirstSaleHero stacks too late**
- **Component/file:** `components/hub/FirstSaleHero.tsx:33`; `agent-system.css:2232-2284` (stacks ≤860 viewport).
- **Affected widths:** 861–~1120 (writing column ~277–450px, 34px heading wraps 2–3 lines).
- **Recommended behaviour:** stack ≤ ~1040 viewport or container ≤700.
- **Priority:** Low.

### C. Property file page

**C1 — Tab bar overflows invisibly (desktop included)**
- **Component/file:** `PropertyFileTabs.tsx:134-190` (`overflow-x-auto scrollbar-hide`, no fade/chevron); `.agent-tab-bar` `agent-system.css:1256-1273`.
- **Affected widths:** internal staff have 10 tabs ≈1120–1150px — overflow at every viewport below ~1450 including 1280 desktops; 8–9 tabs for agency roles overflow < ~1050.
- **Problem:** Documents / Activity / WhatsApp sit off-screen with zero indication they exist.
- **Recommended behaviour:** edge fade-mask (same trick as the milestone strip) + right chevron when `scrollWidth > clientWidth`; content-driven, not a px breakpoint.
- **Shared impact:** `.agent-tab-bar` is shared with other tab rows.
- **Priority:** High.

**C2 — Milestone timeline strip scrolls through the whole two-column range**
- **Component/file:** `MilestoneTimelineStrip.tsx:132-173` (stages `flex: 1 0 92px`, needs ~690px + ~130px action column).
- **Affected widths:** whole 1024–1280 two-column band (main col 432–~690) plus 768–1023.
- **Problem:** the at-a-glance 6-stage summary shows ~4 stages nearly everywhere below 1280.
- **Recommended behaviour:** compact mode via container query ≤ ~700px strip width (smaller stage basis, action buttons already stack ≤500). Root relief comes from A2.
- **Priority:** High (downgrades to Medium if A2 lands).

**C3 — HeroExchangeCell edit mode overflows its half-width cell**
- **Component/file:** `HeroExchangeCell.tsx:66-90`; mobile stat grid `PropertyHero.tsx:487-490` (`grid-cols-2` → ~155–190px cells).
- **Affected widths:** ≤~500.
- **Problem:** DateField (150px) + Save + "Use prediction" ≈250px spill out of the cell.
- **Recommended behaviour:** span both grid columns in edit mode, or stack the buttons under the field.
- **Priority:** Medium.

**C4 — Reminders action cluster crushes the label**
- **Component/file:** `RemindersSection.tsx:268-293` — fixed ~230–250px cluster (Chase / ↻ Chased / ✓ Done / Snooze), never wraps.
- **Affected widths:** phones (label left ~90–150px, wraps 3–4 lines) and the 1024 two-col band.
- **Recommended behaviour:** cluster wraps to a full-width second row ≤ ~480 (mirror the `.people-row-actions` `flex-basis: 100%` pattern) or fold ↻/✓ into the overflow.
- **Priority:** Medium-High.

**C5 — File sidebar accordion: sparse rows on tablet, no toggle on phones**
- **Component/file:** `PropertyFileTabs.tsx:202-219` (toggle `hidden md:flex`; content `md:hidden` only), `AgentFileSidebar.tsx:596-614`.
- **Affected widths:** 768–1023 (rows stretched to 484–550px with huge label/value gaps); ≤767 (all five cards render always-expanded above the tab content — long scroll to reach Overview).
- **Recommended behaviour:** max-width (~420px) on the accordion body; add a collapsed-by-default toggle below 768.
- **Priority:** Medium.

**C6 — Tenure/type popover lacks a right-edge clamp**
- **Component/file:** `HeroSaleFields.tsx:194-216` (`left: anchor.left`, `minWidth: 180`, no clamp; mobile sheet only ≤767).
- **Affected widths:** 768–1023 when the cell sits near the right edge.
- **Recommended behaviour:** clamp `left` to `viewport − menuWidth − 8` (LinkCard's CardMenu already does this — copy it).
- **Priority:** Low.

**C7 — Contacts header button pair tight at the narrowest phones**
- **Component/file:** `ContactsSection.tsx:811-875` (two `flex:1` buttons; label already shortens ≤640).
- **Recommended behaviour:** stack vertically < ~360. **Priority:** Low.

### D. Lists, forms, creation flows

**D1 — Files table: fixed tracks collapse the address and clip Risk on iPads**
- **Component/file:** `TransactionRowView.tsx:38-45` (`COL_WIDTH`/`filesGridTemplate`), `:597` (`hidden md:grid` at 768); `TransactionTable.tsx:131` (`overflow: hidden` card), `:137-143`.
- **Affected widths:** 768–~1000 (negotiator; fixed tracks 500–610px vs 484–740 available), up to ~1240 for director/admin (770–910px of fixed tracks).
- **Current behaviour:** card→grid flips at exactly the viewport where the sidebar reappears; `minmax(0,1fr)` address track absorbs the shortfall → collapses to ~0; residual overflow clipped by `overflow: hidden`.
- **Problem:** the row's identity (address) disappears and the Risk column is cut off on standard iPads. Worst single defect found.
- **Recommended behaviour:** keep the existing mobile card layout up to ~1100 (agent) / ~1240 (admin sets), or drive the switch by container width (~720px available) instead of `md`.
- **Shared impact:** one component serves agent, director, and internal-staff lists.
- **Priority:** Critical.

**D2 — New-sale flow: right column is `display: none` below 1024**
- **Component/file:** `agent-system.css:2721-2728`; content `NewSaleFlow.tsx:1222-1320` (EarningsBuilder fee entry, NotesSection, PropertyDossier/ResearchPanel).
- **Affected widths:** everything <1024 — all phones and all portrait tablets.
- **Problem:** functional gap, not layout: fee (fixed/percent + VAT), referral fee, notes, earnings and sold-price research cannot be entered or seen at creation time on tablet/mobile.
- **Recommended behaviour:** stack the right column beneath the form ≤1023 (the grid already goes `1fr`; drop the `display: none` and reorder), research panel collapsible.
- **Priority:** Critical (functional).

**D3 — New-sale two-column split cramped at 1024–1240**
- **Component/file:** `agent-system.css:2708-2714` (`65fr 35fr` at ≥1024 → right column ~248px at 1024).
- **Recommended behaviour:** two-col only ≥ ~1200 viewport (or container ≥ ~880). **Priority:** Medium.

**D4 — Automated-emails toolbar wrap noise**
- **Component/file:** `AutomatedEmailsListView.tsx:172-236` (7 wrap-tabs + search + three selects + date + Export with `margin-left: auto`).
- **Affected widths:** 768–1023 and phones — 3–4 stacked rows, orphaned right-aligned Export.
- **Recommended behaviour:** collapse the selects into one "Filters" disclosure ≤ ~900; drop the auto-margin when wrapped. **Priority:** Medium.

**D5 — Completions row: long-form date vs address**
- **Component/file:** `CompletionFileRowView.tsx:7-10, 93-114` ("Sat, 14 September 2026" block is `flex-shrink: 0`).
- **Recommended behaviour:** stack the date under the address ≤ ~480 or shorten to "14 Sep 2026". **Priority:** Low.

**D6 — Enquiries triage: good breakpoints, wrong reference width**
- **Component/file:** `EnquiriesTriageList.tsx:213-264`; `agent-system.css:1673-1795` (wraps/collapses at 1024/900 — viewport).
- **Affected widths:** 1025–~1150 polish gap only (nothing clips).
- **Recommended behaviour:** nudge to ~1180 or container-query the list. **Priority:** Low.

**D7 — Account shell is fine but inconsistent**
- **Component/file:** `AccountShell.tsx:134-233` — own 260px sidebar, drawer at ≤860 (vs main shell 220/768).
- **Recommended behaviour:** optionally align collapse points; no defect. **Priority:** Low.

### E. Chains + overlays

**E1 — Chains workspace summary tiles: inverted breakpoint**
- **Component/file:** `ChainsWorkspace.tsx:377-388` (`repeat(4,1fr)`, 2-col only ≤760 — i.e. right when the sidebar disappears and room *increases*).
- **Affected widths:** 768–~900 (tiles ~134px each with icon + number + two labels).
- **Recommended behaviour:** 2-col ≤ ~1000 (mirroring the inline chain tab's rule) or container query on the card. **Priority:** Medium.

**E2 — ChainDrawer: near-full-viewport slide-over with a vanishing dismiss strip**
- **Component/file:** `ChainDrawer.tsx:764` (widths `min(760,100vw)` / `min(1120,96vw)` / `min(1440,96vw)`), `:1191-1199`.
- **Affected widths:** 768 leaves an 8px backdrop strip (linear chain); 834/1024 leave ~33–41px (forked); phones get 100vw with no sheet treatment.
- **Problem:** effectively full-screen but styled as a slide-over; combined with the 22px close (A5) dismissal on touch is fragile.
- **Recommended behaviour:** commit to a full-screen sheet ≤ ~900 (proper close affordance); above it reserve a ≥48px gutter (`min(w, 100vw − 48px)`). Same gutter rule for AddNodeDrawer (440), ChaseNeighbourDrawer (480), IntroCallDrawer (880).
- **Priority:** Medium-High.

**E3 — StatusControl bespoke modals: no max-height/scroll**
- **Component/file:** `StatusControl.tsx:321-324, 452-462, 558-568` (withdrawal/hold/resume cards, `overflow: hidden`, no `maxHeight` — unlike the primitive's `calc(100dvh−120px)` at `Modal.tsx:222,308-314`).
- **Affected widths/heights:** short viewports (mobile landscape, small phones) — Confirm/Cancel pushed off-screen unreachably.
- **Recommended behaviour:** migrate onto the Modal primitive (also inherits A6's footer fix + 32px close), or add the max-height + internal scroll.
- **Priority:** Medium.

**E4 — StatusControl dropdown not edge-clamped**
- **Component/file:** `StatusControl.tsx:131-135, 266-269` (`left: rect.left`, `min-w-[140px]`, no clamp).
- **Recommended behaviour:** copy CardMenu's clamp (`LinkCard.tsx:520`). **Priority:** Low.

**E5 — AddNodeDrawer email/phone pair stays 2-up at 360–375**
- **Component/file:** `AddNodeDrawer.tsx:614` (`grid-cols-2` → ~150–165px fields).
- **Recommended behaviour:** stack < ~400. **Priority:** Low.

### F. Command Centre

**F1 — Command sidebar never collapses**
- **Component/file:** `CommandSidebar.tsx:297` (`w-[220px] flex-shrink-0`, no breakpoints); `app/command/(protected)/layout.tsx:78-96` (`p-8 max-w-6xl`). Content = viewport − 284: 1024→740, 834→550, 768→484, 390→106.
- **Recommended behaviour:** icon rail or off-canvas below `lg` (1024). Fixes the width shortfall behind F2.
- **Priority:** High (founder-only surface, but the lever that makes it iPad-safe).

**F2 — Stat-card grids escalate on viewport, render into content − 284**
- **Component/file:** worst: `prospects/page.tsx:78` (`sm:grid-cols-5` → 5 cards in ~356px); also `ai-outreach:124`, `providers/quotes:137`, `content:45`, `revenue:106` (5–6 col at `md`/`lg`), and the `sm:grid-cols-4` set (`chain-invites:206`, `followup-usage:104,196`, `timeframes:119`, `website-growth:139,209`).
- **Problem:** 2xl currency values in ~55–90px cards, exactly at iPad portrait.
- **Recommended behaviour:** push 5–6-col steps to `xl`, 4-col to `lg` (or land F1 and these become roughly correct).
- **Priority:** Medium (High for the prospects `sm:grid-cols-5`).

**F3 — Revenue tables: the one table family with no scroll wrapper**
- **Component/file:** `revenue/page.tsx:362-421, 456-493`; `revenue/[agencyId]/page.tsx:200-238, 240+` — `overflow-hidden` wrapper (clips), no `overflow-x-auto`/`min-w`, unlike `AdoptionTable.tsx:95-96`, `ProspectsBoard.tsx:87-88`, and `TableShell` (`primitives.tsx:130`).
- **Problem:** a 10-column fee ledger auto-crushes into ~484px with no scroll escape.
- **Recommended behaviour:** adopt the existing wrapper pattern (`overflow-x-auto` + `min-w-[820px]`/`[560px]`) or migrate to `TableShell`. Horizontal scroll is correct here.
- **Priority:** High.

**F4 — Overview stat strips don't wrap**
- **Component/file:** `overview/page.tsx:496-536, 579-599` (`flex gap-6`, right cluster `ml-auto … border-l`, no wrap).
- **Recommended behaviour:** `flex-wrap`, drop the divider < `lg`. **Priority:** Medium.

(Verified fine, for the record: prospect/chase drawers `max-w-lg/md` with full-width fallback; content Kanban stacks at `lg`; the agencies/prospects/adoption/chase-hub tables already scroll correctly.)

### G. Portal + help

**G1 — Help pages have no responsive floor**
- **Component/file:** `app/help/page.tsx:82-146` (fixed 240px `HelpSidebar` + `flex:1` main with 96px horizontal padding + optional 192px TOC; zero media queries).
- **Affected widths:** ≤ ~700, catastrophic ≤430 (~54px of readable text at 390).
- **Recommended behaviour:** ≤768: sidebar behind a hamburger drawer, drop the TOC, main full-width with reduced padding. Publicly navigable URL, so worth fixing even if treated as internal docs.
- **Priority:** High.

**G2 — Portal "Expected exchange" 2-col grid never collapses**
- **Component/file:** `PortalOverviewHero.tsx:699-703` (fixed `1fr 1fr`; each cell 40px icon + date text).
- **Affected widths:** ≤ ~380 (cells ~150px → 3–4-line wraps).
- **Recommended behaviour:** single column < ~400 container. **Priority:** Low-Medium.

**G3 — Portal hero ring vs long address at 360–375** (`PortalOverviewHero.tsx:505-561`) — holds but tight; optional 80px ring < 380. **Priority:** Low.
**G4 — Broker card tagline/CTA row no wrap** (`PortalBrokerCard.tsx:364-372`) — add `flexWrap`. **Priority:** Low.

Everything else in the portal (shell max-w-lg bands, dual-layout milestone timeline swapped at md, swipe panels, updates feed, team card, complete page) is genuinely mobile-first and healthy — the best responsive code in the product.

---

## Responsive breakpoint map

The code justifies a four-tier model, with one strong caveat: because of the two persistent sidebars, **the honest unit is available column width, not viewport** — which is why the recommended direction is container queries for content and viewport queries only for shell chrome.

| Tier | Viewport | Shell state | What should change |
|---|---|---|---|
| **Wide desktop** | ≥ ~1280 | 220px sidebar + (file page) 288px sidebar | Everything as designed. 6-col pipeline, two-col file page with ≥640px main, full tables. |
| **Compact desktop** | ~1024–1279 | 220px sidebar; file sidebar should NOT yet be present (raise its gate from 1024 to ~1180) | Pipeline 4-col; new-sale stays two-col only ≥ ~1200; files table full grid only ≥ ~1100 (agent) / ~1240 (admin); milestone strip full 6 stages. |
| **Tablet** | 768–1023 | Sidebar becomes an icon rail (~64px) — the keystone change | One-column hub rows; 2-col stat quartets; files list stays in card form; chains tiles 2-col; CC sidebar collapses at the same tier; drawers become full-screen sheets ≤ ~900. |
| **Mobile** | <768 | Overlay sidebar (as today) | Existing mobile rules mostly correct; add: footer button stacking ≤420, reminders action row wrap ≤480, exchange-cell edit full-width ≤500, help pages floor. |

Cross-cutting, viewport-independent: `@media (pointer: coarse)` tier for tap targets + hover-affordance replacements; container queries for anything nested (stat quartets, pipeline cards, milestone strip, people rows and chain forks already done).

So: yes — wide desktop → compact desktop → tablet → mobile, but implemented as *shell tiers at the viewport level* plus *container thresholds at the component level*, not as a global four-breakpoint grid.

---

## Top 10 fixes (by noticeable improvement, not effort order)

1. **Agent sidebar icon rail at 768–1023** (`globals.css:79-80, 988`, `AgentShell.tsx`) — dissolves the tablet dead zone that drives a third of this list; hub, lists, chains, enquiries all inherit ~156px back.
2. **Files table: stay in card layout until the grid genuinely fits** (`TransactionRowView.tsx:38-45,597`, `TransactionTable.tsx:131`) — stops the address column collapsing to zero and Risk clipping on iPads; the mobile card fallback already exists, only the switch point is wrong.
3. **New-sale right column: stack, don't hide, below 1024** (`agent-system.css:2721-2728`, `NewSaleFlow.tsx`) — restores fee entry, notes, and earnings on tablet/mobile; currently a functional gap.
4. **File-page sidebar gate at ~1180 instead of 1024** (`PropertyFileTabs.tsx:244`) — removes the second dead zone; the milestone strip regains its at-a-glance width across 1024–1290.
5. **Tab-bar overflow affordance** (`PropertyFileTabs.tsx:134-190`, `.agent-tab-bar`) — fade + chevron so Documents/Activity/WhatsApp stop being invisible, including on 1280 desktops.
6. **Touch strategy pass** (`@media (pointer: coarse)`) — persistent chain insert/photo/edit affordances, tap paths for the files-list popovers, ≥40px targets on reminder actions and drawer closes. One conventions block, applied across the flagged sites.
7. **Overlay safety at phone widths** — Modal/Drawer footer wrap+stack ≤420 (`Modal.tsx:329`, `Drawer.tsx:378`), StatusControl's three bespoke modals onto the primitive (max-height/scroll), ChainDrawer full-screen sheet ≤900 with a real close.
8. **Command Centre iPad pass** — sidebar collapse at `lg`, revenue tables onto the existing scroll-wrapper pattern, stat-grid steps pushed one breakpoint up. Three mechanical changes; the founder's tablet use stops fighting the layout.
9. **Help pages responsive floor** (`app/help/page.tsx`, `HelpSidebar.tsx`) — drawer nav + full-width article below 768; currently ~54px of text on a phone.
10. **Breakpoint tokens + container-query convention** (tailwind screens / CSS custom media, documented in DESIGN_TOKENS.md) — the enabler that stops the 28-value sprawl and viewport-vs-column mismatch from regrowing; new work keys off the proven `.chain-stack`/`.people-rows` pattern.
