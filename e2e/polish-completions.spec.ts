/**
 * Stage 2 Gate — completions polish page
 *
 * Covers all 10 Interactive Polish Gate items from WORKFLOW.md:
 * - G1: canonical classes on all interactive elements
 * - G2: hover / focus / active states present and firing
 * - G3: focus treatment correct per element type
 * - G4: theme tokens on hover/focus (walkthrough)
 * - G5: all six themes render, screenshots captured
 * - G6: reduced-motion toggle suppresses transitions
 * - G7: keyboard navigation (walkthrough)
 * - G8: page-specific animation — agent-acc open/close on urgency groups
 * - G9: loading skeleton present, matches group-as-card structure
 * - G10: mobile frame present at 375px
 *
 * Plus completions-specific gates:
 * - CG1: urgency colour coding (dot + label) visible in all group states
 * - CG2: StatPills present in populated state, absent in empty state
 * - CG3: ghost is abstract skeleton bars — no text content
 * - CG4: "Set date →" badge renders in no_date group file cards
 *
 * Screenshots land in e2e/screenshots/polish-completions/
 * Run: npx playwright test e2e/polish-completions.spec.ts --reporter=list
 */

import { test, expect, type Page } from "@playwright/test";
import { login, USERS } from "./helpers";
import path from "path";
import fs from "fs";

const PAGE_URL = "/agent/polish/completions";
const SS_BASE = path.join(__dirname, "screenshots", "polish-completions");
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

