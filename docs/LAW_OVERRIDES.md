# Law Overrides Log

Per the [Migration & override mechanism](../CLAUDE.md#migration--override) in CLAUDE.md. Every use of `LAWS-OVERRIDE:` in a commit message must be logged here for the quarterly review.

## Format

Each entry is a row:

| Date | Commit | Law overridden | One-line reason | Reviewer decision (added quarterly) |
|---|---|---|---|---|

## Entries

| Date | Commit | Law overridden | One-line reason | Reviewer decision (added quarterly) |
|---|---|---|---|---|
| 2026-08-08 | (this commit) | Law 16 (no bulk rewrites) | Scripted swap of 101 identical adjacent `backdrop-filter` / `-webkit-backdrop-filter` line pairs across 19 CSS files — Turbopack dedupes the pair keeping the LAST declaration, so webkit-last shipped webkit-only CSS and browsers dropped ALL glass blur. Diff verified 102/102 symmetric, backdrop-filter lines only; visual + computed-style verification in session. Hand-editing 101 identical swaps judged higher-risk than the reviewed script. | |

## Quarterly review

Next: **2026-09-26**. At each review:

- If overrides for a given Law exceed 2 in the quarter, the Law itself is reviewed for whether the wording needs to change.
- Overrides marked as "false positive by the hook" get filed as hook-tuning tickets.
- Overrides marked as "genuinely wrong" get amendments proposed via the [Migration & override PR flow](../CLAUDE.md#migration--override).
