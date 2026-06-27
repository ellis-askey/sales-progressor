// Visual regression for the Banner primitive (alias of AgentBanner).

import { test, expect } from "@playwright/test";

const KINDS = ["info", "warning", "danger", "success"] as const;

test.describe("Gallery — Banner primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/banner");
    await page.waitForLoadState("networkidle");
    // agent-reveal-in mount animation needs to settle.
    await page.waitForTimeout(400);
  });

  test("kinds: info / warning / danger / success", async ({ page }) => {
    for (const kind of KINDS) {
      await expect(page.getByTestId(`banner-${kind}`)).toHaveScreenshot(
        `banner-${kind}.png`,
        { maxDiffPixelRatio: 0.005, animations: "disabled" },
      );
    }
  });

  test("with action button", async ({ page }) => {
    await expect(page.getByTestId("banner-with-action")).toHaveScreenshot(
      "banner-with-action.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("dismissible", async ({ page }) => {
    await expect(page.getByTestId("banner-dismissible")).toHaveScreenshot(
      "banner-dismissible.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("action + dismissible together", async ({ page }) => {
    await expect(page.getByTestId("banner-action-dismissible")).toHaveScreenshot(
      "banner-action-dismissible.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("title only (no body)", async ({ page }) => {
    await expect(page.getByTestId("banner-title-only")).toHaveScreenshot(
      "banner-title-only.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("mobile 375px: full page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/gallery/banner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot("banner-gallery-mobile-375.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  });
});
