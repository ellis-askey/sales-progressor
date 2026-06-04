// Commit 8 + /api/healthz verification on the deploy preview.
//
// Covers:
//   - /api/healthz returns { commitSha, builtAt } and the SHA matches
//     the local HEAD (the runbook's hash gate is executable).
//   - Round chip is HIDDEN on a single-round + active file.
//   - Round chip is VISIBLE on a withdrawn file (the withdrawn variant).
//   - Clicking the chip opens the ArchivedRoundDrawer.
//   - The drawer renders the eight locked sections, the documents
//     caveat verbatim, and the buyer-record header.
//   - Escape closes the drawer.

import { chromium, type Browser, type Page } from "playwright";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// Dedicated test account, rotation-excluded. Password lives in Ellis's
// password manager and is supplied via PLAYWRIGHT_TEST_PASSWORD. The
// account itself is provisioned (idempotently) by
// scripts/ensure-playwright-test-user.ts. This suite must NEVER write
// to the User table — a verification tool that mutates the credentials
// it authenticates with both masks failures and races against any
// other writer touching the same row.
const BASE_URL = process.env.BASE_URL ?? "";
const EMAIL    = process.env.PLAYWRIGHT_TEST_EMAIL    ?? "";
const PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";
const TX_ID_WITHDRAWN = process.env.TX_ID_WITHDRAWN ?? "";  // multi-round-feel withdrawn file
const TX_ID_ACTIVE    = process.env.TX_ID_ACTIVE    ?? "";  // single-round active file (chip hidden)

if (!BASE_URL || !EMAIL || !PASSWORD || !TX_ID_WITHDRAWN || !TX_ID_ACTIVE) {
  console.error("Missing env: BASE_URL PLAYWRIGHT_TEST_EMAIL PLAYWRIGHT_TEST_PASSWORD TX_ID_WITHDRAWN TX_ID_ACTIVE.");
  process.exit(2);
}

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
async function snap(page: Page, label: string) {
  const f = path.join(SHOTS, `8-${stamp}-${label}.png`);
  await page.screenshot({ path: f, fullPage: true });
  console.log(`  📷 ${path.basename(f)}`);
}

type Check = { label: string; ok: boolean };
const checks: Check[] = [];
function record(label: string, ok: boolean) {
  checks.push({ label, ok });
  console.log(`  ${ok ? "[PASS]" : "[FAIL]"} ${label}`);
}

async function login(page: Page) {
  // POST credentials via the page's request API so the resulting
  // session cookie attaches to the same browser context.
  const csrfRes = await page.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const res = await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: { csrfToken, email: EMAIL, password: PASSWORD, json: "true" },
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  if (res.status() !== 200 && res.status() !== 302) {
    throw new Error(`login HTTP ${res.status()}`);
  }
  console.log(`  ✓ logged in as ${EMAIL}  (HTTP ${res.status()})`);
}

