const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const svgPath = path.resolve(__dirname, "../public/logo.svg");
  await page.goto(`file://${svgPath}`);

  // The SVG element itself — clip to exactly its bounds
  const el = await page.$("svg");
  await el.screenshot({
    path: path.resolve(__dirname, "../public/logo.png"),
    omitBackground: true, // transparent background
  });

  await browser.close();
  console.log("Exported: public/logo.png");
})();
