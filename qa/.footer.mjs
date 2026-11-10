import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = process.env.OUT;
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

for (const [w, h, tag] of [[1512, 950, "desktop"], [390, 844, "phone"]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, deviceScaleFactor: 2 })).newPage();
  await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(500);
  const i = await p.$("input");
  if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1500); }
  await p.goto(BASE + "/about", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2000);
  for (let s = 0; s < 60; s++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(110); }
  await p.waitForTimeout(2500);

  const info = await p.evaluate(() => {
    const want = ["Work", "More Info", "Hear From Me", "Contact"];
    const heads = [];
    for (const el of document.querySelectorAll("span,div,h1,h2,h3,p")) {
      const t = (el.textContent || "").trim();
      if (!want.includes(t)) continue;
      if (el.children.length) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      heads.push({ t, x: Math.round(r.x), y: Math.round(r.y), size: getComputedStyle(el).fontSize, font: getComputedStyle(el).fontFamily.split(",")[0] });
    }
    const links = [...document.querySelectorAll("footer a")]
      .map(a => ({ label: (a.textContent || "").trim(), href: a.getAttribute("href"), x: Math.round(a.getBoundingClientRect().x), y: Math.round(a.getBoundingClientRect().y) }))
      .filter(a => a.label && a.y > 0);
    return { heads, links };
  });

  console.log(`\n=== ${tag} ===`);
  console.log("headings:");
  for (const hd of info.heads.sort((a, b) => a.y - b.y || a.x - b.x))
    console.log(`   "${hd.t}" at x=${hd.x} y=${hd.y}  ${hd.size} ${hd.font}`);
  console.log("footer links (x,y):");
  for (const l of info.links.sort((a, b) => a.y - b.y || a.x - b.x))
    console.log(`   ${String(l.x).padStart(5)},${String(l.y).padStart(5)}  ${l.label.slice(0, 28).padEnd(28)} ${l.href}`);
  if (OUT) { await p.screenshot({ path: `${OUT}/footer-${tag}.png` }); console.log(`   shot -> footer-${tag}.png`); }
}
await b.close();
