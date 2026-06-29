// Visual regression for the Skeleton primitive.
//
// Skeletons use the agent-shimmer animation. All captures disable
// animations so shimmer doesn't diff every run.

import { test, expect } from "@playwright/test";

test.describe("Gallery — Skeleton primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/skeleton");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
  });

  test("line variants (default / 80% / 40% widths)", async ({ page }) => {
    for (const id of ["skel-line-default", "skel-line-80", "skel-line-40"]) {
      await expect(page.getByTestId(id)).toHaveScreenshot(`${id}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: "disabled",
      });
    }
  });

  test("block variant (default + custom)", async ({ page }) => {
    for (const id of ["skel-block-default", "skel-block-custom"]) {
      await expect(page.getByTestId(id)).toHaveScreenshot(`${id}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: "disabled",
      });
    }
  });

  test("circle variants (4 sizes)", async ({ page }) => {
    for (const id of ["skel-circle-24", "skel-circle-32", "skel-circle-48", "skel-circle-64"]) {
      await expect(page.getByTestId(id)).toHaveScreenshot(`${id}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: "disabled",
      });
    }
  });

  test("card variant", async ({ page }) => {
    await expect(page.getByTestId("skel-card")).toHaveScreenshot(
      "skel-card.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("composed row example", async ({ page }) => {
    await expect(page.getByTestId("skel-row")).toHaveScreenshot(
      "skel-row.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("mobile 375px: full page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/gallery/skeleton");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot("skeleton-gallery-mobile-375.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  });
});
