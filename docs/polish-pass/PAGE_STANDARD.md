# Marketing Site — Page Standard

**Status:** Active standard. Applies to every page on `thesalesprogressor.co.uk` and `www.thesalesprogressor.co.uk` other than the homepage itself.
**Established:** 2026-05-31, on the homepage push that locked Hero → FooterCTA in production.
**Source:** The nine live homepage sections — `components/home/Hero.tsx`, `TheChoice.tsx`, `IntelligenceLayer.tsx`, `ServiceSection.tsx`, `PortalSection.tsx`, `ProofStrip.tsx`, `PricingPreview.tsx`, `FAQ.tsx`, `FooterCTA.tsx` — plus the shared layer at `lib/motion.ts`, `lib/pricing.ts`, `lib/flags.ts`, `lib/backgrounds.tsx`, and `app/globals.css`.
**Baseline reference:** The live homepage at `https://www.thesalesprogressor.co.uk` is the reference bar. When in doubt about whether a new page clears the bar, open the homepage in one tab and the new page in another and compare directly. Do not approve a new page that visibly degrades the homepage's polish, voice, or rhythm.
**Sibling docs:** `ANIMATION_STANDARDS.md` (agent app), `VOICE_GUIDELINES.md` (agent app, voice baseline), `WORKFLOW.md` (agent app, methodology). This doc adopts their conventions; where it adds marketing-specific rules, those additions are flagged inline.

---

## The rule

The homepage is shipped. It defines the polish bar, the language bar, and the working method for every other marketing page. No new marketing page invents its own entrance timing, interaction grammar, voice register, or section architecture when the homepage already establishes one. If a homepage section already owns a topic, the new page references and deepens — it does not re-pitch.

