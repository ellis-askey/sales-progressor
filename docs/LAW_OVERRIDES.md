# Law Overrides Log

Per the [Migration & override mechanism](../CLAUDE.md#migration--override) in CLAUDE.md. Every use of `LAWS-OVERRIDE:` in a commit message must be logged here for the quarterly review.

## Format

Each entry is a row:

| Date | Commit | Law overridden | One-line reason | Reviewer decision (added quarterly) |
|---|---|---|---|---|

## Entries

(none yet — file created 2026-07-01 as part of Phase 5 MVP)

## Quarterly review

Next: **2026-09-26**. At each review:

- If overrides for a given Law exceed 2 in the quarter, the Law itself is reviewed for whether the wording needs to change.
- Overrides marked as "false positive by the hook" get filed as hook-tuning tickets.
- Overrides marked as "genuinely wrong" get amendments proposed via the [Migration & override PR flow](../CLAUDE.md#migration--override).
