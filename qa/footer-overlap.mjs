/*
 * Does anything from the page curtain paint over the footer at full scroll?
 *
 * The footer is a fixed, full-viewport panel that .site-content slides up to
 * uncover. An absolutely positioned descendant of the curtain that extends
 * past the curtain's bottom keeps painting after the curtain has cleared —
 * directly over the footer. That reads as "the footer isn't showing".
 *
 * CLIP-AWARE. getBoundingClientRect reports an element's LAYOUT box and
 * knows nothing about ancestors that clip it, so a naive rect check reports
 * an element as covering the screen long after `overflow: clip` has cut it
 * away. Every rect here is therefore intersected with the clip box of every
 * ancestor whose overflow is not `visible`, which is what the compositor
 * actually paints.
 *
 * Measuring rather than screenshotting is deliberate: a screenshot of a
 * fixed, promoted layer is not reliable evidence about stacking. Geometry is.
 */
import { chromium } from "playwright-core";

const PW = process.env.SITE_PASSWORD;
/* Defaults to the dev server, like qa/harness.mjs. Point it at a
 * production build with QA_BASE=http://localhost:3100 */
const BASE = process.env.QA_BASE || "http://localhost:3000";
const PAGES = [
  "/", "/about", "/work",
  "/work/socal-earth",
  "/work/cultural-olympiad-poster",
  "/work/sprouts-farmers-market",
  "/work/corita-art-center",
  "/work/more-work",
  "/no-such-page",
];
const WIDTHS = [390, 900, 1512];

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
let bad = 0;

for (const path of PAGES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(BASE + "/password", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(600);
    const inp = await page.$("input");
    if (inp && PW) { await inp.fill(PW); await inp.press("Enter"); await page.waitForTimeout(1500); }

    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      for (let i = 0; i < 60; i++) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    await page.waitForTimeout(1500);

    const r = await page.evaluate(() => {
      // The rect actually painted: layout box ∩ every clipping ancestor.
      function visibleRect(el) {
        const b = el.getBoundingClientRect();
        let box = { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
        let p = el.parentElement;
        while (p) {
          const cs = getComputedStyle(p);
          const clips =
            cs.overflow !== "visible" ||
            cs.overflowX !== "visible" ||
            cs.overflowY !== "visible";
          if (clips) {
            const pb = p.getBoundingClientRect();
            box.top = Math.max(box.top, pb.top);
            box.bottom = Math.min(box.bottom, pb.bottom);
            box.left = Math.max(box.left, pb.left);
            box.right = Math.min(box.right, pb.right);
          }
          p = p.parentElement;
        }
        return box;
      }

      const curtain = document.querySelector(".site-content");
      const footer = document.querySelector("footer");
      if (!footer) return { noFooter: true };
      const cr = curtain ? curtain.getBoundingClientRect() : null;

      const midY = window.innerHeight / 2;
      const offenders = [];
      if (curtain) {
        for (const el of curtain.querySelectorAll("*")) {
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.opacity === "0" || cs.display === "none") continue;
          const bg = cs.backgroundColor;
          const opaque = bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg);
          if (!opaque && cs.backgroundImage === "none") continue;

          const v = visibleRect(el);
          if (v.bottom - v.top < 40) continue;             // clipped away
          if (v.right - v.left < window.innerWidth * 0.5) continue;
          if (v.top > midY || v.bottom < midY) continue;    // not over screen centre
          offenders.push({
            tag: el.tagName.toLowerCase(),
            pos: cs.position,
            bg,
            y: `${Math.round(v.top)}..${Math.round(v.bottom)}`,
          });
        }
      }
      return {
        curtainBottom: cr ? Math.round(cr.bottom) : null,
        offenders: offenders.slice(0, 4),
        atEnd: Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 4,
      };
    });

    const label = `${path} @${w}`.padEnd(44);
    if (r.noFooter) {
      console.log(`${label} NO FOOTER ELEMENT`);
      bad++;
    } else if (r.offenders.length) {
      console.log(`${label} COVERED curtainBottom=${r.curtainBottom}`);
      for (const o of r.offenders) console.log(`      ${o.tag} pos=${o.pos} bg=${o.bg} y=${o.y}`);
      bad++;
    } else if (r.curtainBottom !== null && r.curtainBottom > 20) {
      console.log(`${label} CURTAIN NOT CLEARED bottom=${r.curtainBottom} atEnd=${r.atEnd}`);
      bad++;
    } else {
      console.log(`${label} footer visible (curtain bottom ${r.curtainBottom})`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(bad === 0 ? "\nALL CLEAR — footer reachable everywhere" : `\n${bad} PROBLEM(S)`);
