# Standards discovery — 2026-06-07

Read-only investigation. Surfacing what SP already does, not what it should do. The goal is to crystallise the rules already in force so future builds can lean on them; nothing is recommended for formalisation here — Ellis decides afterwards which observations are worth promoting into a `DEFINITION_OF_DONE.md`, `VOICE.md`, `DECISIONS.log` or similar.

Every claim cites a real file path or commit. Where a pattern is verbal-only (enforced in chat across sessions but not written down anywhere), it's flagged **⚑ unwritten** so it surfaces as a high-value candidate for formalisation.

---

## Headline findings

1. **There is no Definition of Done document, but there's a very consistent empirical one.** Across the buyer-round, client-chase, payments, email, and chain arcs the same six gates appear: tsc clean → staging-first migration → verification harness with explicit pass count → backfill + write-path in lockstep → dry-run → apply → re-dry-run zero. None of that is in `CLAUDE.md` today. ⚑ unwritten.

2. **Voice rules are enforced more strictly than they're documented.** The em-dash ban only became a written rule on 2026-06-07 (commit `8ad3501`). The "no exclamation marks", "no system self-references", "round → sale" terminology sweep all live as inline code comments rather than a `VOICE.md`. The strings ship; the rules aren't re-findable. ⚑ unwritten.

3. **Visual language has a canonical pattern and a clear set of outliers.** `agent-btn` + size + colour is canonical for buttons (106 uses), `AgentBanner` is canonical for banners (4 wrappers), `glass-card` is canonical for cards (130 uses), `agent-modal-in` 240ms animation is canonical for modals. The outliers (e.g. `agent-btn-color-primary` alongside `agent-btn-primary`, modal z-index 50/1500/2000 all in play) are exactly the kind of drift a `COMPONENTS.md` would catch.

4. **Multi-tenancy is documented better than anything else in the repo.** CLAUDE.md Rule 7, AGENT_SECURITY.md, the access-scope helper, the per-package scope docs — five separate documents re-state the same rule from different angles. Of everything surveyed, this is the most-formalised single principle.

5. **"Recurring decisions" exist as a class but have nowhere to live.** Things Ellis decided once and then re-decided five times (locked-copy convention, structured-return-not-throw for server actions, the wipe-and-reseed fixture protocol, the staging-first-with-named-staging-merge convention) leave no audit trail. A DECISIONS.log would absorb them.

6. **The biggest existing standard is invisible.** [`docs/active/drawers-modals/design-proposal.md`](docs/active/drawers-modals/design-proposal.md) is 1,224 lines of locked drawer/modal design system — shared primitives, header variants, CTA footer patterns, spacing tokens, animation timings. Nothing in `CLAUDE.md` or the project index points to it. *(Resolved 2026-06-07: moved to [`docs/reference/MODAL_DRAWER_SYSTEM.md`](../reference/MODAL_DRAWER_SYSTEM.md), linked from CLAUDE.md, indexed in [`MODAL_DRAWER_INDEX.md`](../reference/MODAL_DRAWER_INDEX.md).)*

7. **There are two card systems running in parallel.** `glass-card` (130 uses, defined in globals.css) and `agent-glass*` (4 variants, defined in agent-system.css) both render frosted surfaces. No code or doc says which to reach for. Identified by the UI survey, not by any failing test.

8. **The em-dash sweep that just shipped is the most discoverable voice-rule artifact in the repo.** Commits `e009f47` (voice sweep), `3a56a04` (variant alignment), `1c517e7` (signed audit), `8ad3501` (option B ban) form an unintentional 4-commit story of how voice gets enforced. The pattern works; it isn't written down anywhere.

---

## Method

Three parallel sweeps, then a synthesis pass against arc history.

**Sweep A** — Inventory every `.md` file that constitutes a standard, convention, or instruction.
**Sweep B** — Pull ~20–30 client-facing strings from emails, modals, toasts, banners, notifications. Catalogue recurring phrases, deliberate omissions, casing patterns, register.
**Sweep C** — Survey buttons, modals, cards, chips, banners. Count variants, identify canonicals, flag outliers.
**Synthesis** — Walk the last six arcs (buyer-round Phase-1/2/3 + Pass 3a/b/c, client-chase A1–A6, client-chase B1–B7, payments Stage 1–4, email arc Commits 1–6, chain closed-loop arc) via commit log + arc docs to extract what Ellis has actually required before approval.

