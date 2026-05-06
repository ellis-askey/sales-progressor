import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"

export const PASSWORD = process.env.TEST_PASSWORD ?? ""

export const USERS = {
  admin: "ellisaskey@googlemail.com",
  negotiator: "tom@whitfieldhunt.co.uk",
  director: "rachel@whitfieldhunt.co.uk",
  progressor: "ellis@thesalesprogressor.co.uk",
}

export async function dismissCookieBanner(page: Page) {
  const banner = page.getByRole("button", { name: "Essential only" })
  if (await banner.isVisible({ timeout: 3000 }).catch(() => false)) {
    await banner.click()
  }
}

export async function login(page: Page, email: string) {
  await page.goto("/login")
  await dismissCookieBanner(page)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
}

// Asserts a page loaded without crashing — not on login, no error boundary.
export async function expectPageOk(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState("domcontentloaded")
  await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 })
  await expect(page.getByText("Something went wrong")).not.toBeVisible()
  await expect(page.getByText("Application error")).not.toBeVisible()
}
