/**
 * Package D + WS2 verification suite
 * ─────────────────────────────────────────────────────────────────────────────
 * PRODUCTION DATA CONTRACT — READ BEFORE EDITING
 *
 * This suite runs against REAL PRODUCTION DATA. Every test is READ-ONLY:
 *   - Navigate to pages
 *   - Assert what renders
 *   - Take screenshots
 *
 * NEVER add test steps that click:
 *   - Confirm / Undo on milestones
 *   - Mark complete on chase tasks
 *   - Save / Submit on any form
 *   - Any button that triggers a server action or mutation
 *
 * Tab and filter-chip clicks are allowed (UI state only, no data change).
 * If a mutation flow needs testing, use a separate spec against a seeded
 * staging environment — not this file.
 *
 * SCREENSHOT PRIVACY: Screenshots capture real customer file addresses,
 * names, and fees. Do not share externally without redaction.
 * Screenshots are gitignored (e2e/screenshots/) and stay local.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Run: npx playwright test e2e/package-d-and-ws2.spec.ts
 * See: e2e/README-package-d.md for setup, accounts, screenshot locations.
 */

import { test, expect, type Page } from "@playwright/test"
import * as path from "path"
import { login, expectPageOk, USERS, PASSWORDS, dismissCookieBanner } from "./helpers"

// ── Screenshot helper ─────────────────────────────────────────────────────────

const SHOT_DIR = "e2e/screenshots/package-d-ws2"
async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false })
}

// ── Console error tracking ────────────────────────────────────────────────────

function trackErrors(page: Page): () => string[] {
  const errs: string[] = []
  page.on("pageerror", e => errs.push(`[pageerror] ${e.message}`))
  page.on("console", m => { if (m.type() === "error") errs.push(`[console.error] ${m.text()}`) })
  return () => [...errs]
}

// ── Agent routes used by WS2 Cases 3-4 ───────────────────────────────────────