async function main() {
  // 1. Healthz (out-of-browser; no session needed).
  console.log("── /api/healthz ──");
  const localHead = execSync("git rev-parse HEAD").toString().trim();
  const res = await fetch(`${BASE_URL}/api/healthz`);
  const body = await res.json();
  console.log(`  local HEAD:          ${localHead}`);
  console.log(`  deployed commitSha:  ${body.commitSha}`);
  console.log(`  deployment env:      ${body.deployment?.environment ?? "(unknown)"}`);
  record("healthz returns 200", res.status === 200);
  record("healthz commitSha matches local HEAD", body.commitSha === localHead);
  record("healthz body has builtAt", typeof body.builtAt === "string");

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    console.log("\n── Login ──");
    await login(page);

    // 2. Single-round, active file — chip HIDDEN.
    console.log("\n── Round chip hidden on single-round active file ──");
    await page.goto(`${BASE_URL}/agent/transactions/${TX_ID_ACTIVE}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "01-active-file");
    const activeChipPresence = await page.locator('button[aria-label*="record"]').count();
    const activeChipText = await page.getByText(/^R\d+ with /).count();
    record("chip absent on single-round + active file", activeChipText === 0);

    // 3. Withdrawn file — chip VISIBLE.
    console.log("\n── Round chip visible on withdrawn file ──");
    await page.goto(`${BASE_URL}/agent/transactions/${TX_ID_WITHDRAWN}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "02-withdrawn-file");
    // The chip will render as "Sale N with {buyer} · fell through {date}".
    const chip = page.locator('button:has-text("fell through")').first();
    const chipVisible = await chip.isVisible().catch(() => false);
    record("chip visible on withdrawn file", chipVisible);

    if (chipVisible) {
      const chipText = (await chip.textContent()) ?? "";
      console.log(`     chip text: "${chipText.trim()}"`);
      record("chip text contains 'fell through'", chipText.includes("fell through"));

      // 4. Open the drawer. Wait for the /api/transactions/.../rounds/...
      //    response to land before snapping; drawer starts in "Loading…"
      //    state and renders only after the fetch resolves.
      console.log("\n── Open archived-round drawer ──");
      const responsePromise = page.waitForResponse(
        (r) => r.url().includes("/rounds/") && r.url().includes("/api/transactions/"),
        { timeout: 15_000 },
      );
      await chip.click();
      const resp = await responsePromise.catch(() => null);
      console.log(`     drawer API: ${resp ? `HTTP ${resp.status()}` : "(no response)"}`);
      await page.waitForTimeout(400);
      await snap(page, "03-drawer-open");

      // Header LOCKED COPY (visual upgrade pass + terminology sweep,
      // 2026-06-04): "Sale {n}: {buyerName}'s record"
      const drawerHeader = page.getByText(/^Sale \d+: .* record$/).first();
      record("drawer header rendered (Sale {n}: ...'s record)", await drawerHeader.isVisible());

      // LOCKED COPY summary line under the steps section.
      const summaryLine = page.getByText(/^\d+ of 27 buyer steps were complete when this sale fell through\.$/).first();
      record("buyer-steps summary line rendered (locked)", await summaryLine.isVisible());

      // Verify the locked section labels (eyebrow uppercase render).
      const sections = [
        "Buyer's solicitor",
        "Buyer's broker",
        "Agreed price",
        "Steps progress on this sale",
        "Seller-side progress at the moment this sale fell through",
        "Communications during this sale",
        "Why this sale fell through",
        "Documents on this file",
      ];
      for (const s of sections) {
        const visible = await page.locator(`text="${s}"`).first().isVisible().catch(() => false);
        record(`section: ${s}`, visible);
      }

      // Locked documents-pane caveat.
      const caveat = page.locator("text=Documents on this file are not tied to a specific sale").first();
      record("documents caveat rendered verbatim", await caveat.isVisible());

      // Empty-state strings — at least one of the empty messages should
      // render somewhere given typical fixture sparsity.
      const empties = [
        await page.locator('text="Not recorded for this sale."').count(),
        await page.locator('text="Nothing recorded for this sale."').count(),
        await page.locator('text="No reason recorded."').count(),
      ];
      const anyEmptyCount = empties.reduce((a, b) => a + b, 0);
      record(`voice-passed empty-state strings visible: ${anyEmptyCount}`, anyEmptyCount > 0);

      // Close via Escape.
      console.log("\n── Close drawer ──");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      const drawerGone = await page.locator('text="Documents on this file are not tied to a specific sale"').count() === 0;
      record("Escape closes the drawer", drawerGone);
      await snap(page, "04-drawer-closed");
    }

  } finally {
    if (browser) await browser.close();
  }

  console.log("\n── SUMMARY ──");
  let failed = 0;
  for (const c of checks) if (!c.ok) failed++;
  console.log(`  ${checks.length - failed}/${checks.length} checks passed.`);
  console.log(`  Screenshots: ${SHOTS}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
