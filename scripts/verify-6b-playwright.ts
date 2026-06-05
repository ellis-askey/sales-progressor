// Headless-browser verification for commit 6b's UI surface.
//
// What text-presence verification (verify-6b-render.sh) cannot prove:
//   - The modal actually OPENS when the CTA is clicked.
//   - The form fields are present, typeable, and validate.
//   - The "Continue" button takes the agent to the confirmation stage.
//   - The confirmation copy renders to pixels (not just shipped to bundle).
//   - The layout doesn't break under real CSS load (z-index, agent-modal-in
//     animation, scroll lock, etc.).
//
// This script does all of the above and writes screenshots into
// scripts/screenshots/. It does NOT submit the form — relistTransactionAction
// is the canonical mutation, exercised end-to-end in the rehearsal harness.
// Browser-side proof stops at the confirmation stage rendered with the
// agent's typed values.
//
// Inputs (env):
//   BASE_URL  preview/staging URL
//   EMAIL     agent login
//   PASSWORD  agent password
//   TX_ID     a withdrawn, not-yet-exchanged file the agent can see
//
// Run:
//   BASE_URL=... EMAIL=... PASSWORD=... TX_ID=... \
//     npx -y dotenv -e .env --override -- npx ts-node \
//     --project tsconfig.scripts.json scripts/verify-6b-playwright.ts

import { chromium, type Browser, type Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL  = process.env.BASE_URL  ?? "";
const EMAIL     = process.env.EMAIL     ?? "";
const PASSWORD  = process.env.PASSWORD  ?? "";
const TX_ID     = process.env.TX_ID     ?? "";

if (!BASE_URL || !EMAIL || !PASSWORD || !TX_ID) {
  console.error("Missing required env: BASE_URL, EMAIL, PASSWORD, TX_ID.");
  process.exit(2);
}

const SHOTS_DIR = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runStamp = stamp();

async function snap(page: Page, label: string) {
  const file = path.join(SHOTS_DIR, `6b-${runStamp}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📷 ${path.basename(file)}`);
}

async function login(page: Page) {
  // Submit the credentials form. WarmLoginForm calls signIn with
  // redirect:false then router.push("/") on success, so we wait for
  // either a URL change or a session cookie.
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await snap(page, "01-login-page");
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"], input.wi-pw').first().fill(PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  // Wait for the next-auth session cookie OR a URL change away from /login.
  await page.waitForFunction(
    () => !location.pathname.startsWith("/login") || document.cookie.includes("next-auth.session-token") || document.cookie.includes("__Secure-next-auth.session-token"),
    { timeout: 30_000 },
  );
  // Tiny settle for any post-router.push navigation in flight.
  await page.waitForLoadState("networkidle").catch(() => {});
  console.log(`  ✓ logged in as ${EMAIL}  (now at ${page.url()})`);
}

type Check = { label: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function record(label: string, ok: boolean, detail?: string) {
  checks.push({ label, ok, detail });
  console.log(`  ${ok ? "[PASS]" : "[FAIL]"} ${label}${detail ? `  (${detail})` : ""}`);
}

async function main() {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    console.log("\n── Login ──");
    await login(page);

    console.log("\n── Navigate to the withdrawn fixture ──");
    await page.goto(`${BASE_URL}/agent/transactions/${TX_ID}`, { waitUntil: "networkidle" });
    await snap(page, "02-file-detail-banner-visible");

    // Banner present check.
    console.log("\n── Banner ──");
    const bannerTitle = await page.locator("text=This sale fell through.").first();
    record("banner title visible", await bannerTitle.isVisible());
    const ctaButton = page.locator('button:has-text("Relist sale")').first();
    record("Relist sale CTA visible", await ctaButton.isVisible());

    // Click the CTA — modal must open.
    console.log("\n── Open the modal ──");
    await ctaButton.click();
    await page.waitForTimeout(400);  // agent-modal-in animation 240ms + slack
    const modalHeading = page.locator('text="Relist this sale"').first();
    record("modal header rendered", await modalHeading.isVisible());
    await snap(page, "03-modal-form-stage");

    // Form fields present.
    const buyerNameInput = page.getByPlaceholder("Their full name");
    record("buyer-name input present", await buyerNameInput.isVisible());

    // Validation: Continue disabled until name typed.
    const continueBtn = page.locator('button:has-text("Continue")').first();
    record("Continue button present", await continueBtn.isVisible());
    record("Continue disabled before name typed", await continueBtn.isDisabled());

    // Type the new buyer details.
    console.log("\n── Type form values ──");
    await buyerNameInput.fill("Sigrid Six-B Verification");
    await page.getByPlaceholder("Optional").first().fill("sigrid@example-rehearsal.invalid");
    // Now Continue enabled.
    record("Continue enabled after name typed", !(await continueBtn.isDisabled()));
    await snap(page, "04-modal-form-filled");

    // Click Continue → confirmation stage.
    console.log("\n── Continue to confirmation stage ──");
    await continueBtn.click();
    await page.waitForTimeout(400);
    const confirmHeading = page.locator('text="Confirm relist"').first();
    record("confirmation-stage header rendered", await confirmHeading.isVisible());

    // The locked confirmation copy must render to pixels.
    const leadIn = page.locator("text=You're relisting this sale with").first();
    record("lead-in rendered", await leadIn.isVisible());
    const carriesOver = page.locator("text=The seller's solicitor instruction, client care pack").first();
    record("Carries over #1 rendered (management pack, not title pack)", await carriesOver.isVisible());
    const startsFresh3 = page.locator("text=The draft contract pack, reissued to the new buyer's solicitor").first();
    record("Starts fresh #3 rendered (draft contract pack reissue)", await startsFresh3.isVisible());
    const startsFresh4 = page.locator("text=Contract signing, exchange and completion steps").first();
    record("Starts fresh #4 rendered (contract/exchange/completion)", await startsFresh4.isVisible());
    const oldBuyerNote = page.locator('text=this link is no longer active').first();
    record("old-buyer note rendered", await oldBuyerNote.isVisible());

    // Negative: skipped-gate copy MUST NOT appear.
    const oldOverclaim = page.locator("text=The seller's progress stays where it is").first();
    record("OLD overclaiming copy absent", !(await oldOverclaim.isVisible().catch(() => false)));

    const submitBtn = page.locator('button:has-text("Relist sale")').last();
    record("Final submit button visible", await submitBtn.isVisible());
    await snap(page, "05-modal-confirmation-stage");

    // Click Back, verify stage returns to form.
    console.log("\n── Back navigation ──");
    const backBtn = page.locator('button:has-text("Back")').first();
    await backBtn.click();
    await page.waitForTimeout(200);
    const backToForm = page.locator('text="Relist this sale"').first();
    record("Back returns to form stage", await backToForm.isVisible());
    await snap(page, "06-modal-back-to-form");

    // Close via Escape.
    console.log("\n── Close modal ──");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const modalGone = await page.locator('text="Relist this sale"').count() === 0;
    record("Escape closes the modal", modalGone);
    await snap(page, "07-back-on-file-detail");

  } finally {
    if (browser) await browser.close();
  }

  console.log("\n── SUMMARY ──");
  let failed = 0;
  for (const c of checks) {
    if (!c.ok) failed++;
  }
  console.log(`  ${checks.length - failed}/${checks.length} checks passed.`);
  console.log(`  Screenshots written to: ${SHOTS_DIR}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
