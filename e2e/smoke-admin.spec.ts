import { test, type Page } from "@playwright/test"
import { login, expectPageOk, USERS } from "./helpers"

let adminPage: Page

test.describe.serial("Admin/dashboard smoke tests", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    adminPage = await context.newPage()
    await login(adminPage, USERS.admin)
    await adminPage.waitForURL(/\/agent\/hub/, { timeout: 20000 })
  })

  test.afterAll(async () => {
    await adminPage.context().close()
  })

  test("dashboard loads", async () => {
    await expectPageOk(adminPage, "/dashboard")
  })

  // /admin and /admin/audit retired 2026-08-15 — they now redirect into the
  // Command Centre (superadmin-only), so they're no longer part of this agent
  // smoke suite. The engine reference + agency fees live on /command/rules and
  // /command/agencies.

  test("analytics loads", async () => {
    await expectPageOk(adminPage, "/analytics")
  })

  test("reports loads", async () => {
    await expectPageOk(adminPage, "/reports")
  })

  test("tasks loads", async () => {
    await expectPageOk(adminPage, "/tasks")
  })

  test("todos loads", async () => {
    await expectPageOk(adminPage, "/todos")
  })

  test("solicitors loads", async () => {
    await expectPageOk(adminPage, "/solicitors")
  })

  test("comms loads", async () => {
    await expectPageOk(adminPage, "/comms")
  })

  test("new transaction form loads", async () => {
    await expectPageOk(adminPage, "/transactions/new")
  })
})
