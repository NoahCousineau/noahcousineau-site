/**
 * Horizontal overflow + uncaught JS errors across mobile/tablet/desktop.
 * Needs a server running (`npm run dev` or `npm run start`).
 *
 *   node qa/responsive.mjs
 */
import { BASE, withBrowser } from "./harness.mjs";

const SIZES = { mobile: [390, 844], tablet: [834, 1112], desktop: [1512, 900] };
const ROUTES = ["/", "/about", "/work", "/work/socal-earth", "/work/nobody-cares"];

await withBrowser(async (browser) => {
  let failures = 0;

  for (const [label, [width, height]] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    for (const route of ROUTES) {
      await page
        .goto(BASE + route, { waitUntil: "networkidle", timeout: 60_000 })
        .catch(() => {});

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      const overflow = scrollWidth > innerWidth + 1;
      if (overflow) failures++;
      console.log(
        `${label.padEnd(8)} ${route.padEnd(24)} ${scrollWidth}/${innerWidth} ${
          overflow ? "OVERFLOW" : "ok"
        }`
      );
    }

    if (errors.length) {
      failures += errors.length;
      console.log(`  JS ERRORS (${label}):`, errors.slice(0, 3));
    }
    await ctx.close();
  }

  console.log(failures ? `\n${failures} issue(s).` : "\nClean at all breakpoints.");
  return failures;
});
