import { test, expect } from "@playwright/test"
import { login, expectPageOk, USERS } from "./helpers"

// Logs in once as a negotiator and smoke-tests every agent-surface page.
test.describe.serial("Agent app smoke tests (negotiator)", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await login(page, USERS.negotiator)
    await page.waitForURL(/\/agent/, { timeout: 20000 })
    await page.context().storageState({ path: "e2e/.auth/agent.json" })
    await page.close()
  })

  test.use({ storageState: "e2e/.auth/agent.json" })

  test("hub loads", async ({ page }) => {
    await expectPageOk(page, "/agent/hub")
  })

  test("dashboard (transactions list) loads", async ({ page }) => {
    await expectPageOk(page, "/agent/dashboard")
  })

  test("analytics loads", async ({ page }) => {
    await expectPageOk(page, "/agent/analytics")
  })

  test("comms loads", async ({ page }) => {
    await expectPageOk(page, "/agent/comms")
  })

  test("completions loads", async ({ page }) => {
    await expectPageOk(page, "/agent/completions")
  })

  test("settings loads", async ({ page }) => {
    await expectPageOk(page, "/agent/settings")
  })

  test("solicitors loads", async ({ page }) => {
    await expectPageOk(page, "/agent/solicitors")
  })

  test("to-do loads", async ({ page }) => {
    await expectPageOk(page, "/agent/to-do")
  })

  test("work queue loads", async ({ page }) => {
    await expectPageOk(page, "/agent/work-queue")
  })

  test("quick-add loads", async ({ page }) => {
    await expectPageOk(page, "/agent/quick-add")
  })

  test("new transaction form loads", async ({ page }) => {
    await expectPageOk(page, "/agent/transactions/new")
  })

  test("transaction detail loads (first transaction in list)", async ({ page }) => {
    await page.goto("/agent/dashboard")
    await page.waitForLoadState("domcontentloaded")

    // Find the first transaction link and navigate to it
    const firstLink = page.locator('a[href^="/agent/transactions/"]').first()
    const count = await firstLink.count()

    if (count === 0) {
      test.skip()
      return
    }

    const href = await firstLink.getAttribute("href")
    if (!href) { test.skip(); return }

    await expectPageOk(page, href)
  })
})
