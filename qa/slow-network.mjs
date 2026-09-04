/*
 * IS THE PAGE READY TO SCROLL WHEN THE CURTAIN LIFTS? (2026-09-03)
 *
 * Noah, from somewhere with bad wifi: "the website isn't functioning as well.
 * Let's make sure that the loading page gets the main page ready to scroll
 * down."
 *
 * Every other check here runs on a local server over loopback, where every
 * image is effectively instant and this question cannot be asked. So this one
 * throttles the connection through CDP and then asks two things at the moment
 * the loader lets go: how long the reader waited, and how much of the first
 * few screens is actually there.
 *
 * The second number is the point. A loader that lifts quickly onto a page
 * whose images have not been REQUESTED yet is not fast, it is early — and on
 * a fast connection the difference is invisible, which is why this went
 * unnoticed until Noah sat somewhere slow.
 */
import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3100";
const CHROME =
  process.env.QA_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LABEL = process.env.QA_LABEL || "";
/** How many screens down count as "ready to scroll". Matches PRIME_SCREENS. */
const SCREENS = 3;

const PROFILES = [
  { name: "fast-3G", down: 1.6e6 / 8, latency: 150 },
  { name: "slow-3G", down: 450e3 / 8, latency: 400 },
];

const browser = await chromium.launch({ executablePath: CHROME });
for (const { name, down, latency } of PROFILES) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: down,
    uploadThroughput: down,
    latency,
  });
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 180000 });
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
      { timeout: 150000 }
    )
    .catch(() => {});
  const loaderMs = Date.now() - t0;
  const r = await page.evaluate((screens) => {
    const horizon = window.innerHeight * screens;
    const imgs = [...document.querySelectorAll("main img")];
    const near = imgs.filter((i) => i.getBoundingClientRect().top < horizon);
    const ready = near.filter((i) => i.complete && i.naturalWidth > 0);
    return { near: near.length, ready: ready.length, total: imgs.length };
  }, SCREENS);
  const pct = r.near ? Math.round((100 * r.ready) / r.near) : 100;
  console.log(
    `  ${LABEL}${name}: loader ${String(loaderMs).padStart(6)}ms   first ${SCREENS} screens ready ${r.ready}/${r.near} (${pct}%)   page has ${r.total} images`
  );
  await ctx.close();
}
await browser.close();
