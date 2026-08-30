/*
 * Builds the site's share card (src/app/opengraph-image.png).
 *
 * WHAT IT IS: a 1200x630 capture of the site's own home hero — the head in
 * its starburst, the wordmark, "graphic design" in the italic serif. Using
 * the real page rather than a separately-designed card means the preview
 * can never drift out of step with the site, and it uses the real Typekit
 * faces rather than a fallback.
 *
 * WHY IT EXISTS: without an opengraph image, every link to the site — in a
 * text message, on LinkedIn, in a DM — renders as a bare grey box with a
 * URL under it. For a portfolio that is the first thing anyone sees of the
 * work.
 *
 * TO REGENERATE (after any change to the hero):
 *   1. npm run build && npx next start -p 3100
 *   2. node tools/build_og_image.mjs
 *   3. npm run build      # so the new file is picked up
 *
 * TO REPLACE IT WITH A PIECE OF WORK INSTEAD: drop any 1200x630 image at
 * src/app/opengraph-image.png and delete nothing else — Next picks it up
 * from the filename alone, and this script is then only a fallback.
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.OG_BASE || "http://localhost:3100";
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
  "opengraph-image.png"
);

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
/* 1200x630 at deviceScaleFactor 1, which is the size every platform states
   and reads the dimensions from. A 2x capture was tried first and is worse
   on both counts: Next publishes the real pixel size in og:image:width, so
   the tags announced 2400x1260, and the file went to 915KB for a card that
   is rendered about 600px wide in a feed. */
const ctx = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });

// The intro loader sits over the page for several seconds; wait it out rather
// than capturing it.
await page
  .waitForFunction(
    () => {
      const o = [...document.querySelectorAll("div")].filter((d) => {
        const c = getComputedStyle(d);
        return c.position === "fixed" && +c.zIndex >= 999;
      });
      return o.length === 0 || o.every((d) => getComputedStyle(d).opacity === "0");
    },
    null,
    { timeout: 45000 }
  )
  .catch(() => {});
await page.waitForTimeout(3500);

// Hide the fixed chrome. The C mark and the theme toggle are interface, not
// artwork — in a static preview they read as stray marks in the corners.
await page.addStyleTag({
  content: `
    [aria-label="Back to home"],
    [aria-label^="Switch to"] { display: none !important; }
  `,
});
await page.waitForTimeout(400);

/*
 * WAIT FOR THE HEAD TO FACE FORWARD.
 *
 * The head is a turntable driven by rAF and there is no way to pin it to a
 * frame from outside, so a naive capture catches whatever pose the clock
 * happened to land on — the first run of this script produced a clean card
 * of Noah looking off to his left. A share card wants eye contact.
 *
 * "Facing forward" is measurable rather than a matter of taste: the head is
 * near mirror-symmetric only when it faces the camera. So sample the head's
 * own canvas, score how well the left half matches the flipped right half,
 * and shoot on the first frame that scores well.
 */
await page.evaluate(() => {
  // Score the head canvas: how far the left half is from a mirror of the
  // right half. The head is near-symmetric only when it faces the camera.
  window.__ogScore = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas || !canvas.width) return null;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const { width: w, height: h } = canvas;
    const d = ctx.getImageData(0, 0, w, h).data;
    const lum = (x, y) => {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 24) return -1; // transparent: outside the head
      return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    };
    // Use the head's own bounding box as the mirror axis — the sprite is not
    // centred in its frame, so the canvas centre is the wrong axis.
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y += 4)
      for (let x = 0; x < w; x += 4)
        if (lum(x, y) >= 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    if (maxX <= minX || maxY <= minY) return null;
    const cx = (minX + maxX) / 2;
    let diff = 0, n = 0;
    for (let y = minY; y <= maxY; y += 3)
      for (let dx = 2; dx < (maxX - minX) / 2; dx += 3) {
        const l = lum(Math.round(cx - dx), y);
        const r = lum(Math.round(cx + dx), y);
        if (l < 0 && r < 0) continue;
        diff += Math.abs((l < 0 ? 0 : l) - (r < 0 ? 0 : r));
        n++;
      }
    return n ? diff / n : null;
  };
});

/*
 * The head never scores zero — hair, moustache and lighting are not
 * symmetric even head-on — so there is no threshold worth hard-coding, and
 * the first version of this guessed one and never fired. Instead watch a
 * whole revolution, learn what this turntable's best actually is, then shoot
 * on the next frame that comes close to it.
 */
const SAMPLE_MS = 22000;
let best = Infinity;
const t1 = Date.now();
while (Date.now() - t1 < SAMPLE_MS) {
  const s = await page.evaluate(() => window.__ogScore());
  if (typeof s === "number" && s < best) best = s;
  await page.waitForTimeout(120);
}
const target = best * 1.12;
let shotScore = null;
for (let i = 0; i < 400; i++) {
  const s = await page.evaluate(() => window.__ogScore());
  if (typeof s === "number" && s <= target) { shotScore = s; break; }
  await page.waitForTimeout(80);
}
console.log(
  shotScore !== null
    ? `head facing forward (symmetry ${shotScore.toFixed(1)}, best over a revolution ${best.toFixed(1)})`
    : `WARNING: never came back to the forward pose (best ${best.toFixed(1)}) — capturing anyway`
);

await page.screenshot({ path: OUT });
await browser.close();
console.log("wrote", OUT);
