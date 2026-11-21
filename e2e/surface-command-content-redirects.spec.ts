import { test, expect, type Page } from "@playwright/test";
import { login, dismissCookieBanner, PASSWORDS, USERS } from "./helpers";
import { CONTENT_REDIRECTS } from "../lib/content-redirects";

// Content consolidation — Phase 4B RUNTIME coverage.
//
// The static guard (__tests__/command/content-consolidation.test.ts) proves the
// redirect TABLE and the wiring. This spec proves the RUNTIME behaviour the
// static test cannot: that config redirects actually fire (and now take over
// from the deleted legacy pages), that Next forwards the request query onto the
// canonical URL, that the voice-action error round-trip lands on — and renders
// in — the right view, and that the engagement drill-down is NOT swept up by a
// redirect.
//
// Auth: uses the existing login() helper (real NextAuth form) with the
// Command-Centre-capable account. Needs a running app (baseURL) + .env.test
// credentials. It is skipped (not failed) when no credential is resolvable, so
// a credential-less CI run does not report a false failure. Run locally with
// TEST credentials to verify.

const CMD_EMAIL = USERS.superadmin ?? USERS.progressor; // ellis@… has CC powers via the allowlist
const CMD_PASSWORD = PASSWORDS.superadmin;
const CAN_RUN = Boolean(CMD_EMAIL && CMD_PASSWORD);

test.describe.serial("Command Centre — content consolidation redirects (runtime)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.skip(!CAN_RUN, "Needs a Command-Centre account + password (.env.test TEST_SUPERADMIN_* / TEST_PASSWORD).");
    const context = await browser.newContext();
    page = await context.newPage();
    await login(page, CMD_EMAIL, CMD_PASSWORD);
    // Land somewhere authenticated, then confirm CC access (not bounced to /login).
    await page.goto("/command/content");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  });

  test.afterAll(async () => {
    if (page) await page.context().close();
  });

  test("every legacy content route redirects to its canonical tab (query merged)", async () => {
    for (const r of CONTENT_REDIRECTS) {
      await page.goto(r.source);
      // page.goto resolves at the final URL after following the 307.
      expect(page.url(), `source ${r.source}`).toContain(r.destination);
    }
  });

  test("Create seed params are forwarded onto the canonical URL", async () => {
    await page.goto("/command/content/create?item=nonexistent-id");
    expect(page.url()).toContain("/command/content?tab=create&build=new");
    expect(page.url()).toContain("item=nonexistent-id");

    await page.goto("/command/content/create?opp=nonexistent-id");
    expect(page.url()).toContain("opp=nonexistent-id");
  });

  test("voice add-sample empty submit lands on Brand→Voice and DISPLAYS the error", async () => {
    await page.goto("/command/content?tab=brand&view=voice");
    await dismissCookieBanner(page);
    // The "Add a sample" form allows an empty submit; the action redirects back
    // with ?error=empty, which the voice view must render.
    await page.getByRole("button", { name: "Save sample" }).click();
    await expect(page).toHaveURL(/tab=brand&view=voice.*error=empty/, { timeout: 15000 });
    await expect(page.getByText("Content cannot be empty.")).toBeVisible();
  });

  test("the engagement drill-down route is NOT redirected", async () => {
    await page.goto("/command/content/engagement/nonexistent-id");
    // Whatever it renders (empty / not-found), it must stay on the engagement
    // path — never swept into the tabbed workspace by a redirect.
    expect(page.url()).toContain("/command/content/engagement/");
    expect(page.url()).not.toContain("?tab=");
  });

  test("the sidebar exposes exactly one canonical Content entry", async () => {
    await page.goto("/command/content");
    const nav = page.locator("nav");
    await expect(nav.locator('a[href="/command/content"]')).toHaveCount(1);
    // None of the retired legacy content links remain in the sidebar.
    await expect(nav.locator('a[href^="/command/content/"]')).toHaveCount(0);
  });
});
