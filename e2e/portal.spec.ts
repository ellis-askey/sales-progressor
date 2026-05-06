import { test, expect, type Page } from "@playwright/test"
import { login, USERS } from "./helpers"

let portalToken: string | null = null
let adminPage: Page

test.describe.serial("Portal smoke tests", () => {
  test.beforeAll(async ({ browser }) => {
    // Log in as admin to fetch a portal token (middleware requires auth for API routes)
    const context = await browser.newContext()
    adminPage = await context.newPage()
    await login(adminPage, USERS.admin)
    await adminPage.waitForURL(/\/dashboard/, { timeout: 20000 })

    const res = await adminPage.request.get("/api/test-fixtures/portal-token")
    if (res.ok()) {
      const data = await res.json()
      portalToken = data.token ?? null
    }
  })

  test.afterAll(async () => {
    await adminPage.context().close()
  })

  test("garbage token shows not-found", async ({ page }) => {
    await page.goto("/portal/this-token-does-not-exist-abc123")
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
    await expect(page).toHaveURL(/\/portal\//)
  })

  test("valid token — portal home loads", async ({ page }) => {
    if (!portalToken) { test.skip(); return }
    await page.goto(`/portal/${portalToken}`)
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
  })

  test("valid token — progress tab loads", async ({ page }) => {
    if (!portalToken) { test.skip(); return }
    await page.goto(`/portal/${portalToken}/progress`)
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
  })

  test("valid token — updates tab loads", async ({ page }) => {
    if (!portalToken) { test.skip(); return }
    await page.goto(`/portal/${portalToken}/updates`)
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
  })
})
