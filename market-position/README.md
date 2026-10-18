# MARKET POSITION

An internal, living competitive-intelligence artifact for **The Sales Progressor (TSP)**.
Not customer-facing. Does **not** touch the production TSP app — it is a standalone,
dependency-free static dashboard that reads from a structured data file.

> Baseline run: **2026-10-03**. Open `index.html` to use it.

---

## What it answers

In ~10 seconds on the Overview tab: where TSP is strong, where it's weak, what changed, what to look at. Then nine tabs:

| Tab | What's there |
|---|---|
| **Overview** | Distinctive capabilities, strong positions, parity/table-stakes, current gaps, watch list, roadmap advantage + headline counts |
| **Matrix** | Capabilities × products. Depth-rated cells (Advanced/Strong/Basic/Present/None/Unknown). Filter by category/TSP status, pick competitors, click any cell for evidence |
| **Competitors** | A profile per competitor — positioning, pricing, overlap with TSP, assessed strengths, evidenced-absent, sources, freshness |
| **TSP Position** | Current (live) vs forward (partial/in-development/planned), kept separate. Plus a clearly-walled-off "internal/operational advantages — NOT customer features" section |
| **Gaps & Opportunities** | Every gap classified (important / opportunity / watch / parity / low-value) with reasoning and whether TSP already has something in flight |
| **Moats** | Defensibility assessed by type (feature/data/workflow/distribution/network/operational) and strength, with what would make each genuinely hard to copy |
| **Pricing** | Commercial-model comparison where evidence exists (UNKNOWN where private) |
| **Market Changes** | "Since last review" log per research run (baseline = recent market activity) |
| **Sources** | Every external source with check date + freshness (fresh / review-soon / stale) |

---

## How to open

Just double-click **`index.html`**. It's self-contained (inline CSS/JS) and loads its data from
`data/market-data.js` via a local `<script>` tag, so it works from `file://` with no server and no build.

If your browser is locked down and blocks local scripts, serve the folder:

```
cd market-position
python -m http.server 8080   # then open http://localhost:8080
```

No internet is required to run it (external links in evidence open in a new tab if you click them).

---

## Architecture (data-driven — the UI renders from data, nothing is hard-coded)

```
market-position/
  index.html            the dashboard (vanilla HTML/CSS/JS, no dependencies, no build)
  data/
    market-data.js      the entire dataset → window.MARKET_POSITION_DATA
    schema.md           the data model + enums + record shapes
  README.md             this file
  REFRESH_PROMPT.md     paste this into Claude Code to run next month's refresh
```

To change anything shown in the UI, edit `data/market-data.js`. To change *how* it's shown, edit `index.html`.

### Key conventions (read `data/schema.md` for full detail)

- **Entity types:** `TSP | DIRECT | PARTIAL | ADJACENT | SERVICE`
- **Depth:** `ADVANCED | STRONG | BASIC | PRESENT | NONE | UNKNOWN`
  - `UNKNOWN` ≠ `NONE`. `NONE` = evidence of absence; `UNKNOWN` = not established (and empty cells render as Unknown).
- **TSP status:** `LIVE | PARTIAL | DEVELOPMENT | PLANNED`. Only `LIVE` counts toward TSP's *current* position; the rest feed *forward* position only.
- **Confidence:** `CONFIRMED | LIKELY | UNCLEAR`. **Knowledge type:** `PUBLIC | INTERNAL | INFERENCE`.

### Your own knowledge

On any competitor profile or matrix cell you can add internal notes. They're saved in your browser
(`localStorage`), tagged `INTERNAL` or `INFERENCE` so they're never confused with public evidence,
and there's an **Export all notes** button that downloads them as JSON to paste into
`data/market-data.js` (`userNotesSeed`) if you want them to persist in the repo.

---

## Invariants (must stay true every run)

1. Planned / dark TSP features are **never** counted as current advantages (Overview + TSP-current use `LIVE` only).
2. `UNKNOWN` is never silently shown as `NONE`.
3. TSP's internal Command Centre / prospecting / outreach tooling is **never** presented as a customer feature — it lives only in the "internal/operational advantages" section.
4. Every competitor claim carries a dated source; TSP rows cite the codebase product inventory.

---

## Refreshing monthly

See **`REFRESH_PROMPT.md`** — it's the exact prompt to give Claude Code to re-audit TSP, re-research
competitors, append a new research run, and log what changed. The data file is designed so a refresh is
pure data editing; the UI needs no changes.

Baseline competitor set (14): mio, ViewMyChain, Coadjute, Street.co.uk, Reapit, Alto,
Yourkeys/Zoopla Progression Portal, Moverly, Gazeal, Hoowla, Easy Progression, Property Progressors,
The Sales Progression Company, Complete ASAP.
