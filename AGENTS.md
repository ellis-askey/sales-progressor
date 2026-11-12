# AGENTS.md — Sales Progressor

The maintained instructions for this repo live in two files. Read both before
taking any action, and re-read at the start of any new task:

- **[CLAUDE.md](CLAUDE.md)** — governs development procedures and approval
  requirements (the Laws, process, conventions, and how work is proposed and
  signed off).
- **[docs/PRODUCT_TRUTH.md](docs/PRODUCT_TRUTH.md)** — the maintained reference
  for current product facts (pricing, roles, access scopes, business types,
  surfaces, tech stack, feature flags, launch stage).

## How to treat these documents

- `CLAUDE.md` is authoritative for **how** you work here: development procedure
  and approval requirements.
- `docs/PRODUCT_TRUTH.md` is the maintained reference for **what** the product
  is.
- **Neither document automatically overrides verified application behaviour.**
  Documentation can lag the code, and the code can diverge from intent; a
  document being out of date does not by itself make the code wrong, and vice
  versa.
- If documentation, code, and observed behaviour disagree, **do not silently
  pick a side and do not change either side.** Investigate the discrepancy and
  present it to the founder for a decision before changing anything.
- **No application logic or behaviour may be changed without the founder's
  explicit approval.** Explain any proposed change, and obtain approval, before
  implementing it.

## Why this file is a thin pointer

A previous standalone AGENTS.md (2026-05-23) drifted materially from the
codebase — pricing, the role/scope model, surfaces, AI models, and the
governance model were all out of date — and maintaining it as a parallel copy
guaranteed that drift. The complete original is preserved for history at
[docs/meta/AGENTS_2026-05.md](docs/meta/AGENTS_2026-05.md). Keeping one
maintained source avoids the recurrence.

## One hard-won lesson (kept here because it bit us)

Stage everything before you commit. Run `git add -u` (or explicit paths) before
EVERY commit — never rely on `git mv` auto-staging to also catch content edits
made in the same session. The half-state where moves are committed but content
edits are not is the worst case for a revert. Burned by this on 2026-05-21
during the docs reorg (the moves landed in `7351ef0`; the sed sweeps and
AGENTS.md updates were left unstaged, needing a follow-up `6721aa7`). See
CLAUDE.md Law 2.
