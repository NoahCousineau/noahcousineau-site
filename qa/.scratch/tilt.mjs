import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.request.post("http://localhost:3000/api/unlock", { data: { pass: "TopSecret!" } });
await page.goto("http://localhost:3000/work/socal-earth", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(7000);   // let the objects drop and settle
const read = () => page.evaluate(() => {
  // The drop-field bodies: absolutely positioned wrappers the hook drives,
  // inside the header's own arena.
  const arena = document.querySelector('section div.absolute.inset-x-0.top-0');
  if (!arena) return { err: "no arena" };
  const bodies = [...arena.querySelectorAll(':scope > .absolute')];
  if (!bodies.length) return { err: "no bodies" };
  const rs = bodies.map(b => b.getBoundingClientRect());
  return {
    n: rs.length,
    meanX: Math.round(rs.reduce((a,r)=>a+r.left+r.width/2,0)/rs.length),
    meanY: Math.round(rs.reduce((a,r)=>a+r.top+r.height/2,0)/rs.length),
    vw: window.innerWidth,
  };
});
console.log("settled upright ", JSON.stringify(await read()));
const tiltTo = (beta, gamma) => page.evaluate(([b,g]) => {
  window.dispatchEvent(Object.assign(new Event("deviceorientation"), { alpha: 0, beta: b, gamma: g }));
}, [beta, gamma]);
// tilt right
for (let i=0;i<40;i++){ await tiltTo(45, 70); await page.waitForTimeout(50); }
console.log("tilted right    ", JSON.stringify(await read()));
// tilt left
for (let i=0;i<60;i++){ await tiltTo(45, -70); await page.waitForTimeout(50); }
console.log("tilted left     ", JSON.stringify(await read()));
await browser.close();