---

## 1. Existing standards-and-conventions inventory

These are files that tell the AI assistant (or a future developer) what to do, in priority order of how often they bind future work.

### Project-root binding

- **[`CLAUDE.md`](CLAUDE.md)** (329 lines) — Persistent context for every session. 11 development rules + 5 hard rules covering role architecture, multi-tenancy, migration discipline, brand consistency, scope discipline, anti-drift, raw-evidence requirement. This is the closest thing SP has to a master rulebook.

### Visual / interaction

- **[`docs/VISUAL_DIRECTION.md`](docs/VISUAL_DIRECTION.md)** (454 lines) — Mandates premium aesthetic, warm cream + coral primary, glass surfaces. Component consistency rules (line 403+), implementation rules (line 423+). Binds every agent-facing screen.
- **[`docs/ANIMATION_STANDARDS.md`](docs/ANIMATION_STANDARDS.md)** (104 lines) — Canonical animation classes (no inline keyframes). 150ms entry, two-step exit with pointer-events guard, reduced-motion override at the CSS layer.
- **[`docs/reference/MODAL_DRAWER_SYSTEM.md`](../reference/MODAL_DRAWER_SYSTEM.md)** (1,224 lines, moved 2026-06-07 from `docs/active/drawers-modals/design-proposal.md`) — Locked drawer/modal design system. Shared primitives, three header variants, four CTA footer patterns, medium theming rule (line 475), 280ms spring curve, per-component migration order (Phase 1–7). Now linked from CLAUDE.md and indexed in [`MODAL_DRAWER_INDEX.md`](../reference/MODAL_DRAWER_INDEX.md).

### Domain truth

- **[`docs/MILESTONES_SPEC_v1.md`](docs/MILESTONES_SPEC_v1.md)** — Milestone engine state machine, predecessors, gating behaviour. Source of truth for the milestone arc.
- **[`docs/MILESTONES_WEIGHTS_v1.md`](docs/MILESTONES_WEIGHTS_v1.md)** (175 lines) — Progress calculation. Per-side dynamic denominators, edge cases. Cited from every progress-related fix.
- **[`docs/reference/PRODUCT_TRUTH.md`](docs/reference/PRODUCT_TRUTH.md)** (205 lines) — What the system actually does. Includes a "misconceptions" section listing claims **not** to write into marketing copy.
- **[`docs/reference/AGENT_SECURITY.md`](docs/reference/AGENT_SECURITY.md)** (99 lines) — Data isolation rules for `/agent/*` routes. Verified-safe patterns table, checklist, common pitfalls.

### Per-arc rule pockets

- **[`docs/active/package-d/scope.md`](docs/active/package-d/scope.md)** (322 lines) — Hard scope boundaries: "what is OUT" (line 26+), access-model matrix, anti-drift rules (line 289+), per-package Definition of Done (line 303–316).
- **[`docs/active/relist-feature/prod-release-runbook.md`](docs/active/relist-feature/prod-release-runbook.md)** — Step-by-step prod cutover for buyer-round arc. Explicit verification step between every action ("Every step has an explicit verification step that gates the next. Do not collapse them.")
- **[`docs/admin/README.md`](docs/admin/README.md)** (100 lines) — Command Centre conventions: all schema via Prisma migrations on staging first, all CC code under `lib/command/` + `app/command/`, all queries use `commandDb`, all meaningful actions write `AdminAuditLog`, every automation starts in shadow mode.

### AI prompt context (runtime-injected)

- **[`docs/chase-generation/MILESTONE_GLOSSARY.md`](docs/chase-generation/MILESTONE_GLOSSARY.md)** — Per-milestone framing rules for the AI chase generator. Default party-naming table to avoid perspective confusion. Loaded at runtime by `lib/chase/milestone-glossary.ts`.

### Cross-cutting patterns in the inventory

