/*
 * TILT, FIRST THING, AS FAR AS EACH PHONE ALLOWS (2026-09-12, 2026-09-13)
 *
 * Noah: "What I would prefer is for the tilt to be assumed on from the start"
 * and then "Please have the motion request come up first thing on mobile,
 * even before the homepage loads."
 *
 *   Android (no gate)          no screen, on at load
 *   iPhone that said yes       no screen, on at load, no sheet
 *   iPhone that said no        no screen, stays off, stops asking
 *   iPhone never asked         "tap to enter" before the page, holding the
 *                              loader past its own cap; one tap, one sheet,
 *                              then tilt on and the page revealed
 *   browser that never allows  the screen lets the reader in; asking bounded
 *   iPad / Mac Safari width    no screen
 *   JavaScript arriving late   the screen and its tap work before React
 *
 * The stub follows the HTML spec's activation rules per event rather than
 * reading Chrome's navigator.userActivation, which marks every event of a
 * synthetic tap as activated and so hides exactly the bug of 2026-09-12. With
 * touch input, pointerdown and touchstart carry no activation; pointerup,
 * touchend and click do. A phone that has already answered gets its answer
 * with no gesture, as WebKit does.
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

/* Read the loader's cap from its source, so "holds past the cap" keeps
   meaning that if the number changes. */
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

async function open(kind, path, { width = 390, delayChunks = 0 } = {}) {
  const phone = width < 768;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
  });
  await ctx.addInitScript(stub(kind));
  if (delayChunks) {
    await ctx.route("**/_next/static/chunks/**", async (r) => {
      await new Promise((s) => setTimeout(s, delayChunks));
      return r.continue();
    });
  }
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(B + path, { waitUntil: "domcontentloaded", timeout: 120000 });
  return { ctx, page, errs };
}

const read = (page) =>
  page.evaluate(() => {
    const btn = document.querySelector("[data-tilt-ask]");
    const cs = btn && getComputedStyle(btn);
    return {
      attr: document.documentElement.getAttribute("data-tilt"),
      screen: !!btn && cs.visibility === "visible" && parseFloat(cs.opacity) > 0.5,
      loader: !!document.querySelector("[data-page-loader]"),
      on: window.__attached,
      sheets: window.__sheets,
      calls: window.__calls,
      oldOffer: !!document.querySelector("[data-motion-prompt]"),
    };
  });

const tapScreen = async (page) => {
  await page.touchscreen.tap(195, 422);
  await page.waitForTimeout(1500);
};
const tapPage = async (page, i) => {
  await page.touchscreen.tap(40, 600 + (i % 5));
  await page.waitForTimeout(900);
};

for (const path of PAGES) {
  console.log(`\n  ${path}`);

  for (const kind of ["android", "granted", "denied"]) {
    const { ctx, page, errs } = await open(kind, path);
    await page.waitForTimeout(6000);
    const s = await read(page);
    if (kind === "denied") for (let i = 0; i < 3; i++) await tapPage(page, i);
    const after = await read(page);
    const label = { android: "Android", granted: "iPhone that said yes", denied: "iPhone that said no" }[kind];
    const ok =
      !s.screen && !s.oldOffer && !errs.length &&
      (kind === "denied" ? !after.on && after.calls <= 1 : s.on && s.sheets === 0);
    report(ok, `${label}: no screen, ${kind === "denied" ? "stays off" : "on at load"}`,
      `data-tilt=${s.attr} screen=${s.screen} on=${after.on} calls=${after.calls}`);
    await ctx.close();
  }

  // Never asked: the screen comes first and holds the page until answered.
  {
    const { ctx, page, errs } = await open("prompt", path);
    await page.waitForTimeout(800);
    const early = await read(page);
    const holdFor = path === "/" ? MAX_WAIT_MS + 3000 : 6000;
    await page.waitForTimeout(holdFor);
    const held = await read(page);
    report(
      early.screen && held.screen && held.loader && !held.on && held.sheets === 0,
      `iPhone never asked: screen first, page held`,
      `at 0.8s screen=${early.screen}; at ${((800 + holdFor) / 1000).toFixed(1)}s screen=${held.screen} loader=${held.loader}` +
        (path === "/" ? ` (loader cap ${MAX_WAIT_MS / 1000}s)` : "")
    );
    await tapScreen(page);
    const tapped = await read(page);
    let revealed = true;
    try {
      await page.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 10000 });
    } catch {
      revealed = false;
    }
    report(
      tapped.sheets === 1 && tapped.on && !tapped.screen && revealed && !errs.length,
      `iPhone never asked: one tap, sheet, in`,
      `sheets=${tapped.sheets} on=${tapped.on} screen=${tapped.screen} page revealed=${revealed}`
    );
    await ctx.close();
  }

  // A browser that can never raise the sheet must not trap the reader.
  {
    const { ctx, page, errs } = await open("never", path);
    await page.waitForTimeout(3000);
    const before = await read(page);
    await tapScreen(page);
    const after = await read(page);
    for (let i = 0; i < 10; i++) await tapPage(page, i);
    const settled = (await read(page)).calls;
    for (let i = 0; i < 3; i++) await tapPage(page, i);
    const later = (await read(page)).calls;
    report(
      before.screen && !after.screen && after.attr === "skipped" && later === settled && !errs.length,
      `never allows: screen lets reader in, asking bounded`,
      `screen ${before.screen}->${after.screen} data-tilt=${after.attr} calls ${settled}->${later}`
    );
    await ctx.close();
  }
}

console.log("\n  wider than a phone, and JavaScript arriving late");
{
  const { ctx, page, errs } = await open("prompt", "/", { width: 1024 });
  await page.waitForTimeout(6000);
  const s = await read(page);
  report(!s.screen && s.attr === "prompt" && !errs.length, "iPad / Mac Safari width: no screen", `data-tilt=${s.attr} screen=${s.screen}`);
  await ctx.close();
}
{
  const { ctx, page, errs } = await open("prompt", "/", { delayChunks: 12000 });
  await page.waitForTimeout(2500);
  const early = await read(page);
  await tapScreen(page);
  const tapped = await read(page);
  await page.waitForTimeout(16000);
  const later = await read(page);
  report(
    early.screen && tapped.sheets === 1 && !tapped.screen && later.on && !errs.length,
    "JS 12s late: screen and tap work before React",
    `screen=${early.screen} sheets=${tapped.sheets} after tap screen=${tapped.screen}; tilt on once JS lands=${later.on}`
  );
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n  ${fails} FAILED` : "\n  the motion question comes first wherever a phone needs it");
process.exit(fails ? 1 : 0);
