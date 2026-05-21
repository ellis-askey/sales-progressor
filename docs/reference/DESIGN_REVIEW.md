# Design Review — Sales Progressor
**Reviewer role:** Senior Product Designer, Apple Human Interface Team (on loan)  
**Date:** April 2026  
**Status:** Pre-implementation assessment. Do not ship Phase 1a without sign-off.

---

## Part 1 — Audit

### Login Page (`app/login/page.tsx`)

The login page is the strongest surface in the app. The dark navy gradient (`#1e293b → #1e3a5f → #0f172a`) with a centred frosted card is structurally correct — this is recognisably in the territory of Apple's authentication sheets. The blue radial glow behind the card adds depth without noise. The house icon in a rounded square with a blue gradient and the correct box-shadow glow is a legitimate premium detail.

What holds it back:

1. **The icon is wrong.** A house SVG path (`M3 12l2-2m0 0l7-7...`) is a Heroicons 1.x outline — it's too thin (strokeWidth 2), has no character, and reads as a generic web icon. Apple would use a SF Symbols–weight glyph at 1.5pt, optically centred, or a custom mark. The icon is the first thing the user focuses on and it signals "template."
2. **Typography is flat.** `text-xl font-semibold` for "Sales Progressor" at the top of the auth flow — this is the brand name, and it's styled like a nav label. It should be the largest text on the page: 24–26px, weight 700, letter-spacing −0.02em. The subtitle "Sign in to your account" is `text-sm text-blue-200/60` — the opacity is so low (60%) it's nearly invisible on the dark background, which defeats its entire purpose.
3. **The glass card is over-opaque.** `rgba(255,255,255,0.88)` with 28px blur is more "frosted window glass" than "Apple material." Apple's materials at this density (think `UIAlertController` background) are thinner and warmer. The card reads as a white rectangle that happens to be translucent. At 0.80 opacity with a warmer tint and a very subtle inner highlight, it would read as glass rather than paper.

---

### Dashboard (`app/dashboard/page.tsx` + `DashboardHero`)

The dashboard is structurally sound but visually stranded between two design languages. The `DashboardHero` is a flat opaque dark panel (`#1e293b → #0f172a → #1e3a5f`) sitting on top of the photo background — it paints over the glass effect entirely. Below it, glass cards float over the photo. This creates a jarring seam: the hero looks like it belongs in a dark-mode web app from 2021, while the cards below it belong to the glass system. They are not the same app.

The `StatChip` component (`text-2xl font-semibold tracking-tight` value + `text-xs text-slate-500` label) is perfectly readable but dull — the value and label alignment is baseline-matched, which is correct, but there is no visual weight hierarchy between the number and its label. The separator `div` (`w-px h-6 bg-white/10`) is invisible on a dark background and serves no function.

The filter tab bar (`glass-subtle p-1 w-fit`) is the best interaction element on the page — the segmented control pattern is correct. But the active state is a flat `bg-blue-500` pill, which doesn't feel like it belongs to the glass system. Apple's segmented controls use a white/near-white active pill, not a coloured fill.

1. **The opaque hero blocks the photo.** The `background: linear-gradient(...)` with no transparency means the living room photo is invisible from the most important screen in the app. The hero should be a glass panel itself — either a dark glass panel with `backdrop-filter` allowing the photo to show through, or removed entirely and replaced with a compact title row.
2. **No hover states on transaction rows.** The `TransactionTable` has `hover:bg-white/20 transition-colors` — a colour change only. There is no lift (translateY, shadow growth) that signals the row is interactive. The `group-hover:text-blue-600` on the address is good but the overall row doesn't feel tappable.
3. **The risk stripe (4px wide coloured left border)** on the table is a weak signal at desktop widths. It's barely visible at 4px. iOS would encode risk as a tinted card background or a visible colour region, not a 4px stripe.

---

### Transaction Detail (`app/transactions/[id]/page.tsx` + `PropertyHero`)

This is the most important page in the app and has the most thought behind it. The `PropertyHero` is the best-executed component: the address split (line1 / line2), the status pill with dot and ring, the progress bar, the exchange countdown with conditional colour, and the window-grid overlay texture all work together. The `text-[1.6rem]` address heading is the right call.

However:

1. **The hero is transparent to the background photo but has no material between it and the tab bar.** The `PropertyFileTabs` `glass-nav` sits directly below the hero with no separation or depth transition. On scroll, the tab bar becomes sticky (`top-0 z-20`) — but there's no scroll-linked blur intensification or header collapse. It just abruptly sticks. This is the most expensive moment in the navigation and it should animate.
2. **The sidebar (`TransactionSidebar`) has a ProgressRing whose track stroke is `rgba(15,23,42,0.08)`.** This is the wrong token — it was calibrated for a white background. On a glass card (which now has a dark photo showing through), `rgba(15,23,42,0.08)` is nearly invisible. The track stroke should be `rgba(255,255,255,0.12)`.
3. **Tab content has no entrance animation.** Switching tabs causes an instant content swap. There is no crossfade or slide. On a polished native app, tab switching has a 150ms opacity transition. Currently it is a hard cut that reads as a bug.

The `MetaField` three-column strip (Status / Assigned to / Last progress) is good — compact, information-dense, uses the glass card correctly. The `divide-x divide-white/20` dividers are the right approach.

The milestone section (`MilestonePanel`) is the most functionally sophisticated part of the app. The collapsible sections, shimmer animation on the progress bar, and conditional section colours are all correct design decisions. But:

- The section headers (e.g. "Conveyancing", "Onboarding") use coloured dot + coloured label text — but these are `text-violet-600`, `text-amber-700` etc. on a glass card background. On the photo background bleeding through, these colours occasionally clash. The section headers need a neutral base colour (white/70) with the coloured dot as the only colour signal.
- The "exchange ready" banner uses `bg-emerald-50/60 border border-emerald-200/60` — a light tint that works on white backgrounds but washes out on the glass. It should be `bg-emerald-500/15 border border-emerald-400/25` to read on both light and dark surfaces.

---

### Work Queue (`app/tasks/page.tsx` + `WorkQueue` + `TaskCard`)

The work queue is functional and well-structured. The `TaskCard` with left-border colour coding (blue for standard, orange for overdue, red for escalated) is a clear, readable pattern. The snooze dropdown is correctly implemented as a glass flyout.

What it lacks is urgency appropriate to its role. This is the primary action surface — the thing a progressor lives in all day. It currently looks like a list of notifications.

1. **Density is wrong.** Cards are `px-5 py-4` with a `border-l-4` — a lot of padding for a task management interface. Apple's reminders / tasks surfaces are denser, with 44pt minimum touch targets but no wasted space around them. At the current padding, roughly 4–5 task cards fit on screen before scrolling, which means the user has no sense of the full queue.
2. **The "Chase" button is `bg-blue-500 text-white`** — the primary call-to-action in the entire app. But it's the same blue as every other action: the filter tab active state, the CTA buttons in the hero, the sidebar nav active state. There is no visual hierarchy of actions. Chase should feel special — it is the core verb of this product.
3. **Empty state** for "all caught up" uses a green checkmark circle with `bg-green-100/80` — correct emotion, but the icon (`M5 13l4 4L19 7` at 20×20) is too small to read at a glance. Apple's empty states centre on a symbol at ~28pt with generous breathing room and a two-line message.

