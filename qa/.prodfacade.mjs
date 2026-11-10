import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "https://noahcousineau.com";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await (await b.newContext({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 2 })).newPage();

let yt = 0, ytBytes = 0;
p.on("response", async (r) => {
  if (!/youtube|ytimg|googlevideo/i.test(r.url())) return;
  yt++;
  let n = Number(r.headers()["content-length"] || 0);
  if (!n) { try { n = (await r.body()).length; } catch {} }
  ytBytes += n;
});

await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(600);
const inp = await p.$("input");
if (inp && PW) { await inp.fill(PW); await inp.press("Enter"); await p.waitForTimeout(1800); }

yt = 0; ytBytes = 0;
await p.goto(BASE + "/work/sprouts-farmers-market", { waitUntil: "domcontentloaded" });
await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2500);
for (let s = 0; s < 40; s++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(220); }
await p.waitForTimeout(3500);
console.log(`loaded + scrolled past it: ${yt} youtube requests, ${(ytBytes/1024).toFixed(0)}KB`);

const btn = await p.$('button[aria-label^="Play video"]');
console.log("facade button on production:", !!btn);
if (btn) {
  console.log("  label  :", await btn.getAttribute("aria-label"));
  const img = await btn.$("img");
  console.log("  poster :", await img.evaluate(e => `${e.naturalWidth > 0 ? "loaded" : "BROKEN"} ${decodeURIComponent(e.currentSrc).slice(-52)}`));
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(700);
  const before = await btn.boundingBox();
  await btn.click({ force: true });
  await p.waitForTimeout(6000);
  const fr = await p.$("iframe");
  const after = fr ? await fr.boundingBox() : null;
  console.log("  after click, iframe src:", fr ? await fr.getAttribute("src") : "NONE");
  console.log("  youtube now:", yt, "requests,", (ytBytes/1024).toFixed(0) + "KB");
  if (before && after)
    console.log("  layout shift:", Math.abs(before.width-after.width) < 2 && Math.abs(before.height-after.height) < 2 ? "NONE" : `MOVED ${before.width}x${before.height} -> ${after.width}x${after.height}`);
}
await b.close();
