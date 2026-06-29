/**
 * Phase 3 Surface 1 baseline screenshot capture.
 *
 * Logs in as the dedicated Phase 3 staging director (seeded by
 * scripts/seed-playwright-director.ts) and captures the "before"
 * screenshots referenced in
 * docs/phase-3/01-agent-file-detail/BASELINE.md §6.
 *
 * Output: docs/phase-3/01-agent-file-detail/screenshots/before/
 *
 * Run: npx playwright test e2e/baseline-file-detail.spec.ts --reporter=list
 *
 * Per Law 17 these screenshots are pinned as the "before" state. After
 * surface-1 remediation we re-capture the same configurations with the
 * same spec, save to screenshots/after/, and diff.
 */

import { test, type Page } from "@playwright/test";
import { login, USERS, dismissCookieBanner } from "./helpers";
import path from "path";
import fs from "fs";

const OUT_DIR = path.resolve(
  __dirname,
  "..",
  "docs",
  "phase-3",
  "01-agent-file-detail",
  "screenshots",
  "before",
);

const TABS = ["overview", "milestones", "reminders", "todos", "activity"] as const;

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function snap(page: Page, name: string) {
  ensureOutDir();
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function findFirstActiveTransactionId(page: Page): Promise<string | null> {
  await page.goto("/agent/transactions");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  const detailLinks = await page.locator('a[href^="/agent/transactions/cm"]').all();
  if (detailLinks.length === 0) return null;
  const href = await detailLinks[0].getAttribute("href");
  return href?.match(/\/agent\/transactions\/([^/?#]+)/)?.[1] ?? null;
}

// Each capture test does multiple full-page navigations on a streaming
// surface; default 30s test timeout is too tight on a cold dev server.
test.describe.configure({ timeout: 180_000 });

test.describe("Phase 3 Surface 1 baseline capture", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page, USERS.phase3Director);
    await dismissCookieBanner(page);
    await page.waitForURL(/\/agent\/hub|\/agent\/transactions/, { timeout: 45000 });
  });

  test("desktop 1280px — file detail across all tabs", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const txId = await findFirstActiveTransactionId(page);
    test.skip(!txId, "no active transaction available on staging");

    for (const tab of TABS) {
      await page.goto(`/agent/transactions/${txId}?tab=${tab}`);
      await page.waitForLoadState("networkidle");
      // Streamed Suspense panels settle.
      await page.waitForTimeout(2500);
      await snap(page, `director-active-${tab}-desktop-1280`);
    }
  });

  test("mobile 375px — file detail across all tabs", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const txId = await findFirstActiveTransactionId(page);
    test.skip(!txId, "no active transaction available on staging");

    for (const tab of TABS) {
      await page.goto(`/agent/transactions/${txId}?tab=${tab}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2500);
      await snap(page, `director-active-${tab}-mobile-375`);
    }
  });

  test("desktop 1280px — error 404 on invalid id", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/agent/transactions/invalid-cuid-for-baseline");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    await snap(page, "director-error-404-desktop-1280");
  });

  test("desktop 1280px — surrounding context (hub + transactions list)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto("/agent/hub");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await snap(page, "context-hub-desktop-1280");

    await page.goto("/agent/transactions");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await snap(page, "context-transactions-list-desktop-1280");
  });
});