---

### Completing (`app/completing/page.tsx`)

Well-structured. The `CompletingGroup` component with urgency-tinted section headers is one of the stronger patterns in the app — it correctly uses colour to encode priority. The `overdue` group (`bg-red-50/40`) → `this_week` (`bg-amber-50/40`) → `next_week` (`bg-blue-50/40`) gradient of urgency is clear.

Issues:

1. **The section header tints (`bg-red-50/40`, `bg-amber-50/40`) are too light.** At 40% opacity, these light tints are barely perceptible on a glass card over the photo background. The intended visual distinction between urgency groups is lost. They need more saturation: `bg-red-500/12`, `bg-amber-500/10`.
2. **No progress information per file.** Each row shows address, people, solicitors, price, and completion date — but no indication of where the file is in the post-exchange process. A compact progress indicator (milestone codes outstanding, or a mini progress bar) would transform this from a list into a dashboard.
3. **Typography for the date is `text-sm font-medium text-slate-900/80`** — the same size as the address. The completion date is the most important data point on this page and should be typographically dominant: `text-base font-bold tabular-nums` with colour indicating urgency.

---

### Analytics (`app/analytics/page.tsx`)

The analytics page commits an unforgivable sin: it builds its own chart in SVG (`BarChart` function) with no design care. The bars are coloured `#93c5fd`, `#3b82f6`, `#10b981` — acceptable palette — but the SVG renders at variable widths with `Math.floor()` calculations that produce fractional pixel columns and irregular gaps. The legend is `flex items-center gap-4 mt-2` with coloured squares — this is a 2018 dashboard pattern.

1. **Custom SVG chart is visually rough and will be rewritten** as part of a later phase. The `Math.floor(500 / (data.length * ...))` bar width calculation produces illegible bars on small viewports and irregular gaps. This will be rewritten in-app (no new charting library) with correct pixel math, animation, axis labels, and tooltips. See Phase 5 notes.
2. **The `StatCard` (`text-2xl font-bold`) uses 24px for KPI numbers.** For a reporting/analytics context, the numbers are the headline — they should be Title scale (22px minimum), tabular-numeral, bold, with a clear secondary label below. Currently "7" and "£2.4M" look the same size as body text in a glass card.
3. **The "Progressor breakdown" table has no sorting, no inline bars, no visual hierarchy between rows.** A name + three numbers in a plain table is the minimum viable output. On iOS, tables in analytics views use inline sparklines or bar segments inside the cell to provide at-a-glance comparison. Currently you have to compare numbers mentally.

---

### Reports (`app/reports/page.tsx`)

Reports is the simplest page — four KPI cards plus three lists. Well-structured. The `Section` component wrapping each list is correct and clean. The KPI strip uses `text-2xl font-bold tracking-tight` which is the same issue as analytics — too small for headline numbers in an overview context.

One specific issue: the KPI label `"Milestones (7d)"` abbreviates "last 7 days" as `(7d)` — this is internal shorthand that would confuse an agent or new user. Labels should read in plain English.

---

### Admin (`app/admin/page.tsx`)

The admin page is a dense information display — milestone definitions table, reminder rules table, agent management, fee structures. These are correctly rendered as full-width tables inside glass cards. The `Flag` and `Dash` helper components are appropriate for binary value display.

The section headings were just updated to `text-white/60` — correct for the dark background but the weight is wrong. `font-semibold` at `text-xs` with `tracking-wide uppercase` reads as menu labels. These section headings should be `text-sm font-semibold text-white/70` — slightly larger, as section H2s rather than captions.

---

### Login / Register

Covered above. Register page matches login — dark gradient, frosted card — which is correct consistency. The icon mark deserves a proper custom SVG or SF Symbol equivalent that doesn't use a generic house outline.

---

## Part 2 — Design Principles

### 1. Materials and Surfaces

The app uses a four-tier material system. Each tier has a specific purpose and must not be used for another purpose.

**Tier 0 — Environment:** The living room photo with a dark scrim (`rgba(8,12,25,0.52)`) is the permanent backdrop. It is never modified, never obscured by opaque surfaces within the authenticated app (only outside it — login, portal). Glass materials exist to float above it; opaque surfaces that cover it destroy the entire premise.

**Tier 1 — Primary glass card (`glass-card`):** `rgba(255,255,255,0.68)` fill, 24px blur, `saturate(180%)`. Used for content containers: transaction rows, task cards, detail sections, stat cards. This is the workhorse. Nothing else should be a glass card.

**Tier 2 — Strong glass (`glass-card-strong`):** `rgba(255,255,255,0.80)` fill, 32px blur. Used only for modals, sheets, drawers, and popovers — surfaces that float above primary cards. Using strong glass for a primary card is wrong.

**Tier 3 — Subtle glass (`glass-subtle`):** `rgba(255,255,255,0.40)` fill, 12px blur. Used only for segmented controls, secondary badges, and inset sub-surfaces within a card. Never for a top-level card.

**Tier 4 — Navigation glass (`glass-nav` / `glass-sidebar`):** Navigation surfaces — the sidebar, the sticky tab bar — use a higher-opacity fill (`rgba(255,255,255,0.88)`) to ensure readability of navigational text regardless of what photo region is behind them. Nav glass is context-agnostic by design.

**Tier 5 — Dark glass panel (`glass-panel-dark`):** `rgba(8,12,24,0.72)` fill, 32px blur, `border: 1px solid rgba(255,255,255,0.08)`. For use in page hero sections and context headers where a dark surface is needed — the photo bleeds through at reduced opacity, creating depth without covering it. This is distinct from Tier 4 (nav) in that its text must use on-dark label tokens, not light-surface tokens.

**Rule:** An opaque `background: linear-gradient(#1e293b...)` surface within the authenticated shell is only permissible if it has no glass cards below it on the same viewport. The current page headers (Dashboard hero, Completing header, Reports header) all violate this rule by painting an opaque stripe across the top of the photo background. They must be converted to `glass-panel-dark` so the photo bleeds through them.

---

### 2. Typography

The app uses a six-level type scale. Anything outside these six levels is a mistake.

**Type scale:**

| Role | Size | Weight | Tracking | Line height | Tailwind |
|---|---|---|---|---|---|
| Large Title | 34px | 700 | −0.02em | 1.05 | `text-[2.125rem] font-bold tracking-tight` |
| Title | 22px | 600 | −0.01em | 1.15 | `text-[1.375rem] font-semibold` |
| Headline | 17px | 600 | 0 | 1.3 | `text-[1.0625rem] font-semibold` |
| Body | 15px | 400 | 0 | 1.5 | `text-[0.9375rem]` |
| Caption | 12px | 400 | +0.01em | 1.35 | `text-xs tracking-[0.01em]` |
| Micro | 11px | 400 | +0.07em | 1.3 | `text-[0.6875rem] tracking-[0.07em]` |

Micro is only used for `uppercase` labels (section headings, badge text, table column headers). The +0.07em tracking is only appropriate at this size with uppercase; never apply it to mixed-case text.

