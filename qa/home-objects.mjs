/*
 * THE HOME GRID'S OBJECTS PLAY BY THEMSELVES, AND NEVER IN STEP (2026-11-01)
 *
 * Noah: "I would like for these animations to start playing automatically.
 * They should all move a bit slower between frames and have more charming and
 * dynamic animations between frames... Have the animation frames between
 * each animation staggered. For example, the Sprouts apple and the Corita Art
 * Center heart shouldn't change frames at the exact same time... I still want
 * the icons themselves to be able to be thrown on desktop or able to move
 * with the phone on mobile."
 *
 * Then, of the first pass: "a bit too much wiggle... I don't want any
 * shearing or stretching of the items... I still want a bit of a stop motion
 * feel. For the valley strong animation and the ampersand in more work...
 * have these feel like they're being drawn out more instead of appearing in
 * stages."
 *
 * Measured from the DOM, not from the code's intentions: which frame each
 * object is showing is read off the frame images' own opacity every 25ms,
 * and every change is logged with its time. From that log:
 *
 *   PLAYS     every object on screen cuts on its own, and rewinds to frame 1
 *             again — a loop, not a one-shot
 *   STAGGER   no two objects cut within GAP_FLOOR_MS of each other. A
 *             drawing's later strokes are left out: they are one gesture
 *             with its first, and each starts as a point
 *   PACE      each object at the speed Noah set for it: the apple eaten in
 *             about two seconds, the flame caught in under two, the
 *             ampersand "almost instantaneously", the heart and sun a little
 *             over a second a frame, and the house stroke after stroke with
 *             no hold between
 *   STILL     nobody touched them, so nothing has moved from where it was
 *             placed — "let's not have the icons drop unless they are
 *             touched or moved"
 *   RIGID     every nudge is a rotation and a shift only — no scale, no
 *             skew — advancing in steps at about 18 a second, not a tween
 *   FINALE    the sun, and only the sun, holds a last turn; the finished
 *             flame keeps burning, boil and flares, at the same stepped rate
 *   SHEET     on a tilting phone, once the house has settled, changing its
 *             frames does not move it — "make sure the Valley strong credit
 *             union icon doesn't drop either"
 *   DRAWN     every stroke of the house is uncovered through an animated clip
 *   PAUSES    nothing cuts while the grid is scrolled out of view, and it is
 *             found back at frame 1
 *   PRESS     a click (desktop) or tap (phone) plays the next frame now and
 *             does not follow the tile's link
 *   THROW     a drag still moves the object on desktop; a phone still lets
 *             the page scroll over it
 *   REDUCED   with reduced motion asked for, nothing plays by itself
 */
import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const CHROME =
  process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OBJ = '[aria-label="Play the next frame"]';
/* The component books cuts BEAT_GAP_MS (250) apart. This allows for the
   recorder's 25ms sampling and a late timer, not for a real overlap. */
const GAP_FLOOR_MS = 200;
/* Long enough for the slowest object (the seven-frame ampersand) to reach
   its last frame, rest, and go round — with all six in view at once, where
   they share the page's cut slots and each one runs slower than alone. */
const WATCH_MS = Number(process.env.WATCH_MS || 42000);

