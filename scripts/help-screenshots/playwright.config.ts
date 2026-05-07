import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["capture.ts"],
  outputDir: "../../docs/help/screenshots/raw",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    // Headless by default; set PWDEBUG=1 or HEADED=1 to see the browser
    headless: process.env.HEADED !== "1",
    screenshot: "off",   // we call page.screenshot() manually
    video: "off",
    trace: "off",
  },
  workers: 1,  // sequential — we depend on shared auth session
  retries: 0,
  reporter: [["line"]],
  timeout: 60_000,
});
