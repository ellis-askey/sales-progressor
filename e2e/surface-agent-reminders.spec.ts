/**
 * Phase 3 Surface 3 — agent reminders / work-queue happy-path E2E.
 *
 * Per Law 17, an E2E test exists before remediation. Verifies:
 *
 *   login → /agent/work-queue renders → no error boundary →
 *   "Reminders" heading present → either reminder rows OR empty
 *   state visible
 *
 * Skips at runtime if TEST_PASSWORD isn't configured locally (same
 * convention as surface-file-detail.spec.ts and
 * surface-agent-hub.spec.ts).
 *
 * Run: npx playwright test e2e/surface-agent-reminders.spec.ts --reporter=list
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

test.describe("Surface 3 — agent reminders / work queue (happy path)", () => {
  test("login → /agent/work-queue renders without error boundary", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/work-queue");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByText("Application error")).not.toBeVisible();

    // Page title is "Reminders" (set by PageHeader). Always visible.
    const heading = page.getByRole("heading", { name: "Reminders" }).first();
    await expect(heading).toBeVisible();
  });

  test("either reminder rows OR empty-state CTA is visible", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/work-queue");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Director with reminders: either the AgentRemindersList group
    // labels render (Overdue / Due today / Coming up / Snoozed /
    // Completed) OR the empty-state Bell-illustrated card renders.
    const fullList = page.getByText(/Overdue|Due today|Coming up/i).first();
    const empty = page.getByText(/Your reminders will appear here|No files assigned yet/i).first();

    const seen = await Promise.race([
      fullList.waitFor({ state: "visible", timeout: 8000 }).then(() => "full" as const).catch(() => null),
      empty.waitFor({ state: "visible", timeout: 8000 }).then(() => "empty" as const).catch(() => null),
    ]);
    expect(seen).not.toBe(null);
  });
});
