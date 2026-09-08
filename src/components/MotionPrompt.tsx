"use client";

import { useEffect, useState } from "react";
import { useIsPhone } from "@/lib/useIsPhone";
import {
  lastTiltAnswer,
  watchTiltStatus,
  type TiltStatus,
} from "@/lib/deviceTilt";

/**
 * SOMETHING TO TAP, BECAUSE THE SHEET CANNOT BE SUMMONED (2026-09-04).
 *
 * Noah, four times now, most recently: "Permissions should be seen every time
 * a mobile user first opens the site."
 *
 * The honest position, which is worth writing down because it is the whole
 * reason this file exists. iOS will not let a page ask for motion access
 * outside a user gesture, and it remembers the answer per site: once granted
 * the sheet never appears again (readings simply start arriving), and once
 * refused it will not re-ask from anywhere on the page. So "the reader sees
 * the permission screen every visit" is not something a site can do — no
 * amount of asking harder reaches it.
 *
 * What a site CAN do is make sure the question is always available and always
 * findable. lib/deviceTilt handles the first half: every page load arms the
 * ask, and the reader's first touch anywhere fires it. This handles the
 * second — because a reader who lands, reads, and scrolls with one thumb may
 * never produce a gesture that carries an activation, and has no way to know
 * the feature is there at all. A visible thing to tap fixes both at once: it
 * is an unmistakable activation, and it says what tapping is for.
 *
 * WHEN IT KEEPS QUIET, which is most of the time:
 *
 *   - Not a phone. The tilt is a phone feature.
 *   - Motion already works — a reading has arrived, or the browser has no
 *     gate to pass. Nothing to offer.
 *   - This phone has answered before, either way. iOS hands back the same
 *     answer without a sheet, so a returning reader who said yes would be
 *     offered a button they already pressed, and one who said no would be
 *     offered a button that cannot work. Both are remembered — see
 *     lastTiltAnswer. The ask still runs on every load either way; this only
 *     decides what is worth putting on screen.
 *   - Already offered this visit. Once per session, per Noah's "first opens
 *     the site" — not once per page.
 *
 * And it leaves on its own after a few seconds whether or not it was used.
 * It is an offer, not a gate, and it clears out well before the scroll arrow
 * arrives at fifteen seconds so the two never share the foot of the screen.
 */

/** Long enough to be noticed, short enough not to become furniture — and
 *  comfortably clear of ScrollCue's fifteen-second arrival. */
const SHOW_MS = 9000;
/** A beat after the loading screen lifts, so it arrives on a settled page
 *  rather than sliding in under the curtain. */
const AFTER_LOADER_MS = 1200;
/**
 * And a hard deadline from mount, whatever the loading screen did.
 *
 * ScrollCue puts its arrow at the foot of the phone screen fifteen seconds
 * in, which is where this sits too — measured, they land within about twenty
 * pixels of each other. On every load speed tried the two never actually
 * overlap, because this is gone by ten or twelve seconds. That is a margin,
 * not a guarantee: a slow enough load pushes this later without moving the
 * arrow, which runs on its own timer from mount. So the deadline makes it
 * structural. If a load is so slow that there is no useful window left, the
 * offer is skipped rather than stacked under the arrow.
 */
const DEADLINE_MS = 13000;
/** Below this there is not enough time left to read it, so don't bother. */
const MIN_WINDOW_MS = 3500;

/** Marks the offer as made for this visit. */
const SESSION_KEY = "nc-motion-offered";

export default function MotionPrompt() {
  const phone = useIsPhone();
  const [mountedAt] = useState(() => Date.now());
  /* Read once, on the client, after mount — reading storage during render
     would differ between the server pass and the first client one. */
  const [answered, setAnswered] = useState(true);
  useEffect(() => setAnswered(lastTiltAnswer() !== null), []);
  const [status, setStatus] = useState<TiltStatus>("unsupported");
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => watchTiltStatus(setStatus), []);

  /* Wait for the page loader to let go of the scroll before offering
     anything. It locks `body.overflow` while it is up and restores it on the
     way out, which is the one signal it already publishes — cheaper than
     wiring an event through the layout for a poll that runs for a second or
     two and then stops. */
  useEffect(() => {
    if (!phone || status !== "gated" || answered) return;
    let cancelled = false;
    let timer = 0;
    const check = () => {
      if (cancelled) return;
      if (document.body.style.overflow === "hidden") {
        timer = window.setTimeout(check, 200);
        return;
      }
      timer = window.setTimeout(() => {
        if (cancelled) return;
        if (Date.now() - mountedAt > DEADLINE_MS - MIN_WINDOW_MS) return;
        setReady(true);
      }, AFTER_LOADER_MS);
    };
    check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phone, status, answered, mountedAt]);

  /* Once per visit. Written when it actually appears, not when it is
     considered, so a reader whose first page had motion already working is
     still offered it on a page where it does not. */
  const [firstThisVisit, setFirstThisVisit] = useState(false);
  useEffect(() => {
    if (!ready) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Private mode, or storage refused. Offering it is the better failure.
    }
    setFirstThisVisit(true);
  }, [ready]);

  const shown =
    phone && status === "gated" && !answered && ready && firstThisVisit && !dismissed;

  useEffect(() => {
    if (!shown) return;
    const left = Math.min(SHOW_MS, DEADLINE_MS - (Date.now() - mountedAt));
    const t = window.setTimeout(() => setDismissed(true), Math.max(0, left));
    return () => window.clearTimeout(t);
  }, [shown, mountedAt]);

  if (!phone || status !== "gated" || answered) return null;

  return (
    <button
      type="button"
      /* The tap is the point. lib/deviceTilt is already listening on window
         in the capture phase, so this button does not call requestPermission
         itself — it just guarantees a gesture that unambiguously carries an
         activation, and then gets out of the way. Two callers racing for the
         same sheet is exactly the bug that made one tap ask five times. */
      onClick={() => setDismissed(true)}
      data-motion-prompt
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      className="fixed left-1/2 z-[70] flex items-center gap-[0.5em]
                 rounded-full font-[family-name:var(--font-sans)]
                 uppercase leading-none"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 5vw)",
        transform: `translateX(-50%) translateY(${shown ? "0" : "1.2rem"})`,
        opacity: shown ? 1 : 0,
        visibility: shown ? "visible" : "hidden",
        pointerEvents: shown ? "auto" : "none",
        transition: "opacity 420ms ease, transform 420ms ease",
        background: "var(--color-ink)",
        color: "var(--color-paper)",
        padding: "0.85em 1.35em",
        fontSize: "3.4vw",
        fontWeight: 500,
        letterSpacing: "0.08em",
        border: "none",
      }}
    >
      <PhoneGlyph />
      Tap to tilt
    </button>
  );
}

/** A phone rocking side to side — the gesture the sentence is describing. */
function PhoneGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{ width: "1.35em", height: "1.35em", display: "block" }}
    >
      <g className="nc-motion-rock" style={{ transformOrigin: "12px 20px" }}>
        <rect
          x="7.5"
          y="3"
          width="9"
          height="18"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <line
          x1="10.5"
          y1="18.2"
          x2="13.5"
          y2="18.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
