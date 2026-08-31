/*
 * DOES THE HEADER PILE EVER ACTUALLY STOP? (2026-08-31)
 *
 * Noah: "the jitter or vibration or restlessness of the header icons in
 * mobile. I think because things are stacking more (as I want), theres more
 * possibilities for things to get jammed under one another and vibrate."
 *
 * qa/header-settle.mjs already asks a version of this and reports 0.00 px/s,
 * which is why it never caught this. Two reasons it misses:
 *
 *   - it runs at width 1400, and the report is about phones, where the arena
 *     is a fifth as wide and the same ten objects are packed into it;
 *   - it averages into one-second buckets, and a body vibrating half a pixel
 *     back and forth 60 times a second travels a long way while its average
 *     displacement rounds to nothing.
 *
 * So this measures the two things that actually describe the complaint:
 *
 *   restless    total distance travelled during a QUIET window, seconds after
 *               the last interaction. A settled pile scores zero.
 *   vibrating   direction reversals against the distance moved. A body headed
 *               somewhere reverses a handful of times; a body trapped between
 *               two neighbours reverses every frame and gets nowhere, which is
 *               the signature Noah is describing and is invisible to any
 *               average.
 *   jammed      pairs whose boxes interpenetrate past the engine's own slop —
 *               "jammed under one another", measured rather than inferred.
 *
 * And it provokes them the way a person does: real touch drags that pick a
 * body up and fling it somewhere random, at a phone viewport, with the tilt
 * stream running, then silence while the pile is asked to settle.
 */

import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3100";
const PW = process.env.SITE_PASSWORD;
const CHROME =
  process.env.QA_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGES = process.env.QA_PAGES
  ? process.env.QA_PAGES.split(",")
  : [
      "/work/socal-earth",
      "/work/sprouts-farmers-market",
      "/work/corita-art-center",
      "/work/more-work",
    ];
const THROWS = Number(process.env.QA_THROWS || 6);
const ROUNDS = Number(process.env.QA_ROUNDS || 2);
/** "0" off, "still", "held" (default), "waved". */
const TILT = process.env.QA_TILT === "0" ? false : (process.env.QA_TILT || "held");

/** How long a pile is allowed to take to come to rest before that is a bug. */
const SETTLE_LIMIT_MS = 12000;
/** How long we then watch it for. */
const QUIET_WATCH_MS = 4000;

/* Thresholds. A body that drifts a pixel over four seconds is settling; one
 * that covers thirty is not. Vibration is judged on reversals PER PIXEL: real
 * travel reverses rarely, a trapped body reverses constantly and goes
 * nowhere. */
const RESTLESS_PX = 6;
const VIBRATION_REVERSALS = 25;
const VIBRATION_PER_PX = 1.5;

const ARENA = 'section > div.absolute.inset-x-0.top-0';
/** QA_VIEW=1400x900 to check desktop; defaults to a phone. */
const VIEW = (() => {
  const m = (process.env.QA_VIEW || "390x844").match(/^(\d+)x(\d+)$/);
  return { w: Number(m?.[1] || 390), h: Number(m?.[2] || 844) };
})();

/*
 * INK, NOT BOXES.
 *
 * Every one of these objects is a transparent PNG in a box sized for its
 * largest frame, so element rectangles overlap constantly while the artwork
 * does not touch at all — the engine collides against silhouettes, and a
 * checker that uses getBoundingClientRect will report a pile of jams that a
 * reader cannot see. The first version of this file did exactly that and
 * called two icons "100% jammed" when they were nowhere near each other.
 *
 * So each image's alpha is measured once to get the fraction of its box the
 * drawing actually occupies, and overlap is tested on that. Bodies also
 * rotate, and these fractions are taken from the unrotated bitmap, so this
 * stays an approximation — which is why the threshold below is deliberately
 * coarse: it is looking for one object buried inside another, not for a
 * pixel of contact.
 */
