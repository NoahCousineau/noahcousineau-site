/*
 * How much are the header objects still moving, and are any of them stacked?
 *
 * Noah: "getting the header icons able to move and rest on top of one another
 * and reduce fidgeting."
 *
 * Both halves are measurable from the DOM. Each object's transform gives its
 * position, so sampling every frame-ish gives speed in px/s — "fidgeting" is
 * whatever is still moving once the drop is over. And a pair is stacked when
 * one object's box sits above another's with their horizontal spans
 * overlapping, which is exactly what "resting on top of one another" means.
 *
 * Reports speed in one-second buckets so a pile that is slowly creeping shows
 * up differently from one that has genuinely stopped.
 */
import { chromium } from "playwright-core";

const PW = process.env.SITE_PASSWORD;
/* Defaults to the dev server, like qa/harness.mjs. Point it at a
 * production build with QA_BASE=http://localhost:3100 */
const BASE = process.env.QA_BASE || "http://localhost:3000";
const PAGES = process.argv[2]
  ? [process.argv[2]]
  : ["/work/socal-earth", "/work/sprouts-farmers-market", "/work/corita-art-center", "/work/more-work"];
const WIDTH = Number(process.argv[3] || 1400);

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/password", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(600);
  const inp = await page.$("input");
  if (inp && PW) { await inp.fill(PW); await inp.press("Enter"); await page.waitForTimeout(1500); }

  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForFunction(() => {
      const o = [...document.querySelectorAll("div")].filter((d) => {
        const c = getComputedStyle(d);
        return c.position === "fixed" && +c.zIndex >= 9999;
      });
      return o.length === 0 || o.every((d) => getComputedStyle(d).opacity === "0");
    }, null, { timeout: 45000 })
    .catch(() => {});

  const result = await page.evaluate(async () => {
    const arena = document.querySelector("section > div.absolute.inset-x-0.top-0");
    if (!arena) return { none: true };
    const kids = Array.prototype.slice.call(arena.children);

    const posOf = () => {
      const ar = arena.getBoundingClientRect();
      return kids.map((k) => {
        const b = k.getBoundingClientRect();
        return {
          x: b.left - ar.left, y: b.top - ar.top,
          w: b.width, h: b.height,
          vis: getComputedStyle(k).visibility === "visible",
        };
      });
    };

    // Let the drop itself happen before measuring the settle.
    await new Promise((r) => setTimeout(r, 3000));

    const buckets = [];
    for (let sec = 0; sec < 12; sec++) {
      let moved = 0;
      let prev = posOf();
      const t0 = performance.now();
      while (performance.now() - t0 < 1000) {
        await new Promise((r) => requestAnimationFrame(r));
        const now = posOf();
        for (let i = 0; i < now.length; i++) {
          if (!now[i].vis || !prev[i].vis) continue;
          moved += Math.hypot(now[i].x - prev[i].x, now[i].y - prev[i].y);
        }
        prev = now;
      }
      buckets.push(+moved.toFixed(2)); // px travelled by all bodies in that second
    }

    // Stacking: an object whose bottom rests near another's top, with their
    // horizontal spans overlapping by a real fraction.
    const p = posOf().filter((o) => o.vis);
    let stacked = 0;
    const pairs = [];
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < p.length; j++) {
        if (i === j) continue;
        const a = p[i], c = p[j];               // is a sitting on c?
        const gap = c.y - (a.y + a.h);          // a's bottom to c's top
        const overlapX =
          Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
        if (gap > -a.h * 0.5 && gap < a.h * 0.35 && overlapX > Math.min(a.w, c.w) * 0.25) {
          stacked++;
          pairs.push(`${i}on${j}`);
        }
      }
    }
    return { count: p.length, buckets, stacked, pairs: pairs.slice(0, 6) };
  });

  if (result.none) {
    console.log(`${path}: no arena`);
  } else {
    const late = result.buckets.slice(6).reduce((s, v) => s + v, 0) / 6;
    console.log(
      `${path.padEnd(34)} bodies=${result.count} stackedPairs=${result.stacked}\n` +
      `    px moved per second: [${result.buckets.join(", ")}]\n` +
      `    average over last 6s: ${late.toFixed(2)} px/s   ${result.pairs.length ? "stacks: " + result.pairs.join(" ") : ""}`
    );
  }
  await ctx.close();
}
await browser.close();
