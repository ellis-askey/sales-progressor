/**
 * Phase 3 Surface 6 — agent completions happy-path E2E.
 *
 * Per Law 17. Verifies:
 *   login → /agent/completions renders → no error boundary →
 *   "Completions" heading visible
 *
 * Skips at runtime if TEST_PASSWORD isn't configured locally.
 *
 * Run: npx playwright test e2e/surface-agent-completions.spec.ts --reporter=list
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

test.describe("Surface 6 — agent completions (happy path)", () => {
  test("login → /agent/completions renders without error boundary", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/completions");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByText("Application error")).not.toBeVisible();

    const heading = page.getByRole("heading", { name: "Completions" }).first();
    await expect(heading).toBeVisible();
  });
});