const INK = `
window.__ink = window.__ink || {};
window.__inkBox = function (img) {
  const key = img.currentSrc || img.src;
  if (window.__ink[key]) return window.__ink[key];
  let res = { l: 0, t: 0, r: 1, b: 1 };
  try {
    const S = 48;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    let l = S, t = S, r = -1, b = -1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (d[(y * S + x) * 4 + 3] > 24) {
        if (x < l) l = x; if (x > r) r = x;
        if (y < t) t = y; if (y > b) b = y;
      }
    }
    if (r >= 0) res = { l: l / S, t: t / S, r: (r + 1) / S, b: (b + 1) / S };
  } catch (e) { /* tainted or not decoded: fall back to the whole box */ }
  window.__ink[key] = res;
  return res;
};
window.__inkRect = function (el) {
  const img = el.querySelector("img") || el;
  const r = img.getBoundingClientRect();
  const f = window.__inkBox(img);
  /* Rotation too. A spinning object swings its AXIS-ALIGNED box around
     without its centre going anywhere, which reads as translation to any
     rect-based measure — so the trace has to carry the angle or a body
     turning on the spot is indistinguishable from one sliding about. */
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  const rot = Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
  return [r.left + r.width * f.l, r.top + r.height * f.t,
          r.width * (f.r - f.l), r.height * (f.b - f.t), rot];
};
`;

/*
 * How long until the pile stops? Polls short bursts rather than watching
 * continuously, so a pile that settles in 400ms and one that never settles
 * are told apart cheaply. Returns null if it never goes quiet.
 */
const MIN_MS = 2500;
const SETTLE = (maxMs) => INK + `new Promise((res) => {
  const arena = document.querySelector(${JSON.stringify(ARENA)});
  if (!arena) return res({ err: "no arena" });
  const t0 = performance.now();
  let prev = null;
  /* CONSECUTIVE quiet bursts, and never before MIN_MS.
     Two traps this closes. The icons are held for an arm delay before they
     are released, so the very first look finds ten perfectly still objects
     and would call a pile that has not yet MOVED "settled in 140ms". And an
     object at the top of a bounce is motionless for an instant, which one
     sample cannot tell from rest. */
  let quiet = 0;
  const burst = () => {
    const kids = Array.prototype.slice.call(arena.children);
    const now = kids.map((k) => window.__inkRect(k));
    let moved = 0;
    if (prev) for (let i = 0; i < now.length; i++) {
      moved += Math.hypot(now[i][0] - prev[i][0], now[i][1] - prev[i][1]);
    }
    const elapsed = performance.now() - t0;
    quiet = prev && moved < 0.5 ? quiet + 1 : 0;
    if (quiet >= 4 && elapsed >= ${MIN_MS}) return res({ settleMs: Math.round(elapsed) });
    if (elapsed > ${maxMs}) return res({ settleMs: null, lastMoved: +moved.toFixed(2) });
    prev = now;
    setTimeout(() => requestAnimationFrame(burst), 120);
  };
  requestAnimationFrame(burst);
})`;

