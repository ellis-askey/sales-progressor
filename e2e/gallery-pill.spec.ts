// Visual regression for the Pill primitive.

import { test, expect } from "@playwright/test";

const TONES = ["default", "muted", "info", "success", "warning", "danger"] as const;
const SIZES = ["sm", "md"] as const;

test.describe("Gallery — Pill primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/pill");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
  });

  test("tone × size matrix", async ({ page }) => {
    for (const tone of TONES) {
      for (const size of SIZES) {
        await expect(
          page.getByTestId(`pill-${tone}-${size}`),
        ).toHaveScreenshot(`pill-${tone}-${size}.png`, {
          maxDiffPixelRatio: 0.005,
        });
      }
    }
  });

  test("outline style per tone", async ({ page }) => {
    for (const tone of TONES) {
      await expect(
        page.getByTestId(`pill-outline-${tone}`),
      ).toHaveScreenshot(`pill-outline-${tone}.png`, {
        maxDiffPixelRatio: 0.005,
      });
    }
  });

  test("with composed glyphs", async ({ page }) => {
    for (const id of [
      "pill-with-arrow-up",
      "pill-with-arrow-down",
      "pill-with-dot",
      "pill-not-contacted",
    ]) {
      await expect(page.getByTestId(id)).toHaveScreenshot(`${id}.png`, {
        maxDiffPixelRatio: 0.005,
      });
    }
  });

  test("mobile 375px: full page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/gallery/pill");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot("pill-gallery-mobile-375.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.005,
    });
  });
});
