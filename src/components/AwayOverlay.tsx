"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MickeyWatch from "./MickeyWatch";
import { ArcText, BottomArcText } from "./ArcText";

/*
 * AWAY SCREEN — black full-viewport panel carrying the clock lockup and
 * Noah's contact details, shown whenever the viewer leaves the site.
 *
 * WHAT COUNTS AS "CLICKING OFF THE SITE": two different browser signals,
 * because neither alone covers it.
 *   - `visibilitychange` fires when the tab is hidden — switching tabs,
 *     minimizing, moving to another space. It does NOT fire when the user
 *     clicks a different app while this tab stays visible.
 *   - `blur`/`focus` on window covers exactly that case.
 *
 * MEDIA GUARD (2026-08-20, per Noah: "I tried playing the reel that is on
 * the Sprouts page and the clock screen immediately came up, stopping me
 * from watching the video. Have the site operate where if a user is
 * actively trying to watch, listen to a video, the clock screen doesn't
 * show up.")
 *
 * Watching a video legitimately blurs the window in several ordinary ways:
 * going fullscreen hands focus to the fullscreen surface, picture-in-
 * picture moves it to a separate window, and clicking into the native
 * control bar can shift focus off the document. All of those look
 * identical to "left the site" from a bare `blur` listener, which is why
 * the panel was ambushing playback. So playback is now a hard veto: while
 * any video is actually rolling — or anything is fullscreen or in PiP —
 * the away screen stays down, and if playback STARTS while it's already
 * up, it retreats immediately.
 *
 * Detection listens in the CAPTURE phase on the document rather than
 * binding to elements: media events (`play`, `pause`, `ended`) do not
 * bubble, and the videos here mount and unmount as the reader scrolls
 * through a project page, so there is no stable set of elements to attach
 * to.
 *
 * A short ENTER DELAY keeps the panel from flashing on an alt-tab bounce
 * or focus briefly touching browser chrome. Leaving is deliberate after
 * ~400ms; returning is instant, and the fade out is quicker than the fade
 * in, per "quickly fade away once the user is on the site again."
 *
 * Deliberately NOT a route: Noah described "a new page", but the behavior
 * he described — appears when you leave, gone when you come back — can't
 * be a navigation, since navigating away is precisely what hasn't
 * happened. A fixed full-viewport layer is what behaves that way.
 */

const ENTER_DELAY_MS = 400;

const CONTACT_LEFT = [
  { label: "noah@noahcousineau.com", href: "mailto:noah@noahcousineau.com" },
  { label: "(862) 520-8040", href: "tel:+18625208040" },
];
const CONTACT_RIGHT = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/noah-cousineau/" },
  { label: "Instagram", href: "https://www.instagram.com/noahcousineau/" },
];

/* ARC GEOMETRY — the fix for "contact Noah" not following the circle.
 *
 * The arcs are drawn in a 100x100 viewBox laid over a box sized 140% of the
 * white circle and offset -20%, so within that viewBox the real circle is
 * centred at (50, 50) with radius 100/140 * 50 = 35.71. Text only follows
 * the circle's curve if its path is drawn on a CONCENTRIC circle — same
 * centre, radius offset by the gap you want.
 *
 * Previously the two arcs shared neither the circle's centre nor each
 * other's radius: the top ran r=35.7 about centre y=46.23, and the bottom
 * ran r=50 about y=47. r=50 is a much flatter curve than the circle's
 * 35.71, which is exactly why "CONTACT NOAH" read as sitting on its own
 * unrelated arc instead of hugging the circle.
 *
 * Both now share centre (50, 50) and radius CIRCLE_R + ARC_GAP, so they are
 * concentric with the circle and with each other by construction.
 *
 * `spanDeg` is the length of PATH drawn, not the size of the text: the
 * label is centred at 50% of the path with textAnchor="middle", so the
 * path only has to be longer than the text. A full 180 gives generous room
 * and lets font size alone decide how much of the circle the words wrap. */
const CIRCLE_CENTRE = 50;
const CIRCLE_R = 35.71;
const ARC_GAP = 2.6;
const ARC_R = CIRCLE_R + ARC_GAP;
const ARC_FONT = 8.4;

