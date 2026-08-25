import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.request.post("http://localhost:3000/api/unlock", { data: { pass: "TopSecret!" } });
await page.goto("http://localhost:3000" + process.argv[2], { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(500);
console.log("t=0.5s", JSON.stringify(await page.evaluate(()=>({iw:innerWidth,sw:document.documentElement.scrollWidth}))));
await page.waitForTimeout(3000);
console.log("t=3.5s", JSON.stringify(await page.evaluate(()=>({iw:innerWidth,sw:document.documentElement.scrollWidth}))));
const out = await page.evaluate(() => {
  const vw = 390; // the DEVICE width; innerWidth is widened by shrink-to-fit
  const bad = [];
  document.querySelectorAll("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2) {
      bad.push({
        tag: el.tagName,
        cls: (el.className && String(el.className)).slice(0, 60),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
  });
  // keep the outermost few
  return { vw, scrollWidth: document.documentElement.scrollWidth, count: bad.length, sample: bad.slice(0, 12) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
