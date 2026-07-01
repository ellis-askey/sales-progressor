// scripts/help-screenshots/capture.ts
//
// Playwright test that signs in as Tom Hartwell and captures all 7 help-library
// screenshots, then polishes each one with sharp.
//
// Prerequisites:
//   1. Dev server running at localhost:3000
//   2. Help library seed has been run: npm run db:seed-help-library
//   3. Chromium installed: npx playwright install chromium
//
// Run with:  npm run capture-help-screenshots

import { test, type Locator, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { polish } from "./polish";

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "../..");
const RAW_DIR = path.join(ROOT, "docs/help/screenshots/raw");
// Polished PNGs go directly to public/ so Next.js can serve them at /help-screenshots/*
const OUT_DIR = path.join(ROOT, "public/help-screenshots");

[RAW_DIR, OUT_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// ── Seed artifacts ────────────────────────────────────────────────────────────

const artifactsPath = path.join(__dirname, "seed-artifacts.json");
if (!fs.existsSync(artifactsPath)) {
  throw new Error(
    "seed-artifacts.json not found. Run: npm run db:seed-help-library"
  );
}

const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8")) as {
  tomId: string;
  emmaId: string;
  emmaEmail: string;
  birchwoodLaneId: string;
  sarahPortalToken: string;
  directorInviteToken: string;
};

// ── Credentials ───────────────────────────────────────────────────────────────

const DIRECTOR_EMAIL    = "tom@hartwellestates.co.uk";
const DIRECTOR_PASSWORD = "HelpLibrary2026!";

// ── Suppress overlaying UI ────────────────────────────────────────────────────
// Runs before every page script so the cookie banner and onboarding widget
// never render. Must be called before the first page.goto() in each test.

async function suppressOverlays(page: Page): Promise<void> {
  const tomId = artifacts.tomId;
  await page.addInitScript((tid: string) => {
    try {
      localStorage.setItem(
        "cookie-consent",
        JSON.stringify({ analytics: false, decidedAt: Date.now() })
      );
      localStorage.setItem(`sp_onboarding_dismissed_${tid}`, "1");
    } catch {}
  }, tomId);
}

// ── Helper: save raw + polish ─────────────────────────────────────────────────

async function capture(
  page: Page,
  name: string,
  opts?: {
    selector?: string;
    locator?: Locator;
    width?: number;
    clip?: { x: number; y: number; width: number; height: number };
  }
): Promise<void> {
  const rawPath = path.join(RAW_DIR, `${name}.png`);
  const outPath = path.join(OUT_DIR, `${name}.png`);

  if (opts?.locator) {
    const el = opts.locator;
    await el.waitFor({ state: "visible", timeout: 15_000 });
    await el.screenshot({ path: rawPath });
  } else if (opts?.selector) {
    const el = page.locator(opts.selector).first();
    await el.waitFor({ state: "visible", timeout: 15_000 });
    await el.screenshot({ path: rawPath });
  } else if (opts?.clip) {
    await page.screenshot({ path: rawPath, clip: opts.clip });
  } else {
    await page.screenshot({ path: rawPath, fullPage: false });
  }

  await polish(rawPath, outPath, { width: opts?.width ?? 1200 });
  console.log(`  ✓ ${name}.png`);
}

// Cookie-only overlay suppression (leaves onboarding checklist visible)
async function suppressCookieOnly(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "cookie-consent",
        JSON.stringify({ analytics: false, decidedAt: Date.now() })
      );
    } catch {}
  });
}

