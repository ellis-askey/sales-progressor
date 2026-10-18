# MARKET POSITION — monthly refresh prompt

Paste the block below into a new Claude Code session in this repo to run the next monthly refresh.
Replace `YYYY-MM-DD` with today's date and `YYYY-MM` with the new run id (e.g. `2026-11`).

---

```
Refresh the MARKET POSITION artifact at market-position/. This is internal competitive
intelligence for The Sales Progressor (TSP). Do NOT change the production TSP app.

Today is YYYY-MM-DD. New research run id: YYYY-MM.

STEP 1 — Re-audit TSP.
- Read the latest docs/audits/PRODUCT_INVENTORY_*.md. If it is older than ~1 month, regenerate
  it first by auditing the codebase (statuses: LIVE / PARTIALLY IMPLEMENTED / IN DEVELOPMENT / PLANNED).
- In market-position/data/market-data.js, update the TSP assessments whose depth or tspStatus changed.
  Anything that moved from DEVELOPMENT/PLANNED/PARTIAL to LIVE must be bumped so it now counts toward
  current position. Keep runId on changed records set to the new run id.

STEP 2 — Re-research each competitor (live web).
- For every entity in the `entities` array (type != TSP), re-check its official product/pricing/help
  pages. Update `lastChecked` to today, refresh assessments/pricing, and add any dated `recentChanges`.
- Prefer official sources > official docs > official pricing > demos > announcements > reliable
  third-party. Record source URL + dateChecked + confidence (CONFIRMED/LIKELY/UNCLEAR) for new claims.
- Discover new entrants: do a fresh market sweep for UK sales-progression software, CRMs with
  progression, chain/transaction platforms, upfront-info products, and managed progression services.
  Add any meaningful new competitor as a new entity + assessments.

EVIDENCE RULES (unchanged, enforce strictly):
- Never turn marketing language into a feature. Mark UNKNOWN (not NONE) when unverifiable.
  NONE means you have evidence of absence.
- Never present TSP planned/dark features as current advantages.
- Never present TSP internal Command Centre / outreach / prospecting tooling as a customer feature
  (those belong only in `internalAdvantages`).

STEP 3 — Record a new research run and the diff.
- Append a new entry to `researchRuns` (id = new run id, today's date, a one-line summary).
- Append rows to `marketChanges` tagged with the new runId for EVERY delta: competitor launches,
  pricing moves, newly-evidenced capabilities, TSP ships, TSP status promotions
  (DEVELOPMENT->LIVE etc.), gaps closed, gaps opened, new competitors.
- Refresh `overview`, `gaps`, and `moats` so they reflect the new picture.

STEP 4 — Verify.
- Run the node referential-integrity check (load data/market-data.js, assert every assessment's
  capabilityId/entityId exist and depth is in the enum).
- Render market-position/index.html headless with Playwright (from the repo's node_modules):
  confirm no console errors, all tabs populate, the matrix renders, a cell drawer opens, and take
  desktop + mobile screenshots in dark and light.

STEP 5 — Report:
  1. What changed since last run (competitor + TSP deltas).
  2. Any new competitors added.
  3. Gaps opened / closed.
  4. Evidence gaps / anything still UNKNOWN worth chasing.
  5. Confirm the four invariants held.
```

---

## Notes for the refresher

- The data file is the single source of truth; the UI needs no edits for a normal refresh.
- To preserve trend history, bump `runId` on changed records rather than deleting old ones where it
  matters; at minimum the `marketChanges` log must narrate every delta.
- Freshness windows live in `meta.freshnessWindows` (fresh ≤45d, review ≤80d). Sources older than that
  surface as "review soon" / "stale" on the Sources tab — a built-in nudge for what to re-check.
- Watch items flagged in the last run's Overview (`overview.watchList`) are the obvious places to look
  first — e.g. Alto's AI Progression Chaser, CRM-native progression depth, and upfront-information
  mandates were the baseline watch list.
