// Visual regression + behavioural tests for the Toast primitive.

import { test, expect } from "@playwright/test";

const TYPES = ["success", "info", "warning", "error"] as const;

test.describe("Gallery — Toast primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/toast");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
  });

  test("type variants render", async ({ page }) => {
    for (const type of TYPES) {
      await page.getByTestId(`toast-trigger-${type}`).click();
      // Wait for the toast mount animation to settle.
      await page.waitForTimeout(400);
      await expect(page).toHaveScreenshot(`toast-${type}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: "disabled",
      });
      // Wait for it to auto-dismiss before the next one (use the longest
      // duration: error = 8000ms). For the screenshot loop we cut this
      // short by reloading.
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(150);
    }
  });

  test("with description", async ({ page }) => {
    await page.getByTestId("toast-trigger-description").click();
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot("toast-with-description.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  });

  test("with action button", async ({ page }) => {
    await page.getByTestId("toast-trigger-action").click();
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot("toast-with-action.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  });

  test("persistent toast (duration 0) stays on screen", async ({ page }) => {
    await page.getByTestId("toast-trigger-persistent").click();
    await page.waitForTimeout(400);
    // Wait beyond the default duration to confirm it stays.
    await page.waitForTimeout(1500);
    // The toast container should still have a visible toast.
    const toasts = page.locator('[role="status"], [role="alert"]');
    await expect(toasts.first()).toBeVisible();
  });

  test("stacking: 3 toasts in succession render together", async ({ page }) => {
    await page.getByTestId("toast-trigger-stack").click();
    // Wait long enough for all 3 to land + mount animation.
    await page.waitForTimeout(700);
    await expect(page).toHaveScreenshot("toast-stacking.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  });
});
