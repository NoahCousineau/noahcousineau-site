import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3100";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
const p = await ctx.newPage();
await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(400);
const i = await p.$("input");
if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1200); }

for (const route of (process.env.ROUTES || "/corita-art-center,/cultural-olympiad-poster,/socal-earth,/more-work,/sprouts-farmers-market").split(",")) {
  await p.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);
  for (let s = 0; s < 90; s++) { await p.mouse.wheel(0, 1800); await p.waitForTimeout(55); }
  await p.waitForTimeout(2500);

  const r = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll("main img, article img, section img")];
    const rows = imgs.map(e => ({
      src: decodeURIComponent(e.currentSrc || e.src).replace(/^https?:\/\/[^/]+/, "").slice(-78),
      alt: e.getAttribute("alt"),
      broken: e.complete && e.naturalWidth === 0,
      nw: e.naturalWidth,
    }));
    const btns = [...document.querySelectorAll('button[aria-label^="Play video"]')].map(x => x.getAttribute("aria-label"));
    const heads = [...document.querySelectorAll("[id]")].filter(x => /^[a-z0-9-]+$/.test(x.id) && x.id.length > 2).map(x => x.id);
    const dupAlts = {};
    for (const q of rows) { if (!q.alt) continue; (dupAlts[q.alt] ||= []).push(q.src); }
    return { rows, btns, heads, dupAlts, text: document.body.innerText };
  });

  console.log(`\n=== ${route} === ${r.rows.length} imgs`);
  const empty = r.rows.filter(q => !q.alt);
  const broken = r.rows.filter(q => q.broken);
  console.log(`   empty alt: ${empty.length}   broken: ${broken.length}`);
  for (const q of broken.slice(0, 3)) console.log("   BROKEN", q.src);
  for (const [alt, srcs] of Object.entries(r.dupAlts))
    if (srcs.length > 1) console.log(`   x${srcs.length}  "${alt.slice(0, 70)}"`);
  for (const [alt, srcs] of Object.entries(r.dupAlts))
    if (srcs.length === 1) console.log(`    1   "${alt.slice(0, 74)}"`);
  if (r.btns.length) console.log("   play buttons:", JSON.stringify(r.btns));
  if (route === "/more-work") {
    console.log("   section ids:", r.heads.filter(h => /forced|parks|trade|disney|kdi|10-by/.test(h)).join(", "));
    console.log("   em dashes in headings:", (r.text.match(/ — /g) || []).length, "| hyphen headings:", (r.text.match(/\w - \w/g) || []).length);
    const ten = r.rows.find(q => /10-by-ten-logo-animation/.test(q.src));
    console.log("   10x10 animation:", ten ? `${ten.src} nw=${ten.nw}` : "NOT FOUND");
  }
}
await b.close();
