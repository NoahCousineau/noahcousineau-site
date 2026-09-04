"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MickeyWatch from "./MickeyWatch";
import { ArcText, BottomArcText } from "./ArcText";
import { useIsPhone, useIsCompact } from "@/lib/useIsPhone";

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
/* 30s -> 90s, 2026-08-29. Noah, for the second time: "I also still feel like
 * the clock screen is showing up too fast and too frequently, let's work to
 * resolve this."
 *
 * "Too fast" is this number and "too frequently" is the leave trigger below,
 * so both move. Thirty seconds is a long time to be typing but a short one to
 * be READING a case study — which is exactly what someone is doing on a
 * project page, scrolled to a still image with the pointer parked. The site's
 * own content invites the state this was treating as absence. */
/* 45s, set explicitly on 2026-08-29: "let's have this appear 45 seconds
 * after the user last interacts with the site. Scrolling on the site counts
 * as an interaction."
 *
 * Lower than the 90 it had been, which reads as a contradiction next to "the
 * clock screen is appearing too soon" and is not one: the complaint is about
 * the timer not being RESET, not about its length. If a scroll does not stamp
 * the clock then any number is too short, because the countdown never
 * restarts while someone reads. So the number is what Noah asked for and the
 * reset is widened below to cover every way a person touches a page. */
const IDLE_MS = 45_000;
/** How often the idle poll checks the activity stamp. */
const IDLE_POLL_MS = 1000;
/** Debounce on the leave triggers, so an alt-tab bounce or focus brushing
 * browser chrome doesn't flash a full-screen black panel. */
/* 400ms -> 2500ms, 2026-08-29, the "too frequently" half of the note on
 * IDLE_MS. 400ms debounces a bounce; it does not cover the ordinary business
 * of leaving the tab to check something and coming straight back, which
 * raised the panel every time. Two and a half seconds is long enough that a
 * glance elsewhere costs nothing and short enough that genuinely walking away
 * still lands on the clock. */
const LEAVE_DELAY_MS = 2500;

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

