"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MickeyWatch from "./MickeyWatch";
import { ArcText, BottomArcText } from "./ArcText";

/*
 * AWAY SCREEN — full-viewport ink panel carrying the clock lockup and
 * Noah's contact details.
 *
 * THEME (2026-08-21, per Noah: "please make sure the clock screen also fully
 * changes the colors. The background is now white, which is good, but please
 * make the text and the circle black."). The panel is --color-ink and every
 * mark on it is --color-paper, so the whole lockup inverts as one: ink panel
 * with white type and a white clock disc in light mode, white panel with
 * black type and a black disc in dark. Previously the panel already followed
 * the token while the type, the rules under the links and the clock's disc
 * were hardcoded #fff, so in dark mode they turned invisible against their
 * own background. The watch artwork inside the disc is photographic and is
 * deliberately left alone, the same as the two heads.
 *
 * IT APPEARS ON TWO TRIGGERS:
 *
 * 1. IDLE (2026-08-20, per Noah: "Let's have this page appear after the
 *    user is inactive on the site for 25 seconds." Raised to 30s on
 *    2026-08-23 — see IDLE_MS.) Tracked with a single
 *    one-second poll against a last-activity timestamp rather than a timer
 *    that gets torn down and rebuilt on every mousemove — pointer moves
 *    arrive dozens of times a second and only need to stamp a number.
 *
 * 2. LEAVING — `visibilitychange` covers hiding the tab (switching tabs,
 *    minimizing, another space) and `blur`/`focus` covers focus moving to
 *    another application while this tab stays visible. Neither signal
 *    catches the other's case, so both are needed.
 *
 * Any activity dismisses it and restarts the clock.
 *
 * MEDIA GUARD (per Noah: "I tried playing the reel that is on the Sprouts
 * page and the clock screen immediately came up, stopping me from watching
 * the video.") Watching a video legitimately blurs the window in several
 * ordinary ways — fullscreen hands focus to the fullscreen surface,
 * picture-in-picture moves it to a separate window, clicking native
 * controls can shift focus off the document — and, worse for the idle
 * trigger, watching a video IS being inactive. So playback is a hard veto
 * on both triggers: while any video is rolling, or anything is fullscreen
 * or in PiP, the panel stays down, and it retreats if playback starts while
 * it is already up.
 *
 * Media detection listens in the CAPTURE phase on the document: media
 * events do not bubble, and these videos mount and unmount as the reader
 * scrolls a project page, so there is no stable set of elements to bind to.
 *
 * Deliberately NOT a route: Noah described "a new page", but the behavior —
 * appears when you leave or go idle, gone the moment you come back — can't
 * be a navigation, since navigating away is precisely what hasn't happened.
 */

/** Inactivity before the panel appears. */
/* 25s -> 30s, 2026-08-23: "I feel like the clock screen comes up too
 * frequently. Let's have it so it only comes up 30 seconds after the user is
 * actively not using or hovering over the site." The hovering half of that
 * was already handled — `mousemove` is in ACTIVITY below, so a cursor moving
 * anywhere over the page keeps stamping the clock; only a genuinely still
 * pointer counts as idle. */
const IDLE_MS = 30_000;
/** How often the idle poll checks the activity stamp. */
const IDLE_POLL_MS = 1000;
/** Debounce on the leave triggers, so an alt-tab bounce or focus brushing
 * browser chrome doesn't flash a full-screen black panel. */
const LEAVE_DELAY_MS = 400;

const CONTACT_LEFT = [
  { label: "noah@noahcousineau.com", href: "mailto:noah@noahcousineau.com" },
  { label: "(862) 520-8040", href: "tel:+18625208040" },
];
const CONTACT_RIGHT = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/noah-cousineau/" },
  { label: "Instagram", href: "https://www.instagram.com/noahcousineau/" },
];

/* ARC GEOMETRY.
 *
 * The arcs are drawn in a 100x100 viewBox laid over a box sized 140% of the
 * white circle and offset -20%, so within that viewBox the circle is
 * centred at (50, 50) with radius 100/140 * 50 = 35.71. Text follows the
 * circle's curve only if its path is drawn on a CONCENTRIC circle.
 *
 * THE TWO ARCS NEED DIFFERENT RADII, which is what the previous version got
 * wrong (Noah: "'contact noah' appears to have the right curve, but it's
 * overlapping the circle"). SVG glyphs sit with their baseline ON the path
 * and their bodies extending toward the path's left-hand side:
 *
 *   - Top arc, travelling left-to-right over the top, puts that side
 *     OUTWARD, so the letters grow away from the circle. A baseline at
 *     circle + gap is already clear.
 *   - Bottom arc, travelling left-to-right under the bottom, puts that side
 *     INWARD, so the letters grow back toward the circle. A baseline at
 *     circle + gap therefore drops the letter TOPS inside the circle — the
 *     overlap. Its baseline has to sit a cap-height further out.
 *
 * Expressing both from one TEXT_INNER_R means the two labels occupy the
 * same band (inner edge at circle + gap, outer edge a cap-height beyond),
 * so the gap reads identically top and bottom, and both stay concentric
 * with the circle. This is how a real seal is set.
 */
