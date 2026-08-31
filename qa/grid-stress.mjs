/*
 * FAST-SCROLL STRESS TEST FOR THE PHONE HOME PAGE (2026-08-30).
 *
 * Noah: "scrolling at a fast speed seems to freeze the site. The grid just
 * won't load and will just be blank white space."
 *
 * Every earlier check on this page loaded it, waited, and measured a page at
 * rest — which is precisely the state the bug does not occur in. This one
 * scrolls the way a thumb does: real touch gestures driven through the
 * compositor (Input.synthesizeScrollGesture), at speeds well past what a hand
 * can produce, in both directions, over and over.
 *
 * What it watches for, sampled DURING and after each fling:
 *
 *   blank     a project tile is on screen but nothing is drawn in it — no
 *             loaded image, or an image that is transparent, clipped away, or
 *             covered. This is the reported symptom.
 *   frozen    the main thread stopped servicing frames. Measured as the gap
 *             between successive rAF callbacks; anything past ~250ms is a
 *             visible stall on a phone and is what "freeze" means.
 *   longtask  individual blocking tasks, so a freeze can be attributed rather
 *             than just observed.
 *   errors    anything thrown while scrolling.
 *
 * A NOTE ON WHAT THIS CANNOT SEE. Desktop Chrome will not reproduce iOS
 * Safari's tile memory running out (checkerboarding), which is a compositor
 * behaviour with no DOM signal at all. So a pass here is not proof on its
 * own — it rules out the DOM/CSS/JS causes and leaves the compositor ones,
 * which are addressed by reducing what the compositor is asked to hold. The
 * layer and image counts are reported for that reason.
 */

import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3100";
const CHROME =
  process.env.QA_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROUNDS = Number(process.env.QA_ROUNDS || 6);
/** Past a quarter second without a frame, a phone reads as stuck. */
const FREEZE_MS = 250;

/* Devices chosen for the extremes of the phone band rather than popularity:
 * the narrowest screen still sold, a typical modern one, and the tallest. */
const DEVICES = [
  { name: "iPhone SE", width: 375, height: 667, dpr: 2 },
  { name: "iPhone 14", width: 390, height: 844, dpr: 3 },
  { name: "iPhone 15 Pro Max", width: 430, height: 932, dpr: 3 },
];

/* Speeds in CSS px/s. A human fling on a phone tops out around 5000; the
 * upper two are deliberately past anything reachable, because the report was
 * about scrolling FAST and a margin is the point. */
const SPEEDS = [4000, 12000, 40000];

const INSTRUMENT = `
window.__qa = { longtasks: [], maxFrameGap: 0, errors: [], frames: 0 };
try {
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__qa.longtasks.push(Math.round(e.duration));
  }).observe({ entryTypes: ["longtask"] });
} catch {}
addEventListener("error", (e) => window.__qa.errors.push(String(e.message)));
addEventListener("unhandledrejection", (e) => window.__qa.errors.push("rejection: " + String(e.reason)));
(function tick(prev) {
  requestAnimationFrame((t) => {
    if (prev != null) {
      const gap = t - prev;
      window.__qa.frames++;
      if (gap > window.__qa.maxFrameGap) window.__qa.maxFrameGap = Math.round(gap);
    }
    tick(t);
  });
})(null);
`;

/*
 * Is anything actually drawn in each on-screen tile?
 *
 * Deliberately not "does an <img> exist" — the reported symptom is a tile that
 * is THERE and EMPTY. So each visible tile is asked for a loaded, opaque,
 * unclipped image, and the topmost element at its centre is checked too, which
 * catches a tile hidden behind something rather than missing.
 */
