import { chromium } from "playwright-core";
const SP = process.argv[2], name = process.argv[3], route = process.argv[4];
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.request.post("http://localhost:3000/api/unlock", { data: { pass: "TopSecret!" } });
await page.goto("http://localhost:3000" + route, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForFunction(() => { const e=[...document.querySelectorAll('div')].find(d=>getComputedStyle(d).zIndex==='9999'); return !e||getComputedStyle(e).opacity==='0'; },null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(1400);
const shots = [];
for (let i = 0; i < 22; i++) {
  await page.screenshot({ path: `${SP}/step-${name}-${String(i).padStart(2,"0")}.png` });
  for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, 380); await page.waitForTimeout(80); }
  await page.waitForTimeout(320);
}
console.log("stepped", name);
await browser.close();
