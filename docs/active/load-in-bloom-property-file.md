# Load-in bloom — property file (detail page)

**Goal:** bring the same per-item load-in (top-to-bottom, left-to-right) to the agent property-file page `/agent/transactions/[id]` — hero, sidebar, tab strip, and every tab's content.

Spec from a full audit, 2026-10-18. Reference mechanism: `components/agent/BloomStage.tsx` (+ the CSS `.agent-bloom-stagger` for flat lists). Builds on the nav rollout ([load-in-bloom-rollout.md](load-in-bloom-rollout.md)).

---

## The shape of this page (why it's two jobs)

`app/agent/transactions/[id]/layout.tsx` is a **persistent shell**; each tab is its own route segment rendered into `{children}`. A Next layout does **not** re-mount on tab navigation. So:

- **Shell** (hero, tab strip, milestone strip, sidebar) mounts **once per file-open** and survives tab switches → blooms **once** on open.
- **Tab content** (`{children}`) **re-mounts on every tab switch** (wrapped in `TabEnter`) → **re-blooms** per switch.

Layout stacks: **hero (full-width) → tab strip (sticky) → milestone strip → [ content | sidebar ] row**. The 2-column split (content left `flex-1`, sidebar right `w-72`) is inside `FileTabsChrome` at `xl`; below `xl` the sidebar collapses to an accordion above content.

---

## PART A — The shell entrance (blooms once on file-open)

Three visible shell blocks, in order: **hero → milestone strip → sidebar**. (The sticky **tab strip** is navigation chrome — recommend it appears immediately, *not* bloomed.)

| Block | Where | Tag |
|---|---|---|
| Hero | `layout.tsx:429` `<div id="file-hero">` → `PropertyHero` (root `GlassCard`, `PropertyHero.tsx:575`) | `data-bloom` on `#file-hero` div. **Reconcile:** the hero GlassCard already has `className="animate-enter"` — remove it (it would double with the bloom). |
| Milestone strip | `layout.tsx:473` `GlassCard glassId="milestone-timeline"` (in `beforeContent`) | `data-bloom` on that GlassCard (forwards) |
| Sidebar | `AgentFileSidebar.tsx:332` root `<div flex column gap16>` with 6 `GlassCard`s (sale-health, key-dates, agent, fees, previous-sales, quick-links) | **Give the sidebar its OWN cascade** — `agent-bloom-stagger` on the `AgentFileSidebar` root div so its 6 cards flow top-to-bottom. See caveats. |

**Shell wrap:** a single `BloomStage` around hero + milestone strip would be ideal, but the sidebar has **two problems** that make a shell-wide BloomStage unreliable, so handle the sidebar separately:

1. **Sidebar is rendered twice** (mobile accordion `FileTabsChrome.tsx:334` + desktop `:345`). A shell-wide `querySelectorAll("[data-bloom]")` would match both copies and the hidden one consumes stagger indices. → Don't shell-tag the sidebar cards; give the sidebar its own `agent-bloom-stagger` on its root (each copy staggers its own cards independently).
2. **Sidebar streams behind its own Suspense** (`layout.tsx:298`) — it may not be in the DOM when a shell BloomStage arms (arms once on mount via rAF). → Its own stagger (CSS, SSR-applied) fires when it paints, regardless of shell timing.

**Recommended shell implementation:**
- Wrap hero + milestone strip in a `BloomStage` (or `agent-bloom-stagger` on a wrapper) in `layout.tsx` — tag `#file-hero` + the milestone GlassCard. 2 beats.
- Separately, `agent-bloom-stagger` on `AgentFileSidebar.tsx:332` root → its 6 cards cascade. (Reduced-motion + no-flash already handled by that class.)
- **Left-to-right note:** on desktop, content (left) and sidebar (right) are side by side. Content is `TabEnter`'s job, sidebar has its own cascade — they bloom roughly in parallel (acceptable; a single orchestrator can't span them because content re-mounts per tab and the sidebar is persistent).

