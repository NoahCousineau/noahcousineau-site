import { chromium } from "playwright-core";
import fs from "node:fs";
const PW = (fs.readFileSync(".env.local","utf8").match(/SITE_PASSWORD=(.*)/)||[])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await (await b.newContext({ viewport:{width:1512,height:950} })).newPage();
await p.goto("http://localhost:3000/password",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(500);
const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1500); }
for (const u of ["/","/about","/work","/work/sprouts-farmers-market"]) {
  await p.goto("http://localhost:3000"+u,{waitUntil:"domcontentloaded"});
  await p.waitForFunction(()=>!document.querySelector("[data-page-loader]"),null,{timeout:60000}).catch(()=>{});
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.scrollTo(0,0)); await p.waitForTimeout(400);
  const seen = []; let noRing = 0;
  for (let n = 0; n < 28; n++) {
    await p.keyboard.press("Tab");
    const info = await p.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const ow = parseFloat(s.outlineWidth) || 0;
      const hasRing = (ow > 0 && s.outlineStyle !== "none") || (s.boxShadow && s.boxShadow !== "none");
      const r = e.getBoundingClientRect();
      return { tag: e.tagName, label: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0,34),
               ring: hasRing, outline: s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor,
               onscreen: r.width > 0 && r.height > 0 };
    });
    if (!info) break;
    const key = info.tag + "|" + info.label;
    if (seen.some(s => s.key === key)) continue;
    seen.push({ key, ...info });
    if (!info.ring) noRing++;
  }
  console.log(`\n${u}  —  ${seen.length} focus stops, ${noRing} with NO visible ring`);
  for (const s of seen.filter(s => !s.ring).slice(0,10))
    console.log(`   NO RING  ${s.tag.padEnd(7)} "${s.label}"`);
}
await b.close();