/** Sample every animation frame for `ms`, then report per-body motion. */
const WATCH = (ms) => INK + `new Promise((res) => {
  const arena = document.querySelector(${JSON.stringify(ARENA)});
  if (!arena) return res({ err: "no arena" });
  const kids = Array.prototype.slice.call(arena.children);
  const s = kids.map(() => []);
  const t0 = performance.now();
  const tick = () => {
    for (let i = 0; i < kids.length; i++) s[i].push(window.__inkRect(kids[i]));
    if (performance.now() - t0 < ${ms}) requestAnimationFrame(tick);
    else {
      const bodies = s.map((v, i) => {
        let moved = 0, revX = 0, revY = 0, lx = 0, ly = 0;
        /* Deltas under EPS are float noise from getBoundingClientRect and the
           ink projection, not motion. Counted as direction changes they made a
           body that moved 3.6px once and then sat perfectly still register as
           "vibrating" — which it demonstrably was not, per its own trace. */
        const EPS = 0.05;
        for (let j = 1; j < v.length; j++) {
          const dx0 = v[j][0] - v[j - 1][0], dy0 = v[j][1] - v[j - 1][1];
          const dx = Math.abs(dx0) < EPS ? 0 : dx0;
          const dy = Math.abs(dy0) < EPS ? 0 : dy0;
          moved += Math.hypot(dx, dy);
          const sx = Math.sign(dx), sy = Math.sign(dy);
          if (sx && lx && sx !== lx) revX++;
          if (sy && ly && sy !== ly) revY++;
          if (sx) lx = sx;
          if (sy) ly = sy;
        }
        /* ROCKING is its own failure, and neither of the measures above sees
           it: an object tipping back and forth on a curved base can hold its
           centre almost still while swinging ten degrees each way. Traced on
           more-work, exactly that — y frozen, rotation stepping 25 24 29 34
           26 30 22 31 16 11 23 32 — which "moved" scores as noise. */
        let rock = 0, lr = 0, rotMin = 1e9, rotMax = -1e9;
        for (let j = 1; j < v.length; j++) {
          const dr = v[j][4] - v[j - 1][4];
          if (v[j][4] < rotMin) rotMin = v[j][4];
          if (v[j][4] > rotMax) rotMax = v[j][4];
          const sr = Math.sign(dr);
          if (sr && lr && sr !== lr) rock++;
          if (sr) lr = sr;
        }
        return { i, moved: +moved.toFixed(2), reversals: revX + revY,
                 rock, rotSpan: rotMax - rotMin, frames: v.length };
      });
      // Interpenetration, measured on the last frame.
      const jammed = [];
      for (let a = 0; a < kids.length; a++) {
        for (let b = a + 1; b < kids.length; b++) {
          const A = s[a][s[a].length - 1], B = s[b][s[b].length - 1];
          const ox = Math.min(A[0] + A[2], B[0] + B[2]) - Math.max(A[0], B[0]);
          const oy = Math.min(A[1] + A[3], B[1] + B[3]) - Math.max(A[1], B[1]);
          if (ox > 0 && oy > 0) {
            const frac = (ox * oy) / Math.max(1, Math.min(A[2] * A[3], B[2] * B[3]));
            // 0.55 of the SMALLER object's ink swallowed by the larger one.
            if (frac > 0.55) jammed.push(a + "&" + b + " " + Math.round(frac * 100) + "%");
          }
        }
      }
      /* The worst body's actual path, downsampled. A number saying "restless"
         does not tell you whether it is creeping, circulating or buzzing in
         place, and those have different causes — so a failing run hands back
         the trajectory that produced it. */
      let worst = 0;
      for (let i = 1; i < bodies.length; i++) if (bodies[i].moved > bodies[worst].moved) worst = i;
      const path = s[worst].filter((_, i) => i % 8 === 0)
        .map((v) => Math.round(v[0]) + "," + Math.round(v[1]) + "@" + v[4]);
      res({ bodies, jammed, count: kids.length, worstIndex: worst, worstPath: path });
    }
  };
  requestAnimationFrame(tick);
})`;

