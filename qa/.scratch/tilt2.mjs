import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.request.post("http://localhost:3000/api/unlock", { data: { pass: "TopSecret!" } });
await page.goto("http://localhost:3000/work/socal-earth", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(9000);
const read = () => page.evaluate(() => {
  const header = document.querySelector("section");
  const imgs = [...header.querySelectorAll("img")]
    .map(i => i.getBoundingClientRect())
    .filter(r => r.width > 8 && r.width < 250);
  if (!imgs.length) return { err: "none" };
  return {
    n: imgs.length,
    meanX: +(imgs.reduce((a,r)=>a+r.left+r.width/2,0)/imgs.length).toFixed(1),
    meanY: +(imgs.reduce((a,r)=>a+r.top+r.height/2,0)/imgs.length).toFixed(1),
  };
});
const hold = async (beta, gamma, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.evaluate(([b,g]) => window.dispatchEvent(Object.assign(new Event("deviceorientation"), { alpha:0, beta:b, gamma:g })), [beta,gamma]);
    await page.waitForTimeout(40);
  }
};
console.log("upright        ", JSON.stringify(await read()));
await hold(45, 60, 3000);
console.log("gamma +60      ", JSON.stringify(await read()));
await hold(45, -60, 4000);
console.log("gamma -60      ", JSON.stringify(await read()));
await hold(-60, 0, 4000);
console.log("beta -60 (up)  ", JSON.stringify(await read()));
await browser.close();
