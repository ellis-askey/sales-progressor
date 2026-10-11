// Perf audit Track 1 — page-speed measurement harness (2026-10-10).
//
// Logs into the agent app as a real director, then measures every major
// agent-app page three ways:
//
//   1. COLD full loads  — fresh browser context per run (empty cache, no
//      router cache), direct page.goto. Captures server TTFB, FCP, LCP,
//      DOMContentLoaded, load, time-to-settled (network idle + skeletons
//      gone), payload bytes and request count.
//   2. WARM client-side navigation — one long-lived session clicking the
//      real sidebar links, like a user mid-session. Captures ack time
//      (click -> URL change, i.e. "the app heard me") and settled time
//      (click -> content fully rendered). Circuit index recorded so
//      first-visit vs router-cached revisits are distinguishable.
//   3. FILE TABS — opens a property file and clicks through every tab,
//      same ack/settled metrics, repeated circuits.
//
// Usage:
//   PERF_BASE_URL=https://... PERF_EMAIL=... PERF_PASSWORD=... \
//     node e2e/perf/measure.mjs
//
// Optional: PERF_RUNS (default 5), PERF_LABEL (tag in output filenames).
// Output: e2e/perf/results/<label>-<timestamp>.jsonl (one record per
// measurement) + -summary.json (aggregates). Results dir is gitignored.
//
// Scope: agent app only (no Command Centre, no portal) per the agreed
// Track 1 plan. Read-only — it never saves, sends, or mutates anything.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.PERF_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.PERF_EMAIL || "";
const PASSWORD = process.env.PERF_PASSWORD || "";
const RUNS = Number(process.env.PERF_RUNS || 5);
const LABEL = process.env.PERF_LABEL || "run";

if (!BASE || !EMAIL || !PASSWORD) {
  console.error("Set PERF_BASE_URL, PERF_EMAIL, PERF_PASSWORD.");
  process.exit(1);
}

const OUT_DIR = path.join("e2e", "perf", "results");
fs.mkdirSync(OUT_DIR, { recursive: true });
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const JSONL = path.join(OUT_DIR, `${LABEL}-${STAMP}.jsonl`);
const SUMMARY = path.join(OUT_DIR, `${LABEL}-${STAMP}-summary.json`);

// Top-level pages, cold-loaded directly. key = short name for the tables.
const PAGES = [
  { key: "hub", path: "/agent/hub" },
  { key: "work-queue", path: "/agent/work-queue" },
  { key: "enquiries", path: "/agent/enquiries" },
  { key: "completions", path: "/agent/completions" },
  { key: "to-do", path: "/agent/to-do" },
  { key: "comms", path: "/agent/comms" },
  { key: "auto-emails", path: "/agent/automated-emails" },
  { key: "files-list", path: "/agent/transactions" },
  { key: "chains", path: "/agent/chains" },
  { key: "analytics", path: "/agent/analytics" },
  { key: "partners", path: "/agent/partners" },
  { key: "account-profile", path: "/agent/account/profile" },
  { key: "account-billing", path: "/agent/account/billing" },
];

// Sidebar-clickable subset for the warm navigation circuit (account pages
// are behind the avatar menu, not the sidebar — cold-only).
const NAV_KEYS = [
  "hub", "work-queue", "enquiries", "completions", "to-do", "comms",
  "auto-emails", "files-list", "chains", "analytics", "partners",
];

// File-page tab segments (relative to /agent/transactions/[id]).
const FILE_TABS = [
  { key: "file-overview", seg: "" },
  { key: "file-activity", seg: "/activity" },
  { key: "file-milestones", seg: "/milestones" },
  { key: "file-chain", seg: "/chain" },
  { key: "file-documents", seg: "/documents" },
  { key: "file-reminders", seg: "/reminders" },
  { key: "file-chase", seg: "/chase" },
  { key: "file-todos", seg: "/todos" },
  { key: "file-client-portal", seg: "/client-portal" },
  { key: "file-setup", seg: "/setup" },
];

