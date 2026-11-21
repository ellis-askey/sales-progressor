import { test, expect, type Page } from "@playwright/test";
import { login, PASSWORDS, USERS } from "./helpers";
import { GROWTH_REDIRECTS } from "../lib/growth-redirects";

// Command Centre — Growth consolidation Phase 5A RUNTIME redirect coverage.
//
// The static guard (__tests__/command/growth-consolidation.test.ts) proves the
// GROWTH_REDIRECTS table. THIS spec proves what the static test cannot and what
// the brief specifically asked to verify rather than assume: the ACTUAL Next.js
// redirect semantics in a running app —
//   • each legacy dashboard route 307s to its canonical tab/view;
//   • view-local query params (period/tier, range, mode/agency, surface/sort/
//     feature) are forwarded onto the destination;
//   • the enquiries-chase ?tab=<value> is mapped to ?chase= and the legacy tab
//     NEVER appears as the effective workspace tab (which must stay experiments);
//   • Feature Usage detail URLs (?feature=) survive end-to-end.
//
// Auth via the existing login() helper (real NextAuth). Needs a running app +
// .env.test credentials; skipped (not failed) when none resolve. UNRUN in CI /
// headless here — must be run locally to close the runtime gap.

const CMD_EMAIL = USERS.superadmin ?? USERS.progressor;
const CMD_PASSWORD = PASSWORDS.superadmin;
const CAN_RUN = Boolean(CMD_EMAIL && CMD_PASSWORD);

test.describe.serial("Command Centre — Growth redirects (runtime)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.skip(!CAN_RUN, "Needs a Command-Centre account + password (.env.test).");
    const context = await browser.newContext();
    page = await context.newPage();
    await login(page, CMD_EMAIL, CMD_PASSWORD);
    await page.goto("/command/growth");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  });

  test.afterAll(async () => {
    if (page) await page.context().close();
  });

  test("every simple Growth dashboard route redirects to its canonical destination", async () => {
    for (const r of GROWTH_REDIRECTS.filter((x) => !x.has && x.source !== "/command/enquiries-chase")) {
      await page.goto(r.source);
      expect(page.url(), `source ${r.source}`).toContain(r.destination);
    }
  });

  test("Website period/tier, Chain-invites range, Feature detail, and scope are forwarded", async () => {
    await page.goto("/command/website-growth?period=90d&tier=outsourced");
    expect(page.url()).toContain("/command/growth?tab=acquisition&view=website");
    expect(page.url()).toContain("period=90d");
    expect(page.url()).toContain("tier=outsourced");

    await page.goto("/command/chain-invites?range=all");
    expect(page.url()).toContain("tab=acquisition&view=invites");
    expect(page.url()).toContain("range=all");

    await page.goto("/command/followup-usage?feature=nonexistent-id&surface=agent");
    expect(page.url()).toContain("tab=engagement&view=features");
    expect(page.url()).toContain("feature=nonexistent-id");
    expect(page.url()).toContain("surface=agent");

    await page.goto("/command/activation?mode=sp");
    expect(page.url()).toContain("tab=activation");
    expect(page.url()).toContain("mode=sp");
  });

  test("enquiries-chase maps all four sub-views to ?chase= and never overwrites the workspace tab", async () => {
    // Default → chasing (no chase param).
    await page.goto("/command/enquiries-chase");
    expect(page.url()).toContain("/command/growth?tab=experiments&view=chasing");

    for (const v of ["solicitor", "client", "opted_out"]) {
      await page.goto(`/command/enquiries-chase?tab=${v}`);
      const url = new URL(page.url());
      // The effective workspace tab is ALWAYS experiments…
      expect(url.searchParams.getAll("tab")).toContain("experiments");
      // …and the Experiments/Chasing tab actually rendered (not Trends).
      expect(url.searchParams.get("view")).toBe("chasing");
      expect(url.searchParams.get("chase")).toBe(v);
      // The Chasing view is on screen (its intro copy), proving tab resolved right.
      await expect(page.getByText("Every automated chase we send")).toBeVisible();
    }
  });
});
