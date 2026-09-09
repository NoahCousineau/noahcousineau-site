/*
 * DOES THE HEAD MATCH THE THEME? (2026-09-08)
 *
 * Noah: "The site loaded on the darkmode version, but showed my rotating head
 * for light mode."
 *
 * The turntable is a canvas driven from one of two ~3MB sprite sheets, chosen
 * by theme and loaded imperatively with `new Image()`. Two can be in flight at
 * once — the theme changes, or the first client render guesses before it has
 * read the theme — and before the fix the sheet that finished LAST won
 * regardless of which was wanted. So the wrong head came and went with network
 * timing, which is why it read as intermittent.
 *
 * HOW THIS TELLS THE TWO HEADS APART, because the obvious way does not work.
 * Counting near-black pixels finds the sunglasses, and it does separate the
 * heads — but the head is turning, so the number depends on which arc of the
 * rotation the sampling window happened to cover. Measured, the light head
 * ranged over 7.7%, 12.0% and 18.0% across three runs against a dark head at
 * ~29%: a spread wider than the gap it was supposed to resolve, which produced
 * a confident wrong answer.
 *
 * So the sheets are replaced with flat colours of the same natural size, and
 * the canvas is asked which colour it is drawing. Red is the light sheet, blue
 * is the dark one. That is independent of rotation, frame, viewport and
 * cropping — the answer is the same whichever frame is up.
 *
 * Control-tested: removing the `cancelled` guard in RotatingHead fails the
 * mid-download case and no other.
 */
import { chromium } from "playwright-core";

const B = process.env.QA_BASE || "http://localhost:3000";
const CHROME =
  process.env.QA_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

{
  let res;
  try {
    res = await fetch(B + "/");
  } catch (e) {
    console.error(`\nNothing answering at ${B}/ — ${e.message}\n`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(
      `\n${B}/ returned ${res.status}. Either QA_BASE points at the wrong ` +
        `server, or this route no longer exists.\n`
    );
    process.exit(2);
  }
}

const LIGHT_URL = "**/sprite-sheet-light-staggered.webp";
const DARK_URL = "**/sprite-sheet-dark-staggered.webp";
/** The sheets' real natural sizes; the stand-ins must match so every frame
 *  rect the component reads is still in bounds. */
const SIZES = { light: [5760, 8640], dark: [5760, 7200] };
const MARKS = { light: [255, 0, 0], dark: [0, 0, 255] };

const browser = await chromium.launch({ executablePath: CHROME });

/** Flat-colour PNGs standing in for the two sheets, built once. */
const stand = {};
{
  const page = await (await browser.newContext()).newPage();
  for (const which of ["light", "dark"]) {
    const [w, h] = SIZES[which];
    const [r, g, b] = MARKS[which];
    const dataUrl = await page.evaluate(
      ([w, h, r, g, b]) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const x = c.getContext("2d");
        x.fillStyle = `rgb(${r},${g},${b})`;
        x.fillRect(0, 0, w, h);
        return c.toDataURL("image/png");
      },
      [w, h, r, g, b]
    );
    stand[which] = Buffer.from(dataUrl.split(",")[1], "base64");
  }
  await page.context().close();
}

/** What the canvas is actually drawing: "light", "dark", or null for neither. */
const READ = `(() => {
  const c = document.querySelector("canvas");
  if (!c) return null;
  const g = c.getContext("2d", { willReadFrequently: true });
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let red = 0, blue = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    if (d[i] > 180 && d[i + 2] < 80) red++;
    else if (d[i + 2] > 180 && d[i] < 80) blue++;
  }
  if (!red && !blue) return null;
  return red > blue ? "light" : "dark";
})()`;

async function newPage({ delayLight = 0, seedTheme = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 } });
  if (seedTheme) {
    await ctx.addInitScript(
      `try{localStorage.setItem("nc-theme",${JSON.stringify(seedTheme)});}catch(e){}`
    );
  }
  await ctx.route(LIGHT_URL, async (r) => {
    if (delayLight) await new Promise((s) => setTimeout(s, delayLight));
    return r.fulfill({ contentType: "image/png", body: stand.light });
  });
  await ctx.route(DARK_URL, (r) =>
    r.fulfill({ contentType: "image/png", body: stand.dark })
  );
  const page = await ctx.newPage();
  await page.goto(B, { waitUntil: "domcontentloaded" });
  return { ctx, page };
}

async function toggleToDark(page) {
  await page.click('button[aria-label="Switch to dark mode"]');
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
    null,
    { timeout: 5000 }
  );
}

const sheetsFetched = (page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((r) => r.name.includes("sprite-sheet"))
      .sort((a, b) => a.responseEnd - b.responseEnd)
      .map((r) =>
        r.name.split("/").pop().replace("sprite-sheet-", "").replace("-staggered.webp", "")
      )
  );

let fails = 0;
const check = (label, got, want, extra) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${label.padEnd(42)} head=${String(got).padEnd(5)} (want ${want})  ${extra}`
  );
};

// 1. A fresh load starts light, whatever an older visit left in storage — and
//    fetches only the sheet it is going to use.
{
  const { ctx, page } = await newPage({ seedTheme: "dark" });
  await page.waitForTimeout(6000);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  const got = await page.evaluate(READ);
  const sheets = await sheetsFetched(page);
  check(`stale "dark" in storage (theme=${theme})`, got, "light", `sheets=[${sheets.join(",")}]`);
  if (theme !== "light") { fails++; console.log(`       theme was ${theme}, wanted light`); }
  if (sheets.includes("dark")) { fails++; console.log("       fetched the dark sheet it never needed"); }
  await ctx.close();
}

// 2. Toggling to dark swaps the head.
{
  const { ctx, page } = await newPage();
  await page.waitForTimeout(6000);
  await toggleToDark(page);
  await page.waitForTimeout(2500);
  check("toggled to dark", await page.evaluate(READ), "dark", `sheets=[${(await sheetsFetched(page)).join(" then ")}]`);
  await ctx.close();
}

// 3. THE RACE. Flip to dark while the light sheet is still downloading, so the
//    abandoned light load finishes last and would overwrite the dark one.
{
  const { ctx, page } = await newPage({ delayLight: 9000 });
  await page.waitForTimeout(1500); // light sheet still in flight
  await toggleToDark(page);
  await page.waitForTimeout(11000); // outlast the light sheet's arrival
  check("flipped to dark mid-download", await page.evaluate(READ), "dark", `sheets=[${(await sheetsFetched(page)).join(" then ")}]`);
  await ctx.close();
}

// 4. And back again.
{
  const { ctx, page } = await newPage();
  await page.waitForTimeout(6000);
  await toggleToDark(page);
  await page.waitForTimeout(2000);
  await page.click('button[aria-label="Switch to light mode"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light", null, { timeout: 5000 });
  await page.waitForTimeout(2500);
  check("toggled back to light", await page.evaluate(READ), "light", "");
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n  ${fails} FAILED` : "\n  the head matches the theme in every case");
process.exit(fails ? 1 : 0);
