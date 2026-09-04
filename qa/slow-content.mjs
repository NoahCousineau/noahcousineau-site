/*
 * DOES ANYTHING FAIL TO ARRIVE ON A BAD CONNECTION? (2026-09-03)
 *
 * Noah: "I saw that some content isn't loading. This may be an issue with the
 * poor wifi I'm on, but it would be best to double check."
 *
 * Loads each page throttled, scrolls the whole way down at a human pace, and
 * then reports anything that never turned up: requests that failed outright,
 * images still not decoded, and videos that never buffered enough to play.
 * Scrolling matters — most of this content is lazy by design, so a check that
 * only loads the page would declare it fine and learn nothing.
 */
import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3100";
const CHROME =
  process.env.QA_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGES = (process.env.QA_PAGES || "/,/about,/work/socal-earth").split(",");
const KBPS = Number(process.env.QA_KBPS || 700);
const LATENCY = Number(process.env.QA_LATENCY || 250);

const browser = await chromium.launch({ executablePath: CHROME });
let problems = 0;
for (const path of PAGES) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const failed = [];
  page.on("requestfailed", (r) => failed.push(r.url().slice(-70)));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(-70)}`);
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (KBPS * 1000) / 8,
    uploadThroughput: (KBPS * 1000) / 8,
    latency: LATENCY,
  });
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page
    .waitForFunction(
      () => {
        const o = [...document.querySelectorAll("div")].filter((d) => {
          const c = getComputedStyle(d);
          return c.position === "fixed" && +c.zIndex >= 9999 && +c.opacity > 0.01;
        });
        return o.length === 0;
      },
      null,
      { timeout: 200000 }
    )
    .catch(() => {});
  // Walk the page the way a reader would, giving lazy content its chance.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")];
    const bad = imgs
      .filter((i) => !(i.complete && i.naturalWidth > 0))
      .map((i) => decodeURIComponent(i.currentSrc || i.src).slice(-64));
    const vids = [...document.querySelectorAll("video")];
    const coldVids = vids
      .filter((v) => v.preload !== "none" && v.readyState < 2)
      .map((v) => (v.currentSrc || "").slice(-64));
    return { imgs: imgs.length, bad, vids: vids.length, coldVids };
  });
  const bad = r.bad.length + r.coldVids.length + failed.length;
  problems += bad;
  console.log(
    `  ${path.padEnd(20)} ${r.imgs} images, ${r.vids} videos — ` +
      `${r.bad.length} images missing, ${r.coldVids.length} videos cold, ${failed.length} failed requests`
  );
  [...r.bad, ...r.coldVids, ...failed].slice(0, 6).forEach((x) => console.log(`      ${x}`));
  await ctx.close();
}
console.log(problems ? `\n  ${problems} problem(s)` : "\n  everything arrived");
await browser.close();