{
  let res;
  try {
    res = await fetch(BASE + "/");
  } catch (e) {
    console.error(`\nNothing answering at ${BASE}/ — ${e.message}\n`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(`\n${BASE}/ returned ${res.status}. Is QA_BASE right?\n`);
    process.exit(2);
  }
}

/** Installed before the page's own scripts. */
const RECORDER = () => {
  window.__cuts = [];
  window.__anims = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    const host = this.closest && this.closest('[aria-label="Play the next frame"]');
    if (host) {
      const src = decodeURIComponent(host.querySelector("img").currentSrc || host.querySelector("img").src);
      window.__anims.push({
        obj: src.match(/project-animations\/([^/]+)\//)?.[1] ?? "?",
        img: this.tagName === "IMG",
        easing: (options && options.easing) || "",
        ms: (options && options.duration) || 0,
        fill: (options && options.fill) || "none",
        forever: !!options && options.iterations === Infinity,
        kf: JSON.stringify(keyframes),
      });
    }
    return animate.call(this, keyframes, options);
  };
  const last = new Map();
  window.__frames = () =>
    [...document.querySelectorAll('[aria-label="Play the next frame"]')].map((h) => {
      let cur = -1;
      h.querySelectorAll("img").forEach((im, j) => {
        if (im.style.opacity === "1") cur = j;
      });
      return cur;
    });
  window.__maxDrift = 0;
  setInterval(() => {
    for (const h of document.querySelectorAll('[aria-label="Play the next frame"]')) {
      const m = h.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*rotate\(([-\d.e]+)deg\)/);
      if (m) window.__maxDrift = Math.max(window.__maxDrift, Math.hypot(+m[1], +m[2]), Math.abs(+m[3]) * 10);
    }
    window.__frames().forEach((cur, i) => {
      if (last.has(i) && last.get(i) !== cur)
        window.__cuts.push({ obj: i, from: last.get(i), to: cur, t: performance.now() });
      last.set(i, cur);
    });
  }, 25);
};

