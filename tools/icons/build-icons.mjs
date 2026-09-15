/*
 * FAVICON FILES FROM NOAH'S MARK (2026-09-15).
 *
 * Noah: "Let's also double check that the correct favicon is being used on the
 * mobile version."
 *
 * The site's mark is src/app/icon.svg. Desktop browsers use it directly, but
 * iPhones look for an apple-touch-icon PNG for the home screen, bookmarks and
 * Safari's tab and favorites tiles, and many other clients ask for
 * /favicon.ico. Production served neither (both 404), so a phone had nothing
 * of Noah's to show there.
 *
 * This renders both from the SVG, so they can never drift from it:
 *
 *   src/app/apple-icon.png  180x180, the mark inset 20px on a solid white
 *                           square. iOS rounds the corners itself, and fills
 *                           any transparency with black.
 *   src/app/favicon.ico     16, 32 and 48px PNGs in one ICO, transparent
 *                           outside the mark's own white disc, like the SVG.
 *
 * Each size is drawn from the vector at that size, never scaled down from a
 * bigger bitmap. Run with the project's Chrome:  node tools/icons/build-icons.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const SVG = new URL("../../src/app/icon.svg", import.meta.url);
const APP = new URL("../../src/app/", import.meta.url);
const APPLE = { size: 180, inset: 20 };
const ICO_SIZES = [16, 32, 48];

const browser = await chromium.launch({
  executablePath:
    process.env.QA_CHROME ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await (await browser.newContext()).newPage();
await page.setContent("<body></body>");
const svg = "data:image/svg+xml;base64," + readFileSync(SVG).toString("base64");

const render = async (size, { square = false, inset = 0 } = {}) =>
  Buffer.from(
    await page.evaluate(
      async ([svg, size, square, inset]) => {
        const img = new Image();
        img.src = svg;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const g = c.getContext("2d");
        if (square) {
          g.fillStyle = "#ffffff";
          g.fillRect(0, 0, size, size);
        }
        const d = size - 2 * inset;
        g.drawImage(img, inset, inset, d, d);
        return c.toDataURL("image/png").split(",")[1];
      },
      [svg, size, square, inset]
    ),
    "base64"
  );

const apple = await render(APPLE.size, { square: true, inset: APPLE.inset });
writeFileSync(new URL("apple-icon.png", APP), apple);

// An ICO is a small directory of images; every current browser reads PNGs
// stored inside one.
const pngs = [];
for (const s of ICO_SIZES) pngs.push(await render(s));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(ICO_SIZES[i], 0);
  e.writeUInt8(ICO_SIZES[i], 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
writeFileSync(new URL("favicon.ico", APP), Buffer.concat([header, ...entries, ...pngs]));

await browser.close();
console.log(`  src/app/apple-icon.png  ${apple.length} bytes`);
console.log(`  src/app/favicon.ico     ${offset} bytes (${ICO_SIZES.join(", ")}px)`);
