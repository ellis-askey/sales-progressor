# Conventions — Sales Progressor

"How to add a thing." The same flow every time, so the next session doesn't reinvent.

**Read this before:** adding a new screen, primitive, modal, email, migration, or fixture.

---

## How to add a new screen / page

1. **Read [CLAUDE.md](../CLAUDE.md)** — re-read at start of every non-trivial task.
2. **Read the source-of-truth doc** for what the screen does (per CLAUDE.md "Source-of-truth documents" table).
3. **Read [DESIGN_TOKENS.md](reference/DESIGN_TOKENS.md)** before any styling decision.
4. **Read [COMPONENT_LIBRARY.md](reference/COMPONENT_LIBRARY.md)** before reaching for any primitive.
5. **Build with all four data states.** Happy path + loading skeleton + empty (designed, with guidance) + error (recoverable, voice-passed).
6. **Voice-pass every string** against [VOICE.md](reference/VOICE.md) before commit.
7. **Self-check against [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md)** before declaring complete.

---

## How to add a new UI primitive

1. **Check [COMPONENT_LIBRARY.md](reference/COMPONENT_LIBRARY.md) first.** If a canonical pattern exists, use it.
2. If one doesn't exist and you genuinely need a new one:
   1. **Write a one-paragraph spec into COMPONENT_LIBRARY.md** under the relevant section, *before* writing code.
   2. **Add CSS** to [`agent-system.css`](../../app/agent/styles/agent-system.css) (or [`globals.css`](../../app/globals.css) for glass-system primitives).
   3. **Add tokens** to [`themes.css`](../../app/agent/styles/themes.css) if new values are required. Mirror them in [`design/tokens.ts`](../../design/tokens.ts) in the same commit.
   4. **Build the component** in `components/ui/` if a React wrapper is needed.
   5. **Add a row** to the relevant section of COMPONENT_LIBRARY.md with a `lives at:` pointer.

---

## How to add a new modal

