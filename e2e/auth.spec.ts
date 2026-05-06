import { test, expect, type Page } from "@playwright/test"

const PASSWORD = process.env.TEST_PASSWORD ?? ""

// Real users from production DB (verified 2026-05-06)
const ADMIN_EMAIL = "ellisaskey@googlemail.com"
const NEGOTIATOR_EMAIL = "tom@whitfieldhunt.co.uk"
const PROGRESSOR_EMAIL = "ellis@thesalesprogressor.co.uk"

async function dismissCookieBanner(page: Page) {
  const banner = page.getByRole("button", { name: "Essential only" })
  if (await banner.isVisible({ timeout: 3000 }).catch(() => false)) {
    await banner.click()
  }
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await dismissCookieBanner(page)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

test.describe("Login redirects", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  test("admin lands on /dashboard after login", async ({ page }) => {
    await login(page, ADMIN_EMAIL, PASSWORD)
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("negotiator lands on /agent after login", async ({ page }) => {
    await login(page, NEGOTIATOR_EMAIL, PASSWORD)
    await page.waitForURL(/\/agent/, { timeout: 20000 })
    await expect(page).toHaveURL(/\/agent/)
  })

  test("sales progressor lands on /dashboard after login", async ({ page }) => {
    await login(page, PROGRESSOR_EMAIL, PASSWORD)
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("wrong password shows error message", async ({ page }) => {
    await login(page, ADMIN_EMAIL, "wrongpassword")
    await expect(page.getByText("Incorrect email or password.")).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("Route protection", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  test("unauthenticated user visiting /agent/hub is redirected to login", async ({ page }) => {
    await page.goto("/agent/hub")
    await page.waitForURL(/\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test("unauthenticated user visiting /dashboard is redirected to login", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForURL(/\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test("negotiator visiting /dashboard is redirected to /agent", async ({ page }) => {
    await login(page, NEGOTIATOR_EMAIL, PASSWORD)
    await page.waitForURL(/\/agent/, { timeout: 20000 })

    await page.goto("/dashboard")
    await page.waitForURL(/\/agent/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/agent/)
  })
})
