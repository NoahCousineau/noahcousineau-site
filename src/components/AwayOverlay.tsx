"use client";

import { useEffect, useRef, useState } from "react";
import MickeyWatch from "./MickeyWatch";
import { ArcText, BottomArcText } from "./ArcText";

/*
 * AWAY SCREEN (2026-08-20, per Noah: "I want to remove the clock and the
 * 'It's Time To Contact Noah' from the about me page. Instead, I want this
 * to appear on a new page. When the user clicks off the website, I want a
 * black screen to appear and the clock and text to appear on that screen.
 * The screen will quickly fade away once the user is on the site again.")
 *
 * The clock lockup itself is moved here verbatim from the About page's old
 * CLOCK/CONTACT-PROMPT section — same 640u circle, same 153% oversized
 * watch clipped by the circle's overflow, same two upright arcs. Only its
 * trigger and backdrop are new.
 *
 * WHAT COUNTS AS "CLICKING OFF THE SITE": two different browser signals,
 * because neither alone covers it.
 *   - `visibilitychange` fires when the tab is hidden — switching tabs,
 *     minimizing, moving to another space. It does NOT fire when the user
 *     clicks a different app while this tab stays visible.
 *   - `blur`/`focus` on window covers exactly that case — focus moving to
 *     another application or a devtools pane while the page is still on
 *     screen.
 * Listening to both, and treating "away" as (hidden OR unfocused), is what
 * makes this fire in all the ordinary ways a person leaves.
 *
 * A short ENTER DELAY keeps this from being obnoxious: clicking a link,
 * an alt-tab bounce, or focus briefly landing on browser chrome would
 * otherwise flash a full-screen black panel for a few frames every time.
 * Leaving is deliberate after ~400ms; returning is instant, and the fade
 * out is quicker than the fade in, per "quickly fade away once the user is
 * on the site again."
 *
 * Deliberately NOT a route: Noah described "a new page", but the behavior
 * described — appears when you leave, gone when you come back — can't be a
 * navigation, since navigating away is precisely what hasn't happened. A
 * fixed full-viewport layer is the thing that behaves the way he asked
 * for. It renders above everything (including the fixed footer) and is
 * inert to pointer events so it can never trap a click.
 */

const ENTER_DELAY_MS = 400;

export default function AwayOverlay() {
  // Always starts hidden, including in the server-rendered HTML. A page
  // opened in a background tab therefore hydrates clean rather than with a
  // black screen baked in; the first real visibility/focus change after
  // that puts it in the right state. Deliberately not seeded from
  // `document.hidden` in a lazy initializer, which would render differently
  // on server and client and trip a hydration mismatch.
  const [away, setAway] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const leave = () => {
      clearTimer();
      timerRef.current = window.setTimeout(() => setAway(true), ENTER_DELAY_MS);
    };
    const arrive = () => {
      clearTimer();
      setAway(false);
    };

    const onVisibility = () => (document.hidden ? leave() : arrive());

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", arrive);
    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", arrive);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{
        zIndex: 9999,
        background: "var(--color-ink)",
        opacity: away ? 1 : 0,
        // Asymmetric timing: unhurried on the way in, "quickly fade away"
        // on the way back, as asked.
        transition: away ? "opacity 520ms ease" : "opacity 180ms ease",
        // Keep it out of the compositor's way (and untouchable) whenever
        // it's invisible, so it can't intercept anything at rest.
        visibility: away ? "visible" : "hidden",
        transitionProperty: "opacity, visibility",
        transitionDuration: away ? "520ms, 0ms" : "180ms, 0ms",
        transitionDelay: away ? "0ms, 0ms" : "0ms, 180ms",
        containerType: "inline-size",
        ["--u" as string]: "calc(100cqw / 1920)",
      }}
    >
      {/* Clock lockup — moved wholesale from the About page. Sizes are the
          same artboard units it used there; because this layer declares its
          own `--u` off the viewport width, it scales the same way. */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: "min(calc(var(--u) * 640), 62vh)", aspectRatio: "1/1" }}
      >
        {/* White circle backdrop, clips the oversized watch to a clean edge */}
        <div className="absolute inset-0 rounded-full bg-white overflow-hidden">
          <div
            className="absolute"
            style={{ width: "153%", height: "153%", left: "-26.5%", top: "-26.5%" }}
          >
            <MickeyWatch />
          </div>
        </div>
        {/* Top arc: "IT'S TIME TO" — dome shape, letters upright. */}
        <div className="absolute" style={{ width: "140%", height: "140%", left: "-20%", top: "-20%" }}>
          <ArcText
            id="away-clock-arc-top"
            text="It's Time To"
            width={100}
            height={100}
            radius={35.7}
            spanDeg={110}
            baselineY={10.53}
            fontSize={9.3}
            flip={true}
            color="#fff"
          />
        </div>
        {/* Bottom arc: "CONTACT NOAH" — bowl shape, letters upright. */}
        <div className="absolute" style={{ width: "140%", height: "140%", left: "-20%", top: "-20%" }}>
          <BottomArcText
            id="away-clock-arc-bottom"
            text="Contact Noah"
            width={100}
            height={100}
            radius={50}
            spanDeg={110}
            baselineY={97}
            fontSize={9.3}
            color="#fff"
          />
        </div>
      </div>
    </div>
  );
}
