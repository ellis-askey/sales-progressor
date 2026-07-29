# Coverage map — screenshots + Playwright vs the 69 conditionals

**Purpose:** call out every audit conditional (C1–C69) with its coverage source, so blind spots are visible **before** Phase 2 rather than after.

**Legend:**
- 📸 = covered by a baseline screenshot
- 🤖 = covered by a Playwright assertion in `surface-agent-hub-migration.spec.ts`
- 👁 = manual only (walked in [05-verification-checklist.md](05-verification-checklist.md))
- ⚠️ = fixture gap — cannot capture until fixture added
- 💤 = **BLIND SPOT** — neither 📸 nor 🤖. Relies purely on manual walk.

**Convention:** if a conditional is covered by both a screenshot AND a Playwright assertion, that's the strongest state. Aim for 👁 only where the state is genuinely un-capturable (e.g. a variant that requires a synthetic billing state you don't have).

---

## Coverage table

| # | Conditional | Screenshots | Playwright | Manual | Notes |
|---|---|---|---|---|---|
| C1 | Empty state fires | 📸 director--empty--desktop / mobile | 🤖 director empty branch + SP empty branch | 👁 | Both branches asserted via `hub-empty-state` testid |
| C2 | "New sale" button (canCreateSale) | 📸 (visible in director populated) | 🤖 director populated + admin populated + hybrid SP-admin (assert absent) + SP empty (assert absent) | 👁 | |
| C3 | "Send a note" (!isInternalStaff) | 📸 director populated | 🤖 director populated + admin (assert absent) + SP hybrid (assert absent) + viewer (assert absent) | 👁 | |
| C4 | Welcome copy variant | 📸 director--empty + SP--empty | 🤖 both branches asserted | 👁 | |
| C5 | Welcome subtitle variant | 📸 director--empty + SP--empty | 🤖 SP empty test asserts absence of agent copy | 👁 | |
| C6 | "Add a sale" in welcome (canCreateSale) | 📸 director--empty | 🤖 director empty test | 👁 | |
| C7 | PaymentBlockBanner outer | ⚠️ needs payment-block fixture | ⚠️ (no fixture on staging) | 👁 | **BLIND SPOT** in automation until fixture; screenshot listed but likely un-capturable today. Rely on manual walk. |
| C8 | PaymentBlockBanner blocked variant | ⚠️ | ⚠️ | 👁 | Same |
| C9 | PaymentBlockBanner warning variant | ⚠️ | ⚠️ | 👁 | Same |
| C10 | PaymentMethodNudge outer | ⚠️ | ⚠️ | 👁 | Same |
| C11 | Nudge — legacy tier gate | 💤 | 💤 | 👁 | **BLIND SPOT** — requires very specific billing state |
| C12 | Nudge — early return stripeCustomer set | 💤 | 💤 | 👁 | **BLIND SPOT** — the "no-nudge because card exists" is the current default; asserted only by its non-appearance |
| C13 | Nudge — pre-submission | 💤 | 💤 | 👁 | **BLIND SPOT** |
| C14 | Nudge — trial+7d gate | 💤 | 💤 | 👁 | **BLIND SPOT** |
| C15 | Today's diary card | 📸 director populated (if diary items) | 🤖 (via absence-negation only in empty test) | 👁 | Populated diary needs fixture with events dated today — this is time-of-day dependent. Add screenshot when captured. |
| C16 | Diary row per-type styling (green vs coral) | 📸 director populated | 💤 | 👁 | **PARTIAL BLIND SPOT** — spec asserts nothing about diary row styling because that would rely on CSS class inspection (banned). Manual walk only. |
| C17 | Diary events pill text singular/plural | 💤 | 💤 | 👁 | **BLIND SPOT** — requires exactly-1-item AND multi-item diary states |
| C18 | Diary placeholder guard (twelve-week target dedup) | 💤 | 💤 | 👁 | **BLIND SPOT** — data-shape dependent |
| C19 | ExpiredHoldsCard self-hide when empty | 📸 director--empty (implicitly — no card) | 🤖 (skipped when no extender visible; else asserted) | 👁 | The self-hide is asserted implicitly — the extender test skips if no fixture. Manual walk for the "no expired holds" state. |
| C20 | Extender inline mode toggle | ⚠️ | 🤖 (`hub-expired-holds-extender` visible after click) | 👁 | Needs expired-holds fixture — via demo-seed on_hold aging past return date |
| C21 | Extender validity (past date rejected) | 💤 | 💤 | 👁 | **BLIND SPOT** — would require submitting invalid date which is destructive |
| C22 | Attention items visible (first 3) | 📸 director populated | 🤖 asserts "Needs your attention" header presence | 👁 | Spec asserts header only; item-count assertion could be added but requires stable fixture |
| C23 | "All reminders" link when items > 0 | 📸 (visible in populated) | 💤 | 👁 | **PARTIAL BLIND SPOT** — link exists in populated state but no explicit assertion; manual verify |
| C24 | Attention empty state (green dot "All clear") | 💤 | 💤 | 👁 | **BLIND SPOT** — requires director with 0 attention items but > 0 files |
| C25 | Escalated tooltip content | 💤 | 💤 | 👁 | **BLIND SPOT** — tooltip content is a title attribute; would need `page.locator("[title*=...]")` which is fragile |
| C26 | Unassigned self-hide (director) | 📸 director populated (no widget) | 🤖 director asserts absent + admin asserts present (if fixture) | 👁 | |
| C27 | Unassigned agency name secondary line | 💤 | 💤 | 👁 | **BLIND SPOT** — requires fixture with cross-agency file for admin |
| C28 | Unassigned assign dropdown toggle | 💤 | 💤 | 👁 | **BLIND SPOT** — behaviour not asserted; manual walk |
| C29 | Unassigned data lazy-fetch | 💤 | 💤 | 👁 | **BLIND SPOT** — network waterfall not asserted |
| C30 | NewBuyers self-hide (agents) | 📸 director populated (no widget) | 🤖 director asserts absent | 👁 | |
| C31 | ChainSetup self-hide when empty | 📸 (implicit) | 💤 | 👁 | **PARTIAL BLIND SPOT** — no explicit assertion; manual walk |
| C32 | PipelineAtAGlance empty content | 📸 director--empty (ghost variant) | 💤 | 👁 | **PARTIAL BLIND SPOT** — no explicit empty-copy assertion |
| C33 | PipelineStageHover empty branch (per stage) | 💤 | 💤 | 👁 | **BLIND SPOT** — 5 popover empty-state variants, hover-triggered, not asserted |
| C34 | Stage popover tone (quiet/overdue/SLA colour) | 💤 | 💤 | 👁 | **BLIND SPOT** — colour assertions banned; manual walk |
| C35 | Bubble placement (above vs below anchor) | 💤 | 💤 | 👁 | **BLIND SPOT** — pixel-position dependent |
| C36 | Pipeline health subtitle role variants | 📸 all role screenshots | 🤖 director + admin + hybrid SP-admin + pure SP | 👁 | Viewer variant NOT asserted explicitly (viewer test asserts absence of other variants) |
| C37 | Active files tile href | 📸 (visible) | 🤖 director asserts href | 👁 | |
| C38 | Active files delta (+N this month) | 💤 | 💤 | 👁 | **BLIND SPOT** — delta text is data-dependent |
| C39 | Exchanging soon tile link vs static | 💤 | 💤 | 👁 | **BLIND SPOT** — count-dependent |
| C40 | Exchanging soon delta (N this week) | 💤 | 💤 | 👁 | **BLIND SPOT** — data-dependent |
| C41 | Need attention colour (red/warning/primary) | 📸 populated | 💤 | 👁 | **BLIND SPOT in spec** — colour banned; manual walk |
| C42 | Need attention href | 💤 | 💤 | 👁 | **PARTIAL BLIND SPOT** — could add assertion |
| C43 | Need attention delta text | 💤 | 💤 | 👁 | **BLIND SPOT** — data-dependent copy |
| C44 | Pipeline value delta | 💤 | 💤 | 👁 | **BLIND SPOT** — data-dependent |
| C45 | Coming-up strip 3 links | 📸 populated | 🤖 director asserts all 3 links | 👁 | |
| C46 | Stalled empty branch | 💤 | 💤 | 👁 | **BLIND SPOT** — "All files have recent activity" copy |
| C47 | Stalled populated link | 💤 | 💤 | 👁 | **BLIND SPOT** — count-dependent |
| C48 | Grid columns (1fr vs 1fr 1fr) | 📸 SP--populated | 💤 | 👁 | **BLIND SPOT in spec** — grid width is CSS/structural (banned assertion); assert implicit via service-split absence |
| C49 | Exchange forecast subtitle variants | 📸 all roles | 🤖 director + admin | 👁 | SP + viewer + superadmin variants NOT explicit; asserted by absence pattern |
| C50 | Exchange forecast empty (next30 === 0) | 💤 | 💤 | 👁 | **BLIND SPOT** — needs fixture with 0 upcoming exchanges |
| C51 | Forecast week label colour (current week) | 💤 | 💤 | 👁 | **BLIND SPOT** — colour |
| C52 | "This week" count colour | 💤 | 💤 | 👁 | **BLIND SPOT** — colour + data |
| C53 | Ready-check nudge (next7Days > 0) | 💤 | 💤 | 👁 | **BLIND SPOT** — data-dependent |
| C54 | Nudge singular/plural | 💤 | 💤 | 👁 | **BLIND SPOT** |
| C55 | Service split card visible/hidden | 📸 director + SP populated (both variants) | 🤖 director + admin + hybrid SP-admin (all visible) + pure SP (hidden) | 👁 | Strong coverage |
| C56 | Service split labels (admin vs agent) | 📸 (visible in both roles) | 🤖 director agent labels + admin/hybrid admin labels | 👁 | Strong coverage |
| C57 | Service info pill vs muted line | 💤 | 💤 | 👁 | **BLIND SPOT** — outsourced-count-dependent |
| C58 | Info pill copy variant | 💤 | 💤 | 👁 | **BLIND SPOT** — data-dependent |
| C59 | Saved hours mention | 💤 | 💤 | 👁 | **BLIND SPOT** |
| C60 | "self-managed by their agencies" admin plural | 💤 | 💤 | 👁 | **BLIND SPOT** |
| C61 | Activity ribbon (recentActivity truthy) | 📸 populated | 💤 | 👁 | **PARTIAL BLIND SPOT** |
| C62 | Activity glyph selection per kind | 💤 | 💤 | 👁 | **BLIND SPOT** — icon assertions banned; description-based |
| C63 | Pro tip cascade — stalled tier | 💤 | 🤖 (pro tip visible) but not tier | 👁 | **PARTIAL** — testid visible asserted; tier only via manual |
| C64 | Pro tip cascade — escalated tier | 💤 | 🤖 pro tip visible | 👁 | Same |
| C65 | Pro tip cascade — exchanging tier | 💤 | 🤖 | 👁 | Same |
| C66 | Pro tip cascade — attention tier | 💤 | 🤖 | 👁 | Same |
| C67 | Pro tip healthy tier role variants | 💤 | 🤖 director tier visible | 👁 | Copy + href variants NOT asserted per role — data-dependent + copy sensitive |
| C68 | Pro tip render when tip !== null | 📸 populated | 🤖 asserts hub-pro-tip visible | 👁 | |
| C69 | Pro tip Link vs div wrapper | 💤 | 💤 | 👁 | **BLIND SPOT** — element type not asserted |