const records = [];
function record(rec) {
  const full = { ...rec, ts: new Date().toISOString() };
  records.push(full);
  fs.appendFileSync(JSONL, JSON.stringify(full) + "\n");
}

// Content is "settled" when no skeleton placeholders are visible. The
// app's canonical Skeleton primitive animates via an inline
// `agent-shimmer` style (components/ui/Skeleton.tsx); a handful of
// legacy spots still use Tailwind's animate-pulse — watch both.
// Deliberately NOT gated on network idle — the app keeps background
// chatter going (badge refetches, prefetches) which would inflate every
// number; that chatter is measured separately by netQuiet().
async function settle(page, cap = 25000) {
  try {
    await page.waitForFunction(
      () => {
        const skeletons = document.querySelectorAll(
          '[style*="agent-shimmer"], .animate-pulse',
        );
        for (const el of skeletons) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return false;
        }
        return true;
      },
      { timeout: cap },
    );
    return true;
  } catch {
    return false; // skeletons still visible at the cap — recorded as unsettled
  }
}

// Separate signal: did the network go fully quiet (500ms with no
// requests) within the cap? Pages that never do are constantly
// chattering — a Track 3 finding on its own.
async function netQuiet(page, cap = 10000) {
  const t0 = Date.now();
  try {
    await page.waitForLoadState("networkidle", { timeout: cap });
    return { quiet: true, quietMs: Date.now() - t0 };
  } catch {
    return { quiet: false, quietMs: null };
  }
}

async function collectNavMetrics(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = null;
        try {
          new PerformanceObserver((l) => {
            const e = l.getEntries();
            if (e.length) lcp = e[e.length - 1].startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {}
        setTimeout(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const fcp =
            performance.getEntriesByName("first-contentful-paint")[0]
              ?.startTime ?? null;
          const resources = performance.getEntriesByType("resource");
          resolve({
            ttfb: nav ? Math.round(nav.responseStart) : null,
            fcp: fcp == null ? null : Math.round(fcp),
            lcp: lcp == null ? null : Math.round(lcp),
            domContentLoaded: nav
              ? Math.round(nav.domContentLoadedEventEnd)
              : null,
            load: nav ? Math.round(nav.loadEventEnd) : null,
            docBytes: nav ? nav.transferSize : null,
            resourceCount: resources.length,
            resourceBytes: resources.reduce(
              (s, r) => s + (r.transferSize || 0),
              0,
            ),
          });
        }, 150);
      }),
  );
}

async function login(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  // Filling before React hydrates gets wiped when it takes over the form
  // (submit stays disabled) — fill, give the form a beat, refill if needed.
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    try {
      await page.waitForSelector("button[type=submit]:enabled", {
        timeout: 3000,
      });
      break;
    } catch {
      if (attempt === 4) throw new Error("Login submit never enabled");
      await page.waitForTimeout(1000);
    }
  }
  await page.click('button[type="submit"]');
  // Generous: the very first authenticated load can exceed 45s while the
  // server warms its DB pool (observed locally against the Dublin DB).
  await page.waitForURL(/\/agent\//, { timeout: 120000 });
  await settle(page);
  // Dismiss the cookie banner once; consent persists via storageState so
  // no later context ever renders (or pays for) the banner. "Essential
  // only" keeps analytics off so measurement stays clean.
  try {
    await page
      .getByRole("button", { name: "Essential only" })
      .click({ timeout: 4000 });
    await page.waitForTimeout(500);
  } catch {}
  const state = await context.storageState();
  await context.close();
  return state;
}

