import { chromium } from "playwright-core";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForFunction(() => { const e=[...document.querySelectorAll('div')].find(d=>getComputedStyle(d).zIndex==='9999'); return !e||getComputedStyle(e).opacity==='0'; },null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(1200);
for (let i=0;i<150;i++){ await page.mouse.wheel(0, 600); await page.waitForTimeout(35); }
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SP}/foot-phone.png` });
console.log("ok");
await browser.close();