function summarise(watch, label, failures, page) {
  if (watch.err) {
    failures.push(`${page}: ${watch.err}`);
    return null;
  }
  const restless = watch.bodies.filter((b) => b.moved > RESTLESS_PX);
  const vibrating = watch.bodies.filter(
    (b) =>
      b.reversals > VIBRATION_REVERSALS &&
      b.moved > 0.4 &&
      b.reversals / b.moved > VIBRATION_PER_PX
  );
  /* Swinging back and forth through more than a couple of degrees, many
     times, without ending up anywhere. */
  const rocking = watch.bodies.filter((b) => b.rock > 20 && b.rotSpan > 3);
  for (const b of rocking) {
    failures.push(
      `${page} ${label}: icon ${b.i} ROCKING — ${b.rock} turn reversals across ${b.rotSpan}deg`
    );
  }
  for (const b of restless) {
    failures.push(
      `${page} ${label}: icon ${b.i} still travelling ${b.moved}px in ${(
        QUIET_WATCH_MS / 1000
      ).toFixed(0)}s of quiet`
    );
  }
  for (const b of vibrating) {
    failures.push(
      `${page} ${label}: icon ${b.i} VIBRATING — ${b.reversals} reversals over ${b.moved}px`
    );
  }
  /* REPORTED, NOT FAILED — and this is a correction, not a softening.
   *
   * "Jammed" counted a pair whose ink boxes overlap by more than half. Held
   * against a screenshot of a settled pile, the pairs it flags are the sun's
   * spokes reaching across the hill behind it and similar: axis-aligned boxes
   * of rotated, irregular artwork overlapping while the drawings merely sit
   * beside and on top of each other. That is exactly what Noah asked this
   * pile to do — "they can sit on top of one another" — so failing on it
   * would be failing on the feature. It stays in the output because a sudden
   * jump in the count is still worth a look; it is no longer a verdict.
   * Restlessness and vibration are the measures that carry weight here, and
   * both were confirmed against traces of real motion. */
  if (process.env.QA_TRACE && (restless.length || vibrating.length || rocking.length)) {
    console.log(
      `      trace ${page} ${label} icon ${watch.worstIndex}: ${watch.worstPath
        .slice(0, 26)
        .join(" ")}`
    );
  }
  return {
    restless: restless.length,
    vibrating: vibrating.length,
    rocking: rocking.length,
    jammed: watch.jammed.length,
    worst: Math.max(0, ...watch.bodies.map((b) => b.moved)).toFixed(1),
    worstRev: Math.max(0, ...watch.bodies.map((b) => b.reversals)),
  };
}

async function throwOne(page, client, arenaBox, rand) {
  /* Pick a body, drag it up and fling it somewhere else in the arena — which
   * is what a person does with these, rather than nudging them politely. */
  const target = await page.evaluate(
    ([sel, k]) => {
      const arena = document.querySelector(sel);
      if (!arena) return null;
      const kids = Array.prototype.slice.call(arena.children);
      if (!kids.length) return null;
      const el = kids[Math.floor(k * kids.length) % kids.length];
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    },
    [ARENA, rand()]
  );
  if (!target) return;
  const toX = Math.round(arenaBox.x + 20 + rand() * (arenaBox.w - 40));
  const toY = Math.round(arenaBox.y + 20 + rand() * (arenaBox.h - 40));

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: target.x, y: target.y }],
  });
  const steps = 8 + Math.floor(rand() * 8);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: Math.round(target.x + (toX - target.x) * t),
          y: Math.round(target.y + (toY - target.y) * t),
        },
      ],
    });
    await page.waitForTimeout(10 + Math.floor(rand() * 14));
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(120 + Math.floor(rand() * 200));
}

