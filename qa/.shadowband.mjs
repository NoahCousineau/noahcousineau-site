/* Does any shadow ever darken the header band? Sampled as PIXELS, because
   the question is what a reader sees there, not what the CSS says. */
import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs";
const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = process.env.OUT || ".";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await (await b.newContext({ viewport: { width: 1902, height: 950 }, deviceScaleFactor: 1 })).newPage();
await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(400);
const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1200); }
await p.goto(`${BASE}/work/sprouts-farmers-market`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(2200);
const band = await p.evaluate(() => { const r = document.querySelector(".proj-bar-rule");
  return r ? Math.round(r.offsetTop) : 71; });
let worst = { d: 0, at: null, alpha: null };
let shots = 0;
let sampled = 0;
let readyFrames = 0;
for (let k = 0; k < 420; k++) {
  await p.mouse.wheel(0, 90); await p.waitForTimeout(32);
  const st = await p.evaluate(() => {
    const secs = [...document.querySelectorAll("section.sticky")];
    const nearest = secs.map(e => Math.round(e.getBoundingClientRect().top)).filter(t => t > -60 && t < 260);
    const alphas = secs.map(e => getComputedStyle(e).getPropertyValue("--sheet-alpha").trim());
    return { nearest, alphas, ready: document.documentElement.dataset.projBar === "ready" };
  });
  if (st.ready) readyFrames++;
  if (!st.ready || !st.nearest.length) continue;
  sampled++;
  // the band's own strip, away from the type
  const buf = await p.screenshot({ clip: { x: 760, y: 2, width: 380, height: band - 6 } });
  const { data, info } = await sharp(buf).raw().removeAlpha().toBuffer({ resolveWithObject: true });
  let darkest = 255;
  for (let n = 0; n < data.length; n += 3) darkest = Math.min(darkest, data[n]);
  const d = 255 - darkest;
  if (d > worst.d) { worst = { d, at: st.nearest[0], alpha: st.alphas.find(a => a && a !== "0") || "0" };
    if (d > 4 && shots < 2) { shots++; await p.screenshot({ path: `${OUT}/band-${shots}.png`, clip: { x: 0, y: 0, width: 1902, height: band + 60 } }); } }
}
console.log(`  frames with the header up: ${readyFrames}; frames with a section edge near the band: ${sampled}`);
if (!sampled) { console.log("  NOTHING WAS MEASURED — this result means nothing"); await b.close(); process.exit(2); }
console.log(`  darkest the header band ever got: ${worst.d}/255 below paper (section edge at y=${worst.at}, alpha ${worst.alpha})`);
console.log(worst.d <= 4 ? "  the band stays clean" : "  SHADOW STILL REACHES THE BAND");
await b.close();
process.exit(worst.d <= 4 ? 0 : 1);
