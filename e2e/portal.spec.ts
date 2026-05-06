import { test, expect } from "@playwright/test"

test.describe("Portal smoke tests", () => {
  test("garbage token shows not-found", async ({ page }) => {
    await page.goto("/portal/this-token-does-not-exist-abc123")
    await page.waitForLoadState("domcontentloaded")
    // Next.js not-found renders a 404 — check we're not on an error boundary
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
    // Check the URL stayed on the portal path (didn't redirect elsewhere)
    await expect(page).toHaveURL(/\/portal\//)
  })

  test("valid token — portal home loads", async ({ page, request }) => {
    // Fetch a real token from the dev-only fixture endpoint
    const res = await request.get("/api/test-fixtures/portal-token")
    if (!res.ok()) {
      test.skip()
      return
    }

    const { token } = await res.json()
    await page.goto(`/portal/${token}`)
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/portal/${token}`))
  })

  test("valid token — progress tab loads", async ({ page, request }) => {
    const res = await request.get("/api/test-fixtures/portal-token")
    if (!res.ok()) { test.skip(); return }

    const { token } = await res.json()
    await page.goto(`/portal/${token}/progress`)
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
  })

  test("valid token — updates tab loads", async ({ page, request }) => {
    const res = await request.get("/api/test-fixtures/portal-token")
    if (!res.ok()) { test.skip(); return }

    const { token } = await res.json()
    await page.goto(`/portal/${token}/updates`)
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Something went wrong")).not.toBeVisible()
  })
})
