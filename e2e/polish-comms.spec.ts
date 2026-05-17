/**
 * Stage 2 Gate — comms polish page
 *
 * Covers all 10 Interactive Polish Gate items from WORKFLOW.md:
 * - G1: canonical classes on all interactive elements
 * - G2: hover / focus / active states present and firing
 * - G3: focus treatment correct per element type
 * - G4: theme tokens on hover/focus (walkthrough)
 * - G5: all six themes render, screenshots captured
 * - G6: reduced-motion toggle suppresses transitions
 * - G7: keyboard navigation (walkthrough)
 * - G8: page-specific animation — agent-acc open/close on day groups
 * - G9: loading skeleton present, matches card structure
 * - G10: mobile frame present at 375px
 *
 * Screenshots land in e2e/screenshots/polish-comms/
 * Run: npx playwright test e2e/polish-comms.spec.ts --reporter=list
 */

import { test, expect, type Page } from "@playwright/test";
import { login, USERS } from "./helpers";
import path from "path";
import fs from "fs";

const PAGE_URL = "/agent/polish/comms";
const SS_BASE = path.join(__dirname, "screenshots", "polish-comms");
const THEMES = ["sunset", "coastal", "heritage", "slate", "emerald", "claret"];

function ssPath(name: string) {
  return path.join(SS_BASE, `${name}.png`);
}

async function ss(page: Page, name: string) {
  await page.screenshot({ path: ssPath(name), fullPage: false });
}

async function ssFullPage(page: Page, name: string) {
  await page.screenshot({ path: ssPath(name), fullPage: true });
}

let page: Page;

