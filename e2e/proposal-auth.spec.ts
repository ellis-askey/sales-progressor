import { test, expect } from "@playwright/test";

// Authentication-boundary coverage for the private Boardwalk proposal microsite.
// Financial-calculation coverage lives in __tests__/proposal/model.test.ts.
//
// Run against a dev/preview server (manual, like the rest of e2e/). A distinct
// forwarded IP keeps these legitimate logins clear of any brute-force lockout.
test.use({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.77" } });

test.describe("proposal access gate", () => {
  test("shows the password gate to unauthenticated visitors", async ({ page }) => {
    await page.goto("/proposal/boardwalk");
    await expect(page.getByRole("heading", { name: /Beyond Sales Progression/i })).toBeVisible();
    await expect(page.locator("#prop-pw")).toBeVisible();
  });

  test("rejects an incorrect password", async ({ page }) => {
    await page.goto("/proposal/boardwalk");
    await page.fill("#prop-pw", "wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByRole("alert")).toBeVisible();
    // Still gated — the experience must not have loaded.
    await expect(page.locator("#sec-cover")).toHaveCount(0);
  });

  test("admits the correct password and renders the experience", async ({ page }) => {
    await page.goto("/proposal/boardwalk");
    await page.fill("#prop-pw", "2027");
    await page.click('button[type="submit"]');
    await expect(page.locator("#sec-cover")).toBeAttached({ timeout: 30000 });
    await expect(page.locator("#sec-commercial")).toBeAttached();
  });

  test("protects the original PDF from unauthenticated access", async ({ request }) => {
    const res = await request.get("/api/proposal/pdf");
    expect(res.status()).toBe(401);
  });
});