test.describe.serial("Stage 2 gate — completions", () => {
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
    // Urgency group accordion headers must use canonical agent-acc-hdr
    const accHdrCount = await page.locator(".agent-acc-hdr").count();
    expect(accHdrCount, "agent-acc-hdr must be present for urgency group headers").toBeGreaterThan(0);

    // Accordion bodies use canonical agent-acc
    const accCount = await page.locator(".agent-acc").count();
    expect(accCount, "agent-acc must be present for urgency group bodies").toBeGreaterThan(0);

    // StatPills use agent-link class (verified on StatPill component itself)
    const statPillLinks = await page.locator("a.agent-link").count();
    expect(statPillLinks, "agent-link must be present on StatPill anchor elements").toBeGreaterThan(0);

    // agent-skeleton: verify in loading state
    await page.locator("button.pp-pill", { hasText: "loading" }).click();
    await page.waitForTimeout(100);
    const skelCount = await page.locator(".agent-skeleton").count();
    expect(skelCount, "agent-skeleton must be present in loading state").toBeGreaterThan(0);

    // Restore populated
    await page.locator("button.pp-pill", { hasText: "populated" }).click();
    await page.waitForTimeout(100);

    // No raw background hex/rgb on production-bound buttons within the agent-bg wrapper
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
  test("G2: hover rules exist in CSSOM and token --agent-hover-tint resolves on acc-hdr", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    // agent-acc-hdr hover is defined in agent-system.css (canonical class)
    const hoverRule = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (!(rule instanceof CSSStyleRule)) continue;
            const sel = rule.selectorText || "";
            if (sel.includes("agent-acc-hdr") && sel.includes("hover")) return true;
          }
        } catch { continue; }
      }
      return false;
    });
    expect(hoverRule, "CSSOM must have hover rule for .agent-acc-hdr (from agent-system.css)").toBe(true);

    // Token resolution: --agent-hover-tint must resolve on acc-hdr
    const accHdr = page.locator("[data-rm] .agent-acc-hdr").first();
    const hoverTintToken = await accHdr.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue("--agent-hover-tint").trim()
    );
    expect(hoverTintToken, "--agent-hover-tint must resolve on .agent-acc-hdr (requires [data-theme] ancestor)").not.toBe("");

    // StatPill hover — verify agent-link has hover underline in CSSOM
    const agentLinkHover = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (!(rule instanceof CSSStyleRule)) continue;
            const sel = rule.selectorText || "";
            if (sel.includes("agent-link") && sel.includes("hover")) return true;
          }
        } catch { continue; }
      }
      return false;
    });
    expect(agentLinkHover, "CSSOM must have hover rule for .agent-link (StatPill)").toBe(true);

    // Screenshot after hover for Ellis walkthrough
    await accHdr.hover();
    await page.waitForTimeout(200);
    await ss(page, "G2-acc-hdr-hover");

    // File card hover (hover:shadow-md on <a>)
    await page.mouse.move(100, 500);
    await page.waitForTimeout(100);
    // Open the overdue group first
    const overdueGroup = page.locator(".agent-glass").filter({ hasText: "Overdue" }).first();
    await overdueGroup.locator(".agent-acc-hdr").click();
    await page.waitForTimeout(250);
    const fileCard = page.locator("[data-rm] .glass-card").filter({ hasText: "14 High Street" }).first();
    await fileCard.hover();
    await page.waitForTimeout(200);
    await ss(page, "G2-file-card-hover");

    // requires Ellis browser walkthrough: hover every acc-hdr (all 3 urgency groups) and
    // confirm hover-tint fires; hover StatPills and confirm underline appears; hover file
    // cards and confirm shadow lifts.
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G3 — Focus treatment correct per element type
  // ──────────────────────────────────────────────────────────────────────────
  test("G3: agent-acc-hdr focus-visible shows inset ring (not outer halo)", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    // Scoped to [data-rm] to exclude AgentShell nav acc headers
    const accHdr = page.locator("[data-rm] .agent-acc-hdr").first();
    await accHdr.focus();
    await page.waitForTimeout(100);

    const boxShadow = await accHdr.evaluate((el) =>
      window.getComputedStyle(el).boxShadow
    );
    // agent-acc-hdr uses inset ring per ANIMATION_STANDARDS.md — must be non-none
    expect(boxShadow, "agent-acc-hdr focus must show inset ring (lives inside overflow:hidden parent)").not.toBe("none");
    // Confirm it is an inset shadow (not outer halo)
    expect(boxShadow, "agent-acc-hdr focus ring must be inset (not outer box-shadow)").toContain("inset");
    await ss(page, "G3-acc-hdr-focus");
  });

  test("G3: StatPill focus-visible shows box-shadow focus ring", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector("a.agent-link", { timeout: 15000 });

    const statPill = page.locator("a.agent-link").first();
    await statPill.focus();
    await page.waitForTimeout(100);

    const boxShadow = await statPill.evaluate((el) =>
      window.getComputedStyle(el).boxShadow
    );
    expect(boxShadow, "StatPill (agent-link) focus must show box-shadow focus ring").not.toBe("none");
    await ss(page, "G3-stat-pill-focus");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G4 — Theme tokens on hover/focus: requires Ellis browser walkthrough
  // ──────────────────────────────────────────────────────────────────────────
  // (No Playwright assertion — colour quality across 6 themes is subjective)

  // ──────────────────────────────────────────────────────────────────────────
  // G5 — All six themes: screenshots
  // ──────────────────────────────────────────────────────────────────────────
  test("G5: all six themes render, screenshots captured", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".pp-pill", { timeout: 15000 });

    for (const theme of THEMES) {
      await page.locator("button.pp-pill", { hasText: theme }).first().click();
      await page.waitForTimeout(100);

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

    await page.locator("button.pp-pill", { hasText: "rm" }).click();
    await page.waitForTimeout(50);

    const rmAttr = await page.locator("[data-rm]").first().getAttribute("data-rm");
    expect(rmAttr, "data-rm must be '1' when rm is ON").toBe("1");

    // Check agent-acc transition-duration is ≤ 0.01ms in rm mode.
    // Scoped to [data-rm] .agent-acc to exclude AgentShell nav accordions.
    const accTransDuration = await page.locator("[data-rm] .agent-acc").first().evaluate((el) =>
      window.getComputedStyle(el).transitionDuration
    );
    const durationMs = parseFloat(accTransDuration) * (accTransDuration.includes("ms") ? 1 : 1000);
    expect(durationMs, "agent-acc transition-duration must be ≤ 0.01ms in rm mode").toBeLessThanOrEqual(0.01);

    await ss(page, "G6-reduced-motion-on");

    await page.locator("button.pp-pill", { hasText: "rm" }).click();
    await page.waitForTimeout(50);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G7 — Keyboard tab through entire page: requires Ellis browser walkthrough
  // ──────────────────────────────────────────────────────────────────────────
  // (No Playwright assertion — focus order and visual quality are subjective)

  // ──────────────────────────────────────────────────────────────────────────
  // G8 — Page-specific animation: agent-acc open/close on urgency groups
  // ──────────────────────────────────────────────────────────────────────────
  test("G8a: agent-acc toggles .open class on urgency group click", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    // All groups start closed. Scoped by hasText to target a specific group.
    const overdueGlass = page.locator("[data-rm] .agent-glass").filter({ hasText: "Overdue" }).first();
    const overdueHdr = overdueGlass.locator(".agent-acc-hdr");
    const overdueAcc = overdueGlass.locator(".agent-acc");

    // Initially closed
    const classesBefore = await overdueAcc.getAttribute("class");
    expect(classesBefore, "Overdue acc must start without .open class (all groups start closed)").not.toContain("open");

    // Click to open
    await overdueHdr.click();
    await page.waitForTimeout(250);

    const classesAfterOpen = await overdueAcc.getAttribute("class");
    expect(classesAfterOpen, "Overdue acc must have .open class after header click").toContain("open");
    await ss(page, "G8a-overdue-acc-opened");

    // Click to close
    await overdueHdr.click();
    await page.waitForTimeout(200);

    const classesAfterClose = await overdueAcc.getAttribute("class");
    expect(classesAfterClose, "Overdue acc must lose .open class after second click").not.toContain("open");
    await ss(page, "G8a-overdue-acc-closed");
  });

  test("G8b: agent-acc gridTemplateRows differs between open and closed", async () => {
    const overdueGlass = page.locator("[data-rm] .agent-glass").filter({ hasText: "Overdue" }).first();
    const overdueHdr = overdueGlass.locator(".agent-acc-hdr");
    const overdueAcc = overdueGlass.locator(".agent-acc");

    const closedRows = await overdueAcc.evaluate((el) =>
      window.getComputedStyle(el).gridTemplateRows
    );

    await overdueHdr.click();
    await page.waitForTimeout(250);

    const openRows = await overdueAcc.evaluate((el) =>
      window.getComputedStyle(el).gridTemplateRows
    );

    expect(openRows, "gridTemplateRows must differ between open and closed (0px → content height)").not.toBe(closedRows);
    await ss(page, "G8b-grid-rows-open");
  });

  test("G8c: keyboard Enter/Space triggers open/close on urgency group", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    const overdueGlass = page.locator("[data-rm] .agent-glass").filter({ hasText: "Overdue" }).first();
    const overdueHdr = overdueGlass.locator(".agent-acc-hdr");
    const overdueAcc = overdueGlass.locator(".agent-acc");

    await overdueHdr.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);

    const classesAfterEnter = await overdueAcc.getAttribute("class");
    expect(classesAfterEnter, "agent-acc must open on Enter key").toContain("open");

    await page.keyboard.press("Space");
    await page.waitForTimeout(200);

    const classesAfterSpace = await overdueAcc.getAttribute("class");
    expect(classesAfterSpace, "agent-acc must close on Space key").not.toContain("open");
    await ss(page, "G8c-keyboard-open-close");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G9 — Loading skeleton matches group-as-card structure
  // ──────────────────────────────────────────────────────────────────────────
  test("G9: loading skeleton present and mirrors urgency-group-as-card structure", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".pp-pill", { timeout: 15000 });

    await page.locator("button.pp-pill", { hasText: "loading" }).click();
    await page.waitForTimeout(100);

    // Skeleton must have agent-skeleton bars
    const skelCount = await page.locator(".agent-skeleton").count();
    expect(skelCount, "Loading state must have agent-skeleton elements").toBeGreaterThan(0);

    // Skeleton must use agent-glass (mirrors urgency group card structure)
    const skelGlassCount = await page.locator(".agent-glass").count();
    expect(skelGlassCount, "Loading skeleton must have agent-glass cards (mirrors urgency group structure)").toBeGreaterThan(0);

    // Skeleton must have agent-acc-hdr (mirrors the canonical group header)
    const skelHdrCount = await page.locator(".agent-acc-hdr").count();
    expect(skelHdrCount, "Loading skeleton must have agent-acc-hdr inside each skeleton card").toBeGreaterThan(0);

    await ss(page, "G9-loading-skeleton");

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

    const box = await mFrame.boundingBox();
    expect(box, "m-frame must have a bounding box").not.toBeNull();
    expect(box!.width, "m-frame width must be 375px").toBeGreaterThanOrEqual(365);
    expect(box!.width, "m-frame width must not exceed 395px").toBeLessThanOrEqual(395);

    // Mobile frame must contain urgency group acc-hdrs
    const mFrameAccHdrs = mFrame.locator(".agent-acc-hdr");
    const mFrameHdrCount = await mFrameAccHdrs.count();
    expect(mFrameHdrCount, "Mobile frame must contain agent-acc-hdr urgency group headers").toBeGreaterThan(0);

    // Mobile frame must contain StatPills (in populated state)
    const mFramePills = mFrame.locator("a.agent-link");
    const mFramePillCount = await mFramePills.count();
    expect(mFramePillCount, "Mobile frame must contain StatPill anchor elements (populated state)").toBeGreaterThan(0);

    await mFrame.scrollIntoViewIfNeeded();
    await ss(page, "G10-mobile-frame");

    // Capture at actual 375px viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });
    await ss(page, "G10-375px-viewport");

    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CG1 — Urgency colour preserved in agent-acc-hdr (completions-specific)
  // ──────────────────────────────────────────────────────────────────────────
  test("CG1: urgency dot and label colours visible in all group states", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    // Overdue group: dot must be red (bg-red-500 → computed rgb(239,68,68))
    const overdueGlass = page.locator("[data-rm] .agent-glass").filter({ hasText: "Overdue" }).first();
    const overdueDotBg = await overdueGlass.locator(".agent-acc-hdr div").first().evaluate((el) => {
      // Walk descendants to find the dot (first small rounded div)
      const dot = el.querySelector(".rounded-full");
      return dot ? window.getComputedStyle(dot).backgroundColor : "";
    });
    // bg-red-500 = rgb(239,68,68). Not exact match — just confirm it's reddish (R > 200, G < 100)
    const [r, g] = (overdueDotBg.match(/\d+/g) || []).map(Number);
    expect(r, "Overdue dot must have a red-dominant background").toBeGreaterThan(200);
    expect(g, "Overdue dot must have low green channel (not neutral)").toBeLessThan(100);

    // This_week group: dot must be amber (bg-amber-500 → rgb(245,158,11))
    const thisWeekGlass = page.locator("[data-rm] .agent-glass").filter({ hasText: "Completing this week" }).first();
    const thisWeekDotBg = await thisWeekGlass.locator(".agent-acc-hdr div").first().evaluate((el) => {
      const dot = el.querySelector(".rounded-full");
      return dot ? window.getComputedStyle(dot).backgroundColor : "";
    });
    const [r2, g2, b2] = (thisWeekDotBg.match(/\d+/g) || []).map(Number);
    // Amber: R ≈ 245, G ≈ 158, B ≈ 11 — confirm R and G both high, B low
    expect(r2, "This-week dot must have high red channel (amber)").toBeGreaterThan(200);
    expect(g2, "This-week dot must have mid-high green channel (amber)").toBeGreaterThan(100);
    expect(b2, "This-week dot must have low blue channel (amber, not blue)").toBeLessThan(50);

    // No-date group: dot must be light grey (bg-slate-300 → rgb(203,213,225))
    const noDateGlass = page.locator("[data-rm] .agent-glass").filter({ hasText: "No completion date" }).first();
    const noDateDotBg = await noDateGlass.locator(".agent-acc-hdr div").first().evaluate((el) => {
      const dot = el.querySelector(".rounded-full");
      return dot ? window.getComputedStyle(dot).backgroundColor : "";
    });
    const [r3] = (noDateDotBg.match(/\d+/g) || []).map(Number);
    expect(r3, "No-date dot must have high red channel (light grey)").toBeGreaterThan(150);

    await ss(page, "CG1-urgency-colours");

    // requires Ellis browser walkthrough: visually confirm red dot/label (Overdue),
    // amber dot/label (Completing this week), grey dot/label (No completion date set)
    // are all clearly visible at rest AND on hover of the acc-hdr.
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CG2 — StatPills in populated; absent in empty (completions-specific)
  // ──────────────────────────────────────────────────────────────────────────
  test("CG2: StatPills present in populated state, absent in empty state", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".pp-pill", { timeout: 15000 });

    // Populated: StatPills must be present in the PageHeader
    const populatedPillCount = await page.locator("[data-rm] a.agent-link").count();
    expect(populatedPillCount, "StatPills must be present in populated state").toBeGreaterThan(0);
    await ss(page, "CG2-populated-stat-pills");

    // Empty: no StatPills in the PageHeader
    await page.locator("button.pp-pill", { hasText: "empty" }).click();
    await page.waitForTimeout(100);
    const emptyPillCount = await page.locator("[data-rm] a.agent-link").count();
    expect(emptyPillCount, "StatPills must not be present in empty state (no files → no segments)").toBe(0);
    await ss(page, "CG2-empty-no-stat-pills");

    await page.locator("button.pp-pill", { hasText: "populated" }).click();
    await page.waitForTimeout(100);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CG3 — Ghost is abstract skeleton bars (completions-specific)
  // ──────────────────────────────────────────────────────────────────────────
  test("CG3: ghost contains agent-skeleton bars and no readable text content", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".pp-pill", { timeout: 15000 });

    await page.locator("button.pp-pill", { hasText: "empty" }).click();
    await page.waitForTimeout(100);

    // Ghost must exist in empty state (desktop + mobile both render it; check first/desktop)
    const ghost = page.locator('[data-testid="completions-ghost"]').first();
    await expect(ghost).toBeVisible();

    // Ghost must have agent-skeleton bars
    const ghostSkelCount = await ghost.locator(".agent-skeleton").count();
    expect(ghostSkelCount, "Ghost must have agent-skeleton bars (not rendered text)").toBeGreaterThan(0);

    // Ghost must have agent-glass + agent-acc-hdr structure
    const ghostGlass = await ghost.locator(".agent-glass").count();
    expect(ghostGlass, "Ghost must use agent-glass card structure").toBeGreaterThan(0);
    const ghostHdr = await ghost.locator(".agent-acc-hdr").count();
    expect(ghostHdr, "Ghost must use agent-acc-hdr header structure").toBeGreaterThan(0);

    // Ghost must NOT contain readable text content (no <p> or <span> with text)
    const ghostHasText = await ghost.evaluate((el) => {
      const textEls = el.querySelectorAll("p, span");
      return Array.from(textEls).some((node) => node.textContent?.trim().length ?? 0 > 0);
    });
    expect(ghostHasText, "Ghost must not contain real text — must use agent-skeleton bars only").toBe(false);

    await ss(page, "CG3-ghost-abstract-skeleton");

    await page.locator("button.pp-pill", { hasText: "populated" }).click();
    await page.waitForTimeout(100);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CG4 — "Set date →" badge renders in no_date group (completions-specific)
  // ──────────────────────────────────────────────────────────────────────────
  test("CG4: 'Set date →' badge appears in no_date group file cards when expanded", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    // Open the no_date group
    const noDateGlass = page.locator("[data-rm] .agent-glass").filter({ hasText: "No completion date" }).first();
    await noDateGlass.locator(".agent-acc-hdr").click();
    await page.waitForTimeout(250);

    // "Set date →" badge must be visible
    const setDateBadge = noDateGlass.locator("text=Set date →").first();
    await expect(setDateBadge, "'Set date →' badge must be visible in no_date group when expanded").toBeVisible();

    await ss(page, "CG4-set-date-badge");

    // requires Ellis browser walkthrough: confirm the badge is a styled span (not a link),
    // and that clicking the file card routes to transaction detail (not a date picker).
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Full-page screenshots — all states
  // ──────────────────────────────────────────────────────────────────────────
  test("full-page: all state screenshots", async () => {
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });

    // Open all groups for full populated screenshot
    const accHdrs = await page.locator("[data-rm] .agent-acc-hdr").all();
    for (const hdr of accHdrs) {
      await hdr.click();
      await page.waitForTimeout(220);
    }
    await ssFullPage(page, "full-populated-expanded");

    // Populated collapsed
    await page.goto(PAGE_URL);
    await page.waitForSelector(".agent-acc-hdr", { timeout: 15000 });
    await ssFullPage(page, "full-populated-collapsed");

    // Empty state
    await page.locator("button.pp-pill", { hasText: "empty" }).click();
    await page.waitForTimeout(100);
    await ssFullPage(page, "full-empty");

    // Loading state
    await page.locator("button.pp-pill", { hasText: "loading" }).click();
    await page.waitForTimeout(100);
    await ss(page, "full-loading");

    await page.locator("button.pp-pill", { hasText: "populated" }).click();
    await page.waitForTimeout(100);
  });
});
