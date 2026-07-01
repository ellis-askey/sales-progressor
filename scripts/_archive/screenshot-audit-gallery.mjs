/**
 * screenshot-audit-gallery.mjs
 * Takes a screenshot of every drift/choice item on /audit-gallery
 * (a no-auth dev route that renders the before/after gallery with full agent CSS).
 * Outputs to docs/polish-pass/screenshots/audit-gallery/
 *
 * Usage:  node scripts/screenshot-audit-gallery.mjs
 * Requires: dev server running at http://localhost:3000
 */

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "docs", "polish-pass", "screenshots", "audit-gallery");

mkdirSync(OUT_DIR, { recursive: true });

const BASE = "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// ── 1. Navigate to the no-auth gallery route ─────────────────────────────────
console.log("→ Opening gallery (no auth required)…");
await page.goto(`${BASE}/audit-gallery`);
await page.waitForLoadState("networkidle");
// Let fonts, CSS variables, and any entrance animations settle
await page.waitForTimeout(1800);

// Dismiss the cookie consent banner (rendered by root layout's CookieConsentBanner)
const cookieBtn = page.getByRole("button", { name: "Essential only" });
if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await cookieBtn.click();
  await page.waitForTimeout(400);
  console.log("  → Cookie banner dismissed");
}

// Verify the page loaded correctly
const itemCount = await page.locator("[data-item]").count();
if (itemCount === 0) {
  await page.screenshot({ path: join(OUT_DIR, "_debug-page.png") });
  console.error(
    `\n⚠ No [data-item] elements found. The page may have failed to render.\n` +
    `  Check _debug-page.png in the output folder for the current state.\n` +
    `  Current URL: ${page.url()}\n`
  );
  await browser.close();
  process.exit(1);
}
console.log(`  ✓ Gallery loaded (${itemCount} choice items found)`);

// ── 2. Expand all category blocks (they default open, but ensure all visible) ─
const catHeaders = await page.locator(".aba-cat-hdr").all();
for (const hdr of catHeaders) {
  const parent = await hdr.evaluateHandle((el) => el.closest(".aba-cat"));
  const isOpen = await parent.evaluate((el) =>
    el.querySelector(".aba-cat-body") !== null
  );
  if (!isOpen) {
    await hdr.click();
    await page.waitForTimeout(150);
  }
}

// ── 3. Screenshot every [data-item] element ──────────────────────────────────
const items = await page.locator("[data-item]").all();
console.log(`→ Screenshotting ${items.length} items…`);

let saved = 0;
const seen = new Map(); // deduplicate within same category

for (let i = 0; i < items.length; i++) {
  const item = items[i];

  await item.scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);

  const itemId = await item.getAttribute("data-item");
  const catId = await item.evaluate(
    (el) => el.closest(".aba-cat")?.id ?? "unknown"
  );

  const key = `${catId}::${itemId}`;
  const count = (seen.get(key) ?? 0) + 1;
  seen.set(key, count);
  const suffix = count > 1 ? `_${count}` : "";

  const safeItem = (itemId ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const padded = String(i + 1).padStart(2, "0");
  const filename = `${padded}--${catId}--${safeItem}${suffix}.png`;

  try {
    await item.screenshot({
      path: join(OUT_DIR, filename),
      animations: "disabled",
    });
    console.log(`  ✓ ${filename}`);
    saved++;
  } catch (err) {
    console.warn(`  ✗ ${filename} — ${err.message}`);
  }
}

await browser.close();

console.log(`\nDone. ${saved}/${items.length} screenshots saved to:`);
console.log(`  ${OUT_DIR}`);
