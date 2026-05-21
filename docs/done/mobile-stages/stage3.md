# Mobile Fixes — Stage 3 Completion Report

## Summary

Stage 3 addressed five remaining HIGH/MEDIUM audit findings across two groups. Group A fixed the shared header overflow pattern (greeting/title + action buttons or stat chips crammed into a rigid space-between row) across three pages. Group B fixed the FileAlertsStrip internal row overflow and the RecommendedSolicitorsSettings contact form grid. Two follow-up fixes were needed: one for an implicit CSS Grid column creation bug (RSS-2 root cause) and one structural improvement to the FileAlertsStrip row layout (addresses were truncating to 2 characters). All changes are layout/class-level; no database schema, API, or business logic was modified. TypeScript remained clean throughout.

---

## Changes by section

### Group A — HUB-1, MYFILES-1, SOL-1

**Findings resolved:** HUB-1, MYFILES-1, SOL-1

**Shared pattern:**

All three pages used an inline `display: flex; justify-content: space-between` row with no responsive breakpoint treatment. The right-hand element had `flexShrink: 0` (or `flex-shrink-0`), meaning it never compressed. On 375px mobile:

- Hub and My Files: right side = "New sale" button (~90px) + gap(8px) + "Send note to progressor" button (~200px) = 298px with `flexShrink: 0`, leaving only ~29px for the greeting/title — effectively invisible.
- Solicitors: right side = two StatChip elements + `gap: 28` = ~118px with `flexShrink: 0`, leaving ~225px for the left block — adequate for the heading but tight with a long firm name, and the `gap: 28` was disproportionate at 375px.

**Fix (identical across all three):**

```
flex flex-col gap-3 md:flex-row md:items-start md:justify-between
```

Mobile: title/greeting on row 1, right-side content (buttons or chips) on row 2, left-aligned, auto-sized.  
Desktop (`md:`): original side-by-side space-between layout restored.

**Per-file changes:**

Hub — `app/agent/hub/page.tsx`: two instances of the greeting+actions row replaced (empty state line 165, main state line 340). Both were identical `style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}` — replaced with `className`. Inline style removed entirely from those divs.

My Files — `app/agent/dashboard/page.tsx`: inner flex row replaced on line 68. Wrapper div already had Tailwind padding classes; the inner flex row had the inline style pattern. Replaced with `className`.

Solicitors — `app/agent/solicitors/page.tsx`: flex layout moved from inline style to existing `className` on the outer content div (line 51); `display/alignItems/justifyContent` removed from inline style. Stat chips container (line 63): `style={{ display:"flex", alignItems:"center", gap:28, flexShrink:0, marginTop:8 }}` → `className="flex items-center gap-3 md:gap-7 flex-shrink-0"`. `gap: 28` becomes `gap-3` (12px) on mobile and `md:gap-7` (28px) on desktop; `marginTop: 8` removed (outer `gap-3` on the flex-col row handles spacing).

**Files touched:**
- `app/agent/hub/page.tsx`
- `app/agent/dashboard/page.tsx`
- `app/agent/solicitors/page.tsx`

---

### Group B — WQ-NEW, RSS-2

**Findings resolved:** WQ-NEW, RSS-2

#### WQ-NEW — FileAlertsStrip internal row overflow

**Initial fix (first push):** Added `flex-wrap` to the outer alert row (`flex items-center gap-3` → `flex flex-wrap items-center gap-x-3 gap-y-1.5`). This prevented the action link from being clipped — it wrapped to a second line when two badges + the action link exceeded 343px.

**Follow-up refinement (second push):** Real-device testing showed addresses still truncating aggressively ("F..", "3.."). Root cause: the badges container still had `flex-shrink-0` (~248px for two wide badges — "No vendor solicitor" ~111px, "No purchaser solicitor" ~131px + 6px gap), leaving only ~83px for the address despite `flex-1 min-w-0`.

**Final fix:** Restructured each row from a single flex line into two sub-rows:

