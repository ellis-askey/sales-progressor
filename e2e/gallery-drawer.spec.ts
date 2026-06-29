// Visual regression for the Drawer primitive.

import { test, expect } from "@playwright/test";

const SIZES = ["sm", "md", "lg", "xl"] as const;

test.describe("Gallery — Drawer primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/drawer");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
  });

  test("sizes: sm / md / lg / xl", async ({ page }) => {
    for (const size of SIZES) {
      await page.getByTestId(`drawer-trigger-${size}`).click();
      await page.waitForTimeout(350);
      await expect(page).toHaveScreenshot(`drawer-${size}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }
  });

  test("dismiss controls", async ({ page }) => {
    await page.getByTestId("drawer-trigger-no-backdrop").click();
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot("drawer-no-backdrop-dismiss.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    await page.getByTestId("drawer-trigger-no-close").click();
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot("drawer-no-close-button.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  });

  test("stacked drawers (isTopmost rule)", async ({ page }) => {
    await page.getByTestId("drawer-trigger-stacked-outer").click();
    await page.waitForTimeout(350);
    await page.getByTestId("drawer-trigger-stacked-inner").click();
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot("drawer-stacked.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  });

  test("behaviour: escape closes", async ({ page }) => {
    await page.getByTestId("drawer-trigger-md").click();
    await page.waitForTimeout(350);
    await expect(page.getByTestId("drawer-trigger-md-body")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await expect(page.getByTestId("drawer-trigger-md-body")).toBeHidden();
  });

  test("behaviour: backdrop click dismisses by default", async ({ page }) => {
    await page.getByTestId("drawer-trigger-md").click();
    await page.waitForTimeout(350);
    // Click backdrop (left side of viewport, well away from the right panel).
    await page.mouse.click(20, 400);
    await page.waitForTimeout(150);
    await expect(page.getByTestId("drawer-trigger-md-body")).toBeHidden();
  });

  test("behaviour: backdrop click is ignored when dismissOnBackdrop=false", async ({ page }) => {
    await page.getByTestId("drawer-trigger-no-backdrop").click();
    await page.waitForTimeout(350);
    await page.mouse.click(20, 400);
    await page.waitForTimeout(150);
    await expect(page.locator('[role="dialog"]').last()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("mobile 375px: open md drawer", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/gallery/drawer");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("drawer-trigger-md").click();
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot("drawer-mobile-375.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  });
});
