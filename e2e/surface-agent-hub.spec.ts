/**
 * Phase 3 Surface 2 — agent hub happy-path E2E.
 *
 * Per Law 17, an E2E test must exist before behavioural baseline /
 * remediation work begins. This test verifies the hub's happy path:
 *
 *   login → /agent/hub renders → no error boundary → key sections
 *   present (greeting + at least one stat cell or empty-state CTA) →
 *   "New sale" Link is reachable
 *
 * Skipped at runtime if the staging password isn't configured locally.
 * Same convention as surface-file-detail.spec.ts.
 *
 * Run: npx playwright test e2e/surface-agent-hub.spec.ts --reporter=list
 *
 * This becomes the regression sentinel for the Hub remediation.
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

test.describe("Surface 2 — agent hub (happy path)", () => {
  test("login → /agent/hub renders without error boundary", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/hub");
    await page.waitForLoadState("networkidle");
    // Streamed Suspense + per-widget useTransition settles.
    await page.waitForTimeout(2500);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByText("Application error")).not.toBeVisible();

    // Greeting is always present (full hub OR empty state).
    const greeting = page.locator("h1").first();
    await expect(greeting).toBeVisible();
    await expect(greeting).toContainText(/Good (morning|afternoon|evening)|Hello/);
  });

  test("either full-hub stat cells OR empty-state CTA is visible", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/hub");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);

    // Director with > 0 active files: pipeline-health stat labels render.
    const fullHub = page.getByText("Active files").first();
    // Director with 0 active files: empty-state welcome line renders.
    const emptyHub = page.getByText(/Add your first sale|No assigned files yet/).first();

    const seen = await Promise.race([
      fullHub.waitFor({ state: "visible", timeout: 8000 }).then(() => "full" as const).catch(() => null),
      emptyHub.waitFor({ state: "visible", timeout: 8000 }).then(() => "empty" as const).catch(() => null),
    ]);
    expect(seen).not.toBe(null);
  });

  test("New sale Link points to the new-v2 wizard", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/hub");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // PageHeader "New sale" button is present for director (canCreateSale).
    // We assert by href rather than click, so we don't drag the new-sale
    // wizard's own state into the hub sentinel.
    const newSaleLink = page
      .getByRole("link", { name: /New sale|Add a sale/i })
      .first();
    await expect(newSaleLink).toBeVisible();
    const href = await newSaleLink.getAttribute("href");
    expect(href).toBe("/agent/transactions/new-v2");
  });
});
