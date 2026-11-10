import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1000 } })).newPage();
await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(500);
const i = await p.$("input");
if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1200); }
await p.goto(BASE + "/about", { waitUntil: "domcontentloaded" });
await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2000);
for (let s = 0; s < 60; s++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(100); }
await p.waitForTimeout(2500);

const out = await p.evaluate(() => {
  const foot = document.querySelector("footer");
  const art = foot.querySelector(".artboard");
  const u = parseFloat(getComputedStyle(art).getPropertyValue("--u")) || (art.clientWidth / 1920);
  const rows = [];
  for (const el of foot.querySelectorAll("a, span")) {
    const t = (el.textContent || "").trim();
    if (!t || el.children.length) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    rows.push({ t, wPx: +r.width.toFixed(1), fontPx: +fs.toFixed(2), wUnits: +(r.width / u).toFixed(1), perFontUnit: +(r.width / fs).toFixed(3) });
  }
  return { u: +u.toFixed(4), artW: art.clientWidth, rows };
});
console.log("artboard width", out.artW, "--u", out.u);
for (const r of out.rows.sort((a, c) => c.wUnits - a.wUnits))
  console.log(`  ${String(r.wUnits).padStart(7)}u  ${String(r.wPx).padStart(7)}px @${r.fontPx}px  ratio=${r.perFontUnit}  "${r.t}"`);
await b.close();