// Pick a REAL property file. The first file on the list can be the demo
// sale, which renders a static preview instead of the real tab chrome —
// so each candidate is opened and only accepted once genuine tab links
// (anchors to its route segments) are present. PERF_FILE_ID overrides.
async function discoverFileId(browser, state) {
  if (process.env.PERF_FILE_ID) return process.env.PERF_FILE_ID;
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto(`${BASE}/agent/transactions`, {
    waitUntil: "domcontentloaded",
  });
  await settle(page);
  const hrefs = await page.evaluate(() => {
    const seen = new Set();
    for (const a of document.querySelectorAll(
      'a[href^="/agent/transactions/"]',
    )) {
      const h = a.getAttribute("href");
      if (h && !h.includes("/new")) seen.add(h.split(/[?#]/)[0]);
    }
    return Array.from(seen);
  });
  let chosen = null;
  for (const href of hrefs.slice(0, 6)) {
    try {
      await page.goto(`${BASE}${href}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
    } catch {
      console.log(`Skipping ${href} — page did not load within 90s.`);
      continue;
    }
    try {
      // Real tab chrome = anchors to the file's route segments. Give the
      // streamed shell time to arrive — the demo file never renders them.
      await page.waitForSelector(
        `a[href^="${href}/milestones"], a[href^="${href}/activity"]`,
        { timeout: 15000 },
      );
      chosen = href;
      break;
    } catch {
      console.log(`Skipping ${href} — no real tab chrome (demo/preview file).`);
    }
  }
  await context.close();
  if (!chosen) throw new Error("No real file with tab chrome found in first 6 candidates");
  const id = chosen.split("/agent/transactions/")[1].split(/[/?#]/)[0];
  console.log(`Using file id ${id} for file-page measurements.`);
  return id;
}

async function coldRun(browser, state, key, urlPath, run) {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  const t0 = Date.now();
  let status = null;
  try {
    const resp = await page.goto(`${BASE}${urlPath}`, {
      waitUntil: "commit",
      timeout: 60000,
    });
    status = resp ? resp.status() : null;
    const settled = await settle(page);
    const settledMs = Date.now() - t0;
    // Chatter check once per page (a per-page property, not per-run —
    // keeps total runtime sane).
    const q = run === 1 ? await netQuiet(page, 6000) : {};
    const m = await collectNavMetrics(page);
    record({
      mode: "cold",
      key,
      path: urlPath,
      run,
      status,
      finalUrl: page.url().replace(BASE, ""),
      settled,
      settledMs,
      ...q,
      ...m,
    });
    console.log(
      `cold ${key} #${run}: ttfb=${m.ttfb}ms lcp=${m.lcp}ms settled=${settledMs}ms`,
    );
  } catch (e) {
    record({ mode: "cold", key, path: urlPath, run, status, error: String(e.message || e).slice(0, 200) });
    console.log(`cold ${key} #${run}: ERROR ${String(e.message || e).slice(0, 120)}`);
  } finally {
    await context.close();
  }
}

// Click a link to `toPath`, measure ack (URL change) + settled.
async function clickNav(page, key, toPath, circuit, mode) {
  // Exact href, or href with a query string (file tabs carry ?from=
  // when arrived at from a list page).
  const sel = `a[href="${toPath}"], a[href^="${toPath}?"]`;
  const link = page.locator(sel).first();
  try {
    if ((await link.count()) === 0) {
      record({ mode, key, path: toPath, run: circuit, error: "link not found" });
      return;
    }
    const t0 = Date.now();
    await link.click();
    await page.waitForURL((u) => u.pathname === toPath, { timeout: 45000 });
    const ackMs = Date.now() - t0;
    const settled = await settle(page);
    const settledMs = Date.now() - t0;
    record({ mode, key, path: toPath, run: circuit, ackMs, settled, settledMs });
    console.log(`${mode} ${key} #${circuit}: ack=${ackMs}ms settled=${settledMs}ms`);
  } catch (e) {
    record({ mode, key, path: toPath, run: circuit, error: String(e.message || e).slice(0, 200) });
    console.log(`${mode} ${key} #${circuit}: ERROR ${String(e.message || e).slice(0, 120)}`);
  }
}

function aggregate() {
  const groups = {};
  for (const r of records) {
    if (r.error) continue;
    const g = (groups[`${r.mode}|${r.key}`] ||= { mode: r.mode, key: r.key, path: r.path, runs: [] });
    g.runs.push(r);
  }
  const stat = (vals) => {
    const v = vals.filter((x) => typeof x === "number").sort((a, b) => a - b);
    if (!v.length) return null;
    const med = v[Math.floor(v.length / 2)];
    return { median: med, min: v[0], max: v[v.length - 1], n: v.length };
  };
  return Object.values(groups).map((g) => ({
    mode: g.mode,
    key: g.key,
    path: g.path,
    ttfb: stat(g.runs.map((r) => r.ttfb)),
    fcp: stat(g.runs.map((r) => r.fcp)),
    lcp: stat(g.runs.map((r) => r.lcp)),
    settledMs: stat(g.runs.map((r) => r.settledMs)),
    ackMs: stat(g.runs.map((r) => r.ackMs)),
    docBytes: stat(g.runs.map((r) => r.docBytes)),
    resourceBytes: stat(g.runs.map((r) => r.resourceBytes)),
    resourceCount: stat(g.runs.map((r) => r.resourceCount)),
    unsettledRuns: g.runs.filter((r) => r.settled === false).length,
    neverQuiet: g.runs.some((r) => r.quiet === false),
    quietMs: stat(g.runs.map((r) => r.quietMs)),
  }));
}

const browser = await chromium.launch({ headless: true });
try {
  console.log(`Target: ${BASE}  runs: ${RUNS}`);
  const state = await login(browser);
  console.log("Logged in.");
  const fileId = await discoverFileId(browser, state);
  const fileBase = `/agent/transactions/${fileId}`;

  // --- Pass 1: cold full loads --- (PERF_SKIP_COLD=1 to skip, e.g. when
  // resuming a run that already banked the cold data)
  if (!process.env.PERF_SKIP_COLD) {
    for (let run = 1; run <= RUNS; run++) {
      for (const p of PAGES) await coldRun(browser, state, p.key, p.path, run);
      for (const t of FILE_TABS)
        await coldRun(browser, state, `${t.key}-direct`, `${fileBase}${t.seg}`, run);
    }
  }

  // --- Pass 2: warm sidebar circuits ---
  {
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    await page.goto(`${BASE}/agent/hub`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await settle(page);
    for (let circuit = 1; circuit <= RUNS; circuit++) {
      for (const key of NAV_KEYS) {
        const target = PAGES.find((p) => p.key === key);
        if (page.url().replace(BASE, "").split("?")[0] === target.path) continue;
        await clickNav(page, key, target.path, circuit, "warm-nav");
      }
      // reset to hub for the next circuit
      await clickNav(page, "hub", "/agent/hub", circuit, "warm-nav");
    }
    await context.close();
  }

  // --- Pass 3: file tab circuits ---
  {
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    await page.goto(`${BASE}${fileBase}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await settle(page);
    for (let circuit = 1; circuit <= RUNS; circuit++) {
      for (const t of FILE_TABS) {
        if (t.seg === "") continue; // overview is the return point
        await clickNav(page, t.key, `${fileBase}${t.seg}`, circuit, "warm-tab");
        }
      await clickNav(page, "file-overview", fileBase, circuit, "warm-tab");
    }
    await context.close();
  }

  const summary = aggregate();
  fs.writeFileSync(SUMMARY, JSON.stringify({ base: BASE, runs: RUNS, generated: new Date().toISOString(), summary }, null, 2));
  console.log(`\nDone. ${records.length} measurements.`);
  console.log(`Raw:     ${JSONL}`);
  console.log(`Summary: ${SUMMARY}`);
} finally {
  await browser.close();
}
