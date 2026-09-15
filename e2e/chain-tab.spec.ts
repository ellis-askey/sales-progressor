/**
 * Chain tab — Part B happy-path gate.
 *
 * Verifies the ChainView extraction (docs/active/chain-agent-chase/00-spec.md
 * Part B): the property file has a "Chain" tab that renders the chain body
 * INLINE (not as the slide-over drawer), on a real logged-in session, without an
 * error boundary. This is the main regression surface of the arc.
 *
 * Asserts:
 *  - the "Chain" tab is present on a property file,
 *  - clicking it renders the inline ChainView container (.chain-view-inline),
 *  - it does NOT open the slide-over drawer (no .agent-backdrop-overlay),
 *  - no "Something went wrong" / "Application error" boundary.
 *
 * Requires the app running on the Playwright baseURL (:3000) and TEST_DIRECTOR
 * creds in .env.test.local.
 * Run: npx playwright test e2e/chain-tab.spec.ts --reporter=list
 */

import { test, expect } from "@playwright/test";
import { login, USERS, PASSWORDS, dismissCookieBanner } from "./helpers";

test.describe.serial("Chain tab renders inline", () => {
  test.describe.configure({ timeout: 90000 });

  test("Chain tab shows the chain inline, not as a drawer", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();

    // Log in as a customer-agency director (sees their own files).
    await login(page, USERS.director, PASSWORDS.director);
    await page.waitForURL(/\/agent/, { timeout: 30000 });
    await dismissCookieBanner(page);

    // Open the first real property file the director can see. The hub + lists
    // link to /agent/transactions/<id>; take the first such link.
    await page.goto("/agent");
    await page.waitForLoadState("domcontentloaded");
    const fileLink = page.locator('a[href*="/agent/transactions/"]').first();
    await expect(fileLink, "director should have at least one file to open").toBeVisible({ timeout: 20000 });
    await fileLink.click();
    await page.waitForURL(/\/agent\/transactions\/[^/]+/, { timeout: 20000 });
    await page.waitForLoadState("domcontentloaded");

    // The Chain tab is present.
    const chainTab = page.getByRole("button", { name: "Chain", exact: true });
    await expect(chainTab, "Chain tab should be present on the file").toBeVisible({ timeout: 20000 });

    await chainTab.click();

    // The inline ChainView container renders (present in every chain state:
    // empty "build the chain", "chain started", or a populated ladder).
    await expect(
      page.locator(".chain-view-inline"),
      "clicking Chain should render the chain inline",
    ).toBeVisible({ timeout: 20000 });

    // It is NOT the slide-over drawer: the drawer paints a backdrop, the tab does not.
    await expect(
      page.locator(".agent-backdrop-overlay"),
      "the tab must render inline, not open the drawer",
    ).toHaveCount(0);

    // No error boundary.
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByText("Application error")).not.toBeVisible();

    await ctx.close();
  });
});
