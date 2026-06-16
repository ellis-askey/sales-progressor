# Definition of Done — Sales Progressor

Every commit and every component checks against this list. The six commit-level gates have fired before every approval across the buyer-round, client-chase, payments, email, and chain arcs; the per-component gates capture what makes a UI element "done" vs "shipped without polish".

**Read this before:** committing, opening a PR, declaring a feature complete.

---

## Commit-level gates (every commit)

1. **`npx tsc --noEmit` is clean.** EXIT 0, every commit. No "I'll fix the type errors next commit" — fix them now.
2. **Staging branch first, master second.** Convention: `merge: X → staging` then `merge: X → master` as separate commits. Never both at once.
3. **Migrations apply to staging before code reaches master.** CLAUDE.md Rule 3. No exceptions.
4. **Verification harness with explicit pass count for any data-shape change.** "29/29 pass" / "32/32 PASS" — quote the number in the commit message. No "tests pass" without a count.
5. **Dry-run → review → apply → re-dry-run zero** for any prod data script. Section-2 backfill, retro-pass-3-stranded-relists, Hiranya stamping all followed this exact pattern.
6. **Backfill + write-path in lockstep.** A write-site change ships with its backfill in the same PR. Locked phrase: `0636564 feat(buyer-round): OutboundMessage rule refined — write path + backfill in lockstep`.

---

## Recurring conditional gates (fire when applicable)

7. **Voice sweep before client-facing strings land.** Single commit, "strings only, tsc clean, single commit". Review format: file + line per string, not the full diff. See [VOICE.md](reference/VOICE.md) and [CONVENTIONS.md](CONVENTIONS.md).
8. **Browser walkthrough on a staging fixture** before merging to master for any UX-affecting change. Chain arc demanded F1–F5; buyer-round arc demanded the Emily relist fixture.
9. **Self-resetting fixtures.** Seeds wipe their previous output before re-seeding. Pattern: `purgeFixtureChains()` in `seed-chain-closed-loop-fixtures.ts`. No piling-up of orphan rows between runs.
10. **One concern per PR.** CLAUDE.md Rule 5. Bundled commits are explicitly labelled ("polish + X"); the default is single-concern.
11. **Show raw evidence, not interpretation, when stakes are high.** CLAUDE.md Rule 10. Quote the file, show the query output, paste the Sentry trace.
12. **No prod credentials in repo, transcript, or chat.** Post-incident discipline (2026-06-04). See `docs/active/incident-2026-06-04-credential-exposure.md`.
13. **Token lockstep.** Any commit that changes a CSS token (in `globals.css`, `themes.css`, or `agent-system.css`) updates [`design/tokens.ts`](../design/tokens.ts) in the same commit. `tokens.ts` stays a read-only mirror — never imported by components.

---

## Per-component gates (every new UI element)

A component is **done** when:

- [ ] **Uses tokens only.** No inline hex codes, no magic spacing numbers, no hardcoded radii. Every value comes from [`design/tokens.ts`](../design/tokens.ts) / themes.css / globals.css. See [DESIGN_TOKENS.md](reference/DESIGN_TOKENS.md).
- [ ] **Uses canonical primitives.** No new `<button className="bg-...">` when `agent-btn` exists. No inline `createPortal` when the modal pattern is documented. See [COMPONENT_LIBRARY.md](reference/COMPONENT_LIBRARY.md).
- [ ] **Has all four interaction states.** Hover, focus, active, disabled — visible and tested. CSS-driven (no inline `onMouseEnter`). See [HOVER_STATES.md](reference/HOVER_STATES.md).
- [ ] **Has all four data states.** Loading (skeleton), empty (designed copy, with guidance), error (recoverable, voice-passed apology), first-time. Not just the happy path.
- [ ] **Mobile responsive.** Works at 360px width. Inputs respect the 16px iOS Safari floor.
- [ ] **Theme-aware.** Uses theme tokens (`--agent-*`), not hardcoded colours. Works in every `[data-theme]` block in `themes.css`.
- [ ] **Animation from spec.** Uses a named choreography from [MOTION_GUIDE.md](reference/MOTION_GUIDE.md). No inline `@keyframes`. Respects `prefers-reduced-motion`.
- [ ] **Voice swept.** Every string checked against [VOICE.md](reference/VOICE.md). No exclamation marks, no em-dashes in prose, no "the system", no titles.
- [ ] **Keyboard + screen reader.** Escape closes modals/drawers. Focus trapped while open. ARIA labels present. WCAG AA contrast.
- [ ] **No console errors.** Open the dev tools; the console is silent in normal use.
- [ ] **Plain-English summary written.** What changed, why, what could go wrong. Per CLAUDE.md "How to respond".

---

## Verbal-only gates (capture once and stop re-explaining)

These have been enforced verbally across sessions for months. Listed here so they're discoverable, not so the next session re-discovers them.

- **Diff-summary-only review format** for voice sweeps. Response format is "file and line per string", not the full diff.
- **"I'll stop here, fix and reseed"** protocol when a walkthrough finds a bug. Stop the walk → fix → reseed → re-deploy → resume.
- **Sentry-first debugging.** Share the actual error (Sentry, console, server log), not a guess. "I think it's X" is not acceptable when X is checkable. See CLAUDE.md Rule 10.
- **Structured-return-not-throw for server actions.** Next.js wraps Server Action throws in a generic digest in prod, stripping structured payloads. For user-actionable failures, return a discriminated result; only throw for unexpected. Discovered during the milestone prereq fix (commit `5d0941d`).
- **Wipe-and-reseed fixture semantics.** Per-fixture cleanup for closed-loop test data; leave-alone for shared / pre-existing rows.

See [DECISIONS.md](DECISIONS.md) for the canonical entries.

---

## What "done" is NOT

- **"tsc clean" alone is not done.** Tsc verifies code correctness, not feature correctness.
- **"The test passes" alone is not done.** Run the UI in a browser. Click through the golden path AND edge cases.
- **"It works on my machine" is not done.** Staging walkthrough is the gate, not local.
- **"I'll voice-pass it later" is not done.** The string sweep is a gate, not a follow-up.
- **"The hover state is implicit" is not done.** It's not implicit. CSS hover rules need to exist and be tested.

---

## Workflow checklist (paste into PR descriptions)

```
- [ ] tsc clean (EXIT 0)
- [ ] Staging migration applied + verified
- [ ] Verification harness pass count quoted
- [ ] Backfill + write-path in lockstep (if data-shape change)
- [ ] Voice swept (if user-facing strings)
- [ ] Staging walkthrough completed (if UX change)
- [ ] Per-component checklist (if UI change)
- [ ] design/tokens.ts updated (if CSS token change)
- [ ] Plain-English summary written
```