// ── Login helpers ─────────────────────────────────────────────────────────────

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await page.fill('input[type="email"]', DIRECTOR_EMAIL);
  await page.fill('input[type="password"]', DIRECTOR_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to hub
  await page.waitForURL("**/agent/hub", { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

async function signInAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL("**/agent/hub", { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Help library captures", () => {
  // Verify dev server is up before any test runs
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    try {
      const res = await pg.goto("http://localhost:3000/login", { timeout: 8_000 });
      if (!res || !res.ok()) throw new Error("Dev server not responding at localhost:3000");
    } catch (e) {
      throw new Error(
        "Dev server not running. Start it with: npm run dev\n" + String(e)
      );
    }
    await pg.close();
    await ctx.close();
  });

  test("agent-nav-sidebar", async ({ page }) => {
    await suppressOverlays(page);
    await signIn(page);
    await page.goto("/agent/hub");
    await page.waitForLoadState("networkidle");

    await capture(page, "agent-nav-sidebar", {
      selector: "aside",
      width: 240,
    });
  });

  test("hub-overview", async ({ page }) => {
    await suppressOverlays(page);
    await signIn(page);
    await page.goto("/agent/hub");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);

    // Content column starts at x=220 (fixed sidebar). Full viewport height.
    await capture(page, "hub-overview", {
      clip: { x: 220, y: 0, width: 1220, height: 900 },
      width: 1200,
    });
  });

  test("property-file-overview-tab", async ({ page }) => {
    await suppressOverlays(page);
    await signIn(page);
    await page.goto(`/agent/transactions/${artifacts.birchwoodLaneId}`);
    await page.waitForLoadState("networkidle");

    const main = page.locator("main").first();
    await main.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(400);

    await capture(page, "property-file-overview-tab", {
      selector: "main",
      width: 1100,
    });
  });

  test("property-file-milestones-tab", async ({ page }) => {
    await suppressOverlays(page);
    await signIn(page);
    await page.goto(`/agent/transactions/${artifacts.birchwoodLaneId}`);
    await page.waitForLoadState("networkidle");

    const milestonesTab = page
      .getByRole("button", { name: /milestones/i })
      .or(page.getByRole("tab", { name: /milestones/i }))
      .or(page.locator('[data-tab="milestones"]'))
      .first();

    await milestonesTab.click({ timeout: 10_000 });
    await page.waitForTimeout(500);

    await capture(page, "property-file-milestones-tab", {
      selector: "main",
      width: 1100,
    });
  });

  test("team-list-with-pending", async ({ page }) => {
    await suppressOverlays(page);
    await signIn(page);
    await page.goto("/agent/settings");
    await page.waitForLoadState("networkidle");

    // Capture only the Team card — excludes My Profile, Sending addresses, Branch theme, Danger zone.
    const teamCard = page
      .locator(".glass-card")
      .filter({ has: page.locator("h2").filter({ hasText: /^Team$/ }) })
      .first();

    await capture(page, "team-list-with-pending", {
      locator: teamCard,
      width: 900,
    });
  });

  test("director-invitation-banner", async ({ page }) => {
    await suppressOverlays(page);
    await page.goto(`/invite/${artifacts.directorInviteToken}`);
    await page.waitForLoadState("networkidle");

    // The invitation card: h1's grandparent wraps icon + headline + glass card.
    // Tightly bounds the content, trimming the full-page peach background.
    const card = page
      .getByRole("heading", { name: /you've been invited/i })
      .locator("xpath=../..");

    await capture(page, "director-invitation-banner", {
      locator: card,
      width: 600,
    });
  });

  test("portal-buyer-view", async ({ page }) => {
    await suppressOverlays(page);
    await page.goto(`/portal/${artifacts.sarahPortalToken}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    await capture(page, "portal-buyer-view", { width: 900 });
  });

  test("hub-empty-state", async ({ page }) => {
    // Sign in as Emma Hayes — zero transactions, shows empty hub state
    await suppressCookieOnly(page);
    // Suppress welcome modal for Emma at init time
    await page.addInitScript((eid: string) => {
      try {
        localStorage.setItem(`sp_onboarding_dismissed_${eid}`, "1");
      } catch {}
    }, artifacts.emmaId);

    await signInAs(page, artifacts.emmaEmail, DIRECTOR_PASSWORD);
    await page.waitForTimeout(800);

    // Content column only (sidebar at x=0..219, content starts x=220)
    await capture(page, "hub-empty-state", {
      clip: { x: 220, y: 0, width: 1000, height: 640 },
      width: 900,
    });
  });

  test("onboarding-checklist", async ({ page }) => {
    // Sign in as Tom — checklist not dismissed, cookie suppressed only
    await suppressCookieOnly(page);
    await signIn(page);
    await page.waitForTimeout(1000);

    // The onboarding checklist renders as a glass-card containing "Getting started"
    const checklist = page
      .locator(".glass-card")
      .filter({ has: page.locator("*").filter({ hasText: /getting started/i }) })
      .first();

    const isVisible = await checklist.isVisible().catch(() => false);
    if (!isVisible) {
      console.log("  ℹ onboarding-checklist not visible for Tom — skipping");
      return;
    }

    await capture(page, "onboarding-checklist", {
      locator: checklist,
      width: 400,
    });
  });
});