- Sub-row 1: Address block as a full-width `block` link. `p` tags use `leading-snug` and no `truncate` — address has the full 311px content width and can wrap naturally if long.
- Sub-row 2: `flex items-center justify-between` — badge chips on the left (`flex flex-wrap gap-1.5`), action link on the right (`shrink-0 whitespace-nowrap`).

Badge labels unchanged — with their own full-width sub-row the verbose labels ("No vendor solicitor", "No purchaser solicitor") have adequate room. Action link is always right-aligned and fully readable alongside the badges.

#### RSS-2 — RecommendedSolicitorsSettings contact form

**Initial fix (first push):** Changed `grid grid-cols-2 gap-2` to `grid grid-cols-1 sm:grid-cols-2 gap-2` on the contact form wrapper. This was the correct outer-grid change.

**Follow-up fix (second push):** Phone and email were still side-by-side on mobile. Root cause: `col-span-2` in a `grid-cols-1` grid triggers CSS Grid's implicit column creation. A `grid-column: span 2` item in a 1-column explicit grid causes the browser to auto-create a second implicit column track — re-introducing the two-column layout despite `grid-cols-1`. The implicit column absorbed the `col-span-2` items (case handler name and referral fee) while phone and email fell into the two-column layout.

**Fix:** Changed `col-span-2` → `col-span-1 sm:col-span-2` on both spanning fields (case handler name and referral fee). On mobile: all four fields stack as single-column. On `sm+`: name and fee span both columns (full width), phone and email sit side-by-side in their own columns.

**Files touched:**
- `components/reminders/FileAlertsStrip.tsx`
- `components/agent/RecommendedSolicitorsSettings.tsx`

---

## Audit findings now resolved

| Finding | Severity | Resolution |
|---|---|---|
| HUB-1 | HIGH | Group A — Hub greeting+actions row responsive |
| MYFILES-1 | HIGH | Group A — My Files title+actions row responsive |
| SOL-1 | HIGH | Group A — Solicitors header+stat chips row responsive |
| WQ-NEW | HIGH | Group B — FileAlertsStrip two-row layout; address full-width |
| RSS-2 | MEDIUM | Group B — Contact form `grid-cols-1 sm:grid-cols-2` + `col-span-1 sm:col-span-2` |

---

## Audit findings remaining for Stage 4

### Stage 4 — MEDIUM/LOW (polish)

- **RSS-4** — "Remove" button touch target (recommended solicitors list)
- **LT-1** — OnboardingChecklist panel mobile overlap
- **LT-3** — Dashboard filter chip row horizontal overflow
- **HUB-3** — Activity ribbon "View file" crowding on narrow screens
- **ANAL-1** — Solicitor performance row on narrow screens
- **WQ-3** — Snooze/kebab dropdowns may clip at top of viewport
- **NEW-3** — Purchase type button text wrapping

---

## Database changes

None.

## New dependencies

None.

## Breaking changes / visible differences

| Change | User-visible effect |
|---|---|
| Hub header — stacked on mobile | Greeting on row 1, "New sale" + "Send note" buttons on row 2. Desktop unchanged. |
| My Files header — stacked on mobile | "My Files" heading on row 1, buttons below. Desktop unchanged. |
| Solicitors header — stacked on mobile | Eyebrow + heading + subtitle on row 1, stat chips below with tighter gap (12px). Desktop: gap restored to 28px. |
| FileAlertsStrip rows — two sub-rows | Property address now displays fully (no 2-char truncation). Badges + action link on a second line below. Rows are slightly taller than before. |
| RSS-2 form — stacked on mobile | Case handler name (full width), phone (full width), email (full width), referral fee (full width) on mobile. At ≥640px phone and email return to side-by-side. |

---

## Files touched (full list)

- `app/agent/hub/page.tsx`
- `app/agent/dashboard/page.tsx`
- `app/agent/solicitors/page.tsx`
- `components/reminders/FileAlertsStrip.tsx`
- `components/agent/RecommendedSolicitorsSettings.tsx`
