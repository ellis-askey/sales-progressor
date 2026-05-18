import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"

// ── Passwords ─────────────────────────────────────────────────────────────────
// Most accounts share TEST_PASSWORD. Per-account overrides for accounts that
// have their own credentials (director, superadmin, zero-file progressor).

export const PASSWORDS = {
  default:       process.env.TEST_PASSWORD ?? "",
  director:      process.env.TEST_DIRECTOR_PASSWORD      ?? process.env.TEST_PASSWORD ?? "",
  superadmin:    process.env.TEST_SUPERADMIN_PASSWORD    ?? process.env.TEST_PASSWORD ?? "",
  zeroProgressor: process.env.TEST_PROGRESSOR_ZERO_PASSWORD ?? "password",
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export const USERS = {
  // Internal staff (production accounts)
  admin:               "ellisaskey@googlemail.com",
  progressor:          "ellis@thesalesprogressor.co.uk",   // sales_progressor with assigned files
  progressorWithFiles: "ellis@thesalesprogressor.co.uk",   // alias — same account
  progressorZeroFiles: process.env.TEST_PROGRESSOR_ZERO_EMAIL ?? "ellis+zero@thesalesprogressor.co.uk",
  superadmin:          process.env.TEST_SUPERADMIN_EMAIL   ?? null as string | null,

  // Agent accounts (customer agencies)
  director:   process.env.TEST_DIRECTOR_EMAIL   ?? "taylor@akeman-residential.co.uk",
  negotiator: process.env.TEST_NEGOTIATOR_EMAIL ?? null as string | null,  // deferred
}

// ── Login helper ──────────────────────────────────────────────────────────────

export async function dismissCookieBanner(page: Page) {
  const banner = page.getByRole("button", { name: "Essential only" })
  if (await banner.isVisible({ timeout: 3000 }).catch(() => false)) {
    await banner.click()
  }
}

export async function login(page: Page, email: string | null, password: string = PASSWORDS.default) {
  if (!email) throw new Error("login called with null email — set the relevant TEST_*_EMAIL env var in .env.test")
  await page.goto("/login")
  await dismissCookieBanner(page)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

// ── Asserts a page loaded without crashing — not on login, no error boundary ─

export async function expectPageOk(page: Page, url: string) {
  await page.goto(url, { waitUntil: "commit" })
  await page.waitForLoadState("domcontentloaded")
  await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 })
  await expect(page.getByText("Something went wrong")).not.toBeVisible()
  await expect(page.getByText("Application error")).not.toBeVisible()
}
