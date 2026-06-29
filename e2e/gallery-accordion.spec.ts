// Visual regression for the Accordion primitive.

import { test, expect } from "@playwright/test";

test.describe("Gallery — Accordion primitive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/gallery/accordion");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(250);
  });

  test("uncontrolled closed state", async ({ page }) => {
    await expect(page.getByTestId("acc-uncontrolled-closed")).toHaveScreenshot(
      "accordion-uncontrolled-closed.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("uncontrolled open state (defaultOpen=true)", async ({ page }) => {
    await expect(page.getByTestId("acc-uncontrolled-open")).toHaveScreenshot(
      "accordion-uncontrolled-open.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("no chevron variant", async ({ page }) => {
    await expect(page.getByTestId("acc-no-chevron")).toHaveScreenshot(
      "accordion-no-chevron.png",
      { maxDiffPixelRatio: 0.005, animations: "disabled" },
    );
  });

  test("behaviour: click header toggles", async ({ page }) => {
    const acc = page.getByTestId("acc-uncontrolled-closed");
    const body = acc.locator(".agent-acc");
    // Closed initially: aria-hidden=true on body region.
    await expect(acc.locator(".agent-acc-hdr")).toHaveAttribute("aria-expanded", "false");
    await acc.locator(".agent-acc-hdr").click();
    await page.waitForTimeout(250);
    await expect(acc.locator(".agent-acc-hdr")).toHaveAttribute("aria-expanded", "true");
    await expect(body).toHaveClass(/open/);
  });

  test("behaviour: keyboard Enter toggles", async ({ page }) => {
    const acc = page.getByTestId("acc-keyboard");
    await acc.locator(".agent-acc-hdr").focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    await expect(acc.locator(".agent-acc-hdr")).toHaveAttribute("aria-expanded", "true");
  });

  test("behaviour: keyboard Space toggles", async ({ page }) => {
    const acc = page.getByTestId("acc-keyboard");
    await acc.locator(".agent-acc-hdr").focus();
    await page.keyboard.press(" ");
    await page.waitForTimeout(250);
    await expect(acc.locator(".agent-acc-hdr")).toHaveAttribute("aria-expanded", "true");
  });

  test("behaviour: controlled mode mirrors state across siblings", async ({ page }) => {
    const group = page.getByTestId("acc-controlled-group");
    const headers = group.locator(".agent-acc-hdr");
    // Both start closed.
    await expect(headers.first()).toHaveAttribute("aria-expanded", "false");
    await expect(headers.last()).toHaveAttribute("aria-expanded", "false");
    // Click first; both should open because they share `open` state.
    await headers.first().click();
    await page.waitForTimeout(250);
    await expect(headers.first()).toHaveAttribute("aria-expanded", "true");
    await expect(headers.last()).toHaveAttribute("aria-expanded", "true");
  });

  test("mobile 375px: full page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/gallery/accordion");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot("accordion-gallery-mobile-375.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  });
});
