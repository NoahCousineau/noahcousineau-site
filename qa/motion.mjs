/*
 * DOES MOTION ACTUALLY WORK, PAGE BY PAGE? (2026-09-04)
 *
 * Noah: "Sometimes the pages load on mobile but there's no motion control.
 * Let's just do a pass with motion to make sure that anyone using the site is
 * prompted with motion control permissions and that each relevant mobile page
 * has motion activated."
 *
 * Two separate questions, and the earlier checks only ever asked the first:
 *
 *   ASKED     did the page call requestPermission at all, and attach a
 *             deviceorientation listener once granted?
 *   MOVES     with the permission granted and readings arriving, does
 *             anything on the page actually respond?
 *
 * A page can pass the first and fail the second — that is exactly the
 * "loads but no motion control" Noah is describing — so this drives real
 * orientation events afterwards and measures whether the page's own objects
 * move because of them.
 */
import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const CHROME =
  process.env.QA_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGES = (
  process.env.QA_PAGES ||
  "/,/about,/work,/work/socal-earth,/work/sprouts-farmers-market,/work/corita-art-center,/work/cultural-olympiad-poster,/work/valley-strong-credit-union,/work/more-work"
).split(",");

const PRECHECK = PAGES;
/* Fail loudly if BASE is not this site — a stale server on the wrong port
   answers 200 for `/` and 404 for everything else, and every count below
   then reads as a clean sheet. See assertServesSite in harness.mjs. */
for (const path of PRECHECK) {
  let res;
  try {
    res = await fetch(BASE + path);
  } catch (e) {
    console.error(`\nNothing answering at ${BASE}${path} — ${e.message}\n`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(
      `\n${BASE}${path} returned ${res.status}. Either QA_BASE points at ` +
        `the wrong server, or this route no longer exists.\n`
    );
    process.exit(2);
  }
}


/** Everything on the page that motion is supposed to move. */
const MOVERS = `(() => {
  const out = [];
  const arena = document.querySelector('section > div.absolute.inset-x-0.top-0');
  if (arena) for (const k of arena.children) out.push(k);
  // home grid objects
  for (const d of document.querySelectorAll('div.absolute.select-none')) {
    if (d.querySelector('img')) out.push(d);
  }
  // the footer head's eyes
  for (const e of document.querySelectorAll('[data-eye]')) out.push(e);
  return out;
})()`;

const browser = await chromium.launch({ executablePath: CHROME });
let bad = 0;
for (const path of PAGES) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  /* A phone that has NEVER been asked, with the HTML spec's activation rules:
     pointerdown and touchstart carry no activation for touch, so an ask made
     during them is rejected; pointerup, touchend and click can prompt. This
     used to grant every call unconditionally, which is why it passed a flow
     that could never grant on a fresh iPhone (2026-09-12). Chrome's own
     navigator.userActivation cannot stand in for this: for a synthetic tap it
     reports every event as activated. */
  await ctx.addInitScript(`{
    window.__asks = 0; window.__attached = false;
    const ACTIVATES = new Set(["pointerup", "touchend", "click"]);
    let current = null, state = "prompt";
    const add = window.addEventListener.bind(window);
    window.addEventListener = function (t, f, o) {
      if (t === "deviceorientation") window.__attached = true;
      return add(t, f, o);
    };
    for (const t of ["touchstart", "pointerdown", "pointerup", "touchend", "click"])
      add(t, () => { current = t; setTimeout(() => { if (current === t) current = null; }, 0); }, { capture: true });
    window.DeviceOrientationEvent = window.DeviceOrientationEvent || function () {};
    window.DeviceOrientationEvent.requestPermission = () => {
      if (state !== "prompt") return Promise.resolve(state);
      if (!ACTIVATES.has(current))
        return Promise.reject(new DOMException("requires a user gesture to prompt", "NotAllowedError"));
      window.__asks++; state = "granted";
      return Promise.resolve("granted");
    };
  }`);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(17000);

  /* The reader's first tap, which is what brings up Apple's sheet on a phone
     that has never been asked. Wait for the page to be uncovered and its
     entrances to get going before measuring anything that moves. */
  await page.touchscreen.tap(10, 700);
  await page.waitForTimeout(800);
  const asked = await page.evaluate(() => ({ n: window.__asks, at: window.__attached }));
  await page
    .waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(2500);

  /* Scroll the movers into view first. Several of them deliberately do not
     simulate while off screen — that is a performance guard, not a fault —
     so measuring them at the top of the page proves nothing about whether
     motion works. */
  await page.evaluate((sel) => {
    const m = eval(sel);
    if (m.length) m[0].scrollIntoView({ block: "center" });
  }, MOVERS);
  await page.waitForTimeout(1200);

  const before = await page.evaluate(
    (sel) => eval(sel).map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top]),
    MOVERS
  );
  // Sweep the phone through a real tilt, both ways.
  for (const [beta, gamma] of [[62, -45], [62, 45], [40, 0]]) {
    await page.evaluate(
      ([b, g]) => {
        const D = window.DeviceOrientationEvent;
        for (let i = 0; i < 25; i++)
          setTimeout(() => window.dispatchEvent(new D("deviceorientation", { beta: b, gamma: g })), i * 40);
      },
      [beta, gamma]
    );
    await page.waitForTimeout(1500);
  }
  const after = await page.evaluate(
    (sel) => eval(sel).map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top]),
    MOVERS
  );

  let moved = 0;
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    if (Math.hypot(after[i][0] - before[i][0], after[i][1] - before[i][1]) > 2) moved++;
  }
  const ok = asked.n > 0 && asked.at && (before.length === 0 || moved > 0) && !errs.length;
  if (!ok) bad++;
  console.log(
    `  ${path.padEnd(34)} sheets ${asked.n}  attached ${asked.at ? "yes" : "NO "}  ` +
      `movers ${String(before.length).padStart(2)}  moved ${String(moved).padStart(2)}  ` +
      `errs ${errs.length}  ${ok ? "ok" : "<-- NO MOTION"}`
  );
  await ctx.close();
}
console.log(bad ? `\n  ${bad} page(s) without working motion` : "\n  motion works on every page");
await browser.close();
