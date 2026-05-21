# Install CLAUDE.md + ELLIS_MANUAL_TODO.md

Two files attached. Install them in the repo as follows:

1. **`CLAUDE.md`** → save to repo root (`/CLAUDE.md`, NOT in `/docs/`).
   This is the file Claude Code reads automatically at session start.
   It must be at the root.

2. **`ELLIS_MANUAL_TODO.md`** → save to `docs/ELLIS_MANUAL_TODO.md`.
   This is the founder's task tracker for anything CC cannot do
   manually (signups, dashboard config, legal, decisions).

Single commit: `docs: add CLAUDE.md and ELLIS_MANUAL_TODO.md`

Then read `CLAUDE.md` end-to-end and confirm:

- The architecture description matches the actual codebase
- The file structure description is accurate
- The source-of-truth document table is correct (file paths exist)
- Anything in the "Connected services" table is wrong or stale

Surface any inaccuracies — do NOT silently fix them in this commit.
I want to see what was off before approving any updates.

After this lands, every future CC session will read CLAUDE.md
automatically. Going forward:

- When you ship a PR requiring founder manual action (env vars,
  signups, decisions), append the task to ELLIS_MANUAL_TODO.md
  with enough detail that Ellis can do it without asking
- When founder marks a task as done in conversation, strike it
  through in the file with `~~` markdown — leave it visible for
  record
- If you change architecture, file structure, or rules in CLAUDE.md,
  propose an update in the same PR

Order of operations for this session:
1. Audit cleanup (the docs cleanup action list already sent)
2. Install CLAUDE.md + ELLIS_MANUAL_TODO.md (this task)
3. Then start Package A1 (PR 71) per the existing prompt

All three are small docs-only or scope-only tasks. Do them in
sequence, not parallel. Confirm each before moving to the next.
