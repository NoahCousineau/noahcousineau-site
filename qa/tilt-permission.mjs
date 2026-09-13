/*
 * IS TILT ON FROM THE START, AS FAR AS EACH PHONE ALLOWS? (2026-09-12)
 *
 * Noah: "What I would prefer is for the tilt to be assumed on from the start.
 * Can tilt being on on all mobile sites be the default?"
 *
 * iOS decides what is possible, so each kind of phone is checked for the best
 * it permits:
 *
 *   Android (no gate)          on at load, no taps
 *   iPhone that said yes       on at load, no taps, no sheet
 *   iPhone never asked         one sheet on the first tap, on after it
 *   iPhone that said no        never on, and taps stop asking
 *   a browser that never lets  asks stop after a bounded number of taps
 *
 * The stub follows the HTML spec's activation rules, applied per event rather
 * than read from Chrome: for a synthetic tap Chrome's navigator.userActivation
 * reports every event as activated, which would hide exactly the bug this was
 * written for. With touch input, pointerdown and touchstart carry no
 * activation, and pointerup, touchend and click do. Under those rules the
 * previous flow never showed a fresh iPhone its sheet at all.
 *
 * Also asserts that no on-screen "tap to tilt" offer is rendered anywhere.
 */
import { chromium } from "playwright-core";

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
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(44)} ${detail}`);
};

for (const path of PAGES) {
  console.log(`\n  ${path}`);
  for (const kind of ["android", "granted", "prompt", "denied", "never"]) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    await ctx.addInitScript(stub(kind));
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(B + path, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(6000);

    const read = () =>
      page.evaluate(() => ({
        on: window.__attached,
        sheets: window.__sheets,
        calls: window.__calls,
        offer: !!document.querySelector("[data-motion-prompt]"),
      }));
    const tap = async (i) => {
      await page.touchscreen.tap(40, 600 + (i % 5));
      await page.waitForTimeout(900);
    };

    const atLoad = await read();
    if (atLoad.offer) report(false, `${kind}: no on-screen tilt offer`, "an offer was rendered");

    if (kind === "android" || kind === "granted") {
      report(
        atLoad.on && atLoad.sheets === 0 && !errs.length,
        `${kind === "android" ? "Android" : "iPhone that said yes"}: on at load`,
        `on=${atLoad.on} sheets=${atLoad.sheets}`
      );
    } else if (kind === "prompt") {
      await tap(0);
      const after = await read();
      report(
        !atLoad.on && after.on && after.sheets === 1 && !errs.length,
        "iPhone never asked: sheet on first tap",
        `load=${atLoad.on ? "on" : "off"} tap1=${after.on ? "on" : "off"} sheets=${after.sheets}`
      );
    } else if (kind === "denied") {
      for (let i = 0; i < 3; i++) await tap(i);
      const after = await read();
      report(
        !after.on && after.sheets === 0 && after.calls <= 1 && !errs.length,
        "iPhone that said no: stays off, stops asking",
        `on=${after.on} calls=${after.calls}`
      );
    } else if (kind === "never") {
      for (let i = 0; i < 10; i++) await tap(i);
      const settled = (await read()).calls;
      for (let i = 0; i < 3; i++) await tap(i);
      const later = (await read()).calls;
      report(
        !errs.length && later === settled,
        "browser that never allows: asking is bounded",
        `calls after 10 taps=${settled}, after 13=${later}`
      );
    }
    await ctx.close();
  }
}

await browser.close();
console.log(fails ? `\n  ${fails} FAILED` : "\n  tilt is on from the start wherever the phone allows it");
process.exit(fails ? 1 : 0);
