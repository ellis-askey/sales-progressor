// Playwright pass for the "New buyer added" hub card.
//
// Walks the locked behaviour:
//   1. Seed an outsourced + assigned fixture, withdraw it.
//   2. Open a logged-in browser session as the assigned SP.
//   3. Hub: card should NOT appear yet (no relist).
//   4. Run a relist via the impl (same path the UI invokes).
//   5. Reload hub: card appears with locked copy.
//   6. Reload hub a second time: card persists (not session-state).
//   7. Click Acknowledge: card disappears.
//   8. Withdraw the file, relist again (round 3): card RE-APPEARS.
//   9. Tear down.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
React.cache = (fn: unknown) => fn;

import { chromium, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { relistTransactionImpl } from "../app/actions/transactions";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "";
const EMAIL    = process.env.EMAIL    ?? "";          // SP login
const PASSWORD = process.env.PASSWORD ?? "";
if (!BASE_URL || !EMAIL || !PASSWORD) { console.error("missing BASE_URL/EMAIL/PASSWORD"); process.exit(2); }

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
async function snap(page: Page, label: string) {
  const f = path.join(SHOTS, `hub-card-${stamp}-${label}.png`);
  await page.screenshot({ path: f, fullPage: true });
  console.log(`  📷 ${path.basename(f)}`);
}

const prisma = new PrismaClient();
const SENTINEL = "[hub-card rehearsal]";

type Check = { label: string; ok: boolean };
const checks: Check[] = [];
function record(label: string, ok: boolean) {
  checks.push({ label, ok });
  console.log(`  ${ok ? "[PASS]" : "[FAIL]"} ${label}`);
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"], input.wi-pw').first().fill(PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  // Wait for the form's router.push("/") to complete OR for any redirect
  // that comes from middleware role-routing (admin/SP land on /dashboard).
  await page.waitForFunction(
    () => !location.pathname.startsWith("/login"),
    { timeout: 60_000 },
  ).catch(async () => {
    // Login likely failed; surface state for debugging.
    await snap(page, "login-fail");
    const errorText = await page.locator("text=/Incorrect|error|failed/i").first().textContent().catch(() => null);
    throw new Error(`Login timeout. Form error visible: ${errorText ?? "(none)"}. URL: ${page.url()}`);
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  console.log(`  ✓ logged in as ${EMAIL}  (now at ${page.url()})`);
}

async function tearDownFixture() {
  const old = await prisma.propertyTransaction.findMany({ where: { propertyAddress: SENTINEL }, select: { id: true } });
  for (const tx of old) await prisma.propertyTransaction.delete({ where: { id: tx.id } });
}

async function seedAndWithdraw(): Promise<{ txId: string; spUserId: string; dirUserId: string }> {
  const dir = await prisma.user.findFirst({ where: { role: "director", agencyId: { not: null } }, select: { id: true, name: true, agencyId: true } });
  if (!dir || !dir.agencyId) throw new Error("no director");
  // Pick the SP whose email is EMAIL (the Playwright login)
  const sp = await prisma.user.findFirst({ where: { email: EMAIL }, select: { id: true } });
  if (!sp) throw new Error(`no user with email ${EMAIL}`);

  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true, side: true } });

  const { txId, round1Id } = await prisma.$transaction(async (ptx) => {
    const tx = await ptx.propertyTransaction.create({
      data: {
        propertyAddress: SENTINEL,
        agencyId: dir.agencyId!,
        agentUserId: dir.id,
        assignedUserId: sp.id,                 // assigned to the Playwright login user
        serviceType: "outsourced",
        status: "active",
        tenure: "freehold",
        purchaseType: "mortgage",
        purchasePrice: 500_000_00,
      },
    });
    const r1 = await ptx.buyerRound.create({ data: { transactionId: tx.id, roundNumber: 1, status: "active", purchasePrice: 500_000_00 } });
    await ptx.propertyTransaction.update({ where: { id: tx.id }, data: { activeBuyerRoundId: r1.id } });
    return { txId: tx.id, round1Id: r1.id };
  });
  await prisma.contact.create({ data: { propertyTransactionId: txId, name: "Seller A", roleType: "vendor", portalToken: randomUUID() } });
  await prisma.contact.create({ data: { propertyTransactionId: txId, name: "Original Buyer", roleType: "purchaser", portalToken: randomUUID(), buyerRoundId: round1Id } });
  await prisma.milestoneCompletion.createMany({
    data: defs.map((d) => ({ transactionId: txId, milestoneDefinitionId: d.id, state: "locked", buyerRoundId: d.side === "purchaser" ? round1Id : null })),
  });
  await prisma.propertyTransaction.update({ where: { id: txId }, data: { status: "withdrawn", fallThroughReason: "test" } });
  return { txId, spUserId: sp.id, dirUserId: dir.id };
}