1. **Read [MODAL_DRAWER_INDEX.md](reference/MODAL_DRAWER_INDEX.md).** Decide modal vs drawer.
2. **Use the canonical pattern** from [MODAL_DRAWER_SYSTEM.md](reference/MODAL_DRAWER_SYSTEM.md). Do **not** roll your own `createPortal`.
3. **Reference implementation:** [`AddBrokerModal.tsx`](../components/brokers/AddBrokerModal.tsx).
4. **Required parts:** accent line (2px coral-deep top border), Phosphor X close button, `agent-backdrop-overlay`, Esc handler, `agent-modal-in` animation. See [COMPONENT_LIBRARY.md → Modals](reference/COMPONENT_LIBRARY.md#modals).
5. **Z-index:** start at 50. Escalate per the rule in [DESIGN_TOKENS.md](reference/DESIGN_TOKENS.md#z-index--modal-escalation-rule-locked) only when stacking demands.
6. **Scroll pattern:** sticky header + footer, body `flex:1 overflow-y-auto`.
7. **Voice-pass body copy and CTAs** before commit.

---

## How to add a new email

1. **Use the payload-builder pattern** from [`lib/email/chainNotifications.ts`](../lib/email/chainNotifications.ts). Build `subject`, `text`, `html` together; share the `shellHtml` template.
2. **Match the established voice** ("your client", "we'll", "let us know", "Open the chain" for chain emails). See [VOICE.md](reference/VOICE.md).
3. **Subject pattern:** sentence case. Em-dashes OK in subjects as separators; **not** in body prose.
4. **CTA:** single coral button (`#FF6B4A`), label `Open the chain` for chain emails (or imperative-action verb for others).
5. **Unsubscribe footer:** every email. Use `buildUserUnsubscribeUrl` from `lib/email/unsubscribe`.
6. **BCC for staging:** `CHAIN_EMAIL_BCC` env var, **set on staging only**. Never on prod. See [DECISIONS.md](DECISIONS.md).
7. **Voice-pass** subject + lead + follow + CTA copy before commit.
8. **Test from a staging fixture** (or a `/test/*` route) before merging.

---

## How to add a new database migration

1. **Filename:** `YYYYMMDDHHMMSS_descriptive_name`.
2. **Apply to staging first** — `npx prisma migrate deploy` against staging DB. Verify the schema change and any side effects.
3. **Backfill + write-path in lockstep.** If the migration adds a column or table that needs population, ship the backfill script and the write-path update in the same PR.
4. **Dry-run any backfill.** Read-only first pass that reports how many rows would change, what the diff looks like. Review. Apply. Re-dry-run shows zero.
5. **Then merge to master.** CLAUDE.md Rule 3.
6. **Verification harness** with explicit pass count for any data-shape change. Quote the number in the commit message.

---

## How to add a new fixture / seed script

1. **Self-resetting.** The script wipes its previous output (e.g. `purgeFixtureChains()` in [`seed-chain-closed-loop-fixtures.ts`](../scripts/seed-chain-closed-loop-fixtures.ts)) before re-seeding. No orphan rows piling up between runs.
2. **Per-fixture cleanup.** Closed-loop test data is purged; shared / pre-existing rows are left alone.
3. **Idempotent.** Run it twice in a row; result is the same.
4. **Plain-English summary** at the end of the run: how many rows created, what test scenarios are now exercisable.

---

## How to run a voice sweep

1. **List every new or changed string** in one place. Format: file path + line number + current wording + proposed wording.
2. **Request Ellis's review.** He responds with file-and-line annotations. Do **not** ship the full diff for him to read.
3. **Apply the agreed swaps** in a single commit. Subject: `voice: {arc} sweep` or `voice: {arc} variant alignment`.
4. **tsc clean** before commit.
5. **Strings only** — no code logic changes in the sweep commit. If logic needs to change too, that's a separate commit.

Pattern observed across the chain arc (commits `e009f47`, `3a56a04`, `1c517e7`, `8ad3501`) and the buyer-round arc voice passes.

---

## How to run a retro / data-fix script

1. **Dry-run first.** Read-only mode. Reports what would change, no writes.
2. **Review the dry-run output.** Show Ellis the count and the diff sample.
3. **Apply.** Run with the write flag.
4. **Re-dry-run.** Should report zero changes — that's the gate that confirms the fix landed.
5. **Quote the numbers** in the commit message.

Pattern observed: Section 2 backfill, retro-pass-3-stranded-relists, Hiranya stamping.

---

## How to debug a Sentry / console error

1. **Share the actual error** — Sentry trace, console output, server log. Not "I think it's…".
2. **Quote the file and line** the error points to.
3. **State the hypothesis explicitly**, then test it.
4. **Don't guess at architecture** when the stakes are high (security, role, schema). Show raw evidence — CLAUDE.md Rule 10.

---

## "I'll stop here, fix and reseed" protocol

When a staging walkthrough finds a bug:

1. **Stop the walk.** Don't try to power through to "see if there are more bugs".
2. **Fix the bug.**
3. **Reseed the fixture** (it should be self-resetting per above).
4. **Re-deploy** to staging.
5. **Resume the walkthrough** from the start of the affected screen, not from the broken spot.

---

## Hard pauses (mandatory)

CLAUDE.md anti-drift section: hard pauses are mandatory pauses, not optional checkpoints. If a doc or instruction says "pause and ask", pause and ask. Do not silently proceed because you feel confident.

---

## Parallel-session collision

If two AI sessions touch the same working tree:

1. **Notice early.** Unexpected files appearing in `git status` is the first sign.
2. **`git stash`** before doing anything else.
3. **Surface the collision** to Ellis with the file list.
4. **Recover by `git stash pop` after the other session's commits land** or are stashed.

Observed: chain arc commit `28ac8e8` was hijacked by a parallel session writing `DEMO_RUNBOOK.md`. Recovery was `git stash pop`.

---

## What this doc is NOT

- It's not a list of rules — those live in [CLAUDE.md](../CLAUDE.md).
- It's not a Definition of Done — that lives in [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md).
- It's not a token reference — that's [DESIGN_TOKENS.md](reference/DESIGN_TOKENS.md).
- It's "how to do the recurring tasks the same way every time".
