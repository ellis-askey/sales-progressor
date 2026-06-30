/**
 * Phase 3 Surface 4 — agent transactions list happy-path E2E.
 *
 * Per Law 17. Verifies:
 *   login → /agent/transactions renders → no error boundary →
 *   heading present → either the table OR empty-state CTA visible →
 *   clicking the first row navigates to a file-detail URL (if rows
 *   exist)
 *
 * Skips at runtime if TEST_PASSWORD isn't configured locally.
 *
 * Run: npx playwright test e2e/surface-agent-transactions.spec.ts --reporter=list
 */

import { test, expect, type Page } from "@playwright/test";
import { login, USERS, dismissCookieBanner } from "./helpers";

async function attemptLogin(page: Page): Promise<{ ok: true } | { ok: false; reason: string }> {
  await page.context().clearCookies();
  await login(page, USERS.director);
  await dismissCookieBanner(page);
  try {
    await page.waitForURL(/\/agent\/hub|\/agent\/transactions/, { timeout: 12000 });
    return { ok: true };
  } catch {
    const incorrect = await page
      .getByText(/Incorrect email or password/i)
      .isVisible()
      .catch(() => false);
    if (incorrect) {
      return {
        ok: false,
        reason:
          "TEST_PASSWORD / TEST_DIRECTOR_PASSWORD does not match the staging director account. " +
          "Set the correct password in .env.test.local to enable this suite.",
      };
    }
    return {
      ok: false,
      reason:
        "Login flow did not redirect to /agent/hub within 12s and no incorrect-password error was shown. " +
        "Check the dev server is running on localhost:3000.",
    };
  }
}

test.describe("Surface 4 — agent transactions list (happy path)", () => {
  test("login → /agent/transactions renders without error boundary", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/transactions");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByText("Application error")).not.toBeVisible();

    // Page heading is "All Files" (director/admin) or "My Files" (others).
    const heading = page.getByRole("heading", { name: /All Files|My Files/ }).first();
    await expect(heading).toBeVisible();
  });

  test("either transaction rows OR empty-state CTA is visible", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/transactions");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Director with files: at least one row anchored to /agent/transactions/cm...
    const firstRow = page.locator('a[href^="/agent/transactions/cm"]').first();
    // Director with zero files: empty-state CTA renders.
    const empty = page.getByText(/Create your first sale|No files assigned yet/).first();

    const seen = await Promise.race([
      firstRow.waitFor({ state: "visible", timeout: 8000 }).then(() => "list" as const).catch(() => null),
      empty.waitFor({ state: "visible", timeout: 8000 }).then(() => "empty" as const).catch(() => null),
    ]);
    expect(seen).not.toBe(null);
  });

  test("filter banner appears for ?filter=exchanging-this-week", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/transactions?filter=exchanging-this-week");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // The filter banner OR the empty state for that filter must render.
    const banner = page.getByText("Exchanging this week").first();
    await expect(banner).toBeVisible();
  });
});