---

## PART B — `TabEnter` → per-tab cascade

`TabEnter` (`components/transaction/TabEnter.tsx`) currently wraps every tab in one `.agent-bloom` block (whole-tab fade) + reports paint-timing telemetry. **Change:** add a `stage` prop so a tab can opt into a per-item cascade while keeping the telemetry:

```tsx
export function TabEnter({ children, stage = false }) {
  useEffect(() => { /* keep existing timing telemetry */ }, []);
  return stage ? <BloomStage>{children}</BloomStage> : <div className="agent-bloom">{children}</div>;
}
```

Tabs that want per-item use `<TabEnter stage>` and tag their blocks with `data-bloom`. Tabs left as `<TabEnter>` keep the single-block bloom (safe default — a tab with no tags under BloomStage would have *no* entrance). `BloomStage` finds `data-bloom` at any depth, so it reaches blocks nested inside panel components.

### Per-tab plan (beats in document order)

| Tab | Beats (document order) | Tag method | Conflicts / guards |
|---|---|---|---|
| **Overview** `page.tsx` | 1 File-health banner · 2 People (`#clients-section`) · 3 Next-action · 4 Exchange-push · 5 Property-chain · 6 Checkpoints · 7 Activity&notes · 8 Risk score · 9 Property intel · 10 Enquiry tracker (`.mt-5`) · 11 Mortgage expiry (`.mt-5`) | 5-9 are GlassCard/Card → `data-bloom` direct. 2/10/11 → tag the wrapper div. 1/3/4 → wrap (mixed/plain roots). | **Guard nulls** (FileHealthBanner, ExchangePush, EnquiryTracker, MortgageExpiry all return null often — tag their own conditional root, not an always-present wrapper). PeoplePanel has `people-pane-in` + AgentBanner `agent-reveal-in` — watch double-anim on first paint. |
| **Steps/Milestones** `milestones/` | 2 beats: progress-bar `Card` (`MilestonePanel.tsx:348`) + checklist `Card` (`:395`) | `data-bloom` on each `Card` (forwards) | StepsEmailHint is absent at mount (skip). **Do NOT bloom `MilestoneRow`s** — Fragment root + `ms-unlock-enter` + accordion. |
| **Chase** `chase/` | 1 Pause banner · 2 four stat tiles (**L-R**) · 3 list card ‖ detail pane (**L-R**) · 4 footer | Plain divs → `data-bloom` direct. Tag each stat tile for L-R; tag list card + detail pane for L-R. | `ThreadCard` (single `<button>`, no anim) — safe but keep beats at card level. |
| **Chain** `chain/` | 1 View switcher · 2 body (chain link cards / forks) | Plain divs → direct | View switcher has own `chain-viewswitch--enter` (reconcile). Forks branch horizontally. Heavy client cmpt but seeds server-side so paints immediately. |
| **Activity** `activity/` | 1 Filter bar · 2 "Log update" composer · 3 timeline list (as ONE block) | Plain divs (3 levels deep in `ActivityTimeline`) → direct | **Rows use `useAutoAnimate` (FLIP) + `agent-reveal-in`** — do NOT bloom individual rows; tag the list container as one beat. |
| **Documents** `documents/` | 1 Header row · 2 document list (rows safe to cascade) | Plain `glass-card` div → direct; rows are plain divs, **no animation** | Cleanest tab — rows can each be a beat if wanted. |
| **Client portal** `client-portal/` | 1 Intro · 2 left column (phone) ‖ 3 right column (invite + resend) (**L-R**) | Plain inline-styled divs → `data-bloom` direct | Interaction anims only (pill indicator, iframe spinner) — won't conflict. |
| **Reminders** `reminders/` | 1 Exchange→completion card · 2 stat-pill row · 3 the list (**already a BloomStage inside `AgentRemindersList`**) | Tag the exchange card + stat-pill-row wrapper with a single `.agent-bloom` (they sit OUTSIDE the list's BloomStage). List stays as-is. | Don't nest a second BloomStage over the existing one — it'd double-animate the sections. |
| **Setup** `setup/` | 1 Setup `GlassCard` (+ its checklist rows if wanted) | GlassCard → direct; rows plain divs, **no anim** | Rows expand in place only — safe to cascade. |
| **Todos** `todos/` | 1-3 task `Card`s (my-tasks / agent-requests / internal — order by perspective) | `Card` → `data-bloom` direct | **Do NOT bloom `ManualTaskCard` rows** — no prop-forward + own `agent-reveal-in`/`row-flash`/`ms-pop`. Card is the beat. |
| **WhatsApp** `whatsapp/` | 1 `WhatsAppCloudPanel` (if threads) · 2 `WhatsAppPanel` | Wrap each in `<div data-bloom>` (plain roots, no forward) | Message bubbles live in internal scroll panes — never individual beats. |

---

## Cross-cutting gotchas (from the audit)

- **Null-returning blocks**: FileHealthBanner, ExchangePushPanel, EnquiryTrackerSection, ClientMortgageExpiryCard, StepsEmailHint. A `data-bloom` on an always-present wrapper blooms an empty box when they return null → put the tag on the component's own conditional root, or guard the wrapper with the same condition.
- **Dynamic-on-mount**: StepsEmailHint (and anything revealed in an effect) isn't in the DOM when BloomStage arms → it won't be a beat unless restructured. Fine to leave appearing instantly.
- **Rows with their own animation — never bloom individually**: Activity (`useAutoAnimate`), Milestone rows (`ms-unlock-enter` + Fragment root), ManualTaskCard (`agent-reveal-in`/`row-flash`). Bloom at the card/section level instead.
- **Prop forwarding**: `GlassCard` and `Card` forward `{...rest}` → `data-bloom` passes. Plain panels called with fixed props (WhatsApp panels, ExchangeToCompletionCard, InviteCard, NextActionCardConsumer branches) need a wrapper or an in-component root edit.
- **Reconcile existing entrances**: hero `animate-enter`, chain `chain-viewswitch--enter`, PeoplePanel `people-pane-in` — remove/skip where a bloom now owns the entrance.
- **Overflow/hidden containers**: content inside a closed `DoneDisclosure` (grid-rows:0fr) or an internal scroll pane shouldn't carry `data-bloom`.
- **No-flash + reduced-motion**: already handled by BloomStage CSS and `agent-bloom-stagger`.

---

## Rollout order

1. **Shell** — hero + milestone strip bloom, sidebar cascade (biggest visual on every file-open). `TabEnter` gains the `stage` prop.
2. **Overview** (richest tab, 11 beats) — the one you look at most.
3. **Chase, Client-portal** (clear left-to-right pairs).
4. **Documents, Setup, Todos, WhatsApp** (simple, few beats).
5. **Milestones, Chain, Activity, Reminders** (have their own animations — tag at card/section level, reconcile conflicts).

Each tab = one commit, `tsc` + hard-refresh the file and switch tabs to confirm the per-tab re-bloom, staging→master, verify.

---

## Quick reference — tag targets

- Shell: `layout.tsx` `#file-hero` + milestone `GlassCard`; `agent-bloom-stagger` on `AgentFileSidebar.tsx:332`.
- TabEnter: add `stage` prop → `BloomStage`.
- Overview: `OverviewPanel.tsx` blocks + `page.tsx` `.mt-5` divs.
- Chase: `ChaseTimeline.tsx` blocks (stat tiles, list/detail).
- Client-portal: `ClientPortalPreview.tsx` columns.
- Documents/Setup/Todos/WhatsApp: the one/few cards or panel wraps per table above.
- Milestones/Activity/Reminders/Chain: card/section-level only (row animations stay).