- **Five separate docs re-state multi-tenancy.** CLAUDE.md Rule 7, CLAUDE.md Rule 8, AGENT_SECURITY.md, package-d/scope.md §4, the access-scope helper file itself. The rule is well-known and consistently restated; it isn't fragile.
- **Three docs prescribe visual unification.** VISUAL_DIRECTION.md (palette + aesthetic), ANIMATION_STANDARDS.md (timing + classes), drawers-modals/design-proposal.md (primitives). Together they lock the agent app's visual language. But VISUAL_DIRECTION → ANIMATION_STANDARDS → drawers-modals/design-proposal is not a documented reading order.
- **Two docs use a "what is OUT" explicit-exclusion list.** package-d/scope.md §2, drawers-modals/design-proposal.md Phase 10 anti-drift rules. Both pre-emptively enumerate tempting features that are forbidden. The pattern works; it's not generalised into a rule for new scope docs.

### Files conspicuously absent

- No `DEFINITION_OF_DONE.md`.
- No `VOICE.md` or `COPY_GUIDELINES.md`.
- No `COMPONENTS.md` (canonical primitives index).
- No `DECISIONS.log` or `ADR/` directory.
- No `REVIEW_CHECKLIST.md`.

---

## 2. Voice patterns — observed

The voice has been swept three times in the last week (commits `e009f47`, `1c517e7`, `8ad3501`). The "house voice" is now strongly self-consistent in cascade emails, less so elsewhere.

### A. Recurring phrases (and where they appear)

- **"Open the chain"** as the canonical email CTA. [`lib/email/chainNotifications.ts:84, 104, 124, 170, 190, 210`]
- **"your client"** / **"your client's"** as the relational framing on agent-to-agent emails. [`lib/email/chainNotifications.ts:83, 103, 124`]
- **"pulled out"** / **"fell through"** as the event verbs. [`lib/email/chainNotifications.ts:81, 83, 101`, `components/transaction/RelistBanner.tsx:32`, `components/transaction/StatusControl.tsx:37, 42`]
- **"let us know"** as the follow-up. [`lib/email/chainNotifications.ts:84, 104, 124`]
- **"Chain update:"** as the push-notification prefix. [`lib/agent/push-events.ts:157–163`]
- **"We'll"** as the platform-action verb (never "the system will"). [`components/transaction/RelistFileModal.tsx:448–450`, `components/transaction/StatusControl.tsx:445`]

### B. Deliberately avoided

- **Exclamation marks.** Zero in shipped client-facing copy. The chain-emails comment block bakes this in: *"no exclamation marks"* [`lib/email/chainNotifications.ts:34`].
- **Em dashes in prose.** Banned 2026-06-07 (commit `8ad3501`). The relist modal and archived-round drawer comments call this out by name pre-ban [`components/transaction/RelistFileModal.tsx:10`, `components/transaction/ArchivedRoundDrawer.tsx:46`].
- **System self-references.** No "the system", "the platform", "automatically". Direct "we'll" instead.
- **"round" as a user-facing noun.** Replaced with "sale" in the 2026-06-04 terminology sweep [`components/hub/NewBuyersToAcknowledgeView.tsx:94`].
- **Titles (Mr./Mrs./Miss).** Stripped from rendered names via `TITLE_RE` regex [`components/transaction/ArchivedRoundDrawer.tsx:150`].
- **"Delete".** Replaced by "remove" in chain copy [`lib/email/chainNotifications.ts:453`].
- **Technical codes in user-facing strings.** Email subjects are plain English; status-machine enum values never surface.

### C. Sentence case vs title case

**Email subjects — sentence case throughout.**
- `Update on {address} — the buyer has pulled out` [`lib/email/chainNotifications.ts:81`]
- `Still waiting on {address}?` [`lib/email/chainNotifications.ts:207`]

**Banner titles — sentence case, terminal period.**
- `This sale fell through.` [`components/transaction/RelistBanner.tsx:32`]
- `This file is on hold.` [`components/transaction/OnHoldBanner.tsx:16`]

**Modal titles — imperative title-ish, no period.**
- `Mark as withdrawn` [`components/transaction/StatusControl.tsx:301`]
- `Put file on hold` [`components/transaction/StatusControl.tsx:439`]
- `Relist this sale` [`components/transaction/RelistFileModal.tsx:282`]

**Toast labels — terse, sentence case.**
- `File active`, `File on hold`, `Client emails resumed`, `Chase sent`, `Chain claimed`, `File created`.

**Eyebrow / section labels — UPPERCASE + letter-spaced.**
- `CARRIES OVER`, `STARTS FRESH` [`components/transaction/RelistFileModal.tsx:714, 732`]

