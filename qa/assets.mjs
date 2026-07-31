/**
 * Confirms every <img> on every project page decodes to real pixels.
 * Catches broken paths after an asset regeneration (e.g. PNG -> WebP rename).
 * Needs a server running (`npm run dev` or `npm run start`).
 *
 *   node qa/assets.mjs
 */
import { BASE, withBrowser } from "./harness.mjs";
import projects from "../src/content/projects.json" with { type: "json" };

await withBrowser(async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 } });
  const page = await ctx.newPage();
  const bad = [];
  let checked = 0;

  for (const { slug } of projects) {
    await page.goto(`${BASE}/work/${slug}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // Force lazy images into view, then wait for actual decode.
    const { total, broken } = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll("img")];
      for (const img of imgs) {
        img.loading = "eager";
        img.scrollIntoView();
      }
      await Promise.allSettled(imgs.map((i) => i.decode()));
      return {
        total: imgs.length,
        broken: imgs
          .filter((i) => !i.complete || i.naturalWidth === 0)
          .map((i) => i.getAttribute("src")),
      };
    });

    checked += total;
    if (broken.length) bad.push({ slug, broken });
    console.log(`${slug.padEnd(28)} ${total - broken.length}/${total} loaded`);
  }

  if (bad.length) {
    console.log("\nBROKEN:");
    for (const { slug, broken } of bad) console.log(` ${slug}:`, broken.slice(0, 5));
  } else {
    console.log(`\nAll ${checked} images decoded across ${projects.length} pages.`);
  }
  return bad.length;
});
