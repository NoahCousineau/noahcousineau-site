/**
 * Responsive QA: checks for horizontal overflow and uncaught JS errors
 * across mobile / tablet / desktop. Requires `npm run dev` to be running.
 *
 *   node qa-responsive.mjs
 */
import { chromium } from "playwright-core";

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SIZES = {
  mobile: [390, 844],
  tablet: [834, 1112],
  desktop: [1512, 900],
};
const ROUTES = [
  "/",
  "/about",
  "/work",
  "/work/socal-earth",
  "/work/nobody-cares",
];

const browser = await chromium.launch({ executablePath: CHROME });
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
      .goto(`http://localhost:3000${route}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      })
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

await browser.close();
console.log(
  failures ? `\n${failures} issue(s) found.` : "\nClean at all breakpoints."
);
process.exit(failures ? 1 : 0);
