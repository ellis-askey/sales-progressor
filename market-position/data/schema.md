# MARKET POSITION — data model

This artifact is **data-driven**. All research, evidence and comparisons live in
`data/market-data.js` as a single global object (`window.MARKET_POSITION_DATA`).
The dashboard (`index.html`) renders entirely from that object — nothing is
hard-coded in the view. A monthly refresh = edit the data file + add a research
run; the UI updates automatically.

Why a `.js` module and not `.json`? So the file opens from `file://` with no
server and no build step, and so it can carry comments. It is still plain
structured data (one object literal) — trivial to diff and edit.

---

## Top-level shape

```
window.MARKET_POSITION_DATA = {
  meta,            // artifact metadata + freshness windows
  researchRuns,    // [] dated snapshots; newest last. First = BASELINE.
  personas,        // [] who a capability serves
  categories,      // [] capability groups (taxonomy level 1)
  capabilities,    // [] individual comparable capabilities (taxonomy level 2)
  entities,        // [] TSP + every competitor (the matrix columns)
  assessments,     // [] one record per (capabilityId × entityId) that we have a view on
  pricing,         // [] commercial model per entity
  overview,        // curated Overview-tab signals
  gaps,            // [] classified gaps & opportunities
  moats,           // [] TSP defensibility assessments
  internalAdvantages, // [] TSP internal/operational advantages (NOT customer features)
  marketChanges,   // [] "since last review" log, tagged by runId
  userNotesSeed,   // [] internal-knowledge notes seeded in data (UI adds more to localStorage)
}
```

---

## Enumerations (keep these exact — the UI keys off them)

**Entity / competitor type** (`entities[].type`)
- `TSP` — us (always exactly one)
- `DIRECT` — direct sales-progression software
- `PARTIAL` — CRM / platform whose progression is one part of a bigger product
- `ADJACENT` — attacks the same problem (fall-through, speed, visibility) from a different angle
- `SERVICE` — managed human sales-progression provider

**Capability depth** (`assessments[].depth`) — NEVER a raw checkbox
- `ADVANCED` — unusually deep / multi-faceted
- `STRONG` — solid, clearly built out
- `BASIC` — present but shallow
- `PRESENT` — exists, but depth could not be established
- `NONE` — reasonable evidence the capability is ABSENT
- `UNKNOWN` — could not establish whether it exists (DIFFERENT from NONE)

> `UNKNOWN` must never render as `NONE`. `NONE` = evidence of absence.
> `UNKNOWN` = no evidence either way.

**TSP status** (`assessments[].tspStatus`, only on the TSP entity)
- `LIVE` / `PARTIAL` / `DEVELOPMENT` / `PLANNED` — mirrors PRODUCT_INVENTORY statuses.
- A capability may ONLY count toward TSP's *current* position if `LIVE`
  (or the LIVE part of a mixed status). `DEVELOPMENT`/`PLANNED` feed the
  *forward* position only.

**Evidence confidence** (`assessments[].confidence`)
- `CONFIRMED` / `LIKELY` / `UNCLEAR`

**Knowledge type** (`assessments[].knowledgeType`, and `userNotes`)
- `PUBLIC` — publicly verifiable (official page/doc/pricing/demo/announcement)
- `INTERNAL` — internal knowledge the user supplied (not public)
- `INFERENCE` — reasoned conclusion, not directly evidenced

**Gap classification** (`gaps[].classification`)
- `IMPORTANT_GAP` / `POTENTIAL_OPPORTUNITY` / `PARITY` / `LOW_VALUE` / `WATCH`

**Moat type** (`moats[].type`)
- `FEATURE` / `DATA` / `WORKFLOW` / `DISTRIBUTION` / `NETWORK` / `OPERATIONAL`

**Freshness** (derived in UI from `lastChecked` vs `meta.freshnessWindows`)
- `FRESH` ≤ freshDays · `REVIEW_SOON` ≤ reviewSoonDays · `STALE` beyond

---

## Record shapes

```
category   = { id, label, order, blurb }
capability = { id, categoryId, label, description, personas:[personaId], strategicNote }
persona    = { id, label }

entity = {
  id, name, type, website,
  targetCustomer, positioning, pricingSummary,
  strongestAreas:[str], notEvidenced:[str], recentChanges:[str],
  overlapWithTsp, lastChecked:"YYYY-MM-DD",
  sources:[{url,label,dateChecked}],
}

assessment = {
  capabilityId, entityId,
  depth,                 // see enum
  tspStatus,             // TSP only
  confidence,            // see enum
  knowledgeType,         // see enum
  summary,               // plain-English: what they actually provide
  evidence:[{url,dateChecked,note}],
  runId,                 // which research run established this
}

pricing = {
  entityId, model, freeTier, perSeat, perBranch, perTransaction,
  managedPrice, chargingTrigger, contract, setup, confidence, sources:[{url,dateChecked}]
}

gap   = { id, capabilityId|null, title, classification, reasoning, tspForward }
moat  = { id, label, type, assessment, whatWouldMakeItDefensible, strength:"EMERGING|PLAUSIBLE|STRONG" }
internalAdvantage = { id, label, description, whyNotCustomerFacing }
marketChange = { runId, date, entityId|null, type:"LAUNCH|PRICING|FEATURE|TSP_SHIP|TSP_PROMOTE|GAP_CLOSED|GAP_OPENED|NOTE", text }
researchRun = { id, date, label, summary, analyst }
overview = { distinctive:[], strongPositions:[], parity:[], gaps:[], watchList:[], roadmapAdvantage:[] }
userNote = { targetType:"entity|capability", targetId, text, knowledgeType, date }
```

---

## Monthly refresh procedure (for a future Claude Code session)

See `../REFRESH_PROMPT.md` for the exact prompt. In short:
1. Re-audit TSP (re-read the latest `docs/audits/PRODUCT_INVENTORY_*.md`, or regenerate it) and update TSP assessments + statuses.
2. Re-research each competitor's official pages; update `entities[].lastChecked`, assessments, pricing, and `recentChanges`.
3. Append a new `researchRuns` entry (new `id`, e.g. `"2026-11"`).
4. Append `marketChanges` rows tagged with the new `runId` describing every delta (launches, pricing moves, TSP ships, gaps closed/opened).
5. Do NOT overwrite prior assessments destructively if you want trend history — bump `runId` on changed records. At minimum, the `marketChanges` log preserves the narrative of what changed.
6. Refresh `overview`, `gaps`, `moats` to match.
7. Re-run verification (node check + Playwright screenshots).

Invariants the refresh must preserve:
- Planned/dark TSP features never counted as current advantages.
- `UNKNOWN` never silently converted to `NONE`.
- Internal/operational advantages never presented as customer features.
