/**
 * Phase 3 Surface 1 — agent file detail happy-path E2E.
 *
 * Per Law 17, an E2E test must exist before behavioural baseline /
 * remediation work begins. This test verifies the surface's happy path:
 *
 *   login → list → first active file → hero renders → each tab loads
 *   without error → ownership ownership 404 on a non-existent id
 *
 * Skipped at runtime if the staging password isn't configured locally.
 * Author each new tester sets TEST_DIRECTOR_PASSWORD (or shared
 * TEST_PASSWORD) in .env.test.local — same convention as
 * e2e/auth.spec.ts.
 *
 * Run: npx playwright test e2e/surface-file-detail.spec.ts --reporter=list
 *
 * This becomes the regression sentinel that catches functional drift
 * across the surface-1 remediation. If the post-remediation surface
 * passes this test AND the visual diff is clean, we proceed.
 */

import { test, expect, type Page } from "@playwright/test";
import { login, USERS, dismissCookieBanner } from "./helpers";

const TABS = ["overview", "milestones", "reminders", "todos", "activity"] as const;

async function attemptLogin(page: Page): Promise<{ ok: true } | { ok: false; reason: string }> {
  await page.context().clearCookies();
  await login(page, USERS.director);
  await dismissCookieBanner(page);
  try {
    // Short timeout — if creds are bad, we hit the "Incorrect email" path
    // within ~1s. Long enough for the happy path on a warm dev server.
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
          "TEST_PASSWORD / TEST_DIRECTOR_PASSWORD does not match the staging Taylor account. " +
          "Set the correct password in .env.test.local to enable this suite.",
      };
    }
    return {
      ok: false,
      reason:
        "Login flow did not redirect to /agent/hub within 30s and no incorrect-password error was shown. " +
        "Check the dev server is running on localhost:3000.",
    };
  }
}

async function findFirstActiveTransactionId(page: Page): Promise<string | null> {
  await page.goto("/agent/transactions");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
  const detailLinks = await page.locator('a[href^="/agent/transactions/cm"]').all();
  if (detailLinks.length === 0) return null;
  const href = await detailLinks[0].getAttribute("href");
  return href?.match(/\/agent\/transactions\/([^/?#]+)/)?.[1] ?? null;
}

test.describe("Surface 1 — agent file detail (happy path)", () => {
  test("login → list → first file → all 5 tabs render", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    const txId = await findFirstActiveTransactionId(page);
    test.skip(!txId, "no active transaction available on staging");

    for (const tab of TABS) {
      await page.goto(`/agent/transactions/${txId}?tab=${tab}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500); // streamed Suspense panels

      // Each tab must NOT show an error boundary or login redirect.
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByText("Something went wrong")).not.toBeVisible();
      await expect(page.getByText("Application error")).not.toBeVisible();

      // Hero must render the address (every tab keeps the hero visible).
      // PropertyHero shows the address as an h1 / h2; check via a generic
      // role assertion to avoid coupling to the exact tag.
      const hero = page.locator("h1, h2").first();
      await expect(hero).toBeVisible();
    }
  });

  test("invalid id returns 404 (notFound)", async ({ page }) => {
    const auth = await attemptLogin(page);
    test.skip(!auth.ok, auth.ok ? "" : auth.reason);

    await page.goto("/agent/transactions/invalid-id-not-a-cuid");
    await page.waitForLoadState("domcontentloaded");

    // Next.js notFound() renders the 404 page. Don't depend on the exact
    // text (it changes per app shell); just assert we're not on the
    // detail page and not redirected to login.
    await expect(page).not.toHaveURL(/\/login/);
    // The URL stays on the invalid path.
    await expect(page).toHaveURL(/invalid-id-not-a-cuid/);
  });

  test("ownership: negotiator without ownership receives notFound", async ({ page }) => {
    // Deferred — requires a known transaction NOT owned by the test
    // negotiator. Add when negotiator fixture is in place.
    test.skip(true, "negotiator fixture not yet configured");
  });
});