Three exceptions, all narrow:
1. A page may introduce a pattern the homepage does not need (e.g. a calculator on `/pricing` — already live and excluded from this bar's interaction rules where it has bespoke needs).
2. A page may legitimately need a new copy register only where its audience differs (e.g. the legal pages on `/terms`, `/privacy`). The voice still applies; the register may relax.
3. A page may use a different layout shape when the homepage's composed-grid pattern would force content that does not exist (e.g. a single-column long-form article). The polish bar still applies to whatever shapes the page uses.

Everything else — entrance pattern, hover behaviour, accordion motion, depth strategy, voice, accuracy locks — is shared.

---

## 1. POLISH BAR

### 1.1 Entrance pattern

**Source:** `lib/motion.ts`. Every section uses these exports — no per-section re-declarations.

| Export | Value | Where used |
|---|---|---|
| `EASE_OUT` | `[0.4, 0, 0.2, 1]` (cubic-bezier) | All transitions where motion enters or settles |
| `FADE_UP` | `opacity 0 → 1`, `y 14 → 0`, `duration 0.45`, ease `EASE_OUT` | Single-element fade-in on scroll-into-view |
| `STAGGER_PARENT` | `staggerChildren: 0.07`, `delayChildren: 0.15` | Parent that should fade its children in sequence |
| `SCROLL_VIEWPORT` | `{ once: true, margin: "-80px" }` | The viewport prop passed to every `whileInView` |
| `FADE_UP_REDUCED` / `STAGGER_PARENT_REDUCED` | `y 0`, `duration 0`, `staggerChildren 0` | Reduced-motion fallback variants |

**The pattern:**

```tsx
import { motion } from "framer-motion";
import { FADE_UP, SCROLL_VIEWPORT } from "@/lib/motion";

<motion.div
  initial="hidden"
  whileInView="visible"
  viewport={SCROLL_VIEWPORT}
  variants={FADE_UP}
>
  …
</motion.div>
```

**Properties of the pattern (non-negotiable):**

- **Scroll-into-view, once.** `viewport.once: true`. Sections never re-trigger on scroll-back. Looping a section's entrance is forbidden.
- **Fade plus 14px y-lift.** Never `x`, never `scale`, never rotation. The entrance is always vertical.
- **0.45s duration with cubic-bezier ease-out.** No 0.3s "snappy" overrides; no 0.7s "premium" overrides. Consistency is the bar.
- **Children stagger at 0.07s with 0.15s lead-in delay.** This is the parent-child cadence. Use `STAGGER_PARENT` on the wrapper and `FADE_UP` on each child.
- **`-80px` viewport margin.** Triggers entrance shortly before the section's top edge enters the visible area, never on first paint.
- **Reduced-motion fallback.** `useReducedMotion()` from framer-motion is honoured. Where a section sets variants directly (rather than via shared exports), it must short-circuit to `FADE_UP_REDUCED`/`STAGGER_PARENT_REDUCED` — see `FAQ.tsx` for the precedent.

**Bespoke entrances that exist and are deliberate (do not generalise to other pages):**

- `Hero.tsx` runs a choreographed entrance (eyebrow → headline → body → CTAs → metric chips) keyed off mount, not scroll. This is intentional: the hero is the page's first paint and `whileInView` would no-op. Hero entrances live in `Hero.tsx` and stay there.
- `ProofStrip.tsx`'s `AnimatedStat` uses an imperative count-up (`useEffect` + `requestAnimationFrame`) over 850ms ease-out cubic. This is a number-tween, not a layout entrance, and follows the same precedent as the agent-app's `useCountUp` hook (see `ANIMATION_STANDARDS.md` §B1). New pages may borrow the pattern for numerical reveals; they do not re-invent it.
- `PortalSection.tsx`'s `PortalPhoneMockup` runs a 1.2s ease-out cubic progress-ring draw-on after a 300ms settle, triggered on `useInView`. Same precedent as `ANIMATION_STANDARDS.md` §A6.

### 1.2 Interaction patterns

**Card hover lift — the canonical pattern.**

```css
/* From components/home/TheChoice.tsx — the canonical version */
.either-card {
  transition:
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}
.either-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255,107,74,0.35);
  box-shadow: 0 6px 20px rgba(255,107,74,0.10);
}
@media (prefers-reduced-motion: reduce) {
  .either-card, .either-card:hover { transform: none; }
}
```

`translateY(-2px)` + coral border tint + soft coral shadow + 220ms cubic-bezier. Reduced-motion suppresses the `translateY`. This is the contract any hoverable surface must meet. The same pattern is re-used at `PortalSection.tsx` (`.portal-card`) and adapted at `IntelligenceLayer.tsx` (`.intel-mockup` — 3px lift, white-tinted halo, 350ms).

**Coral accent usage.**

The coral token (`#FF6B4A`, `--color-coral` in `globals.css`) is the brand signal. Use it for:

- Section eyebrows (uppercase, 12px, 600, letter-spacing `0.10em` when `TYPOGRAPHY_POLISH` is true else `0.08em`)
- Active states on toggles, dots, and segment selectors
- Hover accents on cards (border + shadow tint, per the canonical lift)
- One headline word per section *only when the section's whole job is anchored on that word* — Hero highlights `silence`; no other home section recolours headline words. New pages should match this restraint.
- Status dots on dark surfaces ("Offer accepted", "On track")
- Primary CTAs on dark sections (solid `#FF6B4A` fill with `0 4px 20px rgba(255,107,74,0.35)` shadow at rest)

Do not use coral for:

- Body copy
- Section backgrounds (one full-coral section per page maximum — see FooterCTA precedent)
- Borders on neutral surfaces at rest
- Multiple eyebrow tints in a row (every eyebrow on the homepage is coral; do not introduce variant accent colours)

**Accordion motion — the canonical pattern.**

`FAQ.tsx` is the reference. Single-item-open, plus/minus rotates to ×, height + opacity tween via `AnimatePresence`. Real values:

```tsx
<motion.span animate={{ rotate: isOpen ? 45 : 0 }}
  transition={reduced ? { duration: 0 } : { duration: 0.20, ease: EASE_OUT }} />

<motion.div
  initial={reduced ? false : { height: 0, opacity: 0 }}
  animate={{ height: "auto", opacity: 1 }}
  exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
  transition={reduced ? { duration: 0 } : { duration: 0.28, ease: EASE_OUT }} />
```

200ms rotation, 280ms height/opacity, both ease-out cubic. Hover and open states both shift question + icon to coral via CSS sibling rules — do not re-implement the colour shift in JS. Reduced-motion: instant snap, no animation, no `initial`.

**Toggle / draggable-carousel motion — the canonical pattern.**

`TheChoice.tsx` per-sale toggle and `ProofStrip.tsx` testimonial carousel use the same spring and drag mechanic:

```ts
const SPRING = { type: "spring", stiffness: 380, damping: 36 };
// drag="x" with dragConstraints { left: -width * (N-1), right: 0 },
// dragElastic 0.15, dragMomentum: false,
// threshold = Math.min(width * 0.18, 80) for snap-on-release.
```

Any new draggable surface on a marketing page uses these values. Auto-advance (where present, as in `ProofStrip`) is 7000ms, pauses on hover, focus, and active drag.

**Press behaviour on CTAs.**

The homepage CTAs use a 200ms cubic-bezier(0.4, 0, 0.2, 1) `transition: all` on rest, with explicit inline-style backgrounds, colours, borders, and shadows. The `.cta` class family in `globals.css` (`.cta`, `.cta-primary-dark`, `.cta-secondary-dark`, `.cta-primary-coral`, `.cta-secondary-coral`) is the canonical *intended* press-down model (asymmetric 80ms-in / 200ms-out, `scale(0.97)` on `:active`, with hover state shifts) but is currently held in reserve — the four CTA reverts that landed pre-push restored inline styling for rendering reliability. New pages should:

- Use the inline-style CTA pattern when matching FooterCTA / PricingPreview's tier cards (this is what is in production and verified rendering correctly).
- Reach for the `.cta-*` classes only when introducing a new CTA shape that the homepage does not already cover, and verify it renders before locking in.

A future pass may re-canonicalise the `.cta-*` classes once the rendering issue is diagnosed. Until then, the inline-style pattern is the bar.

### 1.3 Visual-depth rules

**No flat sections.** Every section on the homepage has at least one layer of depth beyond the base fill. Audit any new section against this list before approving:

| Section | Depth strategy |
|---|---|
| Hero | Dark gradient + radial ambient glow (`rgba(59,130,246,0.07)` + `rgba(255,107,74,0.07)`) + SectionBackground particles + animated mockup right |
| TheChoice | White base + SectionBackground coral particles + draggable dark carousel + "Either way" glass cards |
| IntelligenceLayer | Dark gradient + coral ambient radial + SectionBackground scan grid + dashboard mockup right |
| ServiceSection | Off-white base (`#F8F9FB`) + SectionBackground dot grid + glass timeline mockup |
| PortalSection | White base + phone mockup right with animated ring + portal cards left |
| ProofStrip | Dark gradient + faint coral radial + SectionBackground aurora + count-up stats + draggable testimonial card |
| PricingPreview | Dark gradient + SectionBackground particles + two-tier composed cards with hover-state highlight |
| FAQ | White base + accordion rows with hover/open coral shift |
| FooterCTA | Coral gradient + radial highlight + SectionBackground liquid mesh + glass secondary CTA |

If a new page has a section that does not yet meet two depth strategies (composition + ambient, glass + animated content, mockup + framing, etc.), it has not cleared the bar.

**How dark vs light sections get depth.**

- **Dark sections** (`linear-gradient(160deg, #0d1117 0%, #0f1a2e 100%)` is the canonical surface): radial coral or blue ambient glow at 4–7% opacity + SectionBackground at the dark palette + mockups with glass borders. Text colour scale: `rgba(255,255,255,0.92)` for primary, `0.55–0.65` for body, `0.35` for meta, `0.18–0.28` for footer-fine-print.
- **Light sections** (`#fff` or `#F8F9FB`): SectionBackground at the light palette (very faint navy or coral tints, 4–10% opacity) + mockups with `1px solid #E2E8F0` borders + soft drop shadows + a single coral element to anchor the brand (eyebrow, status dot, accent stroke). Text scale: `#0d1117` primary, `#475569` body, `#94a3b8` meta.
- **Coral sections** (one per page, used at the close): white tints over the gradient for SectionBackground + radial highlight at 8% white + glass-tinted secondary buttons. Text: white at 100% for headline, white at 0.75 for body, 0.50 for fine print.

**Composed layout over stacked blocks.**

The homepage does not stack heading + paragraph + 3 feature boxes. Every section is composed — asymmetric grid with copy on one side and evidence on the other, or a single anchoring centerpiece below the copy. If a new section reads like "title, subtitle, three columns of features," it has not cleared the bar — find the centerpiece, find the composition.

**Uniform icons.**

Phosphor Icons throughout, `weight="regular"` is the default. SVG inline only when the icon is brand-specific or part of a mockup. No mixed icon libraries on the same page.

**Real evidence over coloured pills.**

ProofStrip uses styled wordmarks (`Akeman Residential`, `Via Properties`, `Oplah Estate Agents`, `Meldone Estates`) as a placeholder, with an `AgencyLogo` component that takes an optional `logoSrc` for real SVG drops. Once real logos exist, the placeholders go. Same rule applies to any new "trusted by" / "as featured in" / metric block: real evidence, or omit the section. A coloured text pill with an agency name is not evidence.

### 1.4 Shared tokens and classes

| Source | What it provides | Use it for |
|---|---|---|
| `lib/motion.ts` | `EASE_OUT`, `FADE_UP`, `STAGGER_PARENT`, `SCROLL_VIEWPORT`, reduced-motion fallbacks | Every entrance |
| `lib/pricing.ts` | `SELF_PRICE_DISPLAY`, `OUTSOURCED_RANGE_DISPLAY`, `OUTSOURCED_FROM_DISPLAY`, `OUTSOURCED_BANDS`, `outsourcedRate()` | Every price string |
| `lib/flags.ts` | `TYPOGRAPHY_POLISH` | Tracking and font-weight toggles for headings/eyebrows |
| `lib/backgrounds.tsx` + `components/ui/SectionBackground.tsx` | 20 ambient ideas + the per-section wrapper | Every section's depth layer |
| `lib/background-context.tsx` + `components/dev/BackgroundLab.tsx` | Global override picker | Dev-only — see in-file removal note before any prod-facing launch milestone |
| `app/globals.css` `@theme` block | Coral, accent, success, glass, label tokens | Brand palette across all pages |
| `app/globals.css` `.cta-*` family | Three-state CTA press model | New CTA shapes only; verify rendering before relying |
| Phosphor Icons `@phosphor-icons/react` | All UI icons | Consistency across the site |

**Per-section background defaults (from the homepage push):**

| Section | Default `idea` | Mode | Accent override |
|---|---|---|---|
| Hero | `particles` | `dark` | — |
| TheChoice | `particles` | `light` | `rgba(255,107,74,0.55)` |
| IntelligenceLayer | `scangrid` | `dark` | — |
| ServiceSection | `dotgrid` | `light` | — |
| PortalSection | (none) | `light` | — |
| ProofStrip | `aurora` | `dark` | — |
| PricingPreview | `particles` | `dark` | — |
| FAQ | (none) | `light` | — |
| FooterCTA | `liquid` | `coral` | — |

A new page chooses its own per-section ideas with the same constraints: at most one ambient idea per section, mode matches the section's base palette, and ideas can be omitted (Portal + FAQ precedent) when the content already carries the section. The BG Lab override remains the prototyping tool.

### 1.5 Cross-reference to `ANIMATION_STANDARDS.md`

The marketing site does not import `agent-system.css` and does not use the agent canonical classes (`.agent-acc`, `.agent-segment-pill`, etc.). The two systems are intentionally separate — agent surfaces a tool, marketing surfaces a pitch.

Patterns that **do** carry across, with the marketing site's equivalent:

| Agent canonical (`ANIMATION_STANDARDS.md`) | Marketing equivalent |
|---|---|
| `.agent-acc` / `.agent-acc-in` (accordion) | The `AnimatePresence` height+opacity pattern in `FAQ.tsx`. Same role, different mechanism — marketing uses framer-motion; agent uses CSS grid-template-rows. Do not import the agent class here. |
| `.agent-reveal-in` (inline reveal) | The `FADE_UP` variant in `lib/motion.ts` for any single-element appearance. |
| A6 progress ring draw-on | The phone-mockup ring in `PortalSection.tsx`. Same pattern (stroke-dashoffset transition with mount delay), implemented inline. |
| B1 number count-up | `AnimatedStat` in `ProofStrip.tsx`. Same idea, inline implementation. |
| Reduced-motion contract | Honoured via `useReducedMotion()` + the `FADE_UP_REDUCED` / `STAGGER_PARENT_REDUCED` exports. |

Marketing-only additions beyond `ANIMATION_STANDARDS.md`:

- **Per-section ambient backgrounds** (`SectionBackground` + `lib/backgrounds.tsx`). No agent-side equivalent — the agent app deliberately avoids ambient motion behind data.
- **Draggable horizontal carousels** with the `SPRING` snap + threshold pattern. No agent-side equivalent.
- **Composed scroll-into-view entrances** with `STAGGER_PARENT` on parents. The agent app uses canonical class entrances per-element; the marketing site uses framer-motion variants.

---

## 2. LANGUAGE BAR

### 2.1 Voice — homepage register

The voice baseline established in `VOICE_GUIDELINES.md` applies. The homepage adds five marketing-specific rules.

**Voice rule M1: pain-led but restrained.**

Every section opens with the reality the agency already lives with, then moves to what the product does about it. The pain is named once, calmly, in human language — never in scare-quotes, never with an exclamation mark, never twice in a row.

Examples from the homepage:

| Section | Pain beat | Resolution beat |
|---|---|---|
| Hero | "Follow every sale from start to finish, every step tracked as it happens." | "Your clients always know where their sale stands, and so do you, without chasing anyone for an update." |
| IntelligenceLayer | "Chasing the same solicitor for the third time. Scanning a list for the file that's gone quiet. Writing the same update three different ways." | "None of that needs a person, so the system does it, and the people handling your sales spend their time on the part that does." |
| PortalSection | "For a buyer or seller, this is the most stressful thing they'll do all year, and the worst part is the not knowing." | "The portal takes that away." |

The pain is owned by the agency, not blamed on them. Never "you've been doing this wrong." Always "you've been doing this hard."

**Voice rule M2: one emotional beat per section.**

Each section gets one feeling. Hero owns *relief* (the silence ends). TheChoice owns *control* (your call, sale by sale). IntelligenceLayer owns *recognition* (the admin isn't the job). ServiceSection owns *trust* (hand it over, stay in the picture). PortalSection owns *care* (no more lying awake wondering). ProofStrip owns *credibility* (real numbers, real names). PricingPreview owns *fairness* (pay on exchange, nothing else). FAQ owns *answers*. FooterCTA owns *invitation* (seen through).

A new page section that tries to land two feelings has not cleared the bar. Find the one. Cut the other or move it to a different section.

**Voice rule M3: human-first phrasing.**

The homepage never says "leverage," "ecosystem," "solution," "platform," "drive efficiency," "streamline workflows," or "unlock value." It says "your negotiators open one screen and see what needs them today." Test every sentence against this register before approving copy.

**Voice rule M4: no em dashes (—).**

Already enforced. The homepage uses commas, full stops, colons, parentheses, and the occasional semicolon. Em dashes are a tell of LLM drafting. Strip them on every pass.

**Voice rule M5: no schema jargon as user-facing nouns.**

Adopted from `VOICE_GUIDELINES.md` Rule 2. The marketing site translation table:

| Schema / internal term | Marketing equivalent | Notes |
|---|---|---|
| Milestone | **Step** | Same as agent-app. Homepage uses "every step tracked as it happens," "step tracking" in FAQ. |
| Transaction | **Sale** (for the event), **file** (for the record) | "Your sale," "the file," "active files." Never "transaction." |
| MilestoneCompletion | (omit) | Marketing never names this concept. |
| ServiceType / self_managed / outsourced | "Your team handles it" / "We handle it" | These are the canonical UI labels in `TheChoice.tsx`. |
| progressedBy / assignedTo | "Our team" / "Your team" | Always relational, never role-name. |
| sales_progressor (role) | "Our team," "the progressor on it" | Context-dependent. |
| Director / Negotiator | (not surfaced) | These roles do not appear in marketing copy. |
| ReminderLog / ChaseTask | "Chase," "chases" | Direct. Used as a verb where possible. |

### 2.2 Accuracy locks (non-negotiable)

These are facts about the product that the homepage states correctly and that every other page must match:

1. **"Pay on exchange," not "on completion."** Self tier is `£59 charged on exchange`; outsourced tiers are charged on exchange. Never "on completion." The product's billing trigger is exchange.
2. **All prices source from `lib/pricing.ts`.** `SELF_PRICE_DISPLAY`, `OUTSOURCED_RANGE_DISPLAY`, `OUTSOURCED_FROM_DISPLAY`, `OUTSOURCED_BANDS[i].priceDisplay`, `OUTSOURCED_BANDS[i].rangeLabel`. Never hand-type a price string. Never compose a band range manually.
3. **Not VAT registered.** Remove "+ VAT," "inc VAT," "ex VAT," "inclusive of VAT" from any new page. The `/pricing` page still carries VAT references that are scheduled for removal — do not propagate them.
4. **"Step," not "milestone," in visible copy.** Internal code may still use `milestone`; user-facing strings say `step`. Audit every new page.
5. **Sale falls through → nothing is charged.** "No exchange, no fee." The phrasing varies; the meaning is locked. Do not introduce hedges or asterisks.
6. **No contracts, no minimum, no setup fee.** Stated three times on the homepage (Hero strip, PricingPreview fine print, FAQ Q2). New pages can reference but must not contradict.

### 2.3 Earn-its-keep

Every new section must answer in one sentence: *what does this section do that no other section on this page, or any other page on the site, already does?*

If the answer is "it restates the value prop with different words," the section is cut.
If the answer is "it deepens one of the homepage beats," the section is approved — provided it deepens, not repeats. Deepening means: more detail, more proof, more specifics. Repeating means: same beat with synonyms.

Examples of legitimate deepening:

- `/pricing` deepens PricingPreview by adding the band table, the calculator, the comparison columns, and the full FAQ.
- `/how-it-works` would deepen IntelligenceLayer + ServiceSection by walking the day-1-to-exchange sequence rather than naming the beats.
- `/about` deepens nothing on the homepage; it adds founder, story, and provenance.

If a new section duplicates a beat the homepage already owns — *and* the page is not legitimately deeper on that beat — it gets cut or merged.

### 2.4 No-duplication

Before writing any new section, check it against `homepage-content-reference.md` (to be created during the first non-homepage page's Stage 1; see §3 below). That doc is the canonical map of "which homepage section owns which topic." A new section cannot own a topic the homepage already owns unless it deepens.

The same rule extends across the site: as each non-homepage page locks, its owned topics are appended to `homepage-content-reference.md`. The doc is the site-wide topic map.

---

## 3. WORKING METHOD (per page)

Every non-homepage marketing page follows this method. Method is shared with the agent-app polish workflow (see `WORKFLOW.md`) but trimmed to marketing realities — no inventory CSV, no test-page detour, no separate Stage 4 gate.

### Stage 1 — Investigation (read-only)

Read the live page in production. Read the source files. Read every cross-referenced helper. Produce a short audit covering:

- **Sections.** What sections does the page have, what's their order, what's each section's one job.
- **Polish gaps.** Where does the page miss the polish bar? Specifically: entrance pattern, hover lift, accordion motion, depth strategy, shared-token usage.
- **Language gaps.** Where does the page miss the language bar? Em dashes, schema jargon, accuracy locks, em-dash hygiene, pain-led restraint.
- **Duplication.** Which sections duplicate homepage beats without deepening? Which are candidates for cut or merge?
- **Earn-its-keep failures.** Which sections fail the one-sentence test?

No edits in Stage 1. Sign-off gate: post the audit, wait for Ellis's explicit approval.

### Stage 2 — Section-by-section copy + polish

Work through the page section by section in document order. For each section:

1. Lock the copy first (voice, accuracy, earn-its-keep), then the polish (entrance, hover, depth, tokens).
2. Commit each section as its own atomic change to staging.
3. Cite the homepage precedent in the commit message ("Matches `TheChoice.tsx` either-card hover lift").

Sections that get cut go out in their own commit, with a one-line reason.

### Stage 3 — Push

Once every section on the page is locked, run `tsc --noEmit`, eye the page on localhost, push to production via `vercel deploy --prod --yes`. The marketing site has no separate staging environment beyond Vercel previews; the preview URL plus eyeballing on `www.thesalesprogressor.co.uk` after push is sufficient given the site's pre-launch stage and ~5 test-user audience.

Two specific verifications must happen on prod:

1. **Visual polish bar.** Open the homepage and the new page in adjacent tabs. The new page must not visibly degrade the homepage's polish in any side-by-side comparison.
2. **Accuracy locks.** Search the rendered page (Ctrl+F) for "completion," "milestone," "VAT," em dashes (`—`). All must return zero matches except where deliberately retained and noted.

### Stage 4 — Update the topic map

After push, update `homepage-content-reference.md`:

- Add the page's locked sections to the topic map.
- Note which homepage beats the page deepens.
- Note any new topics the page owns that the homepage does not touch.

This doc accrues page by page. By the time the last marketing page locks, it is the canonical map of the entire marketing site's information architecture and is the first thing read by any new page's Stage 1.

### Stage 5 — Changelog this doc

If the new page reveals a polish or language rule that should be added to this Page Standard (a new canonical interaction, a new accuracy lock, a new voice rule), add it under the relevant section and append a changelog entry below. The bar evolves; it does not slip.

---

## Changelog

| Date | Change |
|---|---|
| 2026-05-31 | Initial extraction from the live homepage push. Locks: entrance pattern (`lib/motion.ts`), card hover lift (`TheChoice.tsx`), accordion motion (`FAQ.tsx`), draggable carousel mechanic (`SPRING` constant in `TheChoice` + `ProofStrip`), per-section background defaults, voice rules M1–M5, accuracy locks 1–6, working method Stages 1–5. CTA classes (`.cta-*`) noted as in-reserve pending rendering diagnosis. |
