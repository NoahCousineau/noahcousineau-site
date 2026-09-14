/*
 * APPLE'S MOTION SHEET AT THE FIRST TOUCH, WITH NOTHING ON SCREEN (2026-09-13)
 *
 * Noah: "Let's just have the motion control request from apple show up first
 * when the site loads... Remove the tap to enter screen."
 *
 * Apple will not show the sheet without a touch, so each kind of phone is
 * checked for the earliest it permits, and that nothing is put on screen:
 *
 *   Android (no gate)            on at load
 *   iPhone that said yes         on at load, no sheet
 *   iPhone that said no          stays off, stops asking
 *   iPhone never asked, no touch no screen, page loads normally, nothing asked
 *   iPhone never asked, touch    one sheet on a touch made DURING the loading
 *     during loading             screen, then tilt on
 *   JavaScript arriving late     a touch still raises the sheet before React
 *   browser that never allows    asking stops after a bounded number of taps
 *
 * The stub follows the HTML spec's activation rules per event rather than
 * reading Chrome's navigator.userActivation, which marks every event of a
 * synthetic tap as activated. With touch input, pointerdown and touchstart
 * carry no activation; pointerup, touchend and click do. A phone that has
 * already answered gets its answer with no gesture, as WebKit does.
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const B = process.env.QA_BASE || "http://localhost:3000";
const PAGES = ["/", "/work/socal-earth"];

for (const path of PAGES) {
  let res;
  try {
    res = await fetch(B + path);
  } catch (e) {
    console.error(`\nNothing answering at ${B}${path} — ${e.message}\n`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(
      `\n${B}${path} returned ${res.status}. Either QA_BASE points at the wrong ` +
        `server, or this route no longer exists.\n`
    );
    process.exit(2);
  }
}

const capMatch = readFileSync(new URL("../src/components/PageLoader.tsx", import.meta.url), "utf8")
  .match(/MAX_WAIT_MS\s*=\s*([\d_]+)/);
if (!capMatch) {
  console.error("\nCould not find MAX_WAIT_MS in PageLoader.tsx.\n");
  process.exit(2);
}
const MAX_WAIT_MS = Number(capMatch[1].replace(/_/g, ""));

/** kind: "android" | "prompt" | "granted" | "denied" | "never" */
const stub = (kind) => `{
  const ACTIVATES = new Set(["pointerup", "touchend", "click"]);
  let current = null, state = ${JSON.stringify(kind)};
  window.__attached = false; window.__sheets = 0; window.__calls = 0;
  const add = window.addEventListener.bind(window);
  window.addEventListener = function (t, f, o) {
    if (t === "deviceorientation") window.__attached = true;
    return add(t, f, o);
  };
  for (const t of ["touchstart", "pointerdown", "pointerup", "touchend", "click"])
    add(t, () => { current = t; setTimeout(() => { if (current === t) current = null; }, 0); }, { capture: true });
  window.DeviceOrientationEvent = window.DeviceOrientationEvent || function () {};
  if (state === "android") {
    delete window.DeviceOrientationEvent.requestPermission;
  } else {
    window.DeviceOrientationEvent.requestPermission = () => {
      window.__calls++;
      if (state === "never")
        return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      if (state !== "prompt") return Promise.resolve(state);
      if (!ACTIVATES.has(current))
        return Promise.reject(new DOMException("requires a user gesture to prompt", "NotAllowedError"));
      window.__sheets++; state = "granted";
      return new Promise((r) => setTimeout(() => r("granted"), 250));
    };
  }
}`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
let fails = 0;
const report = (ok, label, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(46)} ${detail}`);
};

async function open(kind, path, { delayChunks = 0, delayMedia = 0 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(stub(kind));
  const hold = (ms) => async (r) => {
    await new Promise((s) => setTimeout(s, ms));
    return r.continue();
  };
  if (delayChunks) await ctx.route("**/_next/static/chunks/**", hold(delayChunks));
  // Holding the media back keeps the loading screen up, so a touch can be
  // made while it is still there.
  if (delayMedia) {
    await ctx.route("**/_next/image**", hold(delayMedia));
    await ctx.route(/\.(webp|png|jpe?g|avif|mp4)(\?|$)/, hold(delayMedia));
  }
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(B + path, { waitUntil: "domcontentloaded", timeout: 120000 });
  return { ctx, page, errs };
}

const read = (page) =>
  page.evaluate(() => ({
    attr: document.documentElement.getAttribute("data-tilt"),
    screen: !!document.querySelector("[data-tilt-ask], [data-motion-prompt]"),
    loader: !!document.querySelector("[data-page-loader]"),
    on: window.__attached,
    sheets: window.__sheets,
    calls: window.__calls,
  }));

const tap = async (page, x = 195, y = 422) => {
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(900);
};

for (const path of PAGES) {
  console.log(`\n  ${path}`);

  for (const kind of ["android", "granted", "denied"]) {
    const { ctx, page, errs } = await open(kind, path);
    await page.waitForTimeout(6000);
    const s = await read(page);
    if (kind === "denied") for (let i = 0; i < 3; i++) await tap(page, 40, 600 + i);
    const after = await read(page);
    const label = { android: "Android", granted: "iPhone that said yes", denied: "iPhone that said no" }[kind];
    const ok =
      !s.screen && !errs.length &&
      (kind === "denied" ? !after.on && after.calls <= 1 : s.on && s.sheets === 0);
    report(ok, `${label}: ${kind === "denied" ? "stays off" : "on at load"}`,
      `data-tilt=${s.attr} on=${after.on} calls=${after.calls}`);
    await ctx.close();
  }

  // Never asked, and never touched: nothing is shown and nothing holds the page.
  {
    const { ctx, page, errs } = await open("prompt", path);
    let revealed = true;
    const t0 = Date.now();
    try {
      await page.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, {
        timeout: MAX_WAIT_MS + 6000,
      });
    } catch {
      revealed = false;
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const s = await read(page);
    report(
      revealed && !s.screen && s.sheets === 0 && !s.on && !errs.length,
      "never asked, no touch: page loads, no screen",
      `revealed=${revealed} in ${secs}s screen=${s.screen} sheets=${s.sheets} data-tilt=${s.attr}`
    );
    await ctx.close();
  }

  // Never asked: the first touch, made while the loading screen is still up.
  {
    const { ctx, page, errs } = await open("prompt", path, { delayMedia: 8000 });
    await page.waitForTimeout(2000);
    const before = await read(page);
    await tap(page);
    const tapped = await read(page);
    await page.waitForTimeout(4000);
    const later = await read(page);
    report(
      before.loader && !before.screen && tapped.sheets === 1 && later.on && later.sheets === 1 && !errs.length,
      "never asked: touch during loading raises sheet",
      `loader up=${before.loader} sheets=${tapped.sheets} tilt on=${later.on}`
    );
    await ctx.close();
  }

  // A browser that can never raise the sheet stops being asked.
  {
    const { ctx, page, errs } = await open("never", path);
    await page.waitForTimeout(6000);
    for (let i = 0; i < 10; i++) await tap(page, 40, 600 + (i % 5));
    const settled = (await read(page)).calls;
    for (let i = 0; i < 3; i++) await tap(page, 40, 600 + i);
    const s = await read(page);
    report(
      s.calls === settled && !s.screen && !errs.length,
      "never allows: asking is bounded",
      `calls after 10 taps=${settled}, after 13=${s.calls}`
    );
    await ctx.close();
  }
}

console.log("\n  JavaScript arriving late");
{
  const { ctx, page, errs } = await open("prompt", "/", { delayChunks: 12000 });
  await page.waitForTimeout(2500);
  await tap(page);
  const tapped = await read(page);
  await page.waitForTimeout(16000);
  const later = await read(page);
  report(
    tapped.sheets === 1 && !tapped.screen && later.on && !errs.length,
    "JS 12s late: first touch raises sheet before React",
    `sheets=${tapped.sheets}; tilt on once JS lands=${later.on}`
  );
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n  ${fails} FAILED` : "\n  Apple's sheet comes at the first touch, with nothing on screen");
process.exit(fails ? 1 : 0);
