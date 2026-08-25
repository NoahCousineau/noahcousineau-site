import { chromium } from "playwright-core";
const SP = process.argv[2];
const routes = process.argv.slice(3);
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", e => errs.push(String(e)));
await page.request.post("http://localhost:3000/api/unlock", { data: { pass: "TopSecret!" } });
for (const spec of routes) {
  const [name, route] = spec.split("=");
  await page.goto("http://localhost:3000" + route, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => { const el=[...document.querySelectorAll('div')].find(d=>getComputedStyle(d).zIndex==='9999'); return !el||getComputedStyle(el).opacity==='0';},null,{timeout:25000}).catch(()=>{});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SP}/m-${name}.png`, fullPage: false });
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    sw: document.documentElement.scrollWidth,
  }));
  console.log(name.padEnd(12), JSON.stringify(m));
}
console.log("errors:", errs.length ? errs.slice(0,2) : "none");
await browser.close();