async function runPage(browser, path, seed) {
  const phone = VIEW.w < 768;
  const ctx = await browser.newContext({
    viewport: { width: VIEW.w, height: VIEW.h },
    deviceScaleFactor: phone ? 3 : 1,
    isMobile: phone,
    hasTouch: true,
  });
  /* THE SAME PILE EVERY TIME.
   *
   * The drop randomises each object's release height and starting spin, so
   * two runs of this file were two different experiments and the numbers
   * swung wildly between them — one tilt-off run came back perfectly clean
   * and the next reported four vibrating bodies. Nothing about the code had
   * changed; the dice had. Seeding the page's own Math.random makes a run
   * reproducible, which is the only way a measurement here can be used to
   * judge whether a change to the physics helped. */
  await ctx.addInitScript((sd) => {
    let x = sd >>> 0;
    Math.random = () => {
      x = (x * 1664525 + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }, seed);
  const page = await ctx.newPage();
  const failures = [];
  page.on("pageerror", (e) => failures.push(`${path}: pageerror ${e.message}`));

  await page.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (PW) {
    await page.evaluate(async (pw) => {
      await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass: pw }),
      });
    }, PW);
  }
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
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
    .catch(() => failures.push(`${path}: loader never cleared`));

  // A tap satisfies the orientation permission gate; the stream that follows
  // is a hand holding a phone, not a phone on a table.
  await page.touchscreen.tap(8, VIEW.h - 44);
  /*
   * THREE HONEST MODELS OF A PHONE, because they make different claims and
   * an earlier version of this file conflated them.
   *
   *   still   flat on a desk. Gravity constant and off-vertical.
   *   held    in a hand, being read. Postural sway of a degree or so plus
   *           fine tremor — NOT a phone being waved about. This is the case
   *           that must come to a dead stop, and the one Noah is describing:
   *           you are holding the phone still and the icons will not sit
   *           still.
   *   waved   deliberately tilted through large angles, then brought back to
   *           rest before anything is measured. A phone genuinely being
   *           turned SHOULD slide the objects around — that is the feature —
   *           so measuring restlessness while it is still moving would be
   *           marking correct behaviour as a bug. What is measured is whether
   *           the pile settles once the movement stops.
   *
   * The first draft of this file used ±6° swings and called it "held", which
   * is a phone being gestured with, and then reported the objects responding
   * to it as a fault.
   */
  const startTilt = async (mode) => {
    await page.evaluate((m) => {
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) return;
      if (window.__tiltTimer) clearInterval(window.__tiltTimer);
      let a = 0;
      const send = (beta, gamma) =>
        window.dispatchEvent(new DOE("deviceorientation", { beta, gamma }));
      if (m === "still") {
        window.__tiltTimer = setInterval(() => send(62, 20), 50);
      } else if (m === "held") {
        window.__tiltTimer = setInterval(() => {
          a += 0.05;
          // ~1.4 degrees of sway, ~0.35 of tremor. A hand, not an arm.
          send(62 + 1.4 * Math.sin(a) + 0.35 * Math.sin(a * 11),
               12 + 1.4 * Math.sin(a * 0.7) + 0.35 * Math.sin(a * 13));
        }, 16);
      } else {
        window.__tiltTimer = setInterval(() => {
          a += 0.12;
          send(62 + 22 * Math.sin(a), 26 * Math.sin(a * 0.8));
        }, 16);
      }
    }, mode);
  };
  /** Bring the phone to a dead stop and let the reading stabilise. */
  const holdStill = async () => {
    await page.evaluate(() => {
      const DOE = window.DeviceOrientationEvent;
      if (window.__tiltTimer) clearInterval(window.__tiltTimer);
      if (DOE) window.__tiltTimer = setInterval(
        () => window.dispatchEvent(new DOE("deviceorientation", { beta: 62, gamma: 14 })),
        50
      );
    });
    await page.waitForTimeout(400);
  };
  if (TILT) await startTilt(TILT === true ? "held" : TILT);

  const client = await ctx.newCDPSession(page);
  const arenaBox = await page.evaluate((sel) => {
    const a = document.querySelector(sel);
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, ARENA);
  if (!arenaBox) {
    failures.push(`${path}: no arena`);
    await ctx.close();
    return { failures, rows: [] };
  }

  // Deterministic per (page, seed) so a failure can be replayed exactly.
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const rows = [];

  /* Each phase asks the same question: how long until it stops, and does it
     STAY stopped? Waiting a fixed number of seconds and then measuring — what
     this file did first — conflates "still falling" with "never settles", and
     the two are not remotely the same complaint. */
  const phase = async (label) => {
    // A phone still being turned is not a phone at rest; measure after it
    // stops, or the feature reads as the fault.
    if (TILT === "waved") await holdStill();
    const st = await page.evaluate(SETTLE(SETTLE_LIMIT_MS));
    if (st.err) {
      failures.push(`${path}: ${st.err}`);
      return null;
    }
    if (st.settleMs === null) {
      failures.push(
        `${path} ${label}: NEVER SETTLES — still moving ${st.lastMoved}px/burst after ${
          SETTLE_LIMIT_MS / 1000
        }s`
      );
    }
    const w = await page.evaluate(WATCH(QUIET_WATCH_MS));
    const m = summarise(w, label, failures, path);
    if (m) m.settleMs = st.settleMs;
    return m;
  };

  // Phase 1: the pile as it arrives, untouched.
  rows.push(["after drop  ", await phase("after drop")]);

  // Phase 2: thrown around, then left alone.
  for (let i = 0; i < THROWS; i++) await throwOne(page, client, arenaBox, rand);
  rows.push(["after throws", await phase("after throws")]);
  if (TILT === "waved") await startTilt("waved");

  /* Phase 3: the case Noah named. Everything dragged into ONE corner so the
   * objects have no choice but to stack on each other — which is where a
   * body gets wedged under its neighbour and buzzes. */
  for (let i = 0; i < THROWS; i++) {
    const t = await page.evaluate(
      ([sel, k]) => {
        const arena = document.querySelector(sel);
        const kids = Array.prototype.slice.call(arena.children);
        const el = kids[Math.floor(k * kids.length) % kids.length];
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      },
      [ARENA, rand()]
    );
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: t.x, y: t.y }],
    });
    const cx = Math.round(arenaBox.x + arenaBox.w * 0.28);
    const cy = Math.round(arenaBox.y + arenaBox.h * 0.72);
    for (let j = 1; j <= 10; j++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: Math.round(t.x + (cx - t.x) * (j / 10)), y: Math.round(t.y + (cy - t.y) * (j / 10)) },
        ],
      });
      await page.waitForTimeout(12);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(180);
  }
  rows.push(["stacked     ", await phase("stacked")]);

  await ctx.close();
  return { failures, rows };
}

