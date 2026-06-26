// Visual regression for the Card primitive.
//
// Renders /dev/gallery/card and captures screenshots of each named card
// instance via data-testid selectors. Any unexplained pixel diff fails
// the test per Law 18.
//
// Setup: requires a local dev server (npm run dev). Playwright config
// baseURL = http://localhost:3000.

import { test, expect } from "@playwright/test";

test.describe("Gallery — Card primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/card");
    // Block until the page settles. The gallery uses backdrop-filter which
    // needs the browser to compute the filter before the screenshot is
    // stable.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
  });

  test("variants: glass and solid", async ({ page }) => {
    await expect(page.getByTestId("card-glass")).toHaveScreenshot(
      "card-glass.png",
      { maxDiffPixelRatio: 0.005 },
    );
    await expect(page.getByTestId("card-solid")).toHaveScreenshot(
      "card-solid.png",
      { maxDiffPixelRatio: 0.005 },
    );
  });

  test("padding: none / sm / md / lg", async ({ page }) => {
    for (const size of ["none", "sm", "md", "lg"] as const) {
      await expect(page.getByTestId(`card-padding-${size}`)).toHaveScreenshot(
        `card-padding-${size}.png`,
        { maxDiffPixelRatio: 0.005 },
      );
    }
  });

  test("interactive: default state", async ({ page }) => {
    await expect(page.getByTestId("card-interactive")).toHaveScreenshot(
      "card-interactive-default.png",
      { maxDiffPixelRatio: 0.005 },
    );
  });

  test("interactive: hover state", async ({ page }) => {
    await page.getByTestId("card-interactive").hover();
    await page.waitForTimeout(200); // transition-shadow needs to settle
    await expect(page.getByTestId("card-interactive")).toHaveScreenshot(
      "card-interactive-hover.png",
      { maxDiffPixelRatio: 0.005 },
    );
  });

  test("loading: skeleton overlay", async ({ page }) => {
    // animate-pulse means the screenshot will diff every time it's taken.
    // For pulse-state, use a tighter threshold but allow the pulse opacity.
    await expect(page.getByTestId("card-loading")).toHaveScreenshot(
      "card-loading.png",
      { maxDiffPixelRatio: 0.02, animations: "disabled" },
    );
  });

  test("mobile 375px: full page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/gallery/card");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot("card-gallery-mobile-375.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.005,
    });
  });
});
