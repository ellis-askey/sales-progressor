import { test } from "@playwright/test"
import { login, expectPageOk, USERS } from "./helpers"

// Logs in once as admin and smoke-tests every internal-dashboard page.
test.describe.serial("Admin/dashboard smoke tests", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await login(page, USERS.admin)
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
    await page.context().storageState({ path: "e2e/.auth/admin.json" })
    await page.close()
  })

  test.use({ storageState: "e2e/.auth/admin.json" })

  test("dashboard loads", async ({ page }) => {
    await expectPageOk(page, "/dashboard")
  })

  test("admin page loads", async ({ page }) => {
    await expectPageOk(page, "/admin")
  })

  test("audit log loads", async ({ page }) => {
    await expectPageOk(page, "/admin/audit")
  })

  test("analytics loads", async ({ page }) => {
    await expectPageOk(page, "/analytics")
  })

  test("reports loads", async ({ page }) => {
    await expectPageOk(page, "/reports")
  })

  test("tasks loads", async ({ page }) => {
    await expectPageOk(page, "/tasks")
  })

  test("todos loads", async ({ page }) => {
    await expectPageOk(page, "/todos")
  })

  test("solicitors loads", async ({ page }) => {
    await expectPageOk(page, "/solicitors")
  })

  test("comms loads", async ({ page }) => {
    await expectPageOk(page, "/comms")
  })

  test("new transaction form loads", async ({ page }) => {
    await expectPageOk(page, "/transactions/new")
  })
})
