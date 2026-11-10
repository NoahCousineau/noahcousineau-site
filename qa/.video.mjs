import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "https://noahcousineau.com";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();

let vids = new Map();
let other = 0;
p.on("response", async (r) => {
  const u = r.url();
  let n = Number(r.headers()["content-length"] || 0);
  if (/\.(mp4|mov|webm)(\?|$)/i.test(u)) {
    const name = decodeURIComponent(u).split("/").pop().split("?")[0];
    vids.set(name, (vids.get(name) || 0) + n);
  } else { other += n; }
});

await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(600);
const inp = await p.$("input");
if (inp && PW) { await inp.fill(PW); await inp.press("Enter"); await p.waitForTimeout(1800); }

for (const page of ["/work/sprouts-farmers-market", "/"]) {
  vids = new Map(); other = 0;
  await p.goto(BASE + page, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);
  for (let s = 0; s < 45; s++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(220); }
  await p.waitForTimeout(6000);
  const vTotal = [...vids.values()].reduce((a, c) => a + c, 0);
  console.log(`\n=== ${page} on a phone ===`);
  console.log(`  everything else : ${(other/1048576).toFixed(2)}MB`);
  console.log(`  video           : ${(vTotal/1048576).toFixed(2)}MB across ${vids.size} files`);
  console.log(`  TOTAL           : ${((other+vTotal)/1048576).toFixed(2)}MB`);
  for (const [n, v] of [...vids].sort((a, b) => b[1] - a[1]).slice(0, 6))
    console.log(`     ${(v/1048576).toFixed(2).padStart(6)}MB  ${n.slice(0, 56)}`);
}
await b.close();
