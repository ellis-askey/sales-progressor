// Progression-business isolation (Phase 8). Real-browser cross-URL probes: each
// user navigates DIRECTLY to transaction detail URLs — including ones they must
// NOT see — and we assert the file only renders when allowed. Proves the
// boundary holds at the HTTP/page level, not just in unit tests.
//
// Prereq: run scripts/seed-progression-fixture.ts against the target DB and set
// PROGRESSION_BUSINESSES_ENABLED=true, then start the app. Fixture logins use
// password "Pilot2026!". The spec resolves the fixture transaction ids straight
// from the DB so it can probe files a user cannot reach through the UI.
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const PASSWORD = process.env.FIXTURE_PASSWORD ?? "Pilot2026!";
const prisma = new PrismaClient();

const ADDR = {
  T1: "1 Donna Self St - PBFIX",
  T2: "2 Donna To Sarah St - PBFIX",
  T3: "3 Donna To TSP St - PBFIX",
  T4: "4 James To Sarah St - PBFIX",
  T5: "5 James Self St - PBFIX",
  T6: "6 Unrelated To TSP St - PBFIX",
  T7: "7 Other Business St - PBFIX",
} as const;

const ids: Record<keyof typeof ADDR, string> = {} as never;

test.beforeAll(async () => {
  for (const [k, addr] of Object.entries(ADDR)) {
    const tx = await prisma.propertyTransaction.findFirst({ where: { propertyAddress: addr }, select: { id: true } });
    if (!tx) throw new Error(`Fixture transaction "${addr}" not found - run seed-progression-fixture.ts`);
    ids[k as keyof typeof ADDR] = tx.id;
  }
});

test.afterAll(async () => { await prisma.$disconnect(); });

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(agent|dashboard)/, { timeout: 20000 });
}

/** Navigate to a file and decide whether it rendered (allowed) or 404'd (denied). */
async function canOpen(page: Page, txId: string): Promise<boolean> {
  const res = await page.goto(`/agent/transactions/${txId}`, { waitUntil: "domcontentloaded" });
  // notFound() renders the app 404 (status 404); an allowed file returns 200.
  if (res && res.status() === 404) return false;
  // Belt-and-braces: the not-found page shows no file tabs.
  const notFound = await page.getByText(/not found|page could.?n.t be found/i).first().isVisible().catch(() => false);
  return !notFound;
}

async function expectAccess(page: Page, allowed: (keyof typeof ADDR)[], denied: (keyof typeof ADDR)[]) {
  for (const k of allowed) expect(await canOpen(page, ids[k]), `should OPEN ${k}`).toBe(true);
  for (const k of denied) expect(await canOpen(page, ids[k]), `should be DENIED ${k}`).toBe(false);
}

test.describe("Progression-business file isolation", () => {
  test("Sarah (business owner) sees only her business's files (T2, T4)", async ({ page }) => {
    await login(page, "sarah@sarahprogression.co.uk");
    await expectAccess(page, ["T2", "T4"], ["T1", "T3", "T5", "T6", "T7"]);
  });

  test("Sarah's employee sees the whole business book (T2, T4), nothing else", async ({ page }) => {
    await login(page, "kim@sarahprogression.co.uk");
    await expectAccess(page, ["T2", "T4"], ["T1", "T3", "T5", "T6", "T7"]);
  });

  test("Donna (agency) sees all her agency's files incl. handed-out (T1, T2, T3), not James's or Sarah's other client", async ({ page }) => {
    await login(page, "donna@exp-pbfix.co.uk");
    await expectAccess(page, ["T1", "T2", "T3"], ["T4", "T5", "T6", "T7"]);
  });

  test("James sees only his agency's files (T4, T5)", async ({ page }) => {
    await login(page, "james@exp-pbfix.co.uk");
    await expectAccess(page, ["T4", "T5"], ["T1", "T2", "T3", "T6", "T7"]);
  });

  test("the other progression business sees only its own file (T7)", async ({ page }) => {
    await login(page, "owner@otherprogression.co.uk");
    await expectAccess(page, ["T7"], ["T1", "T2", "T3", "T4", "T5", "T6"]);
  });

  test("a TSP progressor sees only files assigned to them (T3, T6)", async ({ page }) => {
    await login(page, "tspprog@thesalesprogressor.co.uk");
    await expectAccess(page, ["T3", "T6"], ["T1", "T2", "T4", "T5", "T7"]);
  });
});