**Rules:**
- Page titles (dashboard h1, property address) use Large Title. The current `text-2xl font-bold` (24px) sits between Title and Large Title — it must move to one or the other, not sit between them.
- KPI numbers in analytics/reports: Title (22px) minimum.
- All numeric columns that change (chase counts, days, prices, percentages) must use `font-variant-numeric: tabular-nums` — use Tailwind `tabular-nums` class.
- No mid-sentence capitalisation in labels: "Chase Up" → "Chase up", "Polite Yet Firm" → "Polite yet firm".
- Section sub-headings between glass cards: Micro, uppercase, `text-white/55` — `text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-white/55`. This is Apple's section label style (seen in iOS Settings, Health).
- Letter-spacing on body and headline text is 0. Negative tracking is only for display type (Large Title, Title). The current `tracking-wide` on caption labels (+0.05em) is incorrect — use `tracking-[0.07em]` only on uppercase Micro labels.
- Do not invent intermediate sizes (16px, 14px, 18px, 20px, 24px). If a piece of text doesn't fit one of the six roles, reconsider its role — don't add a size.

---

### 3. Colour — Semantic Tokens

Stop thinking in palette swatches. Every colour decision should answer "what does this mean?" not "what does this look like?"

```
// Background
--color-env:                    photo + rgba(8,12,25,0.52)   // always behind everything

// Surfaces (light glass)
--color-surface-1:              rgba(255,255,255,0.68)        // cards
--color-surface-2:              rgba(255,255,255,0.82)        // elevated (modals, drawers)
--color-surface-nav:            rgba(255,255,255,0.88)        // navigation
--color-surface-inset:          rgba(255,255,255,0.38)        // sub-surfaces in cards
--color-surface-dark:           rgba(8,12,24,0.72)            // dark glass panels (page headers)

// Text on light surfaces
--color-label-primary:          rgba(0,0,0,0.88)              // primary content
--color-label-secondary:        rgba(0,0,0,0.56)              // supporting content
--color-label-tertiary:         rgba(0,0,0,0.36)              // placeholder, muted
--color-label-quaternary:       rgba(0,0,0,0.20)              // disabled

// Text on dark surfaces (glass-panel-dark, headers, photo-adjacent)
--color-label-primary-on-dark:    rgba(255,255,255,0.92)      // primary content on dark
--color-label-secondary-on-dark:  rgba(255,255,255,0.60)      // supporting content on dark
--color-label-tertiary-on-dark:   rgba(255,255,255,0.38)      // muted on dark
--color-label-quaternary-on-dark: rgba(255,255,255,0.22)      // disabled on dark

// Semantic fills (status)
--color-fill-positive:          rgba(52,199,89,0.15)          // bg for positive badges
--color-fill-warning:           rgba(255,159,10,0.15)         // bg for warning badges
--color-fill-danger:            rgba(255,69,58,0.15)          // bg for danger badges
--color-fill-neutral:           rgba(255,255,255,0.12)        // bg for neutral badges

// Semantic text (status)
--color-text-positive:          #30d158                       // active, on_track
--color-text-warning:           #ff9f0a                       // at_risk, overdue
--color-text-danger:            #ff453a                       // off_track, escalated
--color-text-info:              #0a84ff                       // informational

// Interactive
--color-tint:                   #0a84ff                       // primary interactive (buttons, links)
--color-tint-secondary:         rgba(10,132,255,0.14)         // tinted backgrounds behind interactive

// Separators
--color-separator:              rgba(255,255,255,0.18)        // between cards
--color-separator-opaque:       rgba(0,0,0,0.10)             // inside cards

// Accent: status-specific (chase button — this product's primary verb)
--color-chase:                  #635bff                       // distinctive violet-purple, not the blue tint
```

**Usage discipline for on-dark tokens:** Whenever text sits on a `glass-panel-dark` surface or directly over the photo background (not inside a light glass card), use `-on-dark` tokens. When text sits inside a `glass-card` or `glass-card-strong` (light glass), use the standard `--color-label-*` tokens. Never mix them in the same surface context.