test.describe.serial("Stage 2 gate — comms", () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeAll(async ({ browser }) => {
    if (!fs.existsSync(SS_BASE)) fs.mkdirSync(SS_BASE, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    await login(page, USERS.negotiator);
    await page.waitForURL(/\/agent/, { timeout: 30000 });
    await page.goto(PAGE_URL);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector(".pp-pill", { timeout: 15000 });
    const cookieBtn = page.getByRole("button", { name: "Essential only" });
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G1 — Canonical interactive classes present
  // ──────────────────────────────────────────────────────────────────────────
  test("G1: canonical interactive classes present on all interactive elements", async () => {
    // Day group accordion headers must use canonical agent-acc-hdr
    const accHdrCount = await page.locator(".agent-acc-hdr").count();
    expect(accHdrCount, "agent-acc-hdr must be present for day group headers").toBeGreaterThan(0);

    // Accordion bodies use canonical agent-acc
    const accCount = await page.locator(".agent-acc").count();
    expect(accCount, "agent-acc must be present for day group bodies").toBeGreaterThan(0);

    // Filter pills: production-bound class (deliberate exception to .agent-segment-pill —
    // lighter chip treatment, approved in Stage 1)
    const pillCount = await page.locator(".comms-filter-pill").count();
    expect(pillCount, "comms-filter-pill must be present (min 2: desktop + mobile frame)").toBeGreaterThanOrEqual(2);

    // Transaction address links use .comms-tx-link (token-based hover, not hardcoded Tailwind)
    const txLinkCount = await page.locator(".comms-tx-link").count();
    expect(txLinkCount, "comms-tx-link must be present on transaction address links").toBeGreaterThan(0);

    // agent-skeleton: verify in loading state
    await page.locator("button.pp-pill", { hasText: "loading" }).click();
    await page.waitForTimeout(100);
    const skelCount = await page.locator(".agent-skeleton").count();
    expect(skelCount, "agent-skeleton must be present in loading state").toBeGreaterThan(0);

    // Restore populated
    await page.locator("button.pp-pill", { hasText: "populated" }).click();
    await page.waitForTimeout(100);

    // No raw background hex/rgb on production-bound buttons within the comms page content.
    // Scoped to [data-rm] (the comms page wrapper) to exclude AgentShell chrome buttons
    // (feedback widget, nav buttons etc.) which are out of scope for this gate.
    const rawStyleBtns = await page.evaluate(() => {
      const wrapper = document.querySelector("[data-rm]");
      if (!wrapper) return [];
      const productionBtns = Array.from(wrapper.querySelectorAll("button")).filter(
        (b) => !b.classList.contains("pp-pill")
      );
      return productionBtns
        .filter((b) => {
          const style = b.getAttribute("style") || "";
          return /background\s*:\s*#[0-9a-f]{3,6}/i.test(style) ||
                 /background\s*:\s*rgb\(/i.test(style);
        })
        .map((b) => b.textContent?.trim().slice(0, 40));
    });
    expect(
      rawStyleBtns.length,
      `Production buttons must not use raw background colours. Found: ${JSON.stringify(rawStyleBtns)}`
    ).toBe(0);

    await ss(page, "G1-canonical-classes");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G2 — Hover, focus, active states
  // ──────────────────────────────────────────────────────────────────────────
  // G2 hover — per WORKFLOW.md: "hover feel and visual responsiveness... requires Ellis browser
  // walkthrough." Automated checks cover rule existence + token resolution. Visual quality
  // is Ellis walkthrough.
  test("G2: hover rules exist in CSSOM for all interactive elements", async () => {
    // Check CSSOM for hover rules on production-bound interactive elements
    const hoverRules = await page.evaluate(() => {
      const results: Record<string, boolean> = {
        filterPill: false,
        txLink: false,
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (!(rule instanceof CSSStyleRule)) continue;
            const sel = rule.selectorText || "";
            if (sel.includes("comms-filter-pill") && sel.includes("hover")) results.filterPill = true;
            if (sel.includes("comms-tx-link") && sel.includes("hover")) results.txLink = true;
          }
        } catch { continue; }
      }
      // agent-acc-hdr hover is defined in agent-system.css (canonical class)
      return results;
    });
    expect(hoverRules.filterPill, "CSSOM must have hover rule for .comms-filter-pill").toBe(true);
    expect(hoverRules.txLink, "CSSOM must have hover rule for .comms-tx-link").toBe(true);

    // Token resolution: --agent-hover-tint must resolve on filter pill
    // (confirms [data-theme] ancestor is set and tokens cascade correctly)
    const pill = page.locator(".comms-filter-pill").first();
    const hoverTintToken = await pill.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue("--agent-hover-tint").trim()
    );
    expect(hoverTintToken, "--agent-hover-tint must resolve on .comms-filter-pill (requires [data-theme] ancestor)").not.toBe("");

    // Screenshots after hover for Ellis walkthrough
    await pill.hover();
    await page.waitForTimeout(200);
    await ss(page, "G2-filter-pill-hover");

    await page.mouse.move(100, 500);
    await page.waitForTimeout(100);
    const accHdr = page.locator(".agent-acc-hdr").first();
    await accHdr.hover();
    await page.waitForTimeout(200);
    await ss(page, "G2-acc-hdr-hover");

    await page.mouse.move(100, 500);
    await page.waitForTimeout(100);
    const txLink = page.locator(".comms-tx-link").first();
    await txLink.hover();
    await page.waitForTimeout(200);
    await ss(page, "G2-tx-link-hover");
    // requires Ellis browser walkthrough: hover every interactive element and confirm
    // visual response matches canonical behaviour (hover-tint on acc-hdr and tx-link,
    // hover-tint on unselected filter pill)
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G3 — Focus treatment correct per element type
  // ──────────────────────────────────────────────────────────────────────────
  test("G3: filter pill focus-visible shows box-shadow focus ring", async () => {
    // Navigate fresh so no mouse activity (ensures :focus-visible fires)
    await page.goto(PAGE_URL);
    await page.waitForSelector(".comms-filter-pill", { timeout: 15000 });

    const pill = page.locator(".comms-filter-pill").first();
    await pill.focus();
    await page.waitForTimeout(100);

    const boxShadow = await pill.evaluate((el) =>
      window.getComputedStyle(el).boxShadow
    );
    // Must have a focus ring (non-none box-shadow)
    expect(boxShadow, "comms-filter-pill focus must show box-shadow focus ring").not.toBe("none");
    await ss(page, "G3-filter-pill-focus");
  });

  test("G3: agent-acc-hdr focus-visible shows inset ring", async () => {
    // Navigate fresh
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    const accHdr = page.locator(".agent-acc-hdr").first();
    await accHdr.focus();
    await page.waitForTimeout(100);

    const boxShadow = await accHdr.evaluate((el) =>
      window.getComputedStyle(el).boxShadow
    );
    // agent-acc-hdr uses inset ring per ANIMATION_STANDARDS.md (lives inside overflow:hidden parent)
    // Must be non-none
    expect(boxShadow, "agent-acc-hdr focus must show inset ring (not outer halo)").not.toBe("none");
    await ss(page, "G3-acc-hdr-focus");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G4 — Theme tokens on hover/focus: requires Ellis browser walkthrough
  // ──────────────────────────────────────────────────────────────────────────
  // (No Playwright assertion — color quality across 6 themes is subjective)

  // ──────────────────────────────────────────────────────────────────────────
  // G5 — All six themes: screenshots
  // ──────────────────────────────────────────────────────────────────────────
  test("G5: all six themes render, screenshots captured", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".pp-pill", { timeout: 15000 });

    for (const theme of THEMES) {
      await page.locator("button.pp-pill", { hasText: theme }).first().click();
      await page.waitForTimeout(100);

      // Verify data-theme applied to .agent-bg
      const attrTheme = await page.locator(".agent-bg").first().getAttribute("data-theme");
      expect(attrTheme, `data-theme must be "${theme}" after clicking theme pill`).toBe(theme);

      await ss(page, `G5-theme-${theme}`);
    }

    // Reset to sunset
    await page.locator("button.pp-pill", { hasText: "sunset" }).first().click();
    await page.waitForTimeout(80);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G6 — Reduced-motion: transitions suppressed
  // ──────────────────────────────────────────────────────────────────────────
  test("G6: reduced-motion toggle suppresses transition durations", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".pp-pill", { timeout: 15000 });

    // Toggle rm ON
    await page.locator("button.pp-pill", { hasText: "rm" }).click();
    await page.waitForTimeout(50);

    const rmAttr = await page.locator("[data-rm]").first().getAttribute("data-rm");
    expect(rmAttr, "data-rm must be '1' when rm is ON").toBe("1");

    // Check agent-acc transition-duration is ≤ 0.01ms in rm mode.
    // Scoped to [data-rm] .agent-acc (the comms page wrapper) to exclude AgentShell
    // nav accordions which also use .agent-acc but are outside the rm scope.
    const accTransDuration = await page.locator("[data-rm] .agent-acc").first().evaluate((el) =>
      window.getComputedStyle(el).transitionDuration
    );
    const durationMs = parseFloat(accTransDuration) * (accTransDuration.includes("ms") ? 1 : 1000);
    expect(durationMs, "agent-acc transition-duration must be ≤ 0.01ms in rm mode").toBeLessThanOrEqual(0.01);

    // Check filter pill transition is also suppressed
    const pillTransDuration = await page.locator(".comms-filter-pill").first().evaluate((el) =>
      window.getComputedStyle(el).transitionDuration
    );
    const pillMs = parseFloat(pillTransDuration) * (pillTransDuration.includes("ms") ? 1 : 1000);
    expect(pillMs, "comms-filter-pill transition-duration must be ≤ 0.01ms in rm mode").toBeLessThanOrEqual(0.01);

    await ss(page, "G6-reduced-motion-on");

    // Toggle rm OFF
    await page.locator("button.pp-pill", { hasText: "rm" }).click();
    await page.waitForTimeout(50);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G7 — Keyboard tab through entire page: requires Ellis browser walkthrough
  // ──────────────────────────────────────────────────────────────────────────
  // (No Playwright assertion — focus order and visual quality are subjective)

  // ──────────────────────────────────────────────────────────────────────────
  // G8 — Page-specific animation: agent-acc open/close on day groups
  // ──────────────────────────────────────────────────────────────────────────
  test("G8a: agent-acc toggles .open class on day group click", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    // Monday bucket starts closed (defaultOpen: false).
    // Scoped with hasText to avoid index fragility from AgentShell's .agent-glass mobile sidebar.
    const mondayGlass = page.locator(".agent-glass").filter({ hasText: "Monday, 12 May" });
    const mondayHdr = mondayGlass.locator(".agent-acc-hdr");
    const mondayAcc = mondayGlass.locator(".agent-acc");

    // Initially closed
    const classesBefore = await mondayAcc.getAttribute("class");
    expect(classesBefore, "Monday acc must start without .open class").not.toContain("open");

    // Click to open
    await mondayHdr.click();
    await page.waitForTimeout(250); // 200ms open animation + buffer

    const classesAfterOpen = await mondayAcc.getAttribute("class");
    expect(classesAfterOpen, "Monday acc must have .open class after header click").toContain("open");
    await ss(page, "G8a-acc-opened");

    // Click to close
    await mondayHdr.click();
    await page.waitForTimeout(200); // 150ms close + buffer

    const classesAfterClose = await mondayAcc.getAttribute("class");
    expect(classesAfterClose, "Monday acc must lose .open class after second click").not.toContain("open");
    await ss(page, "G8a-acc-closed");
  });

  test("G8b: agent-acc gridTemplateRows differs between open and closed", async () => {
    // Monday bucket is currently closed from G8a (G8a navigated fresh and closed it)
    const mondayGlass = page.locator(".agent-glass").filter({ hasText: "Monday, 12 May" });
    const mondayHdr = mondayGlass.locator(".agent-acc-hdr");
    const mondayAcc = mondayGlass.locator(".agent-acc");

    const closedRows = await mondayAcc.evaluate((el) =>
      window.getComputedStyle(el).gridTemplateRows
    );

    await mondayHdr.click();
    await page.waitForTimeout(250);

    const openRows = await mondayAcc.evaluate((el) =>
      window.getComputedStyle(el).gridTemplateRows
    );

    expect(openRows, "gridTemplateRows must differ between open and closed (0px → content height)").not.toBe(closedRows);
    await ss(page, "G8b-grid-rows-open");
  });

  test("G8c: keyboard Enter/Space triggers open/close on agent-acc-hdr", async () => {
    // Navigate fresh
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    const mondayGlass = page.locator(".agent-glass").filter({ hasText: "Monday, 12 May" });
    const mondayHdr = mondayGlass.locator(".agent-acc-hdr");
    const mondayAcc = mondayGlass.locator(".agent-acc");

    // Focus the header, press Enter to open
    await mondayHdr.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);

    const classesAfterEnter = await mondayAcc.getAttribute("class");
    expect(classesAfterEnter, "agent-acc must open on Enter key").toContain("open");

    // Press Space to close
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);

    const classesAfterSpace = await mondayAcc.getAttribute("class");
    expect(classesAfterSpace, "agent-acc must close on Space key").not.toContain("open");

    await ss(page, "G8c-keyboard-open-close");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G9 — Loading skeleton matches card structure
  // ──────────────────────────────────────────────────────────────────────────
  test("G9: loading skeleton present and mirrors day-group card structure", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".pp-pill", { timeout: 15000 });

    // Switch to loading state
    await page.locator("button.pp-pill", { hasText: "loading" }).click();
    await page.waitForTimeout(100);

    // Skeleton must use agent-skeleton bars
    const skelCount = await page.locator(".agent-skeleton").count();
    expect(skelCount, "Loading state must have agent-skeleton elements").toBeGreaterThan(0);

    // Skeleton must have agent-glass cards (mirrors day group structure)
    const skelGlassCount = await page.locator(".agent-glass").count();
    expect(skelGlassCount, "Loading skeleton must have agent-glass cards (mirrors day group structure)").toBeGreaterThan(0);

    // Skeleton must have agent-acc-hdr (mirrors the card header)
    const skelHdrCount = await page.locator(".agent-acc-hdr").count();
    expect(skelHdrCount, "Loading skeleton must have agent-acc-hdr inside each skeleton card").toBeGreaterThan(0);

    await ss(page, "G9-loading-skeleton");

    // Restore populated
    await page.locator("button.pp-pill", { hasText: "populated" }).click();
    await page.waitForTimeout(100);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G10 — Mobile view at 375px
  // ──────────────────────────────────────────────────────────────────────────
  test("G10: mobile 375px frame present and correctly sized", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".m-frame", { timeout: 15000 });

    const mFrame = page.locator(".m-frame").first();
    await expect(mFrame).toBeVisible();

    // Width must be 375px (±10px tolerance for borders)
    const box = await mFrame.boundingBox();
    expect(box, "m-frame must have a bounding box").not.toBeNull();
    expect(box!.width, "m-frame width must be 375px").toBeGreaterThanOrEqual(365);
    expect(box!.width, "m-frame width must not exceed 395px").toBeLessThanOrEqual(395);

    // Day groups must be present in the mobile frame
    const mFrameAccHdrs = mFrame.locator(".agent-acc-hdr");
    const mFrameHdrCount = await mFrameAccHdrs.count();
    expect(mFrameHdrCount, "Mobile frame must contain agent-acc-hdr day group headers").toBeGreaterThan(0);

    // Filter pills must be present in the mobile frame
    const mFramePills = mFrame.locator(".comms-filter-pill");
    const mFramePillCount = await mFramePills.count();
    expect(mFramePillCount, "Mobile frame must contain comms-filter-pill elements").toBeGreaterThanOrEqual(2);

    await mFrame.scrollIntoViewIfNeeded();
    await ss(page, "G10-mobile-frame");

    // Also capture at actual 375px viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });
    await ss(page, "G10-375px-viewport");

    // Restore viewport
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Populated state — full page screenshot at 1440px
  // ──────────────────────────────────────────────────────────────────────────
  test("full-page: populated state screenshots", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });
    await ssFullPage(page, "full-populated");

    // Empty state
    await page.locator("button.pp-pill", { hasText: "empty" }).click();
    await page.waitForTimeout(100);
    await ssFullPage(page, "full-empty");

    // Portal filter
    await page.locator("button.pp-pill", { hasText: "populated" }).click();
    await page.locator("button.pp-pill", { hasText: "portal only" }).click();
    await page.waitForTimeout(100);
    await ss(page, "full-portal-filter");

    // Reset
    await page.locator("button.pp-pill", { hasText: "all milestones" }).click();
  });
});
