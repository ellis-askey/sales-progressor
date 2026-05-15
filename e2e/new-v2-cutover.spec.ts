/**
 * new-v2-cutover.spec.ts
 *
 * Real-data spot-check for the new-v2 page cutover (Commit B).
 * Requires dev server running at localhost:3000 and TEST_PASSWORD set in .env.test.local.
 * Tests create real transactions — run against staging/dev only.
 */

import { test, expect, type Page } from "@playwright/test";
import { login, dismissCookieBanner } from "./helpers";

const BASE = "/agent/transactions/new-v2";
const DIRECTOR = "rachel@whitfieldhunt.co.uk";

// One shared browser session — login once, reuse across all tests in this file.
let sharedPage: Page;

test.describe.configure({ mode: "serial", timeout: 90_000 });

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  sharedPage = await ctx.newPage();
  await login(sharedPage, DIRECTOR);
  await sharedPage.waitForURL(/\/agent/, { timeout: 20_000 });
});

test.afterAll(async () => {
  await sharedPage?.context().close();
});

// ── Helper: navigate to new-v2 and fill Stage 1 manually ─────────────────────

async function goAndFillStage1(opts: {
  progressedBy?: "agent" | "progressor";
  street?: string;
  city?: string;
  postcode?: string;
  tenure?: "Freehold" | "Leasehold";
  purchaseType?: "Mortgage" | "Cash" | "Cash from Proceeds";
}) {
  const {
    progressedBy = "agent",
    street = "42 Test Street",
    city = "Bristol",
    postcode = "BS1 4DJ",
    tenure = "Freehold",
    purchaseType = "Mortgage",
  } = opts;

  await sharedPage.goto(BASE);
  await sharedPage.waitForLoadState("domcontentloaded");
  await dismissCookieBanner(sharedPage);

  // Click the "Fill in manually" button on the hero card
  await sharedPage.getByRole("button", { name: /fill in manually/i }).click();

  // Who progresses?
  const pillLabel = progressedBy === "agent" ? "Self-progress" : "Send to us";
  await sharedPage
    .locator("button.stage1-option-pill")
    .filter({ hasText: pillLabel })
    .click();

  // Address
  await sharedPage.getByPlaceholder("e.g. 14 Hartwell Avenue").fill(street);
  await sharedPage.getByPlaceholder("e.g. Bristol").fill(city);
  await sharedPage.getByPlaceholder("e.g. BS6 7TH", { exact: true }).fill(postcode);

  // Tenure — filter to button starting with the label (avoids matching note text)
  await sharedPage
    .locator("button.stage1-option-pill")
    .filter({ hasText: tenure })
    .click();

  // Purchase type
  const ptPattern =
    purchaseType === "Mortgage" ? /^Mortgage/ : new RegExp(`^${purchaseType}`);
  await sharedPage
    .locator("button.stage1-option-pill")
    .filter({ hasText: ptPattern })
    .click();
}

// ── Step 3: page title ────────────────────────────────────────────────────────

test("Step 3 | Page title is 'New sale'", async () => {
  await sharedPage.goto(BASE);
  await sharedPage.waitForLoadState("domcontentloaded");
  await dismissCookieBanner(sharedPage);
  await expect(
    sharedPage.getByRole("heading", { name: "New sale", exact: true })
  ).toBeVisible();
});

// ── Steps 1-8: Freehold + Mortgage (self-managed, e2e creation) ──────────────

test("Steps 4-8 | Freehold + Mortgage — self-managed creation", async () => {
  await goAndFillStage1({
    progressedBy: "agent",
    street: "42 Freehold Road",
    city: "Bristol",
    postcode: "BS1 4DJ",
    tenure: "Freehold",
    purchaseType: "Mortgage",
  });

  // Step 7 — continue button with correct copy
  const continueBtn = sharedPage.getByRole("button", { name: /continue.*add contacts/i });
  await expect(continueBtn).toBeVisible();
  await continueBtn.click();

  // Step 8 — Stage 2 rendered
  await expect(sharedPage.getByText("Vendors").first()).toBeVisible();

  // Add vendor + purchaser
  await sharedPage.locator("button").filter({ hasText: "+ Add vendor" }).click();
  await sharedPage.getByPlaceholder("e.g. Sarah Johnson").first().fill("Alice Vendor");
  await sharedPage.locator("button").filter({ hasText: "+ Add purchaser" }).click();
  await sharedPage.getByPlaceholder("e.g. Sarah Johnson").last().fill("Bob Buyer");

  // Submit
  const submitBtn = sharedPage.getByRole("button", { name: "Create file" });
  await submitBtn.scrollIntoViewIfNeeded();
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // Redirect to transaction detail
  await sharedPage.waitForURL(/\/agent\/transactions\/[^/]+$/, { timeout: 20_000 });
  expect(sharedPage.url()).toMatch(/\/agent\/transactions\/.+/);
});

// ── Steps 1-8 (combo 2): Leasehold + Cash from Proceeds ──────────────────────