export default function AwayOverlay() {
  // Always starts hidden, including in the server-rendered HTML, so a page
  // opened in a background tab hydrates clean. Deliberately not seeded from
  // `document.hidden`, which would differ between server and client.
  const [away, setAway] = useState(false);
  const timerRef = useRef<number | null>(null);
  // True while a video is actually rolling, or anything is fullscreen/PiP.
  const mediaBusyRef = useRef(false);

  const isMediaBusy = useCallback(() => {
    if (document.fullscreenElement) return true;
    if (document.pictureInPictureElement) return true;
    return Array.from(document.querySelectorAll("video")).some(
      (v) => !v.paused && !v.ended && v.readyState > 2
    );
  }, []);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const arrive = () => {
      clearTimer();
      setAway(false);
    };

    const leave = () => {
      clearTimer();
      // Re-check at the moment of firing rather than trusting the cached
      // flag: playback may have started during the enter delay.
      if (isMediaBusy()) return;
      timerRef.current = window.setTimeout(() => {
        if (isMediaBusy()) return;
        setAway(true);
      }, ENTER_DELAY_MS);
    };

    const onVisibility = () => (document.hidden ? leave() : arrive());

    const onMediaChange = () => {
      const busy = isMediaBusy();
      mediaBusyRef.current = busy;
      // Playback starting while the panel is up pulls it straight back down.
      if (busy) arrive();
    };

    // Media events don't bubble, so capture-phase document listeners are
    // the only way to catch videos that mount and unmount during scroll.
    const MEDIA_EVENTS = ["play", "playing", "pause", "ended", "emptied"] as const;
    MEDIA_EVENTS.forEach((e) => document.addEventListener(e, onMediaChange, true));
    document.addEventListener("fullscreenchange", onMediaChange);
    document.addEventListener("enterpictureinpicture", onMediaChange, true);
    document.addEventListener("leavepictureinpicture", onMediaChange, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", arrive);

    return () => {
      clearTimer();
      MEDIA_EVENTS.forEach((e) => document.removeEventListener(e, onMediaChange, true));
      document.removeEventListener("fullscreenchange", onMediaChange);
      document.removeEventListener("enterpictureinpicture", onMediaChange, true);
      document.removeEventListener("leavepictureinpicture", onMediaChange, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", arrive);
    };
  }, [isMediaBusy]);

  const linkStyle: React.CSSProperties = {
    color: "#fff",
    textDecoration: "none",
    display: "block",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-sans)",
    fontSize: "clamp(0.68rem, calc(var(--u) * 24), 1.25rem)",
    letterSpacing: "0.02em",
    borderBottom: "2px solid #fff",
    paddingBottom: "0.32em",
    // The panel itself is inert so it can never trap a click; the links opt
    // back in. Clicking as you return to the window does reach them.
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
        // Asymmetric timing: unhurried in, "quickly fade away" out. The
        // visibility flip is delayed until the fade-out finishes so the
        // panel doesn't vanish mid-dissolve.
        transitionProperty: "opacity, visibility",
        transitionTimingFunction: "ease",
        transitionDuration: away ? "520ms, 0ms" : "180ms, 0ms",
        transitionDelay: away ? "0ms, 0ms" : "0ms, 180ms",
        containerType: "inline-size",
        ["--u" as string]: "calc(100cqw / 1920)",
      }}
    >
      {/* Contact columns flank the clock and share its centre line, per
          Noah: "I want the text aligned horizontally with the middle of the
          clock... email and phone on the left and then the LinkedIn and
          Instagram on the right." */}
      <div
        className="flex items-center justify-center w-full"
        style={{ gap: "clamp(1rem, calc(var(--u) * 70), 4.5rem)" }}
      >
        <div
          className="flex flex-col items-end text-right"
          style={{ gap: "clamp(0.9rem, calc(var(--u) * 34), 2rem)" }}
        >
          {CONTACT_LEFT.map((c) => (
            <a key={c.href} href={c.href} style={linkStyle}>
              {c.label}
            </a>
          ))}
        </div>

        <div
          className="relative flex items-center justify-center shrink-0"
          style={{ width: "min(calc(var(--u) * 560), 54vh)", aspectRatio: "1/1" }}
        >
          {/* White circle backdrop, clipping the oversized watch to a clean edge */}
          <div className="absolute inset-0 rounded-full bg-white overflow-hidden">
            <div
              className="absolute"
              style={{ width: "153%", height: "153%", left: "-26.5%", top: "-26.5%" }}
            >
              <MickeyWatch />
            </div>
          </div>
          {/* Top arc: "IT'S TIME TO" — upright letters over the circle's top. */}
          <div className="absolute" style={{ width: "140%", height: "140%", left: "-20%", top: "-20%" }}>
            <ArcText
              id="away-clock-arc-top"
              text="It's Time To"
              width={100}
              height={100}
              radius={ARC_R}
              centerY={CIRCLE_CENTRE}
              spanDeg={180}
              fontSize={ARC_FONT}
              flip={true}
              color="#fff"
            />
          </div>
          {/* Bottom arc: "CONTACT NOAH" — same circle, letters upright. */}
          <div className="absolute" style={{ width: "140%", height: "140%", left: "-20%", top: "-20%" }}>
            <BottomArcText
              id="away-clock-arc-bottom"
              text="Contact Noah"
              width={100}
              height={100}
              radius={ARC_R}
              centerY={CIRCLE_CENTRE}
              spanDeg={180}
              fontSize={ARC_FONT}
              color="#fff"
            />
          </div>
        </div>

        <div
          className="flex flex-col items-start text-left"
          style={{ gap: "clamp(0.9rem, calc(var(--u) * 34), 2rem)" }}
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