**The Chase action must not be blue.** Blue is already the system tint (links, active tabs, primary buttons). Chase is the core differentiating action of the product — it needs a distinctive colour. Violet-purple (`#635bff`, similar to Stripe's brand) is right: uncommon enough to stand out, serious enough for a professional tool.

---

### 4. Spacing and Radius

**Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px. No half-values (6px, 14px) except for type-adjacent micro-adjustments. Currently the codebase mixes `p-3.5`, `p-4`, `p-5`, `px-5 py-4`, `px-8 pt-6 pb-7` — no consistent unit.

**Target spacing system:**

| Context | Value |
|---|---|
| Page horizontal padding | 32px (px-8) |
| Card internal padding | 20px (p-5) |
| Card section dividers | 16px (py-4) |
| Between cards | 16px (gap-4) or 20px (gap-5) — pick one |
| Input padding | 12px 16px (py-3 px-4) |
| Badge / pill padding | 4px 10px |
| Icon to label gap | 8px (gap-2) |

**Radius scale:**

| Use | Radius |
|---|---|
| Cards, large containers | 20px (rounded-[20px]) — current |
| Modals, sheets | 16px (rounded-2xl) — current |
| Buttons | 12px (rounded-xl) |
| Input fields | 12px (rounded-xl) — currently rounded-xl or rounded-lg inconsistently |
| Badges, pills | 999px (rounded-full) — current, correct |
| Small chips | 8px (rounded-lg) |
| Icon containers | 12–16px (rounded-xl/2xl) |

**Rule:** Never mix radius values within the same component. A card with `rounded-[20px]` must have all internal elements respect that corner (hence the `clipPath: inset(0 round 20px)` pattern — this is correct and must be maintained).

---

### 5. Iconography

The app currently mixes three icon libraries: Lucide (`import { X, Mail, Sparkles... }`), Phosphor (`import { EnvelopeSimple, WhatsappLogo... }`), and raw SVG paths written inline. This is a critical consistency problem.

**Decision: Standardise on Phosphor Icons, Regular weight.**

Reasons: Phosphor has better character than Lucide, better corner rounding (closer to SF Symbols), is already partially adopted in this codebase, and has a broad enough set to cover all use cases. The Regular weight at 16–20px hits the right visual weight.

**Rules:**
- All icons: `weight="regular"` at 16px or 20px only. No mixing of sizes within a component.
- Filled icons (`weight="fill"`) are only used for active/selected states (sidebar nav active item, active toggle).
- No raw SVG paths in components. Every icon must come from the standardised library.
- Icon + label gap: always 8px (`gap-2`).
- Icons in buttons: 14px (not 16px) — the button label dominates, the icon supports.
- Interactive icons (close, expand, collapse): 16px. Decorative icons: 16px. Display/hero icons: 24–32px.

---

### 6. Motion

Motion is currently absent except for `transition-colors` and one shimmer animation on the milestone progress bar. This is a significant gap.

**Motion principles:**
- Duration: 200ms for micro-interactions (hover, press). 280ms for element entrance. 350ms for page-level transitions and modals. Never exceed 400ms for any UI motion.
- Easing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (ease-out) for most UI. `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring overshoot) for entrance of primary elements (cards entering, modals opening). `linear` only for continuous (shimmer, loading spinners).
- What moves:
  - Cards on hover: `translateY(-2px)` + shadow deepening. Duration 200ms ease-out.
  - Buttons on press: `scale(0.97)` + `brightness(0.95)`. Duration 100ms linear, release 200ms ease-out.
  - Tab switching: content `opacity(0→1)` at 150ms ease-out. No slide — lateral motion causes nausea on content-dense interfaces.
  - Modal entrance: `translateY(8px→0) opacity(0→1)` at 280ms spring.
  - Drawer entrance: `translateX(100%→0)` at 320ms spring ease-out.
  - Sticky tab bar: `backdropFilter` blur intensifies from 20px→32px over the first 40px of scroll (requires JS scroll listener).
  - Milestone complete: row gets a green flash (`bg-emerald-400/20`) for 600ms then fades out. Currently instant.
- What does not move: dividers, backgrounds, text content within cards, icon colours.
- Reduced motion: all transform animations wrap in `@media (prefers-reduced-motion: reduce) { transition: none; animation: none; }`. Duration-only animations (opacity crossfades) are permissible at 50% duration. The shimmer animation must be disabled.

---

### 7. Imagery

One photograph is used: `hero-bg.jpg` (living room interior). It is a fixed backdrop behind the entire authenticated shell.

**`hero-bg.jpg` audit — keep or replace?**

The current file is approximately 221KB on disk. For a full-viewport background image serving at 1440px+ display widths and Retina (2x) screens, the ideal source should be 2560px wide or larger, resulting in a well-compressed JPEG of 800KB–2MB at quality 85. A 221KB file at display-fill dimensions suggests one of: (a) the image was sourced as a web thumbnail and is under 1000px wide, (b) it was aggressively compressed and will appear blurry on Retina screens, or (c) it is a heavily cropped square with low information density.

**Before proceeding to Phase 1b, verify the following:**

1. **Resolution** — Open the file in an image editor or run `identify hero-bg.jpg` (ImageMagick). If the width is under 1920px, the image must be replaced. Under 2560px is marginal for Retina.
2. **Content suitability** — The image must show: a warm-toned residential interior (living room or kitchen preferred), no visible people or faces, no identifiable branded items or signage, neutral walls that don't clash with blue/violet UI accents. Avoid images with large areas of bright white (windows, skylights) — these compete with glass panel contrast even through the scrim.
3. **Colour temperature** — Warm amber/cream lighting complements the glass panel system and the property industry context. Cool fluorescent or daylight-white interiors feel sterile.
4. **Commercial licence** — If sourced from Unsplash or Pexels, the licence covers commercial SaaS use. If sourced from Google Images or copied from a listing site, it is not cleared for commercial use and must be replaced before production.

**Recommendation:** If the resolution is confirmed under 2000px wide, replace with a high-resolution alternative. Source from Unsplash (commercial use allowed) — search "luxury living room interior", "modern apartment", "british home interior". Prefer images with depth (foreground furniture, receding background), warm lighting, natural materials (wood, stone, textile). The scrim will darken the image significantly; the underlying photo should have rich midtones, not be dark already.

**Treatment rules:**
- The photo must never be the foreground. It is always recessed under glass.
- The scrim (`rgba(8,12,25,0.52)`) is the baseline. On pages where content is dense (transaction detail, milestones), the scrim stays at 52–58%. On pages with sparse content (empty states), consider increasing to 65% to add depth without the photo competing with empty state messaging.
- The photo must be `object-fit: cover` and `object-position: center` to avoid awkward crops.
- No other photography is introduced. Not avatars, not property listing photos. This is a professional tool, not a consumer property portal.
- The photo is a mood backdrop, not a content image. It should recede from consciousness after 2 seconds. If users are commenting on the photo, the scrim is too light.

---

### 8. Density

Apple is generous with whitespace at the macro level (between sections, margins) but tighter at the micro level (within a list item or table row). This app inverts that: it is padded heavily inside cards but cramped at the page level.

**Target density rules:**
- Page horizontal padding: fixed at 32px (`px-8`). Current — correct. Do not reduce.
- Between major sections on a page: 24px (`space-y-6`). Currently `space-y-7` (28px) — marginally too loose.
- Inside a glass card, between labelled fields: 12–16px.
- Table row height: 52px minimum (44pt touch target + visual breathing room). Current rows are `py-3.5` (14px top/bottom + content ≈ 44px) — borderline. Acceptable.
- Task card internal padding: `px-5 py-4` is 20/16px — this is generous for a dense queue. Should be `px-4 py-3` (16/12px) for tighter scan density.
- Sidebar card internal padding: `p-5` (20px) is correct for the wider sidebar format.

---

### 9. What This Will NOT Look Like

These are the failure modes. If the result of any phase resembles these patterns, the implementation has gone wrong.

**It will not look like a corporate BI dashboard.** Tableau, Power BI, Grafana — dark grey backgrounds, neon blue/green data colours, dense grids with no breathing room. This app is a professional productivity tool, not a command centre. The glass-over-photo approach is warm and spatial by design.

**It will not look like consumer fintech.** Monzo, Revolut — gradient-filled buttons, illustrated empty states with cartoon characters, emoji in UI copy, bold typographic personality. The app serves estate agents and solicitors. It needs authority and clarity, not charm or approachability theatre.

**It will not look like a generic SaaS admin panel.** Bootstrap 4, Material Design 2 — flat white cards with grey borders, no depth, table rows with alternating backgrounds, a primary-coloured header bar. This is the visual language of internal tooling. Nothing in this app should look like it could be a CRUD admin generated by a framework.

**It will not look like an Apple knockoff.** Overuse of frosted glass destroys the effect. If every element — buttons, tooltips, tab bars, modals, popovers, notifications, inline badges — is frosted, none of them reads as glass. Glass is meaningful only when used selectively against a rich background. The rule is: most surfaces are glass, but not all surfaces at every level. The background environment photo provides the signal; glass provides selectivity.

**It will not look like a motion design portfolio.** Animation on every state transition, elaborate page entrance choreography, loading sequences that take half a second to play, spring-bounce transitions on routine actions. Motion must feel incidental to action — the user should barely notice it. If a designer is proud of a specific animation, it is probably too prominent for a professional tool.

**It will not look like a dark mode developer tool.** Linear, Vercel, Raycast — near-black backgrounds, mono fonts, low-saturation palette, everything slightly cool-toned. The glass-over-photo approach is warm and organic. No surface should look like a code editor theme.

**It will not look like a property portal.** Rightmove, Zoopla — property listing photography, map tiles, consumer-facing card patterns with large images, "£375,000" in bold. This is an internal operations tool. No property photography, no consumer-facing data presentation patterns.

---

### 10. Accessibility

The following commitments are non-negotiable. They are not aspirational — they are minimum viable.

**Contrast ratios (WCAG 2.1 AA):**
- Normal text (under 18px regular or 14px bold): minimum 4.5:1 contrast against its background
- Large text (18px+ regular or 14px+ bold): minimum 3:1 contrast
- Interactive elements (buttons, form controls, focus indicators): minimum 3:1 contrast against adjacent colours
- Specific to this app's glass system: `--color-label-primary-on-dark` (white/92) on `glass-panel-dark` (rgba 8,12,24,0.72 over photo with 52% scrim) achieves approximately 11–13:1 — well above threshold. `--color-label-secondary-on-dark` (white/60) achieves approximately 5.5:1 — passes. `--color-label-tertiary-on-dark` (white/38) achieves approximately 3.2:1 — passes for large text only; must not be used for small body text. `--color-label-quaternary-on-dark` (white/22) fails WCAG for text — use only for decorative or disabled states, never for readable content.
- Light glass surfaces: `--color-label-primary` (black/88) on white/68 glass card — approximately 9:1. Passes.
- Chase violet (`#635bff`) on white: approximately 3.7:1 — passes for large text (button labels at Headline scale). Does not pass for small text at Caption scale. Do not use `--color-chase` for small descriptive text.

**Keyboard navigation:**
- Tab order must follow DOM reading order. No custom `tabindex` values greater than 0.
- All interactive elements reachable by keyboard: buttons, links, form controls, disclosure triangles (milestone collapse), filter tabs, snooze dropdowns.
- Modal and drawer components must trap focus when open. Tab must cycle within the overlay; Shift+Tab must cycle backwards. Escape must close the overlay and return focus to the trigger element.
- `PropertyFileTabs` tab bar: arrow keys should move between tabs (ARIA tabs pattern). Currently Tab key cycles through all tab panels, which is incorrect for a tab interface.

**Screen reader semantics:**
- All icons that convey meaning must have an accessible label: `aria-label` on icon-only buttons, or a visually-hidden `<span>` for icon + visible label buttons.
- Icons that are purely decorative (accompany visible text with identical meaning) must have `aria-hidden="true"`.
- Status badges use `role="status"` if their content updates dynamically. Static badges use no role.
- Milestone sections use a logical heading hierarchy: section name as `<h3>` (within the transaction page `<h1>` → tab content region → `<h2>` implied → section as `<h3>`). Currently milestone sections have no heading semantics.
- `ChaseDrawer` must have `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the drawer's visible title.
- Transaction table: `<table>` with proper `<thead>`, `<th scope="col">`, `<td>` — not a `<div>` grid. Currently correct — maintain.
- Live regions: when a chase is successfully sent, a visually-hidden `role="alert"` should announce "Chase sent" to screen readers.

**Reduced motion:**
- All CSS animations and transitions must be wrapped in `@media (prefers-reduced-motion: no-preference)` or use `@media (prefers-reduced-motion: reduce)` to nullify them. The milestone shimmer animation must stop. Transform animations (`translateY`, `scale`) must become instant. Opacity crossfades are permitted at 50% of their normal duration under reduced motion preference.

---

## Part 3 — The System

### Token Foundation Review

The existing `globals.css` has two separate token systems living in the same file:

1. `:root {}` block with `--bg-base`, `--border`, `--text-primary` etc. — a legacy system from before the glass redesign
2. `@layer base { :root {} }` block with `--glass-fill`, `--glass-border` etc. — the new system

**These two systems coexist and conflict.** The legacy tokens are never used (verified: no `var(--bg-base)` usage in components — they all use Tailwind classes). They are dead code and must be removed. Keeping them creates confusion about which system to extend.

### Missing Primitives

The following primitives are specified but not implemented:

**`glass-panel-dark`** — A dark glass panel for use within the photo-background context: `rgba(8,12,24,0.72)` fill, 32px blur, `border: 1px solid rgba(255,255,255,0.08)`. Used for: page hero sections (replacing the opaque gradient headers), the ChaseDrawer overlay context header, the sticky tab bar dark variant. Without this, page headers must remain opaque (blocking the photo) or look washed out if converted to light glass.

**`glass-status-badge`** — A semantic badge primitive that takes a status/level and outputs the correct fill + text + border with correct opacity for the glass context. Currently every component hand-crafts badge colours (`bg-emerald-50/60 text-emerald-700`, `bg-red-100/80 text-red-700` etc.) — there are at least 12 different implementations. A single `StatusBadge` component with semantic tokens would unify them.

**`glass-input`** — Currently `border-white/30 bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:border-blue-400 focus:ring-2 focus:ring-blue-100/50` is repeated verbatim across ~20 input fields. This must be a CSS component class.

**`glass-button-primary`**, **`glass-button-secondary`**, **`glass-button-ghost`** — Three button tiers. Currently every button is hand-styled. Primary = the Chase action and affirmative actions (purple/violet). Secondary = outlined, for cancel/secondary actions. Ghost = text-only with hover background.

**`glass-divider`** — A semantic horizontal rule: `h-px bg-white/18`. Currently implemented as `border-b border-white/20` in some places and `divide-y divide-white/15` in others, and `h-px bg-white/30` as an inline div in others. Pick one implementation and apply it everywhere.

**`glass-section-label`** — The floated section headings between glass cards (Admin page, section separators in Milestones). Defined as: `text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-white/55`. Currently inconsistent between pages.

**`animate-enter`** — A utility for the standard entrance animation: `opacity-0 translate-y-2` → `opacity-100 translate-y-0` at 280ms spring. Used on modal content, drawer content, and initially-hidden tab panels.

---

## Part 4 — The Hero Moments

### Moment 1: Dashboard First Load

**First visit vs. return visit — these are different experiences and must be designed differently.**

**First visit (user has never loaded this dashboard before, or arrives from a blank session):**
The app loads. For 200ms, there is just the living room photo — warm, beautiful, slightly blurred. Then the sidebar slides in from the left (280ms spring). The main content area materialises: the title and user name appear first (120ms), then the stat chips count up from 0 to their values (each number animates, 600ms spring stagger), then the transaction table rows appear staggered (each row fades in 40ms after the previous one, to a max of 6). The whole entrance sequence takes under 1.2 seconds and ends with a loaded, professional interface. This choreography exists to make a lasting first impression — the app must feel expensive from the first time it opens.

**Return visit (user refreshes, navigates back, or opens a new tab after an earlier session):**
The entrance choreography is suppressed. The data is server-rendered and already present — playing a count-up animation on numbers the user saw five minutes ago wastes their time. On return, the sidebar is already in position (no slide), the content fades in at 120ms opacity only (no translateY), and numbers appear at their final value immediately. The signal that the page has loaded is a single, brief glass materialisation — the cards' backdrop-filter resolves from blurry-nothing to sharp frosted glass in 120ms. After that, the user's attention is already on the work queue.

**Implementation note:** Distinguish visits by checking `sessionStorage`. On first load of the session, set a flag and play the full entrance. On subsequent navigation within the session, skip the stagger and count-up.

**Dashboard hero imagery treatment:** The photo here should be at its most dramatic: scrim increased to 55% (darker) for the area behind the page header, then 40% for the card area below — creating a gradient of depth. The hero title "Dashboard" floats on the dark glass panel (`glass-panel-dark`). The photo's focal point (the living room interior, typically warm-lit) is visible through the glass cards below as warm amber-tinted bleed-through. The net effect: frosted glass panels floating over a warmly-lit room — sophisticated, property-industry-appropriate.

---

### Moment 2: Opening a Property File

**The experience:** The user taps a transaction row. It scales down to 0.97 for 100ms (pressed state), then the navigation begins. The `PropertyHero` enters with the address text sliding up from 6px below (`translateY(6px→0)`). The progress bar fills from left to right over 500ms after the hero renders. The tab bar materialises at the top of the content area. Tab content fades in. The sidebar slides in from the right simultaneously.

The structural requirement: `PropertyHero` renders on the server. The entrance animation is CSS-triggered by a small `data-loaded` attribute swap on mount. The progress bar fill uses `transition-all duration-500`.

The critical detail: the address split (line 1 bold 34px / line 2 muted 15px) must have more vertical separation. Currently `mt-0.5` between them. Needs `mt-1`. The street name and city/postcode should feel like a headline + sub-headline, not two lines of the same paragraph.

---

### Moment 3: Sending a Chase

This is the highest-frequency interaction. The drawer slides in from the right, blurring the transaction page behind it. The user generates a message — the textarea fills letter by letter (streaming). They hit "Send chase." The button shows a loading spinner for 800ms, then transforms to a success state: the button background transitions to emerald green over 150ms, and a green ring expands outward — `box-shadow` animating from `0 0 0 0px rgba(52,199,89,0.5)` to `0 0 0 8px transparent` over 400ms ease-out. The drawer slides closed at 280ms ease-out. The task card in the work queue that triggered this has already been updated (optimistic UI). The entire experience feels like pressing "send" on a native mail app — committed, decisive, satisfying.

**What this requires:** The generate button should be violet (`--color-chase`), not blue. The send button changes from blue to `--color-chase` (violet) when a message is ready. The success ring animation is a pure CSS `box-shadow` keyframe. Drawer close is 280ms ease-out — not the current instant `onClose()`.

---

### Moment 4: Milestone Completion

Currently completing a milestone is: checkbox ticked → row updates. That's it.

**What it should feel like:** The user ticks a milestone. The circle node fills with emerald green, with a slight spring overshoot (briefly overshoots to 110% scale, settles at 100%). The row background briefly washes with `bg-emerald-400/15` (a green glow) that fades over 600ms. If this was the last milestone in a section, the section header animates to "All done" with the green fill sliding across the badge. If this milestone triggered exchange readiness, the banner at the top slides in from above with a celebration pulse.

This moment is the most emotionally significant interaction in the product — the progressor has moved a sale forward. It deserves to feel like an achievement.

---

### Moment 5: Empty State — No Transactions Yet

A new user, or a fresh agency account. The dashboard has no transactions. The photo background is visible through the glass sidebar and the empty content area — this is actually a beautiful moment if designed right.

**The experience:** A single glass card centred on the page. Inside: a property illustration (not the generic box icon from the current `EmptyState` — a real architectural line drawing at 64×64px). Below it, "Your sales pipeline, ready to go" in Title scale. Below that, a 2-line description and a primary CTA button. The whole card is `glass-card-strong` with the maximum blur (32px) so the photo behind it is beautifully diffused. The card has a subtle `box-shadow` glow as if warm light from the room behind is illuminating its edges. The CTA button ("Add your first file") uses a spring entrance animation, drawing the eye immediately.

This empty state should make a new user feel like they've arrived somewhere professional — not like they're looking at a placeholder.

---

## Part 5 — Rollout Plan

### Phase 1a — CSS Primitives
**What ships:** The global CSS foundation is completed and cleaned up. New primitive classes are defined. Legacy tokens are removed. No visual changes to any page — this is infrastructure.

**Files touched:**
- `app/globals.css` — Remove legacy `:root {}` token block. Add `glass-panel-dark` primitive. Add `glass-input` component class. Add `glass-section-label` utility. Add `animate-enter` utility. Fix `--shadow-sidebar` token (used by AppShell — ensure it stays).

**Risk:** Removing the legacy `:root {}` block could break components that reference `var(--bg-base)` or similar. Verify with a codebase-wide grep before removing. Expected result: zero references, but verify.

**Effort:** XS (2–3 hours)

**Acceptance criteria:**
- `glass-panel-dark` class renders a dark frosted glass surface (verify in browser: dark panel with photo visible through it, not opaque)
- `glass-input` class applied to one test input: correct border opacity, background, text colour, focus ring
- `animate-enter` utility triggers the 280ms entrance animation when class is applied
- No `var(--bg-base)`, `var(--bg-card)`, `var(--text-primary)` references remain in the codebase (verified by grep)
- `glass-section-label` class matches the Micro + uppercase specification exactly (verify font size, tracking, opacity)

**Approval gate: complete and pass all five criteria before Phase 1b begins.**

---

### Phase 1b — PropertyHero + Tab Bar
**What ships:** The transaction detail hero and tab bar are redesigned. This is the direction-validation surface.

**Files touched:**
- `components/transaction/PropertyHero.tsx` — Remove opaque gradient background. Apply `glass-panel-dark` (photo shows through hero). Increase address title to 34px (Large Title). Fix line2 spacing to `mt-1`. Remove or darken any inner background element that occludes the photo.
- `components/transaction/PropertyFileTabs.tsx` — Add 150ms opacity crossfade on tab panel switching. Add JS scroll listener: sticky tab bar blur intensifies from 20px → 32px over first 40px of scroll.

**Risk:** PropertyHero transparent background risks text unreadability if photo region behind it is bright. The scrim at 52% must be maintained. Test with the actual `hero-bg.jpg` — if any text falls below 4.5:1 contrast, add `text-shadow: 0 1px 3px rgba(0,0,0,0.45)` to the specific elements. Safari handles scroll events differently (no scroll event on `window` if the scrolling container is not `window`) — test the blur intensification on Safari.

**Effort:** S (4–6 hours)

**Acceptance criteria:**
- Hero area shows the living room photo bleeding through the dark glass panel (not blocked by opaque paint)
- Property address renders at 34px (Large Title); line2 has 8px top margin
- Switching tabs produces a visible opacity transition (not a hard cut) — verify by slowing browser animation speed in DevTools
- Sticky tab bar increases its blur when scrolled past hero — verify in Chrome and Safari
- All text in the hero (address, status badge, progress bar label, countdown) passes WCAG 4.5:1 against the dark glass background

**Approval gate: complete and pass all five criteria before Phase 1c begins.**

---

### Phase 1c — Sidebar + Milestones
**What ships:** The transaction sidebar and milestone panel are corrected. These are contained changes with no risk to other pages.

**Files touched:**
- `components/transaction/TransactionSidebar.tsx` — Fix ProgressRing track stroke from `rgba(15,23,42,0.08)` to `rgba(255,255,255,0.12)`. Verify card section label tokens use `glass-section-label` (or equivalent).
- `components/milestones/MilestonePanel.tsx` — Change section header text from coloured (`text-violet-600`, `text-amber-700`) to `text-white/70` with coloured dot only. Change exchange-ready banner from `bg-emerald-50/60 border-emerald-200/60` to `bg-emerald-500/15 border-emerald-400/25`.
- `components/milestones/MilestoneRow.tsx` — Add 600ms green flash animation on milestone completion. The row background transitions `bg-emerald-400/0 → bg-emerald-400/15 → bg-emerald-400/0` over 600ms.

**Risk:** Low — contained to two components on one page.

**Effort:** S (3–4 hours)

**Acceptance criteria:**
- ProgressRing track is visible as a faint ring on the glass card background (was invisible before)
- Milestone section headers show coloured dot but neutral (`text-white/70`) label text — no coloured text clashing with photo background
- Exchange-ready banner is readable on the glass card (not washed-out light tint)
- Milestone completion plays the green flash animation (verify by completing a test milestone)
- No TypeScript errors introduced

**Approval gate: all five criteria pass. Phase 1 is complete. Await greenlight for Phase 2.**

---

### Phase 2 — Global Page Headers: Remove Opaque Panels
**What ships:** Every opaque `linear-gradient(#1e293b...)` panel (Dashboard hero, Completing header, Reports header, Todos header, Analytics header, Admin header) is converted to `glass-panel-dark`. The photo is now visible through every page header in the app.

**Files touched:**
- `app/dashboard/page.tsx` — `DashboardHero` converted to dark glass
- `app/completing/page.tsx`
- `app/reports/page.tsx`
- `app/todos/page.tsx`
- `app/analytics/page.tsx`
- `app/comms/page.tsx`
- `app/solicitors/page.tsx`
- `app/not-our-files/page.tsx`
- `components/ui/PageHeader.tsx`

**Risk:** Text contrast. On a dark glass panel with photo behind it, `text-white` and `text-slate-400` must be verified for contrast ratio ≥ 4.5:1 against the darkest possible photo region. Add `text-shadow: 0 1px 3px rgba(0,0,0,0.4)` to heading text if contrast fails.

**Effort:** S (1 day)

**Acceptance criteria:**
- Photo is visible through every page header across all authenticated routes (verify by visiting each page)
- No opaque `linear-gradient(#1e293b...)` headers remain in any page component
- All header text (title, subtitle) passes 4.5:1 contrast (verify with browser a11y inspector)
- `PageHeader` component uses `glass-panel-dark` and `-on-dark` label tokens correctly
- No regression on sidebar (sidebar must remain light glass, not dark glass)

---

### Phase 3 — Typography and Spacing Normalisation
**What ships:** All KPI numbers upgraded to Title (22px). All section labels normalised to `glass-section-label`. All input fields converted to `glass-input` class. Badge system consolidated into `StatusBadge` component with semantic tokens. Tabular numbers applied to all numeric displays.

**Files touched:** Every page and ~15 components. Primarily a find/replace of `text-2xl` → `text-[1.375rem]` for KPIs, `text-xs font-semibold text-slate-900/40 uppercase tracking-wide` → `glass-section-label`, and adding `tabular-nums` class to number-displaying spans.

**Risk:** Low — visual changes only. Typography size increases may cause text wrapping in constrained layouts (sidebar, task card badges). Review mobile layout at 768px width.

**Effort:** M (2–3 days)

**Acceptance criteria:**
- All KPI numbers are 22px or larger (verify on Analytics, Reports, Dashboard stat chips)
- No `text-xs font-semibold uppercase tracking-wide` patterns remain outside of the `glass-section-label` class
- All inputs on every page use `glass-input` class (no hand-rolled border/bg/focus combinations)
- All numeric values that update or compare vertically have `tabular-nums` (chase counts, days, prices, percentages)
- `StatusBadge` component is used for all status/urgency badges — no inline badge colour combinations

---

### Phase 4 — Icon Library Unification
**What ships:** All Lucide icons replaced with Phosphor Regular weight equivalents. All raw inline SVG paths replaced with Phosphor components. Icon sizes normalised to 16px (interface) / 20px (feature) / 24px+ (display only).

**Files touched:**
- `components/chase/ChaseDrawer.tsx` — Replace `X, Mail, MessageSquare, Sparkles, Send, Loader2, ChevronDown`
- `components/transaction/PropertyHero.tsx` — Replace inline arrow SVG
- `components/tasks/TaskCard.tsx` — Replace inline check SVG
- `components/tasks/WorkQueue.tsx` — Replace inline check SVG
- All other files using `from "lucide-react"` or inline SVG

**Risk:** Low. Phosphor icon names differ from Lucide — requires manual mapping for each icon. Visual weight difference between libraries may look slightly different. Note: Phosphor's equivalent of `Loader2` is `CircleNotch` — confirm this renders acceptably as a spinner before removing `Loader2`.

**Effort:** S (1 day)

**Acceptance criteria:**
- No `from "lucide-react"` imports remain in the codebase (verified by grep)
- No inline `<path d="M3 12...">` SVG paths remain in component files (verified by grep for `<path d=`)
- All icons are Phosphor at 16px or 20px — no icons at 14px, 18px, 24px except display-only icons explicitly approved
- `weight="fill"` is used only for active nav items and active toggle states — not for any other icon
- Visual regression check: all icon-bearing buttons and nav items look intentional, not accidental

---

### Phase 5 — Motion System
**What ships:** The full motion system as specified in Part 2. Entrance animations on dashboard, property detail, modals. Hover lift on cards. Press states on buttons. Tab switch crossfade. Milestone completion flash. Chase send success animation.

**Files touched:** `app/globals.css` (animation utilities), `components/tasks/TaskCard.tsx`, `components/milestones/MilestoneRow.tsx`, `components/chase/ChaseDrawer.tsx`, `components/transaction/PropertyFileTabs.tsx`, `app/dashboard/page.tsx`.

**Risk:** Medium. Motion must be tested with `prefers-reduced-motion`. On low-end devices, staggered list entrance can cause jank if list is large (50+ items). Limit stagger to first 6 items maximum. The Chase send animation uses `box-shadow` keyframes — verify cross-browser.

**Effort:** M (2–3 days)

**Acceptance criteria:**
- Card hover: `translateY(-2px)` and shadow deepening visible on all `glass-card` elements (verify hover state in browser)
- Button press: `scale(0.97)` visible on all primary and secondary buttons
- Tab switch crossfade: 150ms opacity transition visible (use DevTools animation slow-motion)
- With `prefers-reduced-motion: reduce` enabled in OS settings: all transforms are instant, no entrance animations play, shimmer animation is stopped
- Chase send success animation plays correctly in Chrome, Firefox, and Safari

---

### Phase 6 — Work Queue Density and Chase Redesign
**What ships:** TaskCard internal padding reduced for density. Chase button colour changed to `--color-chase` (violet). Empty state icons upgraded. Analytics SVG chart rewritten with correct pixel math, animation, axis labels, and accessible colour usage — no new charting library introduced.

**Files touched:** `components/tasks/TaskCard.tsx`, `components/chase/ChaseButton.tsx`, `components/chase/ChaseDrawer.tsx`, `components/ui/EmptyState.tsx`, `app/analytics/page.tsx`.

**Risk:** TaskCard padding reduction changes the visual rhythm of the work queue — test with a full queue of 15+ items to ensure density reads correctly, not cramped. The SVG chart rewrite must be tested at narrow viewport widths (tablet). The violet Chase colour must be checked for contrast on both light glass and dark glass backgrounds.

**Effort:** M (1–2 days)

**Acceptance criteria:**
- TaskCard padding is `px-4 py-3` (not the previous `px-5 py-4`)
- Chase button renders in `--color-chase` violet across Work Queue, transaction detail, and all other entry points
- Analytics bar chart has correct, consistent bar widths at all viewport sizes (no fractional-pixel gaps)
- Analytics chart bars have entrance animation (fade + height grow)
- `EmptyState` icons use Phosphor `CheckCircle weight="fill"` at 28px in relevant contexts

---

## Part 6 — The Details That Sell It

1. **Card hover lift.** Every clickable `glass-card` should `translateY(-2px)` on hover with shadow deepening from `--glass-shadow-md` to `--glass-shadow-lg`. Duration 200ms ease-out. Currently all hover states are colour-only (`hover:bg-white/20`).

2. **Button press state.** Every button: `active:scale-[0.97] active:brightness-95`. Duration 100ms linear. No button currently has a scale-down press state.

3. **Tabular numbers.** Every number that could be compared vertically — exchange countdown days, prices, milestone counts, task counts, chase numbers — must be `tabular-nums`. Currently only `PropertyHero` uses this class. Task card chase counts, sidebar fee amounts, analytics numbers are all proportional.

4. **Focus rings that are beautiful.** The current Tailwind default focus ring (`focus:ring-2 focus:ring-blue-400`) is a rectangle. Apple's focus rings are `border-radius`-aware, `2px solid rgba(0,102,255,0.6)` with `box-shadow: 0 0 0 4px rgba(0,102,255,0.14)`. Apply via `focus-visible:` (not `focus:`) so keyboard users see it but mouse users don't.

5. **Scroll-linked blur intensification.** The sticky tab bar (`PropertyFileTabs`) should increase its `backdrop-filter` blur from 20px → 32px as the user scrolls past the hero. Requires a `useEffect` with `window.addEventListener('scroll', ...)` and CSS variable update. This is the signature detail on iOS navigation bars.

6. **Sidebar active item.** The current active nav item is a blue gradient pill. Apple's sidebar active state is a `rounded-xl bg-blue-500/85` with `shadow-sm`. The icon should flip from `weight="regular"` to `weight="fill"` on activation — one of the most effective iOS detail signals.

7. **`.glass-card` hover state.** A light inner highlight intensification: on hover, the `inset 0 1px 0 rgba(255,255,255,0.X)` shadow in `--glass-highlight` increases from 0.60 → 0.85 opacity. Creates a "the glass brightens as your mouse approaches" effect.

8. **Reduced-motion parity.** Every `transition-*` and `animation-*` wraps in a `@media (prefers-reduced-motion: reduce)` block. The shimmer on the milestone progress bar must stop. Position changes (`translateY`) must become instant. Opacity crossfades reduce to 50% duration.

9. **Icon weight consistency.** After unification on Phosphor Regular, all icons render at the same visual weight (~1.5pt equivalent at 16px). This eliminates the current mixed-weight problem caused by Lucide, Phosphor, and inline SVG coexisting.

10. **Input placeholder opacity.** Currently `placeholder:text-slate-900/30` — 30% of black = very faint. Apple's placeholder text is `rgba(0,0,0,0.25)` on light fields. The distinction between placeholder and entered text needs more contrast: `placeholder:text-slate-900/35` minimum.

11. **Glass card `border-radius` on clipped containers.** The current `clipPath: "inset(0 round 20px)"` pattern (used to clip tables inside glass cards) is correct but every instance is hardcoded with an inline style. This should be a Tailwind `clip-glass` utility so it's searchable and maintainable.

12. **Date display consistency.** The app formats dates 4 different ways across components: `"dd MMM yyyy"`, `"dd/MM/yyyy"`, `"numeric month long year"`, and relative (e.g. "3 days ago"). Standardise: absolute dates use `"d MMM yyyy"` (e.g. "14 Apr 2026"), relative dates use a unified `relativeDate()` function (already exists in `lib/services/summary.ts` but is not used consistently).

13. **"Chase #N" counter.** On the `ChaseDrawer`, "Chase #2" appears in `text-xs text-slate-900/40`. This is an operational detail the progressor needs to glance at quickly. It should be visually prominent: `text-sm font-semibold tabular-nums` with the tone badge directly adjacent.

14. **Status badge ring.** All status badges (Active, On Hold, Completed, Withdrawn) use `ring-1` for a subtle border. This is correct. But the ring colour in `PropertyHero` (`ring-emerald-400/30`, `ring-amber-400/30`) differs from the generic `StatusBadge` component which has its own border implementation. One component, one implementation.

15. **Milestone section collapse animation.** Currently collapse/expand is an instant show/hide. The `max-height` CSS animation trick (or a proper exit animation library) would make the sections feel alive.

16. **Empty checkmark circles.** The `WorkQueue` empty state uses a hardcoded `bg-green-100/80` circle with an SVG checkmark. After icon unification, this should use `<CheckCircle weight="fill" className="text-emerald-500" size={28} />` from Phosphor.

17. **Link affordance on transaction rows.** `TransactionTable` rows are full-width `<Link>` elements. On hover, only the text changes colour. The entire row should show a right-pointing chevron (`w-4 h-4 text-slate-900/20 group-hover:text-slate-900/50 transition`) at the far right — iOS's standard disclosure indicator.

18. **ChaseDrawer backdrop click.** The backdrop is `bg-black/30 backdrop-blur-sm`. The blur on the content behind should use `blur-sm` on the entire `PropertyFileTabs` content, not just the overlay. Currently only the overlay dims; the content behind the drawer stays sharp. On iOS, opening a sheet blurs the content behind it.

19. **Sidebar user avatar.** The current user avatar is `linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)` with the user's first initial. This is a correct pattern but the gradient is the same blue as the active nav item — the avatar doesn't feel distinct. Use a soft gradient derived from the user's name (a consistent colour per person) or a neutral `rgba(255,255,255,0.15)` with white initial text.

20. **The "View file →" link pattern.** Appears on TaskCard and SnoozedItem — `text-xs text-blue-500 hover:text-blue-600 transition-colors` with a literal `→`. Replace the arrow character with a Phosphor `ArrowRight` icon at 12px. The `→` character is typographically inconsistent across fonts and renders differently at small sizes.

21. **Scrollbar styling.** The current scrollbar CSS targets WebKit: 5px width, transparent track, rounded grey thumb. This is good but the thumb colour `rgba(209,217,224,0.8)` is wrong for the dark photo background — the scrollbar should be `rgba(255,255,255,0.20)` thumb to read against the dark photo.

22. **The login icon's house path.** The `M3 12l2-2m0 0l7-7 7 7M5 10v10...` SVG is Heroicons' `home` icon. It was copied inline. It has no rounding, it's at strokeWidth 2 which is too thin at 24px, and the path's proportions are off. Replace with Phosphor `House weight="fill"` at 24px in the icon container.

23. **Keyboard trap in ChaseDrawer.** When the drawer is open, keyboard focus can escape to the content behind it. A proper focus trap (`inert` attribute on background content, or a focus trap library) is required. This is both an accessibility requirement and a "polish" detail — an app that handles focus correctly signals engineering quality.

---

**Phase 1a is approved. Execute when ready.**
