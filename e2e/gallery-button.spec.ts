// Visual regression for the Button primitive.
//
// Renders /dev/gallery/button and captures screenshots of each named
// button instance via data-testid selectors. Any unexplained pixel
// diff fails the test per Law 18.

import { test, expect } from "@playwright/test";

const VARIANTS = ["primary", "secondary", "ghost", "danger"] as const;
const SIZES = ["xs", "sm", "md", "lg"] as const;

test.describe("Gallery — Button primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/button");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
  });

  test("variant × size matrix", async ({ page }) => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        await expect(
          page.getByTestId(`button-${variant}-${size}`),
        ).toHaveScreenshot(`button-${variant}-${size}.png`, {
          maxDiffPixelRatio: 0.005,
        });
      }
    }
  });

  test("disabled states", async ({ page }) => {
    for (const variant of VARIANTS) {
      await expect(
        page.getByTestId(`button-${variant}-disabled`),
      ).toHaveScreenshot(`button-${variant}-disabled.png`, {
        maxDiffPixelRatio: 0.005,
      });
    }
  });

  test("loading states (animations disabled)", async ({ page }) => {
    for (const variant of VARIANTS) {
      await expect(
        page.getByTestId(`button-${variant}-loading`),
      ).toHaveScreenshot(`button-${variant}-loading.png`, {
        maxDiffPixelRatio: 0.005,
        // Spinner animation would diff every run; disable for stable capture.
        animations: "disabled",
      });
    }
  });

  test("with icons (leading + trailing)", async ({ page }) => {
    await expect(page.getByTestId("button-with-icon")).toHaveScreenshot(
      "button-with-icon-leading.png",
      { maxDiffPixelRatio: 0.005 },
    );
    await expect(page.getByTestId("button-with-icon-trailing")).toHaveScreenshot(
      "button-with-icon-trailing.png",
      { maxDiffPixelRatio: 0.005 },
    );
  });

  test("hover state (primary md)", async ({ page }) => {
    const btn = page.getByTestId("button-primary-md");
    await btn.hover();
    await page.waitForTimeout(200); // transform + box-shadow transition
    await expect(btn).toHaveScreenshot("button-primary-md-hover.png", {
      maxDiffPixelRatio: 0.005,
    });
  });

  test("focus-visible state", async ({ page }) => {
    await page.getByTestId("button-focusable").focus();
    await page.waitForTimeout(150);
    await expect(page.getByTestId("button-focusable")).toHaveScreenshot(
      "button-focusable-focused.png",
      { maxDiffPixelRatio: 0.005 },
    );
  });

  test("mobile 375px: full page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/gallery/button");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot("button-gallery-mobile-375.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.005,
    });
  });
});