---

## Summary — coverage tiers

- **Strongly covered (both 📸 + 🤖):** C1, C2, C3, C4, C6, C26, C30, C36 (partial), C37, C45, C49 (partial), C55, C56, C68 — **14 conditionals**
- **Screenshot only, no spec:** C5, C15, C16, C22, C23, C32, C41, C48, C61 — **9 conditionals** (spec-untestable or copy/colour-only)
- **Spec only, no screenshot:** C20 — **1 conditional** (behaviour-based)
- **BLIND SPOTS — neither screenshot nor spec:** C7, C8, C9, C10, C11, C12, C13, C14, C17, C18, C21, C24, C25, C27, C28, C29, C31, C33, C34, C35, C38, C39, C40, C42, C43, C44, C46, C47, C50, C51, C52, C53, C54, C57, C58, C59, C60, C62, C67 (partial), C69 — **~40 conditionals rely on the manual walk in [05-verification-checklist.md](05-verification-checklist.md)**

**~14 fully covered, ~15 partially, ~40 manual-only.**

## Why 40 conditionals are manual-only — categorised

1. **Data-dependent copy** (~15 conditionals) — delta text, singular/plural, saved-hours count, etc. Would need to synthesise exact fixture data + assert the exact string. Trade-off: adds brittleness for marginal value. Manual walk during Phase 4 covers.
2. **Colour / CSS assertions banned** (~8 conditionals) — Ellis's rule (a) rules these out of the spec. Manual walk verifies visually.
3. **Hover / focus behaviour** (~5 conditionals) — stage popovers, escalated tooltip, extender lazy content. Automation-fragile; manual walk verifies.
4. **Fixture-gap conditionals** (~8 conditionals) — payment states, empty attention, exact chain-declined states. Waiting on `scripts/seed-hub-fixtures.ts`. Once fixtures land, some of these can move into the spec.
5. **Structural / pixel-position** (~4 conditionals) — grid layout, bubble above/below anchor, element type (Link vs div). Ellis's rule (a) rules these out.

## Actionable — before Phase 4 sign-off

1. **Manual walk** [05-verification-checklist.md](05-verification-checklist.md) row-by-row on `/agent/hub-preview` covers all 40 blind spots. **This is the load-bearing verification step**; the automation is the sentinel, not the proof.
2. **Fixture seeding** via `scripts/seed-hub-fixtures.ts` (Phase 1d, still owed) unlocks:
   - Payment-block + payment-nudge states → C7–C14 become testable
   - Empty attention → C24 testable
   - Chain-declined link → variant of C30 testable
3. **Consider adding to the spec** (but only after Phase 4 sign-off, per the frozen policy):
   - `href` assertions for C39, C42 — easy and stable
   - Attention item count for C22
   - "All reminders" link for C23

## What to tell the reviewer

If asked "is this migration 100% automated-verified?" the honest answer is **no**. It's **14 / 69 automated + 15 partial + 40 walked**. The migration ships when the walk is done, not when the automation is green.

The automation exists to catch the specific regressions that killed prior kinetic attempts (extend-hold-with-date + niche control existence). Its purpose is regression sentinel, not primary verification. Read [05-verification-checklist.md](05-verification-checklist.md) as the primary; read this spec as the safety net.
