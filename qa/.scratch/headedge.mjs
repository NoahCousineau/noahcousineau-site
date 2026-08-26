import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForFunction(() => { const e=[...document.querySelectorAll('div')].find(d=>getComputedStyle(d).zIndex==='9999'); return !e||getComputedStyle(e).opacity==='0'; },null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(1500);
// flip to dark and let the sheet swap in
await page.evaluate(() => document.querySelector('button[aria-pressed]')?.click());
await page.waitForTimeout(2500);
// Grab the canvas's own pixels — the head as actually composited.
const png = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return c.toDataURL("image/png");
});
console.log(png.length, "chars");
await import("node:fs").then(fs => fs.writeFileSync(process.argv[2], Buffer.from(png.split(",")[1], "base64")));
await browser.close();
