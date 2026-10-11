# Performance baseline — agent app (Track 1 of the perf audit)

Date: 2026-10-11. Harness: `e2e/perf/measure.mjs` (committed 4ebfa24a). Scope: agent app only — Command Centre and portal excluded by decision (Ellis, 2026-10-10).

## What was measured, and against what

The intended target was the staging deployment plus production. Both fell through for reasons that are themselves findings (F2, F3 below), so this baseline ran against a **local production build of the current code** (`next build` + `next start` on :3101, Windows dev machine) talking to the **staging Supabase in eu-west-1 (Dublin)** over a home connection.

What that means for reading the numbers:

- **Absolute values are environment-specific.** A UK home connection to Dublin pays roughly 25–40ms per database round trip; Vercel's default US-East region pays ~80–100ms (see F2), so production cold loads are plausibly *worse* than these numbers, not better.
- **Rankings, ratios, and the cold/warm gap are trustworthy.** Every page was measured identically, 5 iterations, fresh browser context per cold run.
- A **real-infrastructure pass** (prod with a prod login, or staging after a push) should be re-run with this same harness before and after fixes. The harness is re-runnable: see header of `e2e/perf/measure.mjs`.

Test account: `playwright-baseline@thesalesprogressor.test` (director, Hartwell & Partners, 103 active files — re-pointed to the busiest agency by the updated `scripts/seed-playwright-director.ts`). File-page measurements used file `cmuwquvgd009ilgwxvsmpn2yp`.

Metrics per cold load: **TTFB** (server starts responding), **FCP/LCP** (content visibly arrives), **settled** (skeletons gone), **quiet** (did the network ever go idle for 500ms within 6s), payload bytes + request count. Warm navigation: **ack** (click → URL change, "the app heard me") and **settled**.

---

## Cold full loads — league table (medians of 5, ms)

| Page | TTFB | LCP | Settled | Payload | Requests | Ever quiet? |
|---|---|---|---|---|---|---|
| File: overview | 19,843 | 25,176 | 29,860 | 864 KB | 70 | no |
| File: chase timeline | 19,555 | 19,792 | 19,634 | 727 KB | 41 | no |
| File: chain | 19,249 | 19,744 | 19,564 | 811 KB | 54 | no |
| File: client portal | 18,815 | 19,104 | 19,425 | 724 KB | 48 | no |
| Auto emails | 18,390 | 19,200 | 18,672 | 713 KB | 32 | no |
| File: reminders | 18,379 | 35,220 | 18,459 | 767 KB | 44 | no |
| File: milestones (Steps) | 17,828 | 18,372 | 18,239 | 756 KB | 43 | no |
| Partners | 17,821 | 18,044 | 18,003 | 606 KB | 31 | no |
| Comms (Updates) | 17,467 | 18,084 | 18,041 | 588 KB | 34 | yes |
| Completions | 17,276 | 17,656 | 17,579 | 632 KB | 32 | no |
| Work queue (Reminders) | 17,155 | 17,348 | 17,385 | 682 KB | 36 | no |
| File: documents | 17,066 | 17,356 | 17,694 | 723 KB | 48 | no |
| Chains | 17,060 | 17,356 | 17,507 | 736 KB | 39 | no |
| File: activity | 16,909 | 18,392 | 17,403 | 754 KB | 42 | no |
| To-Do | 16,825 | 25,452 | 16,907 | 614 KB | 31 | no |
| File: todos | 16,479 | 18,708 | 17,066 | 723 KB | 40 | no |
| Files list | 16,368 | 18,048 | 16,407 | 644 KB | 33 | no |
| Analytics | 16,344 | 16,580 | 16,538 | 732 KB | 33 | no |
| **Hub** | 16,308 | 17,240 | **37,769** | **1,331 KB** | **94** | no |
| Enquiries | 16,157 | 16,416 | 16,356 | 658 KB | 32 | no |
| File: setup | 15,982 | 18,556 | 16,253 | 720 KB | 40 | no |
| Account: billing | 10,586 | 12,260 | 11,032 | 511 KB | 23 | no |
| Account: profile | 7,570 | 8,044 | 8,158 | 700 KB | 26 | no |

## Warm client-side navigation (clicking real sidebar links / tabs)

| Target | First visit ack | First visit settled | Revisit ack | Revisit settled |
|---|---|---|---|---|
| Work queue (not prefetched) | 22,026 | 25,070 | — | — |
| Enquiries | 1,475 | 1,680 | — | — |
| Completions (prefetched) | 445 | 723 | — | — |
| To-Do | 347 | **30,382** | — | — |
| Comms | 511 | 607 | — | — |
| File tab: Steps | 12,400 | 12,409 | 1,940 | 4,927 |
| File tab: Chain | 484 | 3,981 | 472 | 11,092 |
| File tab: Documents | 332 | 426 | 416 | 433 |
| File tab: Reminders | 423 | 458 | 349 | 433 |
| File tab: Chase | 338 | 412 | 520 | 564 |
| File tab: To-Do | 327 | 397 | 404 | 486 |
| File tab: Overview (return) | 456 | 523 | 421 | 527 |

