import { chromium } from "playwright-core";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForFunction(() => { const e=[...document.querySelectorAll('div')].find(d=>getComputedStyle(d).zIndex==='9999'); return !e||getComputedStyle(e).opacity==='0'; },null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(1500);
const box = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const r = c.getBoundingClientRect();
  return { x: Math.max(0,r.x+r.width*0.18), y: Math.max(0,r.y+r.height*0.22), width: r.width*0.34, height: r.height*0.28 };
});
await page.screenshot({ path: `${SP}/ctx-light.png`, clip: box });
await page.evaluate(() => document.querySelector('button[aria-pressed]')?.click());
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SP}/ctx-dark.png`, clip: box });
console.log("ok");
await browser.close();