**Push titles — colon-split: title-cased prefix + sentence continuation.**
- `Chain update: the buyer has pulled out`
- `Sale relisted` (no colon variant)
- `Exchange target: today` / `tomorrow` / `{n} days`

### D. House voice in one paragraph

Conversational but precise. Speaks from the agent's vantage point about *their* client. Uses passive constructions for celebratory news ("a new buyer has been secured" — not "we found a new buyer"). Past tense for events, forward-looking for actions. Calm even when the message is bad. Errors apologise without blaming ("Couldn't update status, try again"). Avoids all hedging language ("kind of", "perhaps", "we think").

Representative samples:
- *"The buyer for your client's property at {address} has pulled out of the chain. Open the chain to let us know what's next, find a new buyer, or withdraw."* [`lib/email/chainNotifications.ts:83–84`]
- *"When you find a new buyer, relist the sale. The new buyer's steps start fresh, and the seller keeps everything that doesn't depend on the buyer."* [`components/transaction/RelistBanner.tsx:33`]
- *"Couldn't update status, try again."* [`components/transaction/StatusControl.tsx:173`]

### E. Voice inconsistencies surfaced by the sweep

- **OnHoldBanner is colder than RelistBanner.** OnHoldBanner uses procedural list-with-colons: *"All automation is frozen: no client emails, no agent reminders, no escalations."* RelistBanner uses warm forward-looking prose. Both describe equally-significant file-state changes. [`components/transaction/OnHoldBanner.tsx:17` vs `components/transaction/RelistBanner.tsx:33`]
- **One toast still uses an em-dash separator.** `Chased — next in {n} days` [`components/reminders/RemindersSection.tsx:731`] — survived the em-dash sweep because it's a toast, not chain copy. ⚑ Caught by survey, not by ban scope.
- **Modal verbs split between "Mark X" and "Put X" and "Take X off Y"** for similar status mutations. `Mark as withdrawn`, `Put file on hold`, `Take off hold` [`StatusControl.tsx:301, 439, 520`]. All shipped; no convention rules.
- **Hub card action verbs diverge for similar dismissals.** `Mark as done` (chain setup pending) vs `Acknowledge` (new buyer added) [`ChainSetupPendingView.tsx:111`, `NewBuyersToAcknowledgeView.tsx:113`].
- **Notification bell + push share copy** (good — they're built from the same string source [`lib/services/notifications.ts:70`, `lib/agent/push-events.ts:214`]).

---

## 3. Component / UI patterns — observed

### Buttons

10 distinct classes. Canonical pattern: `agent-btn` + size class + colour class, e.g. `agent-btn agent-btn-md agent-btn-primary`. **106 uses across the codebase.**

Outliers:
- `AcknowledgeButton.tsx` uses raw Tailwind (`bg-neutral-800 text-neutral-400`) — not the agent-btn system.
- `AgentFlagButton.tsx` mixes `agent-btn` with inline background/border styles.
- Two parallel primary classes co-exist: `agent-btn-primary` and `agent-btn-color-primary`. Both are coral; one is used in SurveyNrConfirmModal/MortgageModal, the other elsewhere. No doc explains the split.

### Modals

14 portal-based modal components + 2 inline (in `StatusControl.tsx`).

**Canonical structure:**
```tsx
createPortal(
  <div data-theme={theme} style={{ position: "fixed", inset: 0, zIndex: 50 }}>
    <div className="fixed inset-0 agent-backdrop-overlay" />
    <div style={{ position: "relative", zIndex: 1, background: "var(--agent-surface-elevated)", borderRadius: 20 }}>
      {/* content */}
    </div>
  </div>,
  document.body
)
```

Animation: `agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both`. Defined in `app/agent/styles/agent-system.css`.

**Z-index variants in use:**
- 50 — older modals (SurveyNrConfirmModal, MortgageModal, UndoMilestoneModal, WelcomeModal)
- 1500 — newer (SwitchServiceTypeModal, StatusControl inline)
- 2000 — AddBrokerModal / AddFirmModal (raised 2026-06-05 per commit `5a7cfa0` to sit above the relist modal)

Three z-index tiers with no documented rule for when to use which. The 50→2000 fix was Sentry-driven, not preventative.

**Outliers:**
- `StatusControl.tsx` renders modals inline (not via shared chrome) and uses `nv2-night` class + `data-night` attribute — a different theming convention from the rest.
- `SwitchServiceTypeModal.tsx` mirrors that convention; nothing else in the app does.

### Cards

Two card systems in parallel:
- `glass-card` — 130 uses, defined in globals.css.
- `agent-glass` / `agent-glass-strong` / `agent-glass-subtle` / `agent-glass-light` — 4 variants, defined in agent-system.css.

No file or doc indicates when to use which. The two coexist with no apparent semantic difference.

Portal cards (`components/portal/*`) use a separate `P.cardBg` token from `components/portal/portal-ui.tsx` — solid white, not frosted. Intentional separation (portal is buyer/seller-facing, different surface).

### Chips / badges / pills

Three approaches in active use:

1. **`StatusBadge`** — exported component at `components/ui/StatusBadge.tsx`. Tailwind-based, sparse use. Looks "canonical" by location but isn't widely adopted.
2. **`ChainStatusBadge`** — inline function inside `LinkCard.tsx`, not exported. Hardcoded colour variants per status.
3. **Withdrawal badges (BADGE_STYLE constant)** — also inline in `LinkCard.tsx`, distinct from ChainStatusBadge. Four kinds: REMARKETING/WAITING/BREAK_CHAIN/WITHDRAWN.
4. **`RoundChip`** — interactive button (not a pure display badge), 3D flip animation, theme-aware.
5. **`DeltaPill`** / **`StatPill`** / **`LastContactedPill`** — context-specific KPI primitives.

There is no canonical badge primitive. Each surface invents its own.

### Banners

Cleanest of the five categories. One canonical wrapper, four semantic instances, one legacy holdout.

**Canonical:** `AgentBanner` at `components/ui/AgentBanner.tsx`. Handles four kinds (info/warning/danger/success) via semantic tokens (`--agent-info`, `--agent-warning`, etc.). Icon + title + body + optional action + optional dismiss.

**Wrappers:** OnHoldBanner, ChainSetupFailedBanner, RelistBanner, FileHealthBanner — all use AgentBanner.

**Legacy:** ReconcileLaterBanner — inline-styled, predates AgentBanner. Still in use.

**Inline ad-hoc:** the cascade-explanation `<div>` inside StatusControl's withdraw modal (lines 331–348). Banner-like styling, one-off, not exported.

---

## 4. Defacto Definition of Done (synthesised from arc approvals)

Walking back through the last six arcs (buyer-round Phase-1/2/3 + Pass 3a/b/c, client-chase A1–A6 + B1–B7, payments Stage 1–4, email arc Commits 1–6, chain closed-loop arc), the same gates appear before Ellis approves a commit. **None of this is in any standards doc.** ⚑ unwritten.

### The six gates that fire every time

1. **`npx tsc --noEmit` clean** before commit, every commit. The exact phrase "EXIT 0" appears as the trigger.
2. **Staging branch first, master second.** Convention: `merge: X → staging` then `merge: X → master` as separate commits. Visible across the entire commit log.
3. **Migrations apply to staging before code lands on master.** CLAUDE.md Rule 3 says this; the practice has held without exception.
4. **Verification harness with explicit pass count for any data-shape change.** "29/29 pass", "32/32 PASS" recur. Examples: `cb9682a test(buyer-round): Phase-2 read-shape verification harness — 29/29 pass`, `bdb4088 test(buyer-round): Phase-3 harness assertions — 32/32 PASS on staging`.
5. **Dry-run → review → apply → re-dry-run zero** for any prod data script. The Section 2 backfill + retro-pass-3-stranded-relists + the Hiranya stamping all followed this exact pattern.
6. **Backfill + write-path in lockstep.** Locked phrase from `0636564 feat(buyer-round): OutboundMessage rule refined — write path + backfill in lockstep`. The principle: a write-site change ships with its backfill in the same PR, not separately.

### Recurring conditional gates (fire when applicable)

7. **Voice sweep before client-facing strings land.** Surfaced as a ritual: Ellis asks for "all strings", marks them, asks for a single commit with "strings only, tsc clean, single commit". Re-ran four times in 8 days during the chain arc.
8. **Browser walkthrough on a staging fixture** before merging to master for any UX-affecting change. The chain arc demanded F1–F5 walkthrough pre-merge; the buyer-round arc demanded the Emily relist fixture.
9. **Self-reset fixtures.** `seed-chain-closed-loop-fixtures.ts` was hand-edited four times to add `purgeFixtureChains()`; the pattern is: idempotent seeds that clean their own previous output.
10. **No bundling of unrelated work.** CLAUDE.md Rule 5 says one concern per PR; the practice is stricter — Ellis explicitly says "polish + X" when he means a bundled commit, otherwise expects single-concern.
11. **Show raw evidence not interpretation when stakes are high.** CLAUDE.md Rule 10. Enforced by Ellis verbally on every architectural / role / schema question.
12. **No prod credentials in repo, transcript, or chat.** Post-incident (2026-06-04). Tracked in `docs/active/incident-2026-06-04-credential-exposure.md`.

### Gates that exist verbally but nowhere on disk ⚑

- **The diff-summary-only review format.** When Ellis approves a voice sweep, the response format is "file and line per string", not the full diff. Implicit but consistently expected.
- **The "I'll stop here, fix and reseed" protocol** when a walkthrough finds a bug. Ellis stops the walk, expects: fix → reseed → re-deploy → resume. Not in any doc.
- **The collision recovery protocol** when a parallel agent session interferes with the working tree (the chain arc commit `28ac8e8` was hijacked by a parallel session writing DEMO_RUNBOOK.md; recovery via `git stash pop`). Pattern observed; recovery not documented.
- **Structured-return-not-throw for server actions.** Discovered during the milestone prereq error fix (commit `5d0941d`). Reasoning: Next.js wraps Server Action throws in a generic digest in prod, stripping structured payloads. The rule "for user-actionable failures, return a discriminated result; only throw for unexpected" is now in code but not in any doc.
- **The wipe-and-reseed semantics**: per-fixture cleanup for closed-loop test data; leave-alone for shared / pre-existing rows. Practiced; not documented.

---

## 5. Recurring decisions (candidates for a DECISIONS.log)

These came up more than once across recent arcs and got re-decided each time. Listed with date and arc.

| Decision | First made | Re-made | Status |
|---|---|---|---|
| Em-dashes banned in prose; comma / colon / full stop instead | 2026-06-07 (`8ad3501`) | already enforced in 3 prior voice-pass commits | now written |
| "Locked copy" tag on voice-passed strings — must not be paraphrased | client-chase B7 (2026-05-28) | reinforced in chain arc voice sweep | enforced via code comments only |
| Round → sale as user-facing noun | 2026-06-04 terminology sweep | recurs in F2 chain arc copy | enforced via inline comments |
| Cascade direction in chain code: position 0 = TOP, UPWARD walks to lower positions | chain arc commit `404029c` | pre-existing bug surfaced during F2 walkthrough | now documented in code |
| Migration applies to staging before code reaches master | CLAUDE.md Rule 3 + relist runbook | every buyer-round and chain migration | already documented |
| Per-recipient cascade variant copy (WAITING / REMARKETING / no-response) | chain closed-loop arc | applied to BUYER_FOUND | new pattern, no precedent |
| Re-seed must wipe + cleanup before rebuild (no stale chains piling up) | chain arc commit `404029c` | will recur in any future fixture seed | not documented |
| Dry-run all retro scripts; apply only on review | buyer-round Pass 3 retro | chain arc retro | not documented |
| Test-email BCC pattern (CHAIN_EMAIL_BCC env var on staging only) | chain arc commit `ed10aec` | will recur for any new email-arc work | not documented |
| Hub card chrome shared: coral left border + `agent-coral-bg-tint` background | NewBuyersToAcknowledgeView | replicated in ChainSetupPendingView | not documented |
| Modal scroll: header + footer sticky, body `flex:1 overflow-y:auto` | chain arc commit `ed10aec` | will recur for any tall modal | not documented |
| Sentry-first debugging: share the actual error, not "I think it's..." | enforced verbally | every Sentry issue handed over since 2026-06-04 | not documented |
| Z-index escalation 50→2000 for nested modals | commit `5a7cfa0` (modal fix) | will recur when modals stack | not documented |

The first three are documented somewhere (em-dash now in commit, locked-copy as code comment, round→sale as terminology-sweep commit). The rest are repeating verbally each time.

---

## 6. Inconsistencies

Surfaced from agent surveys and synthesis. Listed without fixes proposed; Ellis decides which (if any) are worth chasing.

### Voice register

- **OnHoldBanner is procedural; RelistBanner is warm.** Both describe equally-significant file states. Different tonal register.
- **`Mark as done` vs `Acknowledge`** for similar dismissal actions on adjacent hub cards.
- **`Mark as withdrawn`, `Put file on hold`, `Take off hold`** — three different verb shapes for status mutations from one component.
- **`Chased — next in {n} days`** toast still has an em-dash separator post-sweep.

### UI primitives

- **Two card systems** (`glass-card` vs `agent-glass*`) with no rule for which to use when.
- **Two coral primary button classes** (`agent-btn-primary` vs `agent-btn-color-primary`).
- **Three modal z-index tiers** (50, 1500, 2000) without a documented escalation rule.
- **No canonical badge primitive.** Three rolling-their-own approaches in active use.
- **Theming attribute inconsistency.** Most modals use `data-theme={theme}`; `StatusControl` and `SwitchServiceTypeModal` use `data-night={isNight ? "" : undefined}`. Both work; no doc says which is current.

### Conventions in code vs in docs

- **CLAUDE.md doesn't link to drawers-modals/design-proposal.md** even though it's the single largest standards doc in the repo (1,224 lines).
- **Multi-tenancy is restated in 5 docs** (CLAUDE.md, AGENT_SECURITY.md, package-d/scope.md, etc.) — strong but redundant.
- **Visual rules across 3 docs** (VISUAL_DIRECTION, ANIMATION_STANDARDS, drawers-modals) — no documented reading order.
- **Voice rules live in code comments** (chainNotifications.ts:34, RelistFileModal.tsx:10) rather than a `VOICE.md`.

### Data convention vs runtime

- **`displayChainPosition` says `dbPosition 0 = top of chain`**, but the cascade walker pre-fix used `UPWARD: gt: fromPosition` (walking toward higher positions = bottom). The mismatch shipped to prod and only surfaced when a 4-link chain made the direction matter. Comment matched intent; code didn't.
- **Two seed scripts** (`seed-demo.ts` and `seed-chain-closed-loop-fixtures.ts`) with different reset semantics. seed-demo wipes broadly; seed-chain-closed-loop now does targeted purge. No documented convention.

---

## What's NOT documented but clearly enforced (high-value formalisation candidates)

Listed once more for emphasis. These are the rules Ellis re-explains across sessions because there's nowhere to point.

1. **The six-gate Definition of Done** (tsc / staging-first / migration discipline / harness pass count / dry-run-apply-zero / backfill-and-write-path-lockstep). Highest-value single addition.
2. **The voice sweep ritual** — request "all strings", mark them, expect single commit, expect diff-summary-only review format.
3. **Em-dash ban in prose** — now committed (8ad3501), needs to live in a `VOICE.md` to be discoverable next session.
4. **Locked-copy convention** — strings tagged "LOCKED" or "voice-passed verbatim" must not be paraphrased. Currently a comment convention only.
5. **The collision protocol** for parallel agent sessions interfering with working tree.
6. **The wipe-and-reseed fixture pattern**.
7. **The structured-return-not-throw rule** for server actions surfacing user-actionable failures.
8. **The "show me the actual Sentry / console error, not a guess" rule.**
9. **The hub-card chrome convention** (coral left border + tint background).
10. **The modal-scroll pattern** (sticky header/footer, flexible body).

---

## Open questions for Ellis (not for the doc to answer)

These are observations that would benefit from a one-line locked decision rather than a guess:

- Is `glass-card` deprecated in favour of `agent-glass`, or are they both canonical for different contexts?
- Is `agent-btn-color-primary` deprecated in favour of `agent-btn-primary`, or vice versa?
- What's the rule for modal z-index? Default 50, escalate to 1500 when stacked, 2000 when nested in another modal?
- Should the OnHoldBanner be re-voiced to match RelistBanner's register, or is the colder tone deliberate (on-hold = freeze, relist = forward)?
- Is there a `data-theme` vs `data-night` convention, or did `nv2-night` get half-introduced and never finished?

---

Nothing here proposes a change. Every claim cites code or commit. After Ellis reads, he'll decide which of the unwritten rules and recurring decisions are worth lifting into formal docs, and in what order.