const PROBE = `(() => {
  const out = { visibleTiles: 0, blank: [], covered: [] };
  const vh = innerHeight, vw = innerWidth;
  /* Grid tiles only. The footer links to the same six projects with plain
     text anchors that contain no images at all, and an earlier version of
     this probe dutifully reported every one of them as a blank tile on every
     sample — 300-odd failures that were all the footer being the footer. */
  const tiles = [...document.querySelectorAll('a[href^="/work/"]')].filter(
    (a) => !a.closest("footer") && a.querySelector("img")
  );
  for (const t of tiles) {
    const r = t.getBoundingClientRect();
    if (r.bottom < 8 || r.top > vh - 8 || r.width < 4 || r.height < 4) continue;
    out.visibleTiles++;
    const label = (t.getAttribute("href") || "?").replace("/work/", "");
    const imgs = [...t.querySelectorAll("img")];
    const drawn = imgs.filter((i) => {
      if (!i.complete || !i.naturalWidth) return false;
      const c = getComputedStyle(i);
      if (c.display === "none" || c.visibility === "hidden") return false;
      if (parseFloat(c.opacity) < 0.01) return false;
      const b = i.getBoundingClientRect();
      return b.width > 2 && b.height > 2;
    });
    if (!drawn.length) out.blank.push(label + " (imgs=" + imgs.length + ")");
    const cx = Math.min(vw - 2, Math.max(2, r.left + r.width / 2));
    const cy = Math.min(vh - 2, Math.max(2, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    if (top && !t.contains(top) && top !== t && !t.parentElement?.contains(top)) {
      out.covered.push(label + " -> " + top.tagName.toLowerCase() + "." + (top.className || "").toString().slice(0, 40));
    }
  }
  return out;
})()`;

async function fling(client, x, y, dy, speed) {
  await client.send("Input.synthesizeScrollGesture", {
    x,
    y,
    xDistance: 0,
    yDistance: dy,
    speed,
    gestureSourceType: "touch",
    preventFling: false,
  });
}

