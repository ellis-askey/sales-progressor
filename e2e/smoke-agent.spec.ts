import { test, type Page } from "@playwright/test"
import { login, expectPageOk, USERS } from "./helpers"

let agentPage: Page

test.describe.serial("Agent app smoke tests (negotiator)", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    agentPage = await context.newPage()
    await login(agentPage, USERS.negotiator)
    await agentPage.waitForURL(/\/agent/, { timeout: 20000 })
  })

  test.afterAll(async () => {
    await agentPage.context().close()
  })

  test("hub loads", async () => {
    await expectPageOk(agentPage, "/agent/hub")
  })

  test("dashboard (transactions list) loads", async () => {
    await expectPageOk(agentPage, "/agent/dashboard")
  })

  test("analytics loads", async () => {
    await expectPageOk(agentPage, "/agent/analytics")
  })

  test("comms loads", async () => {
    await expectPageOk(agentPage, "/agent/comms")
  })

  test("completions loads", async () => {
    await expectPageOk(agentPage, "/agent/completions")
  })

  test("settings loads", async () => {
    await expectPageOk(agentPage, "/agent/settings")
  })

  test("solicitors loads", async () => {
    await expectPageOk(agentPage, "/agent/solicitors")
  })

  test("to-do loads", async () => {
    await expectPageOk(agentPage, "/agent/to-do")
  })

  test("work queue loads", async () => {
    await expectPageOk(agentPage, "/agent/work-queue")
  })

  test("quick-add loads", async () => {
    await expectPageOk(agentPage, "/agent/quick-add")
  })

  test("new transaction form loads", async () => {
    await expectPageOk(agentPage, "/agent/transactions/new")
  })

  test("transaction detail loads (first in list)", async () => {
    await agentPage.goto("/agent/dashboard")
    await agentPage.waitForLoadState("domcontentloaded")

    const firstLink = agentPage.locator('a[href^="/agent/transactions/"]').first()
    if ((await firstLink.count()) === 0) {
      test.skip()
      return
    }

    const href = await firstLink.getAttribute("href")
    if (!href) { test.skip(); return }

    await expectPageOk(agentPage, href)
  })
})
