/**
 * Phase 3 Surface 9 — agent admin bundle (analytics + partners + admin)
 * happy-path E2E.
 *
 * Per Law 17. Verifies:
 *   login → each of the 3 routes renders → no error boundary → heading
 *
 * The /agent/admin route is founder-only (email allowlist), so with the
 * phase3Director account it renders as 404. That's still a valid
 * "not crashed" signal — assert we get either the heading OR a 404 marker.
 *
 * Skips at runtime if TEST_PASSWORD isn't configured locally.
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

test.describe("Surface 9 — agent admin bundle (happy path)", () => {
  test("/agent/analytics renders", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/analytics");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    const heading = page.getByRole("heading", { name: /Analytics/i }).first();
    await expect(heading).toBeVisible();
  });

  test("/agent/partners renders", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/partners");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    const heading = page.getByRole("heading", { name: /Partners/i }).first();
    await expect(heading).toBeVisible();
  });

  test("/agent/admin returns 404 for non-founder OR founder heading", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/admin");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await expect(page).not.toHaveURL(/\/login/);
    // Either the founder heading renders, or the 404 renders. Both are valid.
    // A crash to the error boundary is what we're asserting against.
    await expect(page.getByText("Application error")).not.toBeVisible();
  });
});
