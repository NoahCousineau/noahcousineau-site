import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.QA_BASE || "http://localhost:3100";
const OUT = process.env.OUT;
const WIDTHS = (process.env.WIDTHS || "640,900,1024,1199").split(",").map(Number);
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(350);
  const i = await p.$("input");
  if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1000); }
  await p.goto(BASE + "/about", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1200);
  for (let s = 0; s < 70; s++) { await p.mouse.wheel(0, 1600); await p.waitForTimeout(60); }
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/footer-${w}.png` });
  console.log("shot", w);
  await ctx.close();
}
await b.close();
