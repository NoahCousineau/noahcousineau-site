/* The statement's hand: pointing, stationary, and never holding the page.
   Noah: "stopping the page for the hand to fall is stopping the flow of
   things... make it so the finger doesn't rotate and then fall down. It
   should act like how it does on mobile." */
import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.QA_BASE || "http://localhost:3000";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
let bad = 0;
const ok = (c, w, d = "") => { if (!c) bad++; console.log(`  ${c ? "ok  " : "FAIL"} ${w.padEnd(52)} ${d}`); };
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const [w, h, tag] of [[1512, 950, "desktop"], [390, 844, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }
  await p.goto(`${BASE}/work/corita-art-center`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(2200);
  const hand = () => p.evaluate(() => {
    const im = [...document.querySelectorAll("img")].find(x => /hand|finger|pointing/i.test(x.src) && !x.closest("footer"));
    if (!im) return null;
    const e = im.parentElement, r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const m = new DOMMatrixReadOnly(cs.transform);
    return { deg: +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(1), vis: cs.visibility,
             op: +cs.opacity, onScreen: r.bottom > 0 && r.top < innerHeight };
  });
  const start = await hand();
  ok(!!start, `${tag}: the statement has a hand`, JSON.stringify(start));
  // wheel past the whole statement, checking the page never stops moving
  let stalls = 0, rotated = 0, hidden = 0;
  let last = await p.evaluate(() => Math.round(scrollY));
  for (let k = 0; k < 40; k++) {
    await p.mouse.wheel(0, 300); await p.waitForTimeout(90);
    const y = await p.evaluate(() => Math.round(scrollY));
    if (y === last) stalls++;
    last = y;
    const s = await hand();
    if (s) { if (Math.abs(s.deg - start.deg) > 1) rotated++; if (s.op < 0.9 || s.vis === "hidden") hidden++; }
  }
  ok(stalls <= 2, `${tag}: the page never stops while scrolling past it`, `${stalls} frames with no movement`);
  ok(rotated === 0, `${tag}: the finger never rotates`, `${rotated} frames turned`);
  ok(hidden === 0, `${tag}: and it never drops out of sight`, `${hidden} frames faded`);
  await ctx.close();
}
await b.close();
console.log(bad ? `\n  ${bad} FAILED\n` : "\n  the hand points and stays put on both tiers\n");
process.exit(bad ? 1 : 0);
