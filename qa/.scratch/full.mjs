import { chromium } from "playwright-core";
const SP = process.argv[2], name = process.argv[3], route = process.argv[4];
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.request.post("http://localhost:3000/api/unlock", { data: { pass: "TopSecret!" } });
await page.goto("http://localhost:3000" + route, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForFunction(() => { const el=[...document.querySelectorAll('div')].find(d=>getComputedStyle(d).zIndex==='9999'); return !el||getComputedStyle(el).opacity==='0';},null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(1200);
// step down the page so lazy content and pinned sections resolve
for (let i=0;i<45;i++){ await page.mouse.wheel(0, 700); await page.waitForTimeout(90); }
await page.waitForTimeout(800);
await page.screenshot({ path: `${SP}/mf-${name}.png`, fullPage: true });
console.log("shot", name);
await browser.close();