async function doRelist(txId: string, dirId: string, buyerName: string) {
  const dir = await prisma.user.findUnique({ where: { id: dirId }, select: { name: true, agencyId: true } });
  if (!dir || !dir.agencyId) throw new Error("dir missing agency");
  await relistTransactionImpl(
    { transactionId: txId, newBuyer: { name: buyerName } },
    { userId: dirId, userName: dir.name ?? "Director", agencyId: dir.agencyId, scope: { kind: "agency", agencyIds: [dir.agencyId] } },
  );
  // wait for the fire-and-forget notification chain
  await new Promise((r) => setTimeout(r, 600));
}

async function main() {
  await tearDownFixture();
  const { txId, spUserId, dirUserId } = await seedAndWithdraw();
  console.log(`Seeded tx ${txId}, assigned to SP ${spUserId}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    console.log("\n── Login ──");
    await login(page);

    console.log("\n── Step 1: hub before any relist — card MUST be absent ──");
    await page.goto(`${BASE_URL}/agent/hub`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "01-hub-before-relist");
    const headerCountPre = await page.locator('text="New buyer added"').count();
    record("card hidden when no relist", headerCountPre === 0);

    console.log("\n── Step 2: relist round 1 → 2 ──");
    await doRelist(txId, dirUserId, "Charlie Reeves");

    console.log("\n── Step 3: hub after relist — card MUST appear ──");
    await page.goto(`${BASE_URL}/agent/hub`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "02-hub-after-relist");
    const headerVisible = await page.locator('text="New buyer added"').first().isVisible().catch(() => false);
    record("card visible after relist", headerVisible);
    const bodyLine = page.locator(`text=/Charlie Reeves is the new buyer \\(round 2\\)\\. Relisted/`).first();
    record("locked body line rendered verbatim with round number", await bodyLine.isVisible().catch(() => false));
    const ackBtn = page.locator('button:has-text("Acknowledge")').first();
    record("Acknowledge button visible", await ackBtn.isVisible());

    console.log("\n── Step 4: reload hub — card MUST persist (not session state) ──");
    await page.goto(`${BASE_URL}/agent/hub`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "03-hub-after-reload");
    const headerStillVisible = await page.locator('text="New buyer added"').first().isVisible().catch(() => false);
    record("card persists after reload", headerStillVisible);

    console.log("\n── Step 5: click Acknowledge — card MUST disappear ──");
    await page.locator('button:has-text("Acknowledge")').first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);
    await snap(page, "04-hub-after-acknowledge");
    // After ack, either header gone or body line for this round gone. Header
    // could still be there if there's ANOTHER unacknowledged round; in this
    // test there's only one, so both should be gone.
    const headerGone = (await page.locator('text="New buyer added"').count()) === 0;
    const bodyLineGone = (await page.locator(`text=/Charlie Reeves is the new buyer \\(round 2\\)/`).count()) === 0;
    record("card gone after Acknowledge", headerGone && bodyLineGone);

    // Verify the DB stamp landed.
    const acked = await prisma.buyerRound.findFirst({
      where: { transactionId: txId, roundNumber: 2 },
      select: { relistAcknowledgedAt: true, relistAcknowledgedById: true },
    });
    record("DB: relistAcknowledgedAt stamped",  !!acked?.relistAcknowledgedAt);
    record("DB: relistAcknowledgedById = SP",   acked?.relistAcknowledgedById === spUserId);

    console.log("\n── Step 6: withdraw + relist again (round 3) — card MUST RE-APPEAR ──");
    await prisma.propertyTransaction.update({ where: { id: txId }, data: { status: "withdrawn", fallThroughReason: "second test" } });
    await doRelist(txId, dirUserId, "Diana Reeves");
    await page.goto(`${BASE_URL}/agent/hub`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "05-hub-after-second-relist");
    const reappeared = await page.locator(`text=/Diana Reeves is the new buyer \\(round 3\\)/`).first().isVisible().catch(() => false);
    record("card re-appears for round 3 (fresh unacknowledged state)", reappeared);

  } finally {
    await browser.close();
  }

  await prisma.propertyTransaction.delete({ where: { id: txId } });
  await prisma.$disconnect();

  console.log("\n── SUMMARY ──");
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`  ${checks.length - failed}/${checks.length} checks passed.`);
  console.log(`  Screenshots: ${SHOTS}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