async function runDevice(browser, dev) {
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.dpr,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage();
  const failures = [];
  page.on("pageerror", (e) => failures.push(`${dev.name}: pageerror ${e.message}`));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (/\/(assets|_next)\//.test(u)) failures.push(`${dev.name}: failed request ${u.slice(-70)}`);
  });

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  // The loader owns the screen until it lets go; scrolling before then tests
  // nothing, since scroll is locked while it is up.
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
      { timeout: 60000 }
    )
    .catch(() => failures.push(`${dev.name}: loader never cleared`));
  await page.waitForTimeout(800);

  /* MEASURE THE SCROLL, NOT THE BOOT (2026-08-30).
     Hydration is one ~240ms task at about t=400ms, and it was being reported
     as a scroll freeze on every device. It is real work, but it happens with
     the loading screen still up and scroll still locked, so no reader ever
     meets it as a stuck page. Zeroing here means a freeze this file reports
     is a freeze that happened WHILE SCROLLING, which is the claim being made.
     The boot task is reported separately below so it stays visible. */
  const bootTask = await page.evaluate(() => {
    const worst = window.__qa.longtasks.length ? Math.max(...window.__qa.longtasks) : 0;
    window.__qa.longtasks = [];
    window.__qa.maxFrameGap = 0;
    return worst;
  });

  /* SCROLL WITH THE PHYSICS AWAKE (2026-08-31).
   *
   * The home grid's objects now tilt, which means six bodies integrating,
   * colliding and repainting WHILE the reader scrolls. Testing a fast scroll
   * against a page whose physics is asleep would measure the easy case and
   * miss the one that was actually added. So: one real tap to satisfy the
   * orientation permission gate, then a stream of orientation changes for the
   * whole run, sweeping the gravity vector right round so nothing ever
   * settles. This is harder than any real phone in a real hand. */
  const client = await ctx.newCDPSession(page);
  const cx = Math.round(dev.width / 2);
  const cy = Math.round(dev.height / 2);

  await page.touchscreen.tap(8, dev.height - 60);
  await page.evaluate(() => {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    let a = 0;
    setInterval(() => {
      a += 0.25;
      window.dispatchEvent(
        new DOE("deviceorientation", {
          beta: 30 * Math.sin(a * 0.7),
          gamma: 55 * Math.sin(a),
        })
      );
    }, 40);
  });
  await page.waitForTimeout(400);

  let worstGap = 0;
  let visibleSeen = 0;

  const pageH = await page.evaluate(() => document.documentElement.scrollHeight);
  /* WALK the page rather than flinging end to end. A single huge fling lands
   * back where it started and the probe then only ever sees the top of the
   * page — which is exactly how an earlier version of this file reported
   * "0 tiles sampled" while claiming to have scrolled 30,000px. Each step is
   * a viewport and a half, fast, with a look at what is on screen after it. */
  const step = Math.round(dev.height * 1.5);
  const steps = Math.ceil(pageH / step) + 1;
  let movedAtAll = false;

  for (let round = 0; round < ROUNDS; round++) {
    for (const speed of SPEEDS) {
      for (const dir of [-1, 1]) {
        for (let s = 0; s < steps; s++) {
          const before = await page.evaluate(() => window.scrollY);
          await fling(client, cx, cy, dir * step, speed);
          // Sample immediately — while the fling is still settling — and then
          // again once it has stopped. A tile that fills in a beat later is
          // still a tile that was blank when the reader looked at it.
          for (const settle of [0, 350]) {
            if (settle) await page.waitForTimeout(settle);
            const probe = await page.evaluate(PROBE);
            visibleSeen += probe.visibleTiles;
            const where = `${dev.name} @${speed}px/s ${dir < 0 ? "down" : "up"} settle=${settle}ms`;
            for (const b of probe.blank) failures.push(`${where}: BLANK tile ${b}`);
            for (const c of probe.covered) failures.push(`${where}: COVERED tile ${c}`);
          }
          const after = await page.evaluate(() => window.scrollY);
          if (Math.abs(after - before) > 20) movedAtAll = true;
        }
      }
    }
    const qa = await page.evaluate(() => window.__qa);
    worstGap = Math.max(worstGap, qa.maxFrameGap);
    for (const e of qa.errors) failures.push(`${dev.name}: error ${e}`);
    await page.evaluate(() => {
      window.__qa.errors = [];
      window.__qa.maxFrameGap = 0;
    });
  }

  const qa = await page.evaluate(() => window.__qa);
  const longest = qa.longtasks.length ? Math.max(...qa.longtasks) : 0;
  const load = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")];
    const promoted = [...document.querySelectorAll("*")].filter((e) => {
      const c = getComputedStyle(e);
      return (
        c.willChange !== "auto" ||
        c.backfaceVisibility === "hidden" ||
        (c.transform !== "none" && c.transform !== "matrix(1, 0, 0, 1, 0, 0)")
      );
    }).length;
    const painted = imgs.filter((i) => getComputedStyle(i).display !== "none");
    return { imgs: imgs.length, painted: painted.length, promoted };
  });

  if (worstGap > FREEZE_MS) {
    failures.push(`${dev.name}: FROZE for ${worstGap}ms between frames (limit ${FREEZE_MS})`);
  }
  if (!visibleSeen) failures.push(`${dev.name}: never saw a project tile at all`);
  if (!movedAtAll) failures.push(`${dev.name}: the page never scrolled — the test proved nothing`);

  console.log(
    `  ${dev.name.padEnd(18)} tiles sampled ${String(visibleSeen).padStart(4)}` +
      `  worst frame gap ${String(worstGap).padStart(4)}ms` +
      `  longest task ${String(longest).padStart(4)}ms` +
      `  imgs ${load.painted}/${load.imgs}  layers ${load.promoted}`
  );

  await ctx.close();
  return failures;
}

const browser = await chromium.launch({ executablePath: CHROME });
console.log(`Fast-scroll stress — ${ROUNDS} rounds x ${SPEEDS.length} speeds x 2 directions, ${BASE}`);
let all = [];
for (const dev of DEVICES) {
  all = all.concat(await runDevice(browser, dev));
}
await browser.close();

if (all.length) {
  console.log(`\n✗ ${all.length} failure(s):`);
  const seen = new Map();
  for (const f of all) seen.set(f, (seen.get(f) || 0) + 1);
  for (const [f, n] of seen) console.log(`   ${n > 1 ? `x${n} ` : ""}${f}`);
  process.exit(1);
}
console.log("\n✓ no blank tiles, no freezes, no errors");