(Warm-nav circuits 2–5 were lost to a harness gap — after one navigation the run landed on a page without the sidebar links and every later click recorded "link not found". Three end-of-row tabs — Activity, Client portal, File setup — sit outside the tab bar's scroll viewport and the clicker timed out on them. Both are harness fixes for the next run, not product findings.)

---

## Findings, ranked by leverage

### F1 — Every page pays a ~16–20s shared server cost; the problem is a tax, not a few slow pages
The league table's most important feature is its *uniformity*: 21 of 23 pages land in a 16–20s TTFB band. That pattern means the dominant cost is shared, not per-page. The shared code every one of those pages runs on the server is the agent layout chain: `resolveAgentSession` → `agencyUserHasSelfManagedFiles` → `computeNavBadgeCounts` (5 badge counts) → business-member resolution → per-page queries, largely sequential, each paying a network round trip to the database. The two pages *outside* the band (account profile/billing, ~half the cost) are the natural isolation experiment for what the rest are paying. **Track 3's first job: count and parallelise/consolidate the layout's per-request queries, and make badge counts cheap (single query or cached).**

### F2 — Production functions run in Washington DC; the database is in Dublin
`X-Vercel-Id: iad1::iad1` on portal.thesalesprogressor.co.uk; `vercel.json` exists but is crons-only with no `regions` key, and no region config exists anywhere else in the repo — so prod runs in Vercel's default `iad1` (US East). Supabase is `eu-west-1` (Dublin). Every one of the many queries in F1 pays ~80–100ms transatlantic, and UK users' requests cross the Atlantic twice before any data moves. **Fix: pin the function region next to the DB (`dub1`, or `lhr1`) — one small config file, ships as its own PR with before/after measurement.** Given F1's query counts, this multiplies with every query-count fix.

### F3 — The staging deployment is a stale build; manual testing happens on old code
The staging URL still renders the pre-September file page (tab buttons, no route segments). Large amounts of committed work sit unpushed locally. Any perf (or feature) impression formed on the staging URL is an impression of an old product. Re-point the habit: push staging before testing on it, or test against prod.

### F4 — Almost no page ever goes network-quiet
Only Comms reached 500ms of network silence within 6s of being fully loaded. Everything else keeps requesting — badge refetches, prefetches, polling. Each individual request may be cheap, but it keeps the browser busy, pollutes "is it done yet?" perception, and on the file page it competes with the content the user is waiting for. Track 3 should inventory what fires post-load on the worst three pages.

### F5 — The hub is the heaviest page: 1.3MB, 94 requests, 38s to fully settle
Twice the payload and requests of any other page. LCP lands at ~17s (band-typical) but skeletons persist to ~38s — the hub keeps loading well after it looks half-ready. Deserves its own pass (defer below-fold widgets, trim payload) after F1/F2 land.

### F6 — Prefetch works brilliantly where it's enabled — and its coverage is partial
Sidebar targets whose payloads Next had prefetched (Completions, To-Do, Comms) acknowledged clicks in 350–600ms. Work queue — same sidebar, no prefetched payload — took 22s to respond to a click. The per-page `unstable_dynamicStaleTime` opt-in (PERF-05) plus `prefetch` is demonstrably the difference between "instant" and "is this thing on?". **Cheap win: audit which agent pages opt in, and extend coverage.**

### F7 — First tab visit re-pays the trunk; revisits are fast
File tabs revisited within the 5-minute client-cache window switch in ~350–500ms (the September route-split architecture working as designed). But the *first* visit to a heavy tab (Steps: 12.4s) pays trunk + tab queries again server-side. F1's layout-cost fix benefits every first tab visit too.

### F8 — To-Do: instant ack, 30 seconds of skeletons
`ack` 347ms (loading state appears immediately — good) but 30s before skeletons cleared: content streams in long after the shell. Whatever that page fetches client-side after paint is the long pole. Candidate for the Track 2 interaction audit's deep-dive list.

---

## What happens next

1. **Track 3 (architecture) starts at F1**: instrument the agent layout's query chain (count, sequence, cost), then consolidate. Highest-leverage code fix.
2. **F2 region pin** as its own PR + before/after harness run. Highest-leverage config fix.
3. **Track 2 (interaction audit)**: the 48 `router.refresh()` save-paths, plus F8-style post-paint fetch audits.
4. **Real-infrastructure baseline** once prod credentials or a staging push exist; re-run this harness unchanged.
5. **Permanent monitoring**: Speed Insights wired (56b866d8), awaiting the Vercel dashboard toggle (ELLIS_MANUAL_TODO 2026-10-10); Sentry tracing already live at 10% sample (dashboard-only until read access is granted).

## Needed from Ellis

- A production director login for the harness (or say the word to push staging and I'll measure the fresh staging deployment instead).
- The Vercel **Speed Insights** toggle (see ELLIS_MANUAL_TODO).
- Optional: Sentry read access (auth token + org/project slug) to mine the existing 10% server traces instead of re-deriving them.