const CIRCLE_CENTRE = 50;
const CIRCLE_R = 35.71;
/** Clear space between the circle's edge and the nearest ink. */
const ARC_GAP = 3;
const ARC_FONT = 8.4;
/** Cap height as a share of font size, for Akzidenz. */
const CAP_RATIO = 0.75;
/** Inner edge of the text band — the same for both labels. */
const TEXT_INNER_R = CIRCLE_R + ARC_GAP;
/** Top label: baseline is the inner edge; letters grow outward from it. */
const TOP_ARC_R = TEXT_INNER_R;
/** Bottom label: letters grow inward, so the baseline sits a cap-height
 * beyond the inner edge to leave the same clear space. */
const BOTTOM_ARC_R = TEXT_INNER_R + ARC_FONT * CAP_RATIO;

/** Fired on `window` each time the away screen appears. */
export const AWAY_SCREEN_SHOWN = "nc:away-screen-shown";

export default function AwayOverlay() {
  // Always starts hidden, including in server-rendered HTML, so a page
  // opened in a background tab hydrates clean.
  const [away, setAway] = useState(false);

  /* Announce the away screen so the rest of the site can stand itself back up
   * behind it (2026-08-22, per Noah: "It would also be good if the animations
   * reset when the clock screen comes on."). An event rather than shared state
   * because the listeners are incidental — the project-grid objects care, and
   * nothing renders differently here — and because it fires exactly on the
   * transition rather than making every listener diff a boolean. Dispatched in
   * an effect keyed on `away` so it follows the state whichever of the several
   * triggers raised the screen. */
  useEffect(() => {
    if (away) window.dispatchEvent(new CustomEvent(AWAY_SCREEN_SHOWN));
  }, [away]);
  // Mirrors `away` so the long-lived listeners below can read the current
  // value without being torn down and re-subscribed on every toggle.
  // Synced in an effect rather than assigned during render, which is not a
  // safe place to touch a ref.
  const awayRef = useRef(false);
  useEffect(() => {
    awayRef.current = away;
  }, [away]);
  const leaveTimerRef = useRef<number | null>(null);

  const isMediaBusy = useCallback(() => {
    if (document.fullscreenElement) return true;
    if (document.pictureInPictureElement) return true;
    return Array.from(document.querySelectorAll("video")).some(
      (v) => !v.paused && !v.ended && v.readyState > 2
    );
  }, []);

  useEffect(() => {
    let lastActivity = Date.now();

    const clearLeaveTimer = () => {
      if (leaveTimerRef.current != null) {
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
    };

    const dismiss = () => {
      clearLeaveTimer();
      // Functional update so a mousemove while already dismissed returns
      // the identical value and React skips the re-render entirely.
      setAway((prev) => (prev ? false : prev));
    };

    const onActivity = () => {
      lastActivity = Date.now();
      if (awayRef.current) dismiss();
    };

    // --- Idle ------------------------------------------------------------
    const idlePoll = window.setInterval(() => {
      if (awayRef.current) return;
      if (document.hidden) return; // the leave triggers own that case
      if (Date.now() - lastActivity < IDLE_MS) return;
      if (isMediaBusy()) {
        // Watching counts as being present: hold the clock off and treat it
        // as activity so the countdown restarts when playback ends.
        lastActivity = Date.now();
        return;
      }
      setAway(true);
    }, IDLE_POLL_MS);

    // --- Leaving ---------------------------------------------------------
    const leave = () => {
      clearLeaveTimer();
      if (isMediaBusy()) return;
      leaveTimerRef.current = window.setTimeout(() => {
        if (isMediaBusy()) return;
        setAway(true);
      }, LEAVE_DELAY_MS);
    };
    const arrive = () => {
      lastActivity = Date.now();
      dismiss();
    };
    const onVisibility = () => (document.hidden ? leave() : arrive());

    const onMediaChange = () => {
      if (isMediaBusy()) {
        lastActivity = Date.now();
        dismiss();
      }
    };

    const ACTIVITY = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"] as const;
    ACTIVITY.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true })
    );

    const MEDIA_EVENTS = ["play", "playing", "pause", "ended", "emptied"] as const;
    MEDIA_EVENTS.forEach((e) => document.addEventListener(e, onMediaChange, true));
    document.addEventListener("fullscreenchange", onMediaChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", arrive);

    return () => {
      window.clearInterval(idlePoll);
      clearLeaveTimer();
      ACTIVITY.forEach((e) => window.removeEventListener(e, onActivity));
      MEDIA_EVENTS.forEach((e) => document.removeEventListener(e, onMediaChange, true));
      document.removeEventListener("fullscreenchange", onMediaChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", arrive);
    };
  }, [isMediaBusy]);

  const linkStyle: React.CSSProperties = {
    color: "var(--color-paper)",
    textDecoration: "none",
    display: "block",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-sans)",
    fontSize: "clamp(0.62rem, calc(var(--u) * 21), 1.1rem)",
    letterSpacing: "0.02em",
    borderBottom: "2px solid var(--color-paper)",
    paddingBottom: "0.32em",
    // The panel is inert so it can never trap a click; the links opt back
    // in, so a click made on the way back to the window still lands.
    pointerEvents: "auto",
  };

  return (
    <div
      aria-hidden={!away}
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{
        zIndex: 9999,
        background: "var(--color-ink)",
        opacity: away ? 1 : 0,
        visibility: away ? "visible" : "hidden",
        // Asymmetric: unhurried in, "quickly fade away" out. The visibility
        // flip waits for the fade-out so it can't vanish mid-dissolve.
        transitionProperty: "opacity, visibility",
        transitionTimingFunction: "ease",
        transitionDuration: away ? "520ms, 0ms" : "180ms, 0ms",
        transitionDelay: away ? "0ms, 0ms" : "0ms, 180ms",
        containerType: "inline-size",
        ["--u" as string]: "calc(100cqw / 1920)",
      }}
    >
      {/* `1fr auto 1fr` puts the CLOCK dead centre on the page regardless of
          how wide either contact group is (2026-08-20, per Noah: "please
          also center the clock in the center of the page"). A flex row with
          justify-center would instead centre the row as a whole, letting the
          wider left group push the clock off-centre. */}
      <div
        className="grid items-center w-full"
        style={{
          gridTemplateColumns: "1fr auto 1fr",
          gap: "clamp(1.25rem, calc(var(--u) * 132), 8rem)",
        }}
      >
        {/* Email and phone side by side, per Noah, and pushed toward the
            clock so both groups read as flanking it. */}
        <div
          className="flex flex-wrap items-center justify-end"
          style={{ gap: "clamp(1rem, calc(var(--u) * 76), 4.25rem)" }}
        >
          {CONTACT_LEFT.map((c) => (
            <a key={c.href} href={c.href} style={linkStyle}>
              {c.label}
            </a>
          ))}
        </div>

        <div
          className="relative flex items-center justify-center shrink-0"
          style={{ width: "min(calc(var(--u) * 520), 52vh)", aspectRatio: "1/1" }}
        >
          {/* White circle backdrop, clipping the oversized watch to a clean edge */}
          <div className="absolute inset-0 rounded-full bg-[color:var(--color-paper)] overflow-hidden">
            <div
              className="absolute"
              style={{ width: "153%", height: "153%", left: "-26.5%", top: "-26.5%" }}
            >
              <MickeyWatch />
            </div>
          </div>
          {/* Top arc: "IT'S TIME TO" — letters grow outward from the baseline. */}
          <div className="absolute" style={{ width: "140%", height: "140%", left: "-20%", top: "-20%" }}>
            <ArcText
              id="away-clock-arc-top"
              text="It's Time To"
              width={100}
              height={100}
              radius={TOP_ARC_R}
              centerY={CIRCLE_CENTRE}
              spanDeg={180}
              fontSize={ARC_FONT}
              flip={true}
              color="var(--color-paper)"
            />
          </div>
          {/* Bottom arc: "CONTACT NOAH" — letters grow inward, so this
              baseline sits a cap-height further out to keep the same clear
              space off the circle. */}
          <div className="absolute" style={{ width: "140%", height: "140%", left: "-20%", top: "-20%" }}>
            <BottomArcText
              id="away-clock-arc-bottom"
              text="Contact Noah"
              width={100}
              height={100}
              radius={BOTTOM_ARC_R}
              centerY={CIRCLE_CENTRE}
              spanDeg={180}
              fontSize={ARC_FONT}
              color="var(--color-paper)"
            />
          </div>
        </div>

        <div
          className="flex flex-wrap items-center justify-start"
          style={{ gap: "clamp(1rem, calc(var(--u) * 76), 4.25rem)" }}
        >
          {CONTACT_RIGHT.map((c) => (
            <a key={c.href} href={c.href} target="_blank" rel="noreferrer" style={linkStyle}>
              {c.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
