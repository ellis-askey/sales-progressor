// Render docs/feature-functionality-reference.html to PDF using playwright.
// Usage:  node scripts/render-feature-reference-pdf.js
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const htmlPath = path.resolve(__dirname, "..", "docs", "feature-functionality-reference.html");
  const pdfPath = path.resolve(__dirname, "..", "docs", "feature-functionality-reference.pdf");
  const url = pathToFileURL(htmlPath).href;

  console.log("Loading", url);
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
  });
  await browser.close();
  console.log("Wrote", pdfPath);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