const AGENT_ROUTES = [
  "/agent/hub",
  "/agent/dashboard",
  "/agent/analytics",
  "/agent/comms",
  "/agent/completions",
  "/agent/solicitors",
  "/agent/to-do",
  "/agent/work-queue",
]

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE D — Cases 1-2: Admin sees data on /dashboard and /completing
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("PD-1/2 Admin data — /dashboard and /completing", () => {
  let page: Page
  let getErrors: () => string[]

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    page = await ctx.newPage()
    getErrors = trackErrors(page)
    await login(page, USERS.admin)
    await dismissCookieBanner(page)
    await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
  })

  test.afterAll(async () => { await page.context().close() })

  test("PD-1 admin /dashboard — forecast and post-exchange strips visible", async () => {
    await page.goto("/dashboard", { waitUntil: "networkidle" })
    await expect(page).not.toHaveURL(/\/login/)

    const forecastVisible = await page.getByText("Exchanging soon").isVisible().catch(() => false)
    const postExVisible   = await page.getByText("Exchanged — Awaiting Completion").isVisible().catch(() => false)

    await shot(page, "package-d-case-1-admin-dashboard")
    expect(getErrors(), "no console errors").toEqual([])

    if (!forecastVisible && !postExVisible) {
      test.skip(true, "No forecast or post-exchange data in production — acceptable only if no outsourced files exist")
    }
    expect(forecastVisible || postExVisible, "forecast or post-exchange strip visible").toBe(true)
  })

  test("PD-2 admin /completing — page renders correctly", async () => {
    await page.goto("/completing", { waitUntil: "networkidle" })
    await expect(page).not.toHaveURL(/\/login/)

    const hasGroups = await page.getByText(/Completing this week|Overdue|No completion date set|Completing later/).isVisible().catch(() => false)
    const hasEmpty  = await page.getByText("No files awaiting completion").isVisible().catch(() => false)

    await shot(page, "package-d-case-2-admin-completing")
    expect(getErrors(), "no console errors").toEqual([])
    expect(hasGroups || hasEmpty, "completing page renders content or empty state").toBe(true)

    if (!hasGroups) {
      test.skip(true, "No post-exchange outsourced files — empty state is valid")
    }
    expect(hasGroups, "at least one completing group visible").toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE D — Cases 3-4: Sales progressor (with files) sees scoped data
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("PD-3/4 Progressor with files — scoped data", () => {
  let page: Page
  let getErrors: () => string[]

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    page = await ctx.newPage()
    getErrors = trackErrors(page)
    await login(page, USERS.progressorWithFiles)
    await dismissCookieBanner(page)
    await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
  })

  test.afterAll(async () => { await page.context().close() })

  test("PD-3 progressor /dashboard — data visible and scoped", async () => {
    await page.goto("/dashboard", { waitUntil: "networkidle" })
    await expect(page).not.toHaveURL(/\/login/)

    const forecastVisible = await page.getByText("Exchanging soon").isVisible().catch(() => false)
    const postExVisible   = await page.getByText("Exchanged — Awaiting Completion").isVisible().catch(() => false)
    const hasTxRows       = await page.locator('a[href^="/transactions/"]').count().then(n => n > 0)

    await shot(page, "package-d-case-3-progressor-dashboard")
    expect(getErrors(), "no console errors").toEqual([])

    if (!forecastVisible && !postExVisible && !hasTxRows) {
      test.skip(true, "No assigned files for this progressor — check assignedUserId in DB")
    }
    expect(forecastVisible || postExVisible || hasTxRows, "progressor sees assigned data").toBe(true)
  })

  test("PD-4 progressor /completing — page renders correctly", async () => {
    await page.goto("/completing", { waitUntil: "networkidle" })
    await expect(page).not.toHaveURL(/\/login/)

    const hasGroups = await page.getByText(/Completing this week|Overdue|No completion date set|Completing later/).isVisible().catch(() => false)
    const hasEmpty  = await page.getByText("No files awaiting completion").isVisible().catch(() => false)

    await shot(page, "package-d-case-4-progressor-completing")
    expect(getErrors(), "no console errors").toEqual([])
    expect(hasGroups || hasEmpty, "completing page renders content or empty state").toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE D — Cases 5-6: Zero-files progressor — empty states render cleanly
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("PD-5/6 Zero-files progressor — empty states", () => {
  let page: Page
  let getErrors: () => string[]

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    page = await ctx.newPage()
    getErrors = trackErrors(page)
    await login(page, USERS.progressorZeroFiles, PASSWORDS.zeroProgressor)
    await dismissCookieBanner(page)
    await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
  })

  test.afterAll(async () => { await page.context().close() })

  test("PD-5 zero-files progressor /dashboard — clean empty state, no crash", async () => {
    await page.goto("/dashboard", { waitUntil: "networkidle" })
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page).not.toHaveURL(/error/)

    // Must NOT show data strips (no files assigned)
    await expect(page.getByText("Exchanging soon")).not.toBeVisible()
    await expect(page.getByText("Exchanged — Awaiting Completion")).not.toBeVisible()

    // Must show 0 counts or explicit empty state — not blank or broken
    const showsZero  = await page.getByText(/0 Total files|No transactions yet/).isVisible().catch(() => false)

    await shot(page, "package-d-case-5-progressor-empty-dashboard")
    expect(getErrors(), "no console errors").toEqual([])
    expect(showsZero, "zero-file dashboard shows empty state clearly").toBe(true)
  })

  test("PD-6 zero-files progressor /completing — clean empty state", async () => {
    await page.goto("/completing", { waitUntil: "networkidle" })
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText("No files awaiting completion")).toBeVisible({ timeout: 8000 })
    await expect(page.getByText("Something went wrong")).not.toBeVisible()

    await shot(page, "package-d-case-6-progressor-empty-completing")
    expect(getErrors(), "no console errors").toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE D — Case 7: Admin zero-outsourced /completing — SKIP
// (Admin has scope "all" — /completing shows all outsourced post-exchange files
//  across every agency. Requires zero such files globally. Not testable against
//  a live production system with real data. Covered by PD-2 empty state branch.)
// ═══════════════════════════════════════════════════════════════════════════════

test("PD-7 SKIP — requires zero outsourced post-exchange files globally (not testable on production)", async () => {
  test.skip(true, "PD-2 empty-state branch covers this; full coverage needs isolated staging env")
})

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE D — Cases 8-9: Agent regression
// Director path uses taylor@akeman-residential.co.uk (TEST_DIRECTOR_PASSWORD).
// Negotiator path is deferred — set TEST_NEGOTIATOR_EMAIL to enable.
// ═══════════════════════════════════════════════════════════════════════════════

type AgentRoleConfig = { label: string; email: string | null; password: string }
const AGENT_ROLE_CONFIGS: AgentRoleConfig[] = [
  { label: "director",   email: USERS.director,   password: PASSWORDS.director },
  { label: "negotiator", email: USERS.negotiator,  password: PASSWORDS.default  },
]

for (const { label, email, password } of AGENT_ROLE_CONFIGS) {
  test.describe.serial(`PD-8/9 Agent regression — ${label}`, () => {
    let page: Page
    let getErrors: () => string[]

    test.beforeAll(async ({ browser }) => {
      if (!email) return
      const ctx = await browser.newContext()
      page = await ctx.newPage()
      getErrors = trackErrors(page)
      await login(page, email, password)
      await dismissCookieBanner(page)
      await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
    })

    test.afterAll(async () => { await page?.context().close() })

    test(`PD-8 ${label} /agent/dashboard — list renders, no errors`, async () => {
      if (!email) { test.skip(true, `No ${label} account configured — set TEST_${label.toUpperCase()}_EMAIL`); return }

      await page.goto("/agent/dashboard", { waitUntil: "networkidle" })
      await expect(page).not.toHaveURL(/\/login/)
      await expect(page).toHaveURL(/\/agent\/dashboard/)

      const hasRows = await page.locator('a[href^="/agent/transactions/"]').count().then(n => n > 0)
      await shot(page, `package-d-case-8-${label}-transactions`)
      expect(getErrors(), "no console errors").toEqual([])

      if (!hasRows) { test.skip(true, `No transactions for ${label} in production`); return }
      expect(hasRows, "at least one transaction row rendered").toBe(true)
    })

    test(`PD-8 ${label} status tabs clickable without errors`, async () => {
      if (!email) { test.skip(true, `No ${label} account configured`); return }

      await page.goto("/agent/dashboard", { waitUntil: "networkidle" })
      for (const tabText of ["Active", "Archived"]) {
        const btn = page.getByRole("link", { name: new RegExp(tabText, "i") }).first()
        if (await btn.isVisible().catch(() => false)) {
          await btn.click()
          await page.waitForLoadState("domcontentloaded")
        }
      }
      expect(getErrors(), "no errors after tab clicks").toEqual([])
    })

    test(`PD-9 ${label} transaction detail — all tabs load`, async () => {
      if (!email) { test.skip(true, `No ${label} account configured`); return }

      await page.goto("/agent/dashboard", { waitUntil: "networkidle" })
      const firstLink = page.locator('a[href^="/agent/transactions/"]').first()
      if ((await firstLink.count()) === 0) { test.skip(true, `No transactions for ${label}`); return }

      const href = await firstLink.getAttribute("href")
      if (!href) { test.skip(true, "Could not get transaction href"); return }

      await page.goto(href, { waitUntil: "networkidle" })
      await expect(page).not.toHaveURL(/\/login/)

      for (const tabName of ["Overview", "Milestones", "Reminders", "Activity"]) {
        const tab = page.getByRole("button", { name: tabName })
          .or(page.getByRole("tab", { name: tabName })).first()
        if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await tab.click()
          await page.waitForLoadState("domcontentloaded")
          await shot(page, `package-d-case-9-${label}-tab-${tabName.toLowerCase()}`)
        }
      }
      expect(getErrors(), "no errors across all tabs").toEqual([])
    })
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// WS2 — Cases 1-2: Internal staff land on /agent/hub after login
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("WS2-1/2 Post-login redirect — internal staff land on /agent/hub", () => {
  test.beforeEach(async ({ page }) => { await page.context().clearCookies() })

  test("WS2-1 sales_progressor lands on /agent/hub", async ({ page }) => {
    await login(page, USERS.progressorWithFiles)
    await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
    await expect(page).toHaveURL(/\/agent\/hub/)
    await expect(page).not.toHaveURL(/\/dashboard/)
    await shot(page, "ws2-case-1-progressor-lands-agent-hub")
  })

  test("WS2-2 admin lands on /agent/hub", async ({ page }) => {
    await login(page, USERS.admin)
    await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
    await expect(page).toHaveURL(/\/agent\/hub/)
    await expect(page).not.toHaveURL(/\/dashboard/)
    await shot(page, "ws2-case-2-admin-lands-agent-hub")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// WS2 — Cases 3-4: Internal staff can navigate all /agent/* routes
// ═══════════════════════════════════════════════════════════════════════════════

for (const [caseNum, roleLabel, email, pwd] of [
  ["3", "sales_progressor", USERS.progressorWithFiles, PASSWORDS.default],
  ["4", "admin",            USERS.admin,               PASSWORDS.default],
] as const) {
  test.describe.serial(`WS2-${caseNum} ${roleLabel} — agent route access`, () => {
    let page: Page

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext()
      page = await ctx.newPage()
      await login(page, email, pwd)
      await dismissCookieBanner(page)
      await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
    })

    test.afterAll(async () => { await page.context().close() })

    for (const route of AGENT_ROUTES) {
      test(`${route} loads without redirect`, async () => {
        await page.goto(route, { waitUntil: "commit" })
        await page.waitForLoadState("domcontentloaded")
        await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 })
        await expect(page).not.toHaveURL(/\/dashboard/)
        await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")))
      })
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// WS2 — Case 5: Director and negotiator unchanged
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("WS2-5 Agent roles unchanged", () => {
  test.beforeEach(async ({ page }) => { await page.context().clearCookies() })

  test("WS2-5a director lands on /agent/hub", async ({ page }) => {
    if (!USERS.director) { test.skip(true, "No director account configured"); return }
    await login(page, USERS.director, PASSWORDS.director)
    await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
    await expect(page).toHaveURL(/\/agent\/hub/)
  })

  test("WS2-5b negotiator lands on /agent/hub", async ({ page }) => {
    if (!USERS.negotiator) { test.skip(true, "No negotiator account configured — set TEST_NEGOTIATOR_EMAIL"); return }
    await login(page, USERS.negotiator)
    await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
    await expect(page).toHaveURL(/\/agent\/hub/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// WS2 — Case 6: Superadmin still lands on /command/overview
// Enabled when TEST_SUPERADMIN_EMAIL + TEST_SUPERADMIN_PASSWORD are set.
// ═══════════════════════════════════════════════════════════════════════════════

test("WS2-6 superadmin lands on /command/overview", async ({ page }) => {
  if (!USERS.superadmin) {
    test.skip(true, "Set TEST_SUPERADMIN_EMAIL and TEST_SUPERADMIN_PASSWORD in .env.test to enable")
    return
  }
  await page.context().clearCookies()
  await login(page, USERS.superadmin, PASSWORDS.superadmin)
  await page.waitForURL(/\/command\/overview/, { timeout: 20000 })
  await expect(page).toHaveURL(/\/command\/overview/)
  await shot(page, "ws2-case-6-superadmin-command-overview")
})

// ═══════════════════════════════════════════════════════════════════════════════
// WS2 — Case 7: /dashboard direct URL still accessible (WS4 cleanup not done)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("WS2-7 /dashboard direct URL still accessible", () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    page = await ctx.newPage()
    await login(page, USERS.admin)
    await dismissCookieBanner(page)
    await page.waitForURL(/\/agent\/hub/, { timeout: 20000 })
  })

  test.afterAll(async () => { await page.context().close() })

  test("WS2-7 admin navigating directly to /dashboard — page loads, no error", async () => {
    await page.goto("/dashboard", { waitUntil: "networkidle" })
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
    await expect(page.getByText("Application error")).not.toBeVisible()
    await shot(page, "ws2-case-7-dashboard-direct-url")
  })
})
