/**
 * THE MOTION QUESTION COMES FIRST (2026-09-13).
 *
 * Noah: "Please have the motion request come up first thing on mobile, even
 * before the homepage loads."
 *
 * iOS will not show its motion sheet without a tap, so "first thing" is a
 * screen that asks for one: a phone that has never been asked is met with
 * "tap to enter" before the homepage, and that tap brings up the sheet. See
 * TiltAsk.tsx for the screen.
 *
 * It has to be decided by an inline script rather than React. The page's own
 * code can take seconds to arrive on a slow connection, and the question is
 * meant to come before the homepage, not after the JavaScript. So the script
 * below runs in <head>, asks straight away, and marks <html data-tilt>:
 *
 *   (absent)  no gate here at all — Android, desktop Chrome. Tilt just works.
 *   checking  the silent first ask is still out. Holds the loader.
 *   granted   this phone said yes before. No screen; tilt is on from load.
 *   denied    this phone said no before. No screen; iOS will not re-ask.
 *   ask       a phone never asked. The screen is up and holds the loader.
 *   prompt    never asked, but not a phone (iPad, Mac Safari). No screen.
 *   skipped   the tap could not raise a sheet. Let in rather than trapped.
 *
 * It also owns every requestPermission call on the page from then on, through
 * window.__ncTilt. lib/deviceTilt routes through it, so the screen's tap and a
 * tap anywhere else share one open sheet instead of racing to raise two.
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
  function answered() { return nc.state === "granted" || nc.state === "denied"; }
  function mark(v) { root.setAttribute("data-tilt", v); }
  nc.on = function (f) { if (answered()) f(nc.state); else waiters.push(f); };
  function settle(r) {
    if (answered() || (r !== "granted" && r !== "denied")) return;
    nc.state = r;
    mark(r);
    var w = waiters.splice(0, waiters.length);
    for (var i = 0; i < w.length; i++) { try { w[i](r); } catch (e) {} }
  }
  if (!D || typeof D.requestPermission !== "function") return;

  var phone = false;
  try { phone = window.matchMedia("(max-width: 767px)").matches; } catch (e) {}
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
    mark(phone ? "ask" : "prompt");
  }
  /* WebKit answers at once, with no gesture, when this site already has an
     answer; it only needs a gesture to PROMPT. A rejection here means "never
     asked" and changes nothing on the phone. */
  try {
    var probe = D.requestPermission();
    if (probe && typeof probe.then === "function") probe.then(settle, undecided);
    else undecided();
  } catch (e) { undecided(); }
  /* A probe that never settles must not hold the page forever. */
  setTimeout(undecided, 1500);

  /* Registered here, before any of the page's code exists, so the screen
     works however late the JavaScript arrives. A click carries the user
     activation iOS requires. */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest("[data-tilt-ask]")) return;
    nc.ask().then(null, function () {}).then(function () {
      if (root.getAttribute("data-tilt") === "ask") mark("skipped");
    });
  }, true);
})();
`;

function tiltAttr(): string | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.getAttribute("data-tilt");
}

/** True while the motion question stands between the reader and the page. */
export function tiltHoldsEntrance(): boolean {
  const v = tiltAttr();
  return v === "checking" || v === "ask";
}

/** Run `cb` once nothing is holding the entrance; returns a cancel. */
export function whenTiltAskClears(cb: () => void): () => void {
  if (!tiltHoldsEntrance()) {
    cb();
    return () => {};
  }
  const obs = new MutationObserver(() => {
    if (tiltHoldsEntrance()) return;
    obs.disconnect();
    cb();
  });
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-tilt"],
  });
  return () => obs.disconnect();
}
