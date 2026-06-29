// Visual regression for the Modal primitive.
//
// Each test opens the modal via its trigger button, waits for the
// agent-modal-in animation to settle, captures, then closes via Escape.

import { test, expect } from "@playwright/test";

const SIZES = ["sm", "md", "lg"] as const;
const SURFACES = ["solid", "glass"] as const;

test.describe("Gallery — Modal primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/modal");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
  });

  test("sizes: sm / md / lg", async ({ page }) => {
    for (const size of SIZES) {
      await page.getByTestId(`modal-trigger-${size}`).click();
      // agent-modal-in spring animation is 280ms; wait for it to settle.
      await page.waitForTimeout(350);
      await expect(page).toHaveScreenshot(`modal-${size}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }
  });

  test("surfaces: solid / glass", async ({ page }) => {
    for (const surface of SURFACES) {
      await page.getByTestId(`modal-trigger-${surface}`).click();
      await page.waitForTimeout(350);
      await expect(page).toHaveScreenshot(`modal-surface-${surface}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }
  });

  test("dismiss controls", async ({ page }) => {
    // No backdrop dismiss.
    await page.getByTestId("modal-trigger-no-backdrop").click();
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot("modal-no-backdrop-dismiss.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    // No close button.
    await page.getByTestId("modal-trigger-no-close").click();
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot("modal-no-close-button.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  });

  test("nested z-layer", async ({ page }) => {
    await page.getByTestId("modal-trigger-nested-outer").click();
    await page.waitForTimeout(350);
    await page.getByTestId("modal-trigger-nested-inner").click();
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot("modal-nested-zlayer.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  });

  test("behaviour: escape closes", async ({ page }) => {
    await page.getByTestId("modal-trigger-md").click();
    await page.waitForTimeout(350);
    // Modal is open — body should be present.
    await expect(page.getByTestId("modal-trigger-md-body")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    // Modal closed — body no longer in DOM.
    await expect(page.getByTestId("modal-trigger-md-body")).toBeHidden();
  });

  test("behaviour: backdrop click dismisses by default", async ({ page }) => {
    await page.getByTestId("modal-trigger-md").click();
    await page.waitForTimeout(350);
    // Click the backdrop (top-left corner of viewport, outside card).
    await page.mouse.click(20, 20);
    await page.waitForTimeout(150);
    await expect(page.getByTestId("modal-trigger-md-body")).toBeHidden();
  });

  test("behaviour: backdrop click is ignored when dismissOnBackdrop=false", async ({ page }) => {
    await page.getByTestId("modal-trigger-no-backdrop").click();
    await page.waitForTimeout(350);
    await page.mouse.click(20, 20);
    await page.waitForTimeout(150);
    // Modal should still be open.
    await expect(page.locator('[role="dialog"]').last()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("mobile 375px: open md modal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/gallery/modal");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("modal-trigger-md").click();
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot("modal-mobile-375.png", {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  });
});
