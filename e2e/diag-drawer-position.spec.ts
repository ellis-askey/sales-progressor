/**
 * Diagnostic: verify drawer panel is visible at right edge of viewport.
 * Run standalone: npx playwright test e2e/diag-drawer-position.spec.ts
 */
import { test, type Page } from "@playwright/test";
import { login, USERS } from "./helpers";
import path from "path";
import fs from "fs";

const SS_DIR = path.join(__dirname, "screenshots", "polish-transaction-detail");

test("drawer panel clips correctly at viewport right edge", async ({ browser }) => {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await login(page, USERS.negotiator);
  await page.waitForURL(/\/agent/, { timeout: 30000 });
  await page.goto("/agent/polish/transaction-detail");
  await page.waitForSelector(".pp-pill", { timeout: 15000 });

  // Dismiss cookie banner if present
  const cookie = page.getByRole("button", { name: "Essential only" });
  if (await cookie.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cookie.click();
    await page.waitForTimeout(300);
  }

  // Full page baseline (no drawer)
  await page.screenshot({
    path: path.join(SS_DIR, "diag-baseline-nodrawer.png"),
    fullPage: false,
  });

  // Open chase drawer
  await page.getByRole("button", { name: "Chase drawer" }).click();
  await page.waitForSelector(".pp-overlay-drawer", { timeout: 3000 });
  await page.waitForTimeout(350); // drawer animation completes

  // Full viewport screenshot
  await page.screenshot({
    path: path.join(SS_DIR, "diag-drawer-full-viewport.png"),
    fullPage: false,
  });

  // Clipped: right 520px — should show the drawer panel
  await page.screenshot({
    path: path.join(SS_DIR, "diag-drawer-right-edge.png"),
    fullPage: false,
    clip: { x: 920, y: 0, width: 520, height: 900 },
  });

  // Clipped: left 920px — should show dimmed backdrop, no drawer
  await page.screenshot({
    path: path.join(SS_DIR, "diag-drawer-left-backdrop.png"),
    fullPage: false,
    clip: { x: 0, y: 0, width: 920, height: 900 },
  });

  // Log computed positions
  const info = await page.evaluate(() => {
    // Find overlay container by inline style
    const allFixed = Array.from(document.querySelectorAll<HTMLElement>("*")).filter(el => {
      const s = window.getComputedStyle(el);
      return s.position === "fixed" && parseInt(s.zIndex || "0") >= 100;
    });

    const drawerPanel = document.querySelector<HTMLElement>(".pp-overlay-drawer");
    const backdrop = document.querySelector<HTMLElement>(".pp-drawer-backdrop");
    const onboarding = document.querySelector<HTMLElement>('[style*="z-index: 50"]');

    return {
      fixedHighZElements: allFixed.map(el => ({
        tag: el.tagName,
        className: el.className.slice(0, 60),
        zIndex: window.getComputedStyle(el).zIndex,
        bb: el.getBoundingClientRect(),
      })),
      drawerPanel: drawerPanel ? {
        zIndex: window.getComputedStyle(drawerPanel).zIndex,
        position: window.getComputedStyle(drawerPanel).position,
        bb: drawerPanel.getBoundingClientRect(),
      } : null,
      backdrop: backdrop ? {
        zIndex: window.getComputedStyle(backdrop).zIndex,
        position: window.getComputedStyle(backdrop).position,
        bb: backdrop.getBoundingClientRect(),
      } : null,
      onboarding: onboarding ? {
        zIndex: window.getComputedStyle(onboarding).zIndex,
        position: window.getComputedStyle(onboarding).position,
        bb: onboarding.getBoundingClientRect(),
      } : null,
    };
  });

  console.log("=== Drawer diagnostic ===");
  console.log(JSON.stringify(info, null, 2));

  await ctx.close();
});