export default function AwayOverlay({
  forceOpen = false,
}: {
  /* HELD OPEN FOR THE BENCH (2026-08-25). Noah: "on the mobile bench, please
   * also provide a way for me to see what the clock screen will look like on
   * mobile."
   *
   * The bench shows routes in iframes, and this screen is deliberately not a
   * route — it appears on idle or on leaving, and any activity dismisses it,
   * which are exactly the conditions a frame you are looking at will never be
   * in. There is nothing to navigate to and nothing that would stay up if
   * there were.
   *
   * So it takes a prop instead, and app/dev/clock renders it pinned open. The
   * flag also skips the idle poll and the leave/media listeners outright
   * rather than just forcing the state, so nothing can dismiss it and no
   * timers run behind a screen that is meant to sit still. Dev-only by
   * construction: the one caller that passes it 404s in production. */
  forceOpen?: boolean;
}) {
  const phone = useIsPhone();
  const compact = useIsCompact();
  // Always starts hidden, including in server-rendered HTML, so a page
  // opened in a background tab hydrates clean.
  const [awayState, setAway] = useState(false);
  /*
   * THE CLOCK DOES NOT DOWNLOAD UNTIL IT IS WANTED (2026-09-03).
   *
   * Noah, from somewhere with bad wifi: "the website isn't functioning as
   * well. Let's make sure that the loading page gets the main page ready to
   * scroll down."
   *
   * Measured what the home page actually fetches before the curtain lifts:
   * 7.53MB, and 1.83MB of it is this clock — body.png at 1072KB, the minute
   * hand at 562KB, the hour hand at 194KB. A quarter of the download, for a
   * screen that appears after forty-five seconds of idling or when the reader
   * leaves the tab, and which many will never see at all. The loader does not
   * WAIT for it (it only watches `main`), but the bytes still compete for the
   * connection with the ones it does wait for, so on a slow link this made
   * every page slower to open for nothing.
   *
   * Latched rather than tied to `away` directly: once the screen has been
   * shown it stays mounted, so it appears instantly every time after the
   * first. The first appearance is the only one that has to fetch, and it is
   * a full-screen takeover with nothing behind it to be late for.
   */
  const [clockWanted, setClockWanted] = useState(false);
  const away = forceOpen || awayState;
  /* Latch: the first time the screen is wanted, the clock mounts and stays. */
  useEffect(() => {
    if (away) setClockWanted(true);
  }, [away]);

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
    /* NOT WHEN EMBEDDED. An iframe's window is blurred whenever it is not the
     * focused frame, which is nearly always, so the `blur` trigger below would
     * fire immediately and permanently in every embed — including all ten
     * phones on /dev/mobile, which would show nothing but the clock. The away
     * screen is a full-viewport takeover addressed to someone who has stepped
     * away from THE SITE; inside someone else's page that is not a claim this
     * component can make. Registering nothing is enough, since the overlay
     * starts hidden and only these listeners ever raise it.
     *
     * That guard is also why the bench could never show this screen, and why
     * `forceOpen` exists — see the prop's note. Held open, none of these
     * listeners should run either: there is nothing for them to raise, and a
     * dismiss would take down the thing you are trying to look at. */
    if (forceOpen) return;
    if (window.self !== window.top) return;

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

    /* Every way someone can be present. `scroll` was already here, but only
       on `window` — and a smooth-scroll library that animates a transform
       rather than the document would never fire it, so the pointer and touch
       events are the belt to its braces. `pointermove` also covers a stylus
       and a trackpad glide that never becomes a click. */
    const ACTIVITY = [
      "mousemove", "mousedown", "keydown", "wheel", "touchstart", "touchmove",
      "pointerdown", "pointermove", "scroll",
    ] as const;
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
  }, [isMediaBusy, forceOpen]);

  const linkStyle: React.CSSProperties = {
    color: "var(--color-paper)",
    textDecoration: "none",
    display: "block",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-sans)",
    /* 2026-08-25, phones: "Have the clock in the center of the screen with
       the contact type larger and now center aligned above and below."
       Roughly double, and no longer clamped small — there is room for it once
       the two groups stop flanking the clock and stack instead. */
    fontSize: phone
      ? "clamp(0.95rem, calc(var(--u) * 46), 1.5rem)"
      : "clamp(0.62rem, calc(var(--u) * 21), 1.1rem)",
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
      }}
    >
      {/* `1fr auto 1fr` puts the CLOCK dead centre on the page regardless of
          how wide either contact group is (2026-08-20, per Noah: "please
          also center the clock in the center of the page"). A flex row with
          justify-center would instead centre the row as a whole, letting the
          wider left group push the clock off-centre. */}
      {/* PHONE: one column, clock in the middle, contacts stacked above and
          below it and centred — "Have the clock in the center of the screen
          with the contact type larger and now center aligned above and
          below." The desktop `1fr auto 1fr` exists to hold the clock dead
          centre regardless of how wide either contact group is; stacked, the
          clock is centred by the column itself and the same guarantee comes
          for free. */}
      {/* THE ARTBOARD IS THE CONTENT, NOT THE PANEL (2026-08-29). The black
          curtain has to stay full-bleed at every width -- it is the thing
          covering the site -- so it cannot be the element the narrow tier
          caps. `.artboard` moves down here, onto the grid, which is what
          should stop growing and centre itself. See the narrow-tier note in
          globals.css. */}
      <div
        className={`artboard grid w-full ${phone ? "justify-items-center" : "items-center"}`}
        style={{
          ["--u" as string]: "calc(100cqw / 1920)",
          gridTemplateColumns: phone ? "minmax(0, 1fr)" : "1fr auto 1fr",
          /* Generous, and it has to be: the arc type is drawn INSIDE the
             clock's own square box, right at its top and bottom edges, so
             the visible gap between "CONTACT NOAH" and the row beneath it is
             this value minus however much of that box is empty corner. At
             1.5rem the links landed on top of the arc. */
          /* The phone gap grew on 2026-08-29 with the stacking above: each
             contact group is now two lines tall instead of one row, so the
             group's own last line starts where its first used to, and the
             phone number's rule landed on "IT'S TIME TO" while "LinkedIn"
             sat under "CONTACT NOAH". 150 -> 320 units. */
          /* SPREAD DOWN THE SCREEN ON A PHONE (2026-08-29). Noah: "the text
             is arranged much better. Let's just distribute the content
             vertically more."
             A gap alone can only push the three rows apart from wherever the
             centred column happens to start, so past a point it just pushes
             the whole block off the screen. Giving the column the screen's
             height and letting `align-content` share the slack out does what
             was asked: the contacts sit near the top and bottom edges and the
             clock keeps the middle, whatever the device's height. The gap
             stays as the MINIMUM separation for a short screen. */
          alignContent: phone ? "space-evenly" : undefined,
          minHeight: phone ? "88dvh" : undefined,
          gap: phone
            ? "clamp(2.75rem, calc(var(--u) * 320), 8rem)"
            : "clamp(1.25rem, calc(var(--u) * 132), 8rem)",
        }}
      >
        {/* Email and phone side by side, per Noah, and pushed toward the
            clock so both groups read as flanking it.

            ...ONE PER LINE ON A PHONE (2026-08-29). Noah: "on the mobile
            clock screen, let's stack all the content vertically and
            centered." The row already wrapped, but only when it had to --
            the email is long enough that it wrapped and the phone number did
            not, which is what produced the ragged half-stacked look. Stacking
            it outright is the instruction, and it also removes the only
            reason this group's width mattered. */}
        <div
          className={`flex items-center ${
            phone ? "flex-col justify-center" : "flex-wrap justify-end"
          }`}
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
          style={{
            // Bigger on a phone as a share of the screen, since it is no
            // longer sharing a row with anything.
            /* The middle band gets its own size (2026-08-29: "for the
               in-between sizes, let's make sure the clock is slightly
               larger"). The desktop expression is 520 units capped at 52vh,
               which at 900px wide is only 244px — small in a window with
               nothing else in it. 720 units lifts it to about 338px there
               and the vh cap still governs a short window. */
            width: phone
              ? "min(calc(var(--u) * 1320), 34vh)"
              : compact
                ? "min(calc(var(--u) * 720), 58vh)"
                : "min(calc(var(--u) * 520), 52vh)",
            aspectRatio: "1/1",
          }}
        >
          {/* White circle backdrop, clipping the oversized watch to a clean edge */}
          <div className="absolute inset-0 rounded-full bg-[color:var(--color-paper)] overflow-hidden">
            <div
              className="absolute"
              style={{ width: "153%", height: "153%", left: "-26.5%", top: "-26.5%" }}
            >
              {clockWanted && <MickeyWatch />}
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
              /* The light crosses this phrase first, then the one below —
                 clockwise along the top, which on screen is left to right. */
              shimmer
              shimmerPhaseMs={0}
              shimmerActive={away}
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
              /* One second later, so it starts as the phrase above finishes.
                 Counter-clockwise along the bottom — which, like the top, is
                 left to right on screen, so the two read in order. */
              shimmer
              shimmerPhaseMs={1000}
              shimmerActive={away}
            />
          </div>
        </div>

        {/* Stacked on a phone for the same reason as the group above. */}
        <div
          className={`flex items-center ${
            phone ? "flex-col justify-center" : "flex-wrap justify-start"
          }`}
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
