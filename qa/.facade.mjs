import { chromium } from "playwright-core";
import fs from "node:fs";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await (await b.newContext({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 2 })).newPage();
let yt = 0, ytBytes = 0;
p.on("response", async (r) => {
  if (!/youtube|ytimg|googlevideo/i.test(r.url())) return;
  yt++; let n = Number(r.headers()["content-length"] || 0);
  if (!n) { try { n = (await r.body()).length; } catch {} } ytBytes += n;
});
await p.goto("http://localhost:3000/password", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(400);
const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1200); }
yt = 0; ytBytes = 0;
await p.goto("http://localhost:3000/work/sprouts-farmers-market", { waitUntil: "domcontentloaded" });
await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(2500);
for (let s = 0; s < 40; s++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(250); }
await p.waitForTimeout(3500);
console.log(`1. loaded + scrolled past the video: ${yt} youtube requests, ${(ytBytes/1024).toFixed(0)}KB`);

const btn = await p.$('button[aria-label^="Play video"]');
console.log(`2. facade button present: ${!!btn}`);
if (btn) {
  console.log(`   accessible name: "${await btn.getAttribute("aria-label")}"`);
  const box = await btn.boundingBox();
  console.log(`   rendered box: ${box ? Math.round(box.width)+"x"+Math.round(box.height) : "NOT VISIBLE"}`);
  const poster = await btn.$("img");
  const pm = poster && await poster.evaluate(e => ({ w: e.naturalWidth, src: e.currentSrc.slice(-70), complete: e.complete }));
  console.log(`   poster loaded: ${JSON.stringify(pm)}`);
  await btn.scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await btn.click();
  await p.waitForTimeout(4000);
  const fr = await p.$$eval("iframe", els => els.map(e => e.getAttribute("src")));
  console.log(`3. after click -> iframes: ${JSON.stringify(fr)}`);
  console.log(`   youtube requests now: ${yt}, ${(ytBytes/1024).toFixed(0)}KB`);
  console.log(`   still a facade button? ${!!(await p.$('button[aria-label^="Play video"]'))}`);
}
await b.close();