test("Steps 4-8 | Leasehold + Cash from Proceeds — self-managed creation", async () => {
  await goAndFillStage1({
    progressedBy: "agent",
    street: "10 Leasehold Lane",
    city: "London",
    postcode: "SW1A 1AA",
    tenure: "Leasehold",
    purchaseType: "Cash from Proceeds",
  });

  await sharedPage.getByRole("button", { name: /continue.*add contacts/i }).click();
  await expect(sharedPage.getByText("Vendors").first()).toBeVisible();

  await sharedPage.locator("button").filter({ hasText: "+ Add vendor" }).click();
  await sharedPage.getByPlaceholder("e.g. Sarah Johnson").first().fill("Vendor Two");
  await sharedPage.locator("button").filter({ hasText: "+ Add purchaser" }).click();
  await sharedPage.getByPlaceholder("e.g. Sarah Johnson").last().fill("Buyer Two");

  const submitBtn = sharedPage.getByRole("button", { name: "Create file" });
  await submitBtn.scrollIntoViewIfNeeded();
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  await sharedPage.waitForURL(/\/agent\/transactions\/[^/]+$/, { timeout: 20_000 });
  expect(sharedPage.url()).toMatch(/\/agent\/transactions\/.+/);
});

// ── Steps 9-14: Outsourced — submit button progression ───────────────────────

test("Steps 9-14 | Outsourced — submit button copy and disable progression", async () => {
  await goAndFillStage1({
    progressedBy: "progressor",
    street: "5 Outsourced Road",
    city: "Manchester",
    postcode: "M1 1AE",
    tenure: "Freehold",
    purchaseType: "Mortgage",
  });

  await sharedPage.getByRole("button", { name: /continue.*add contacts/i }).click();

  // Step 11 — OutsourcedBanner with Commit B copy
  await expect(sharedPage.getByText("Our team is handling this file")).toBeVisible();

  // Step 12 — no vendor yet: button reads "Add a seller to continue" and is disabled
  await expect(
    sharedPage.getByRole("button", { name: "Add a seller to continue" })
  ).toBeDisabled();

  // Add vendor name only (no contact method)
  await sharedPage.locator("button").filter({ hasText: "+ Add vendor" }).click();
  await sharedPage.getByPlaceholder("e.g. Sarah Johnson").first().fill("Outsourced Vendor");

  // Step 13 — vendor has name but no contact: prompt for phone/email
  await expect(
    sharedPage.getByRole("button", {
      name: "Add a phone number or email for the seller",
    })
  ).toBeDisabled();

  // Add vendor phone
  await sharedPage.getByPlaceholder("07700 900000").first().fill("07700 900123");

  // Step 14 — vendor ready, no purchaser yet
  await expect(
    sharedPage.getByRole("button", { name: "Add a buyer to continue" })
  ).toBeDisabled();

  // Add purchaser with name + phone
  await sharedPage.locator("button").filter({ hasText: "+ Add purchaser" }).click();
  await sharedPage.getByPlaceholder("e.g. Sarah Johnson").last().fill("Outsourced Buyer");
  await sharedPage.getByPlaceholder("07700 900000").last().fill("07700 900456");

  // Both sides ready — button unlocks
  const createBtn = sharedPage.getByRole("button", { name: "Create file" });
  await createBtn.scrollIntoViewIfNeeded();
  await expect(createBtn).toBeEnabled();
});

// ── Steps 15-19: Memo upload — N/A ───────────────────────────────────────────
// Skipped: no PDF fixtures in e2e/. MOS flow cannot be automated.

// ── Step 20: Theme screenshots ────────────────────────────────────────────────

const THEMES = [
  "agent-theme-warm",
  "agent-theme-slate",
  "agent-theme-forest",
  "agent-theme-midnight",
  "agent-theme-rose",
  "agent-theme-ocean",
];

for (const theme of THEMES) {
  test(`Step 20 | Theme screenshot — ${theme}`, async () => {
    await sharedPage.evaluate((t) => localStorage.setItem("agent-theme", t), theme);
    await sharedPage.goto(BASE);
    await sharedPage.waitForLoadState("domcontentloaded");
    await dismissCookieBanner(sharedPage);
    await expect(
      sharedPage.getByRole("heading", { name: "New sale", exact: true })
    ).toBeVisible();
    await sharedPage.screenshot({
      path: `e2e/screenshots/new-v2-${theme}.png`,
      fullPage: true,
    });
  });
}

// ── Step 21: Mobile 375px ─────────────────────────────────────────────────────

test("Step 21 | Mobile 375px — page renders without horizontal overflow", async () => {
  await sharedPage.setViewportSize({ width: 375, height: 812 });
  await sharedPage.goto(BASE);
  await sharedPage.waitForLoadState("domcontentloaded");
  await dismissCookieBanner(sharedPage);
  await expect(
    sharedPage.getByRole("heading", { name: "New sale", exact: true })
  ).toBeVisible();
  await sharedPage.screenshot({
    path: "e2e/screenshots/new-v2-mobile-375.png",
    fullPage: true,
  });
  const overflow = await sharedPage.evaluate(
    () => document.body.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
  // Reset viewport
  await sharedPage.setViewportSize({ width: 1280, height: 800 });
});
