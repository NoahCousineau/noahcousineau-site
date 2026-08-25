import { chromium } from "playwright-core";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const [name, w, h] of [["phone", 390, 844], ["desktop", 1512, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  // the away screen fires on blur; a headless page is already blurred, so
  // just wait for it to raise itself
  // The overlay raises itself on blur/idle. Headless pages report as
  // focused, so nudge it: fire a blur and wait for the panel to become
  // visible.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll("div")].find(
      (d) => getComputedStyle(d).zIndex === "9998" || (d.textContent || "").includes("CONTACT NOAH")
    );
    return el && getComputedStyle(el).opacity === "1";
  }, null, { timeout: 20000 }).catch(() => console.log("away did not appear", name));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SP}/away-${name}.png` });
  console.log("shot", name);
  await ctx.close();
}
await browser.close();
