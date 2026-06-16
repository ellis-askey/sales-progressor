# Decisions Log — Sales Progressor

A running log of decisions made once and re-applied across arcs. Append new entries at the bottom; never edit historical entries (annotate with a follow-up entry if a decision is superseded).

**Format:** `YYYY-MM-DD · arc · decision · why · source`

**Read this when:** a recurring question comes up ("how do we handle X again?"). If the decision is here, follow it. If not, decide and append.

---

## 2026-06-07 · standards · Em-dashes banned in prose. Replace with comma / colon / full stop.

**Why:** prose was reading as over-styled; em-dashes were doing decorative rather than structural work.
**Scope:** body copy in emails, modals, banners, toasts. **Excluded:** email subject lines (em-dash is the established subject-line separator pattern).
**Source:** commit `8ad3501` (Option B ban). Voice pass at commits `e009f47`, `3a56a04`, `1c517e7` was the run-up.

## 2026-06-07 · standards · Voice rules formalised in [VOICE.md](reference/VOICE.md).

**Why:** rules previously lived as inline code comments in `chainNotifications.ts` and various modals. Not discoverable by a future session.
**Source:** this docs pass. See [VOICE.md](reference/VOICE.md).

---

## 2026-06-05 · chain arc · Modal z-index escalation rule.

**Why:** AddBrokerModal opened over the relist modal was occluded. Sentry-driven fix.
**Decision:** default 50, escalated 1500 above page-level overlays, deep 2000 only when stacking modals.
**Source:** commit `5a7cfa0`. See [DESIGN_TOKENS.md](reference/DESIGN_TOKENS.md#z-index--modal-escalation-rule-locked).

## 2026-06-05 · chain arc · Chain code: position 0 = TOP of chain. UPWARD walks toward LOWER position numbers.

**Why:** `findNearestClaimedLink` used `UPWARD: gt: fromPosition` which inverted intent; cascade walked the wrong direction. Bug surfaced in F2 walkthrough.
**Decision:** position 0 is the top; UPWARD walks to lower positions. `displayChainPosition` comment now matches code.
**Source:** commit `404029c`. Reinforced in code comments.

## 2026-06-05 · chain arc · Re-seeds must wipe their previous output before rebuilding.

**Why:** orphan fixture chains piled up between runs, polluting walkthroughs.
**Decision:** every fixture seed runs `purgeFixtureChains()` (or equivalent) before insert.
**Source:** chain arc commit `404029c`. Pattern documented in [CONVENTIONS.md](CONVENTIONS.md#how-to-add-a-new-fixture--seed-script).

## 2026-06-05 · email arc · `CHAIN_EMAIL_BCC` env var on staging only, never on prod.

**Why:** test BCCs leaking into prod email would be a data-disclosure incident.
**Decision:** env var set on staging Vercel deploy only. Prod must never have it.
**Source:** chain arc commit `ed10aec`. Tracked in [`ELLIS_MANUAL_TODO.md`](active/ELLIS_MANUAL_TODO.md) as a per-deploy verification.

## 2026-06-05 · UI · Modal scroll pattern: header + footer sticky, body `flex:1 overflow-y-auto`.

**Why:** RelistFileModal had a multi-stage form whose footer scrolled off-screen. Confusing.
**Decision:** every modal taller than viewport pins header + footer and scrolls the body.
**Source:** commit `ed10aec`. See [COMPONENT_LIBRARY.md → Modals](reference/COMPONENT_LIBRARY.md#modals).

## 2026-06-05 · UI · Hub card chrome: 3px coral left border + `agent-coral-bg-tint` background for hub action cards.

**Why:** consistent visual signal that these cards require agent action.
**Decision:** any new hub-page action card uses this chrome.
**Source:** [`NewBuyersToAcknowledgeView.tsx`](../components/hub/NewBuyersToAcknowledgeView.tsx), replicated in [`ChainSetupPendingView.tsx`](../components/hub/ChainSetupPendingView.tsx).

---

## 2026-06-04 · terminology · "round" → "sale" in user-facing strings.

**Why:** "round" reads as betting/sports language to non-internal readers. "Sale" is the established UK estate-agency noun.
**Scope:** UI strings only. Internal data model (`Round` table, `RoundStatus` enum) unchanged.
**Source:** 2026-06-04 terminology sweep. Comment in [`NewBuyersToAcknowledgeView.tsx:94`](../components/hub/NewBuyersToAcknowledgeView.tsx).

## 2026-06-04 · security · No prod credentials in repo, transcript, or chat.

**Why:** post-incident discipline (`docs/active/incident-2026-06-04-credential-exposure.md`).
**Decision:** prod DATABASE_URL never pasted into chat. Staging-only access for any AI session.
**Source:** incident response.

---

## 2026-05-28 · client-chase B7 · Locked-copy convention.

**Why:** voice-passed strings were being subtly re-worded on subsequent edits, undoing the sweep.
**Decision:** strings tagged `// LOCKED` or `// voice-passed verbatim` must not be paraphrased. New meaning requires a new voice pass.
**Source:** enforced via code comments. Documented in [VOICE.md](reference/VOICE.md#locked-copy-convention).

---

## 2026-05-15 · server actions · Structured-return-not-throw for user-actionable failures.

**Why:** Next.js wraps Server Action throws in a generic digest in prod, stripping structured payloads. Error messages disappeared.
**Decision:** for user-actionable failures, return a discriminated result (`{ ok: false, code, message }`); only throw for unexpected.
**Source:** milestone prereq fix commit `5d0941d`.

---

## (Recurring, pre-2026-05) · process · Dry-run → review → apply → re-dry-run zero for retro / data-fix scripts.

**Why:** prevents accidental writes to prod data. Re-dry-run zero confirms the fix landed.
**Decision:** every retro script supports both modes; dry-run is the default.
**Source:** Section 2 backfill, retro-pass-3-stranded-relists, Hiranya stamping all followed this pattern.

## (Recurring, pre-2026-05) · process · Staging migration first, then master commit.

**Why:** CLAUDE.md Rule 3. Production never gets a migration that hasn't run on staging.
**Decision:** `npx prisma migrate deploy` on staging → verify → merge to master → migration runs on prod via deploy pipeline.
**Source:** CLAUDE.md and every migration commit since launch.

## (Recurring, pre-2026-05) · process · Backfill + write-path in lockstep.

**Why:** write-path changing without backfill leaves half-populated rows; backfill landing without write-path locks future rows in the old shape.
**Decision:** ship together in one PR.
**Source:** commit `0636564 feat(buyer-round): OutboundMessage rule refined — write path + backfill in lockstep`.

## (Recurring) · debugging · Sentry-first / show raw evidence.

**Why:** "I think it's X" wastes time when X is checkable in 30 seconds.
**Decision:** for architectural/security/schema questions, quote the file or paste the Sentry trace. Save interpretation for after evidence is on screen.
**Source:** CLAUDE.md Rule 10. Enforced verbally every Sentry handover.

---

*Append new entries at the bottom. Don't edit historical entries — supersede them with a follow-up.*