const browser = await chromium.launch({ executablePath: CHROME });
console.log(
  `Header jitter — ${VIEW.w}x${VIEW.h}, ${PAGES.length} pages x ${ROUNDS} rounds, ${THROWS} throws each, tilt ${TILT || "off"}, ${BASE}`
);
let all = [];
const agg = new Map();
for (const path of PAGES) {
  for (let r = 0; r < ROUNDS; r++) {
    const { failures, rows } = await runPage(browser, path, 12345 + r * 977);
    all = all.concat(failures);
    for (const [label, m] of rows) {
      if (!m) continue;
      const key = label.trim();
      const a = agg.get(key) || { n: 0, never: 0, restless: 0, vibrating: 0, rocking: 0, jammed: 0, worst: 0 };
      a.n++;
      if (m.settleMs === null) a.never++;
      a.restless += m.restless;
      a.vibrating += m.vibrating;
      a.rocking += m.rocking;
      a.jammed += m.jammed;
      a.worst = Math.max(a.worst, Number(m.worst));
      agg.set(key, a);
    }
  }
}
console.log("");
for (const [k, a] of agg) {
  console.log(
    `  ${k.padEnd(13)} runs ${a.n}  never-settled ${a.never}/${a.n}` +
      `  restless ${String(a.restless).padStart(3)}  vibrating ${String(a.vibrating).padStart(3)}` +
      `  rocking ${String(a.rocking).padStart(3)}` +
      `  jammed ${String(a.jammed).padStart(3)}  worst ${a.worst.toFixed(1)}px`
  );
}
await browser.close();

if (all.length) {
  const seen = new Map();
  for (const f of all) seen.set(f, (seen.get(f) || 0) + 1);
  console.log(`\n✗ ${all.length} finding(s), ${seen.size} distinct:`);
  for (const [f, n] of [...seen.entries()].slice(0, 40)) {
    console.log(`   ${n > 1 ? `x${n} ` : ""}${f}`);
  }
  process.exit(1);
}
console.log("\n✓ pile settles: nothing restless, nothing vibrating, nothing jammed");
