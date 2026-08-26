import { chromium } from "playwright-core";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.request.post("http://localhost:3000/api/unlock", { data: { pass: "TopSecret!" } });
await page.goto("http://localhost:3000/work/socal-earth", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForFunction(() => { const e=[...document.querySelectorAll('div')].find(d=>getComputedStyle(d).zIndex==='9999'); return !e||getComputedStyle(e).opacity==='0'; },null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(9000);   // let the drop finish
await page.screenshot({ path: `${SP}/proj-header.png` });
const m = await page.evaluate(() => {
  const sec = document.querySelector("section");
  const rule = [...sec.querySelectorAll("div")].find(d => {
    const cs = getComputedStyle(d);
    const r = d.getBoundingClientRect();
    return r.height > 0 && r.height < 12 && r.width > 300 && cs.background.includes("rgb");
  });
  const icons = [...sec.querySelectorAll("img")].map(i => i.getBoundingClientRect()).filter(r => r.width > 8);
  return {
    vh: window.innerHeight,
    ruleTop: rule ? Math.round(rule.getBoundingClientRect().top) : null,
    iconCount: icons.length,
    iconMeanW: icons.length ? Math.round(icons.reduce((a,r)=>a+r.width,0)/icons.length) : null,
    iconMaxBottom: icons.length ? Math.round(Math.max(...icons.map(r=>r.bottom))) : null,
  };
});
console.log(JSON.stringify(m));
await browser.close();
