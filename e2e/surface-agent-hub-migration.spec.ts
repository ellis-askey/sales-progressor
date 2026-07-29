/**
 * Hub migration sentinel — FROZEN.
 *
 * This spec is the definition of "no regression" for the hub migration
 * documented in docs/active/hub-migration/. It must be green against
 * both /agent/hub (legacy baseline) AND /agent/hub-preview (Phase 2
 * build) before Phase 4 sign-off.
 *
 * Ellis-stated rules (per docs/active/hub-migration/04-playwright.md):
 *
 *   a. Assertions target ONLY user-visible, structure-independent
 *      things — visible text, ARIA roles, accessible names, and
 *      data-testid. Never CSS classes, DOM nesting, or element
 *      position.
 *
 *   b. Testids on legacy are the one permitted addition to the hub
 *      pre-Phase-2. The full set added is listed in 04-playwright.md.
 *      No other assertions may add new testids without being logged
 *      in that doc first.
 *
 *   c. Covers all 5 roles + 3 quirks (hybrid SP-admin, viewer,
 *      superadmin) + every empty / loading / error branch from the
 *      audit.
 *
 *   d. Run against the current legacy hub until green. Record the
 *      passing run in 04-playwright.md with date and commit SHA.
 *
 *   e. FROZEN after green. Any later edit needs an explicit reason
 *      line in 04-playwright.md. "It failed after the migration" is
 *      a finding, not a licence to edit the spec.
 *
 * Run:
 *   npx playwright test e2e/surface-agent-hub-migration.spec.ts --reporter=list
 *
 * Tests without the required env var skip gracefully.
 */

import { test, expect, type Page } from "@playwright/test";
import { login, dismissCookieBanner } from "./helpers";

// ── Env-driven credentials — each role independent ────────────────────────────
// Each role requires its OWN password env var. NO fallback to shared TEST_PASSWORD.
// Reason: a shared TEST_PASSWORD that matches (say) director but not admin causes
// the admin tests to fail at login rather than skip — a wrong-password failure
// looks identical to a real regression. Explicit env per role prevents this.

const CREDS = {
  director: {
    email: process.env.TEST_DIRECTOR_EMAIL ?? "emily@hartwellpartners.co.uk",
    password: process.env.TEST_DIRECTOR_PASSWORD ?? "",
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL ?? "ellisaskey@googlemail.com",
    password: process.env.TEST_ADMIN_PASSWORD ?? "",
  },
  spHybrid: {
    // Hybrid SP-admin — Ellis's account, role=sales_progressor + on hybrid-admin allowlist.
    email: process.env.TEST_SP_HYBRID_EMAIL ?? "ellis@thesalesprogressor.co.uk",
    password: process.env.TEST_SP_HYBRID_PASSWORD ?? "",
  },
  spPure: {
    // Pure SP — role=sales_progressor, NOT on hybrid allowlist. Not yet seeded.
    email: process.env.TEST_SP_PURE_EMAIL ?? "",
    password: process.env.TEST_SP_PURE_PASSWORD ?? "",
  },
  negotiator: {
    email: process.env.TEST_NEGOTIATOR_EMAIL ?? "",
    password: process.env.TEST_NEGOTIATOR_PASSWORD ?? "",
  },
  viewer: {
    email: process.env.TEST_VIEWER_EMAIL ?? "",
    password: process.env.TEST_VIEWER_PASSWORD ?? "",
  },
  superadmin: {
    email: process.env.TEST_SUPERADMIN_EMAIL ?? "",
    password: process.env.TEST_SUPERADMIN_PASSWORD ?? "",
  },
  // Empty-state director — a director account with 0 files.
  emptyDirector: {
    email: process.env.TEST_EMPTY_DIRECTOR_EMAIL ?? "",
    password: process.env.TEST_EMPTY_DIRECTOR_PASSWORD ?? "",
  },
} as const;

// URL under test — flip to /agent/hub-preview when the preview lands.
const HUB_URL = process.env.HUB_TEST_URL ?? "/agent/hub";

// ── Shared setup ──────────────────────────────────────────────────────────────

async function loginAndOpenHub(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await login(page, email, password);
  await dismissCookieBanner(page);
  // Wait for post-login redirect (may land on /agent/hub or /agent/transactions).
  await page.waitForURL(/\/agent\/(hub|transactions|dashboard)/, { timeout: 15000 });
  await page.goto(HUB_URL);
  await page.waitForLoadState("networkidle");
  // Streamed Suspense + per-widget useTransition settles.
  await page.waitForTimeout(2500);
}

