import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "https://noahcousineau.com";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();

await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(600);
const inp = await p.$("input");
if (inp && PW) { await inp.fill(PW); await inp.press("Enter"); await p.waitForTimeout(1800); }

await p.goto(BASE + "/sprouts-farmers-market", { waitUntil: "domcontentloaded" });
await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2500);
for (let s = 0; s < 45; s++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(200); }
await p.waitForTimeout(6000);

const specs = await p.evaluate(() => [...document.querySelectorAll("video")].map(v => ({
  src: decodeURIComponent(v.currentSrc || v.src).split("/").pop(),
  natural: `${v.videoWidth}x${v.videoHeight}`,
  displayed: `${Math.round(v.getBoundingClientRect().width)}x${Math.round(v.getBoundingClientRect().height)}`,
  seconds: Number.isFinite(v.duration) ? +v.duration.toFixed(1) : "?",
  preload: v.preload, autoplay: v.autoplay, loop: v.loop, muted: v.muted,
})));
for (const s of specs) {
  console.log(`\n  ${s.src.slice(0, 58)}`);
  console.log(`    encoded ${s.natural}, shown at ${s.displayed} CSS px on a 390px phone`);
  console.log(`    ${s.seconds}s | preload=${s.preload} autoplay=${s.autoplay} loop=${s.loop} muted=${s.muted}`);
}
await b.close();
