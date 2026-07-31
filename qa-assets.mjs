/**
 * Asset QA: loads every project page against the running server and
 * confirms each <img> decodes to real pixels. Catches broken paths after
 * an asset regeneration (e.g. PNG -> WebP rename).
 *
 *   node qa-assets.mjs
 */
import { chromium } from "playwright-core";
import projects from "./src/content/projects.json" with { type: "json" };

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 } });
const page = await ctx.newPage();

const bad = [];
let checked = 0;

for (const { slug } of projects) {
  await page.goto(`http://localhost:3000/work/${slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  // Force every lazy image into view, then wait for decode.
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll("img")) {
      img.loading = "eager";
      img.scrollIntoView();
    }
    await Promise.allSettled(
      [...document.querySelectorAll("img")].map((i) => i.decode())
    );
  });

  const broken = await page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => i.getAttribute("src"))
  );
  const total = await page.evaluate(
    () => document.querySelectorAll("img").length
  );

  checked += total;
  if (broken.length) bad.push({ slug, broken });
  console.log(`${slug.padEnd(28)} ${total - broken.length}/${total} loaded`);
}

await browser.close();

if (bad.length) {
  console.log("\nBROKEN:");
  for (const { slug, broken } of bad)
    console.log(` ${slug}:`, broken.slice(0, 5));
} else {
  console.log(`\nAll ${checked} images decoded across ${projects.length} pages.`);
}
process.exit(bad.length ? 1 : 0);