let fails = 0;
const report = (ok, label, detail = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(46)} ${detail}`);
};

async function open(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(RECORDER);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE + "/", { waitUntil: "load" });
  // The loading sheet: fixed, on top of everything, still visible.
  await page
    .waitForFunction(
      () =>
        ![...document.querySelectorAll("body *")].some((el) => {
          const c = getComputedStyle(el);
          return c.position === "fixed" && +c.zIndex >= 9999 && +c.opacity > 0.01;
        }),
      null,
      { timeout: 20000 }
    )
    .catch(() => {});
  await page.waitForSelector(OBJ);
  return { ctx, page, errors };
}

/** Scroll so the whole grid (or as much as fits) is on screen. */
async function showGrid(page) {
  await page.evaluate((sel) => {
    const first = document.querySelector(sel).closest("a");
    const top = first.getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo({ top, behavior: "instant" });
  }, OBJ);
}

/** Which artwork each object is, by its frames' folder. */
async function objectNames(page) {
  return page.evaluate((sel) =>
    [...document.querySelectorAll(sel)].map(
      (h) => decodeURIComponent(h.querySelector("img").currentSrc || h.querySelector("img").src).match(/project-animations\/([^/]+)\//)?.[1] ?? "?"
    ), OBJ);
}
const DRAWN = new Set(["valley-strong"]);
/** Frame-to-frame pace each object should play at, in ms (from frameMs). */
const STEADY = new Set(["cac", "socal-earth"]);

/** Every object still exactly where it was placed: the physics' own
 *  translate and rotate on each, read straight off the element. Sampled
 *  repeatedly by the recorder below, so a drop that bounced back still
 *  counts. */
async function untouched(page) {
  return page.evaluate(() => window.__maxDrift <= 0.5);
}

async function visibleObjects(page) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((h) => {
      const r = h.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    });
  }, OBJ);
}

function analyse(cuts, visible, names, label) {
  const shown = visible.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const by = (i) => cuts.filter((c) => c.obj === i);
  const drawn = (i) => DRAWN.has(names[i]);
  const quiet = shown.filter((i) => by(i).length < 2);
  report(quiet.length === 0, `${label}: every visible object plays`, quiet.length ? `idle: ${quiet.join(", ")}` : `${shown.length} objects, ${cuts.length} cuts`);
  // A loop ends on a rewind: frame 2 straight back to frame 1.
  const looped = shown.filter((i) => by(i).some((c) => c.to === 0 && c.from === 1));
  report(looped.length === shown.length, `${label}: each one rewinds to frame 1`, `${looped.length}/${shown.length}`);
  const midStroke = (c) => drawn(c.obj) && c.from >= 1 && c.to === c.from + 1;
  const sorted = cuts.filter((c) => !midStroke(c)).sort((a, b) => a.t - b.t);
  let minGap = Infinity;
  let pair = "";
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k].obj === sorted[k - 1].obj) continue;
    const g = sorted[k].t - sorted[k - 1].t;
    if (g < minGap) {
      minGap = g;
      pair = `${names[sorted[k - 1].obj]}&${names[sorted[k].obj]}`;
    }
  }
  report(minGap >= GAP_FLOOR_MS, `${label}: no two objects cut together`, `closest ${Math.round(minGap)}ms (${pair})`);
  // PACE, object by object. A "run" is first frame to last, without a rewind.
  const runs = (i) => {
    const out = [];
    let begin = null;
    for (const c of by(i)) {
      if (c.from === 0 && c.to === 1) begin = c.t;
      if (begin !== null && c.to === c.from + 1 && c.to === Math.max(...by(i).map((x) => x.to))) {
        out.push(c.t - begin);
        begin = null;
      }
    }
    return out;
  };
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const stepGaps = (i) => {
    const fwd = by(i).filter((c) => c.to === c.from + 1);
    const out = [];
    for (let k = 1; k < fwd.length; k++) if (fwd[k].from === fwd[k - 1].to) out.push(fwd[k].t - fwd[k - 1].t);
    return out;
  };
  for (const i of shown) {
    const n = names[i];
    if (n === "sprouts") {
      const r = runs(i);
      report(r.length > 0 && r.every((d) => d > 1400 && d < 2600), `${label}: the apple is eaten in about 2s`, r.map((d) => `${(d / 1000).toFixed(2)}s`).join(", ") || "no full run seen");
    } else if (n === "olympics") {
      const r = runs(i);
      report(r.length > 0 && r.every((d) => d > 1200 && d < 2200), `${label}: the flame catches in under 2s`, r.map((d) => `${(d / 1000).toFixed(2)}s`).join(", ") || "no full run seen");
    } else if (n === "ampersand") {
      const r = runs(i);
      report(r.length > 0 && r.every((d) => d < 700), `${label}: the & comes almost at once`, r.map((d) => `${Math.round(d)}ms`).join(", ") || "no full run seen");
    } else if (STEADY.has(n)) {
      const g = stepGaps(i);
      report(g.length > 0 && mean(g) > 1000 && mean(g) < 2600, `${label}: ${n} grows a frame every ~1.5s`, `mean ${Math.round(mean(g))}ms over ${g.length}`);
    } else if (DRAWN.has(n)) {
      const g = stepGaps(i);
      report(g.length > 0 && mean(g) < 1600, `${label}: the house is drawn stroke after stroke`, `mean ${Math.round(mean(g))}ms, longest ${Math.round(Math.max(0, ...g))}ms`);
    }
  }
}

/** The nudges are rigid and stepped; the strokes are clipped on. */
function analyseAnims(anims, cuts, names, label) {
  const moves = anims.filter((a) => !a.img);
  const loose = moves.filter((a) => !a.easing.startsWith("steps(") || /scale|skew|matrix/.test(a.kf));
  report(moves.length > 0 && loose.length === 0, `${label}: nudges are rigid and stepped`, `${moves.length} moves, ${loose.length} with scale/skew or a smooth tween`);
  const rates = anims
    .filter((a) => a.easing.startsWith("steps(") && a.ms > 0)
    .map((a) => Number(a.easing.match(/steps\((\d+)/)[1]) / (a.ms / 1000));
  const off = rates.filter((r) => r < 15 || r > 21);
  report(rates.length > 0 && off.length === 0, `${label}: everything steps at ~18fps`, `${rates.length} animations, ${Math.min(...rates).toFixed(1)}-${Math.max(...rates).toFixed(1)} steps/s`);
  const finales = [...new Set(anims.filter((a) => a.fill === "forwards").map((a) => a.obj))];
  report(finales.length === 1 && finales[0] === "socal-earth", `${label}: only the sun holds a final turn`, finales.join(", ") || "none");
  const burns = anims.filter((a) => a.forever);
  const burnObjs = [...new Set(burns.map((a) => a.obj))];
  const flame = burns.filter((a) => a.obj === "olympics");
  report(
    burnObjs.length === 1 && flame.some((a) => !a.img) && flame.some((a) => a.img && a.kf.includes("opacity")),
    `${label}: the finished flame burns`,
    `${flame.length} burn animations (${flame.filter((a) => !a.img).length} boil, ${flame.filter((a) => a.img).length} flare)${burnObjs.length > 1 ? `; also on ${burnObjs.filter((o) => o !== "olympics").join(", ")}` : ""}`
  );
  const reveals = anims.filter((a) => a.img && a.kf.includes("clipPath") && !a.kf.includes("opacity"));
  const strokeCuts = cuts.filter((c) => DRAWN.has(names[c.obj]) && c.to === c.from + 1).length;
  report(reveals.length >= strokeCuts && strokeCuts > 0, `${label}: every stroke is drawn on`, `${reveals.length} reveals for ${strokeCuts} strokes`);
}

const browser = await chromium.launch({ executablePath: CHROME });
try {
  /* ---------------- desktop ---------------- */
  console.log("\ndesktop 1440x1300");
  {
    const { ctx, page, errors } = await open(browser, { viewport: { width: 1440, height: 1300 } });
    await showGrid(page);
    const visible = await visibleObjects(page);
    const names = await objectNames(page);
    await page.evaluate(() => {
      window.__cuts = [];
      window.__anims = [];
      window.__maxDrift = 0;
    });
    await page.waitForTimeout(WATCH_MS);
    const { cuts, anims } = await page.evaluate(() => ({ cuts: window.__cuts, anims: window.__anims }));
    analyse(cuts, visible, names, "desktop");
    analyseAnims(anims, cuts, names, "desktop");
    report(await untouched(page), "desktop: untouched icons never drop");

    // PAUSES
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(400);
    await page.evaluate(() => (window.__cuts = []));
    await page.waitForTimeout(5000);
    const offCuts = await page.evaluate(() => window.__cuts.length);
    const offFrames = await page.evaluate(() => window.__frames());
    report(offCuts === 0, "desktop: nothing plays out of view", `${offCuts} cuts in 5s`);
    report(offFrames.every((f) => f === 0), "desktop: found back at frame 1", offFrames.join(","));

    // PRESS: click an object that is resting on frame 1, between cuts.
    await showGrid(page);
    await page.waitForTimeout(300);
    const target = await page.evaluate((sel) => {
      const h = document.querySelectorAll(sel)[1];
      const r = h.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, OBJ);
    const before = (await page.evaluate(() => window.__frames()))[1];
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(500);
    const after = (await page.evaluate(() => window.__frames()))[1];
    report(after !== before, "desktop: a click plays the next frame", `${before} -> ${after}`);
    report(new URL(page.url()).pathname === "/", "desktop: and does not follow the link", page.url());

    // THROW. Measured while it is held: once let go, a hard throw can hit the
    // far wall and bounce most of the way home, which says nothing about
    // whether it could be picked up.
    const grab = await page.evaluate((sel) => {
      const h = document.querySelectorAll(sel)[0];
      const r = h.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, OBJ);
    const offset = (sel) => {
      const m = document.querySelectorAll(sel)[0].style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
    };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    for (let s = 1; s <= 12; s++) {
      await page.mouse.move(grab.x - s * 15, grab.y - s * 5);
      await page.waitForTimeout(16);
    }
    const held = await page.evaluate(offset, OBJ);
    report(held.x < -120, "desktop: objects can still be picked up", `follows the pointer ${Math.round(held.x)}px, ${Math.round(held.y)}px`);
    await page.mouse.up();
    await page.waitForTimeout(2500);
    const inside = await page.evaluate((sel) => {
      const h = document.querySelectorAll(sel)[0];
      const t = h.closest("a").getBoundingClientRect();
      const r = h.getBoundingClientRect();
      return r.left >= t.left - 2 && r.right <= t.right + 2 && r.top >= t.top - 2;
    }, OBJ);
    report(inside, "desktop: and thrown, landing inside its tile");
    report(new URL(page.url()).pathname === "/", "desktop: a throw does not follow the link", page.url());
    report(errors.length === 0, "desktop: no errors", errors.slice(0, 3).join(" | "));
    await ctx.close();
  }

  /* ---------------- phone ---------------- */
  console.log("\nphone 390x844");
  {
    const { ctx, page, errors } = await open(browser, {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await showGrid(page);
    const visible = await visibleObjects(page);
    const names = await objectNames(page);
    await page.evaluate(() => {
      window.__cuts = [];
      window.__anims = [];
      window.__maxDrift = 0;
    });
    await page.waitForTimeout(WATCH_MS);
    const cuts = await page.evaluate(() => window.__cuts);
    analyse(cuts, visible, names, "phone");
    report(await untouched(page), "phone: untouched icons never drop");
    const touch = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((h) => getComputedStyle(h).touchAction));
    report(touch.every((t) => t !== "none"), "phone: the page still scrolls over objects", touch.join(","));
    const target = await page.evaluate((sel) => {
      const h = document.querySelectorAll(sel)[0];
      const r = h.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, OBJ);
    const before = (await page.evaluate(() => window.__frames()))[0];
    await page.touchscreen.tap(target.x, target.y);
    await page.waitForTimeout(500);
    const after = (await page.evaluate(() => window.__frames()))[0];
    report(after !== before, "phone: a tap plays the next frame", `${before} -> ${after}`);
    report(new URL(page.url()).pathname === "/", "phone: and does not follow the link", page.url());
    report(errors.length === 0, "phone: no errors", errors.slice(0, 3).join(" | "));
    await ctx.close();
  }

  /* ---------------- the house on a tilting phone ---------------- */
  console.log("\nphone, tilting");
  {
    const { ctx, page, errors } = await open(browser, {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const r = await page.evaluate(async (sel) => {
      const vs = [...document.querySelectorAll(sel)].find((h) =>
        decodeURIComponent(h.querySelector("img").currentSrc || h.querySelector("img").src).includes("valley-strong")
      );
      const tile = vs.closest("a").getBoundingClientRect();
      window.scrollTo({ top: tile.top + scrollY - innerHeight + tile.height + 10, behavior: "instant" });
      // An upright phone leaning a little, its readings arriving as a real
      // one sends them, so the house is awake and resting on its floor.
      const feed = setInterval(
        () => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: 70, gamma: 4 + Math.random() * 0.5 })),
        60
      );
      const frame = () => {
        let f = -1;
        vs.querySelectorAll("img").forEach((im, j) => {
          if (im.style.opacity === "1") f = j;
        });
        return f;
      };
      const y = () => +(vs.style.transform.match(/translate\([-\d.]+px,\s*([-\d.]+)px\)/)?.[1] ?? 0);
      await new Promise((res) => setTimeout(res, 3000));
      const t0 = performance.now();
      const seen = new Set();
      let lo = Infinity;
      let hi = -Infinity;
      await new Promise((res) => {
        const iv = setInterval(() => {
          seen.add(frame());
          lo = Math.min(lo, y());
          hi = Math.max(hi, y());
          if (performance.now() - t0 > 17000) {
            clearInterval(iv);
            res();
          }
        }, 30);
      });
      clearInterval(feed);
      return { frames: seen.size, range: hi - lo, settledAt: lo };
    }, OBJ);
    report(r.frames >= 5, "tilting: the house plays its frames", `${r.frames} frames seen`);
    report(r.range <= 3, "tilting: the house holds still through them", `moved ${r.range.toFixed(1)}px up and down`);
    report(errors.length === 0, "tilting: no errors", errors.slice(0, 3).join(" | "));
    await ctx.close();
  }

  /* ---------------- reduced motion ---------------- */
  console.log("\nreduced motion");
  {
    const { ctx, page } = await open(browser, { viewport: { width: 1440, height: 1300 }, reducedMotion: "reduce" });
    await showGrid(page);
    await page.waitForTimeout(800);
    await page.evaluate(() => (window.__cuts = []));
    await page.waitForTimeout(7000);
    const cuts = await page.evaluate(() => window.__cuts.length);
    report(cuts === 0, "reduced: nothing plays by itself", `${cuts} cuts in 7s`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(fails ? `\n${fails} check(s) failed\n` : "\nAll home-object checks passed\n");
process.exit(fails ? 1 : 0);
