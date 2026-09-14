/**
 * APPLE'S MOTION SHEET, AT THE FIRST TOUCH (2026-09-13).
 *
 * Noah asked for the motion request "first thing on mobile, even before the
 * homepage loads". A "tap to enter" screen did that, and he turned it down:
 * "Let's just have the motion control request from apple show up first when
 * the site loads... Remove the tap to enter screen."
 *
 * Apple's sheet cannot appear with no touch at all. WebKit answers at once
 * when this site already has an answer, but to PROMPT it needs a user gesture
 * and rejects any ask made without one — on every website. So with nothing on
 * screen to invite it, the earliest the sheet can appear is the reader's first
 * touch. This makes that touch count from the moment the page starts loading,
 * loading screen included, before any of the site's own JavaScript arrives.
 *
 * This inline <head> script:
 *   - asks once straight away, silently. A phone that answered before gets its
 *     answer here and tilt is on from load; one never asked is left alone.
 *   - listens for touches on the whole page and asks inside the first one that
 *     can carry the gesture, until the phone answers.
 *   - marks <html data-tilt>: checking, then prompt, granted or denied.
 *   - owns every requestPermission call through window.__ncTilt, which
 *     lib/deviceTilt listens to, so there is only ever one open sheet.
 */

export type TiltAnswer = "granted" | "denied";

export type NcTilt = {
  state: "open" | "unknown" | "prompt" | TiltAnswer;
  ask: (() => Promise<TiltAnswer>) | null;
  on: (f: (r: TiltAnswer) => void) => void;
};

declare global {
  interface Window {
    __ncTilt?: NcTilt;
  }
}

/** Plain ES5, and no template literals inside: it is inlined verbatim. */
export const TILT_INIT_SCRIPT = `
(function () {
  var root = document.documentElement;
  var D = window.DeviceOrientationEvent;
  var nc = { state: "open", ask: null, on: null };
  var waiters = [];
  window.__ncTilt = nc;
  var GESTURES = ["touchstart", "touchend", "pointerdown", "pointerup", "click"];
  function answered() { return nc.state === "granted" || nc.state === "denied"; }
  function mark(v) { root.setAttribute("data-tilt", v); }
  function unlisten() {
    for (var i = 0; i < GESTURES.length; i++) window.removeEventListener(GESTURES[i], onGesture, true);
  }
  nc.on = function (f) { if (answered()) f(nc.state); else waiters.push(f); };
  function settle(r) {
    if (answered() || (r !== "granted" && r !== "denied")) return;
    nc.state = r;
    mark(r);
    unlisten();
    var w = waiters.splice(0, waiters.length);
    for (var i = 0; i < w.length; i++) { try { w[i](r); } catch (e) {} }
  }
  if (!D || typeof D.requestPermission !== "function") return;

  nc.state = "unknown";
  mark("checking");

  var pending = null;
  nc.ask = function () {
    if (answered()) return Promise.resolve(nc.state);
    if (pending) return pending;
    var p;
    try { p = D.requestPermission(); } catch (e) { return Promise.reject(e); }
    if (!p || typeof p.then !== "function") return Promise.reject(new Error("no answer"));
    pending = p.then(
      function (r) { pending = null; settle(r); return r; },
      function (e) { pending = null; throw e; }
    );
    return pending;
  };

  function undecided() {
    if (answered() || nc.state !== "unknown") return;
    nc.state = "prompt";
    mark("prompt");
  }
  /* A rejection here means "never asked" and changes nothing on the phone. */
  try {
    var probe = D.requestPermission();
    if (probe && typeof probe.then === "function") probe.then(settle, undecided);
    else undecided();
  } catch (e) { undecided(); }
  setTimeout(undecided, 1500);

  /* A tap is several events, and the first two (pointerdown, touchstart) carry
     no user activation, so an ask made in them is rejected. A rejection hands
     the next event its turn; only an ask still open, which IS the sheet,
     blocks the ones behind it. A browser that can never raise the sheet stops
     being asked after ten taps, counting a tap's events as one. */
  var failedTaps = 0;
  var lastFail = -1e9;
  function onGesture() {
    if (answered() || pending) return;
    nc.ask().then(null, function () {
      var now = Date.now();
      if (now - lastFail > 700) failedTaps++;
      lastFail = now;
      if (failedTaps >= 10) unlisten();
    });
  }
  for (var i = 0; i < GESTURES.length; i++) window.addEventListener(GESTURES[i], onGesture, true);
})();
`;