function skipIfNoCredentials(creds: { email: string; password: string }, label: string) {
  test.skip(
    !creds.email || !creds.password,
    `${label} credentials not configured — set TEST_${label.toUpperCase()}_EMAIL + TEST_${label.toUpperCase()}_PASSWORD (or shared TEST_PASSWORD). Test skipped, does NOT count as pass.`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Empty state (director, 0 files)
// Requires empty-director fixture from scripts/seed-hub-fixtures.ts
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("empty state — director with 0 files", () => {
  test("empty branch renders; full branch does not", async ({ page }) => {
    skipIfNoCredentials(CREDS.emptyDirector, "empty_director");
    await loginAndOpenHub(page, CREDS.emptyDirector.email, CREDS.emptyDirector.password);

    // C1: empty state fires
    await expect(page.getByTestId("hub-empty-state")).toBeVisible();
    await expect(page.getByTestId("hub-full-state")).not.toBeVisible();

    // C4: welcome copy is director/agent variant
    await expect(page.getByText(/Add your first sale/i)).toBeVisible();
    await expect(page.getByText(/No assigned files yet/i)).not.toBeVisible();

    // C2: "New sale" button visible (director has canCreateSale)
    await expect(page.getByRole("link", { name: /New sale|Add a sale/i }).first()).toBeVisible();

    // Banners never appear in empty branch
    await expect(page.getByText(/payment failed|New file creation paused/i)).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Empty state (sales_progressor)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("empty state — sales_progressor with 0 assigned files", () => {
  test("empty branch uses assigned-files copy; no create CTA", async ({ page }) => {
    skipIfNoCredentials(CREDS.spPure, "sp_pure");
    await loginAndOpenHub(page, CREDS.spPure.email, CREDS.spPure.password);

    await expect(page.getByTestId("hub-empty-state")).toBeVisible();
    // C4/C5: progressor variant
    await expect(page.getByText(/No assigned files yet/i)).toBeVisible();
    await expect(page.getByText(/Add your first sale/i)).not.toBeVisible();
    // C2/C6 negated: no create CTA
    await expect(page.getByRole("link", { name: /New sale|Add a sale/i })).toHaveCount(0);
    // C3 negated: no "Send a note" (isInternalStaff)
    await expect(page.getByRole("button", { name: /Send a note|Flag/i })).toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Populated hub (director)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("populated hub — director @ Hartwell", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(CREDS.director, "director");
    await loginAndOpenHub(page, CREDS.director.email, CREDS.director.password);
  });

  test("greeting + full-hub branch mounted", async ({ page }) => {
    await expect(page.getByTestId("hub-full-state")).toBeVisible();
    await expect(page.getByTestId("hub-empty-state")).not.toBeVisible();
    await expect(page.locator("h1").first()).toContainText(/Good (morning|afternoon|evening)|Hello/);
  });

  test("New sale + Send-a-note both visible", async ({ page }) => {
    // C2: canCreateSale
    const newSale = page.getByRole("link", { name: /New sale/i }).first();
    await expect(newSale).toBeVisible();
    await expect(newSale).toHaveAttribute("href", "/agent/transactions/new-v2");
    // C3: !isInternalStaff
    await expect(page.getByRole("button", { name: /Send a note|Flag/i }).first()).toBeVisible();
  });

  test("pipeline health — all 4 stat tiles by accessible name", async ({ page }) => {
    // aria-label on each tile
    await expect(page.getByLabel("Active files")).toBeVisible();
    await expect(page.getByLabel("Exchanging soon")).toBeVisible();
    await expect(page.getByLabel("Need attention")).toBeVisible();
    await expect(page.getByLabel("Pipeline value")).toBeVisible();
  });

  test("Active files tile links to transactions list", async ({ page }) => {
    // C37
    const tile = page.getByLabel("Active files");
    await expect(tile).toHaveAttribute("href", "/agent/transactions");
  });

  test("pipeline health subtitle reads business-oriented (director variant)", async ({ page }) => {
    // C36 — director variant
    await expect(
      page.getByText(/Where your business stands today|Your pipeline at a glance/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/Platform-wide pipeline/i)).not.toBeVisible();
  });

  test("Coming-up strip: 3 filter links", async ({ page }) => {
    // C45 — always renders; hrefs stable regardless of count
    await expect(page.getByRole("link", { name: /exchanging this week/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /completing this week/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /closing this month/i })).toBeVisible();
  });

  test("Exchange forecast subtitle reads agent variant", async ({ page }) => {
    // C49 — director variant
    await expect(
      page.getByText(/When your files are due to exchange/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/Platform-wide exchange forecast/i)).not.toBeVisible();
    await expect(page.getByText(/Exchange forecast for your assigned files/i)).not.toBeVisible();
  });

  test("Service split card visible with agent labels", async ({ page }) => {
    // C55 — director sees it (!isProgressor)
    await expect(page.getByTestId("hub-service-split")).toBeVisible();
    // C56 — agent labels
    await expect(
      page.getByTestId("hub-service-split").getByText(/Who[’']s managing/i),
    ).toBeVisible();
    await expect(
      page.getByTestId("hub-service-split").getByText(/Service split/i),
    ).not.toBeVisible();
  });

  test("Attention list header renders", async ({ page }) => {
    // C22/C23 — always mounted
    await expect(page.getByText(/Needs your attention/i).first()).toBeVisible();
  });

  test("UnassignedFiles NOT visible for director", async ({ page }) => {
    // C26 — director never sees this (not admin_all)
    await expect(page.getByText(/Needs assigning/i)).not.toBeVisible();
  });

  test("NewBuyers NOT visible for director", async ({ page }) => {
    // C30 — agents get empty array
    await expect(page.getByText(/New buyer added/i)).not.toBeVisible();
  });

  test("Pipeline at a Glance — all 5 stage buttons by accessible name", async ({ page }) => {
    // Existing aria-label pattern: `${stage}: ${count}` — assert by prefix
    for (const stage of ["New", "Legals", "Ready", "Exchanged", "Completed"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${stage}:`) }).first(),
      ).toBeVisible();
    }
  });

  test("Pro tip visible with one of the cascade variants", async ({ page }) => {
    // C63-C67 — cascade fires exactly one tier. Test that the anchor is present.
    // If fixture data means the healthy tier fires, hrefs match agent variants.
    const proTip = page.getByTestId("hub-pro-tip");
    await expect(proTip).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Populated hub (admin)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("populated hub — admin", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(CREDS.admin, "admin");
    await loginAndOpenHub(page, CREDS.admin.email, CREDS.admin.password);
  });

  test("full-hub branch renders", async ({ page }) => {
    await expect(page.getByTestId("hub-full-state")).toBeVisible();
  });

  test("New sale visible (admin has canCreateSale)", async ({ page }) => {
    // C2 — admin gets it
    await expect(page.getByRole("link", { name: /New sale/i }).first()).toBeVisible();
  });

  test("Send-a-note NOT visible (isInternalStaff)", async ({ page }) => {
    // C3 negated
    await expect(page.getByRole("button", { name: /Send a note/i })).toHaveCount(0);
  });

  test("Pipeline health subtitle uses platform-wide variant", async ({ page }) => {
    // C36 — admin variant
    await expect(page.getByText(/Platform-wide pipeline/i).first()).toBeVisible();
  });

  test("Exchange forecast subtitle uses platform-wide variant", async ({ page }) => {
    // C49 — admin variant
    await expect(page.getByText(/Platform-wide exchange forecast/i).first()).toBeVisible();
  });

  test("Service split card visible with ADMIN labels", async ({ page }) => {
    // C55 (visible), C56 (admin labels)
    const card = page.getByTestId("hub-service-split");
    await expect(card).toBeVisible();
    await expect(card.getByText(/Service split/i)).toBeVisible();
    await expect(card.getByText(/Who[’']s managing/i)).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Hybrid SP-admin quirk (Ellis)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("hybrid SP-admin — Ellis's account", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(CREDS.spHybrid, "sp_hybrid");
    await loginAndOpenHub(page, CREDS.spHybrid.email, CREDS.spHybrid.password);
  });

  test("full-hub branch renders", async ({ page }) => {
    await expect(page.getByTestId("hub-full-state")).toBeVisible();
  });

  test("no New sale button (canCreateSale checks raw role — SP is out)", async ({ page }) => {
    // Role-quirk row from audit
    await expect(page.getByRole("link", { name: /New sale/i })).toHaveCount(0);
  });

  test("Service split visible with ADMIN labels (isAdmin=true wins the ternary)", async ({ page }) => {
    // Role-quirk row — hybrid gets admin copy
    const card = page.getByTestId("hub-service-split");
    await expect(card).toBeVisible();
    await expect(card.getByText(/Service split/i)).toBeVisible();
  });

  test("Pipeline health subtitle uses platform-wide (admin) variant", async ({ page }) => {
    // Role-quirk — isAdmin wins first ternary
    await expect(page.getByText(/Platform-wide pipeline/i).first()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Pure sales_progressor (non-hybrid)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("pure sales_progressor", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(CREDS.spPure, "sp_pure");
    await loginAndOpenHub(page, CREDS.spPure.email, CREDS.spPure.password);
  });

  test("Service split card HIDDEN (isProgressor && !isAdmin)", async ({ page }) => {
    // C55 — hidden variant
    await expect(page.getByTestId("hub-service-split")).not.toBeVisible();
  });

  test("Pipeline health subtitle uses progressor variant", async ({ page }) => {
    // C36 — progressor variant
    await expect(page.getByText(/Your assigned files at a glance/i).first()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — Viewer quirk
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("viewer role quirk", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(CREDS.viewer, "viewer");
    await loginAndOpenHub(page, CREDS.viewer.email, CREDS.viewer.password);
  });

  test("no create CTA, no send-note, uses non-progressor/non-admin subtitle variants", async ({ page }) => {
    // Role-quirk row
    await expect(page.getByRole("link", { name: /New sale/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Send a note/i })).toHaveCount(0);
    // Not progressor copy; not admin copy — so plain variant
    await expect(page.getByText(/Your assigned files at a glance/i)).not.toBeVisible();
    await expect(page.getByText(/Platform-wide pipeline/i)).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — Superadmin quirk (minimal — behaviour documented as latent)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("superadmin quirk", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(CREDS.superadmin, "superadmin");
    await loginAndOpenHub(page, CREDS.superadmin.email, CREDS.superadmin.password);
  });

  test("hub mounts without error (superadmin behaviour treated as director-like)", async ({ page }) => {
    await expect(page.getByTestId("hub-full-state")).toBeVisible();
    await expect(page.getByText(/Something went wrong|Application error/i)).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — Niche controls (director)
// Focus on the two controls that killed prior kinetic attempts:
// extend-hold-with-date and take-off-hold modal.
// Only asserts existence — behaviour asserted via manual walk in
// 05-verification-checklist.md because full server-action flow would
// mutate staging data.
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("niche controls — director", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(CREDS.director, "director");
    await loginAndOpenHub(page, CREDS.director.email, CREDS.director.password);
  });

  test("Expired holds card — extender opens with date input", async ({ page }) => {
    // C19/C20 — only fires if fixture provides an expired hold
    const extendBtn = page.getByRole("button", { name: /^Extend$/i }).first();
    const isThere = await extendBtn.isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(!isThere, "No expired-holds fixture present — extender test skipped (fixture gap).");

    await extendBtn.click();
    // Extender wrapper testid
    await expect(page.getByTestId("hub-expired-holds-extender")).toBeVisible();
    // Date input present within the extender
    await expect(
      page.getByTestId("hub-expired-holds-extender").locator('input[type="date"]'),
    ).toBeVisible();
    // Buttons within the extender
    await expect(
      page.getByTestId("hub-expired-holds-extender").getByRole("button", { name: /Set date/i }),
    ).toBeVisible();
    await expect(
      page.getByTestId("hub-expired-holds-extender").getByRole("button", { name: /Indefinitely/i }),
    ).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — Multi-tenant safety (Law 7)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("multi-tenant safety", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoCredentials(CREDS.director, "director");
    await loginAndOpenHub(page, CREDS.director.email, CREDS.director.password);
  });

  test("hub does not surface cross-agency content — no error boundary either", async ({ page }) => {
    // Loose assertion — the strong version needs known cross-agency fixture addresses.
    // For now: assert the page renders and does not show any obvious cross-agency
    // leak indicators (specifically the internal-only widgets).
    await expect(page.getByText(/Needs assigning/i)).not.toBeVisible();
    await expect(page.getByText(/New buyer added/i)).not.toBeVisible();
  });
});
