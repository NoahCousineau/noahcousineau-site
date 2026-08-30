"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Stage, Place, uFont } from "./Stage";
import { HAND_BOX, HAND_FRAMES, HAND_PIXELS } from "@/lib/passwordHand";
import { useIsPhone } from "@/lib/useIsPhone";

/*
 * THE PASSWORD HAND (2026-08-23).
 *
 * Noah: "The password page is to appear whenever a new user first visits the
 * site and selects a project... The hand will fly up with a slight rotation
 * and be stuck on frame 1. The homepage will be visible behind it. There
 * will be text on the hand that reads 'Woah, pal! What's the password?'
 * along with a spot to enter the password, slightly tilted... Dots will
 * conceal the password. Once the correct password is entered it will
 * automatically advance, no need to hit enter. The text will fade and the
 * hand will rotate from the 'stop' position to a thumbs up over about a
 * quarter second while the homepage fades away, hold on the thumbs up for
 * about a second, fade, and then the loading screen appears."
 *
 * EVERY POSITION HERE IS MEASURED, not designed. Noah built the whole thing
 * in Password Animation Demo/*.svg, one file per frame, and the numbers below
 * are that file's own transforms converted from its 192x108 viewBox to the
 * site's 1920x1080 artboard (x10). The fly-in keyframes, the two blocks of
 * copy, their -3.77deg tilt and the tilted entry box are all his — including
 * the fact that the copy only appears once the hand has landed, which is why
 * it fades in at "ask" rather than flying in attached to the hand.
 *
 * THE FRAMES GO THROUGH A CANVAS rather than fifteen stacked <img>s or one
 * <img> with a swapping src. The turn is fifteen frames in 250ms — 17ms
 * each — and a src swap can miss its frame and flash blank, while fifteen
 * stacked layers is a lot of full-size compositing for something on screen
 * for a quarter second. Preloaded images drawn to a canvas make each switch
 * a single drawImage with nothing to lay out.
 *
 * THE COPY STAYS DARK IN BOTH THEMES, like the "C" home mark. It is written
 * on a photograph of a hand, and a palm does not darken in dark mode —
 * --color-ink would flip it to white on pink.
 */

/*
 * Three phases, not five, and the two that are missing are the point. The
 * turn, the hold and the exit are ONE phase because they are one gsap
 * timeline. Splitting them out and having the timeline call setPhase as it
 * passed each milestone made the timeline kill itself: phase is a dependency
 * of the effect that builds it, so the first setPhase ran that effect's
 * cleanup, and the hold and the fade never played at all. Nothing renders
 * differently between the three anyway — past this point the timeline IS the
 * state machine.
 */
type Phase = "enter" | "ask" | "go";

/** Fly-in. The demo goes translate(90.83 45.61) rotate(-12.57) scale(0) ->
 *  translate(43.01 9.54) rotate(0) scale(.07) — small, tilted, down and to
 *  the right of where it lands.
 *
 *  THE TRANSLATION IS GONE, 2026-08-25. Noah: "let's also make sure the hand
 *  comes from the center of the page and rotates from its starting point."
 *  Setting the transform origin to the page's centre was necessary and not
 *  sufficient: with a 478x361 unit offset still on the tween, the hand grew
 *  from a point that far off centre and slid into place, which is the sliding
 *  he could still see. At x/y 0 it scales up from the origin itself, so the
 *  origin IS the starting point and the rotation happens about it. */
const ENTER_FROM = { x: 0, y: 0, rotate: -12.57, scale: 0 };
// 0.62 -> 0.85: "The animation of the hand coming up from the back can be
// just a tad longer in time as well."
const ENTER_SECONDS = 0.85;

/** 2026-08-24, Noah: "When the hand is showing up, I want it to spin/grow
 *  more from the center of the page." Was the uncropped artwork's own
 *  corner (Noah's demo's own transform origin) — that grows the hand from a
 *  point near its own base, which reads as it unfurling from itself rather
 *  than bursting in from the middle of the screen. The Stage here is the
 *  full 1920x1080 artboard, so (960,540) is the page's true centre. */
const PAGE_CENTER = { x: 960, y: 540 };

/**
 * Noah's copy, positioned by its baselines. `dy` is measured down from the
 * first line's baseline, `dx` across from where it starts.
 *
 * SHRUNK 15% AND MOVED 30 UNITS LEFT, 2026-08-25. Noah: "The text and the
 * typing box should still be more on the palm. Move the text and box to the
 * left and shrink it down a bit to better fit on the palm."
 *
 * Not judged by eye. The palm was isolated out of frame 1's alpha — the
 * LEFTMOST contiguous run of opaque pixels on each row, which excludes the
 * thumb, since the thumb is a separate run further right on exactly the rows
 * where it juts out and text drifting onto it is part of what reads as
 * off-the-palm. Every line and the box were then measured against that mask.
 * At the old numbers "woah, pal!" was 87% covered and the box 98%; the
 * search says 0.85 scale is safe anywhere from 20 to 40 units left, so it
 * sits at 30 — the middle of the band rather than its edge.
 *
 * `dx`/`dy` scale with the type (COPY_SCALE), because they are the line
 * spacing Noah drew at the original size.
 */
const COPY_SCALE = 0.85;
const COPY_SHIFT_X = -30;
const COPY_ANCHOR = {
  x: 775.3 + COPY_SHIFT_X,
  y: 584.5,
  rot: -3.77,
  size: 68.3 * COPY_SCALE,
};
/** As Noah drew them: each line's offset from the anchor, at his own scale. */
const COPY_LINES_DRAWN = [
  { dx: 0, dy: 0, text: "woah, pal!" },
  { dx: 11.2 * COPY_SCALE, dy: 83.6 * COPY_SCALE, text: "what’s the" },
  { dx: -1.5 * COPY_SCALE, dy: 146.2 * COPY_SCALE, text: "password?" },
];

/*
 * CENTRED ON ONE AXIS (2026-08-25). Noah: "the lock screen animation is
 * almost perfect! Let's just make sure the copy and the password type box are
 * center-aligned to themselves a bit more. Please also scoot up 'woah, pal!'
 * up by a smidge."
 *
 * "To themselves" is the instruction: not to the hand, not to the page, but
 * to each other. Measured at 1512px, the four things had four different
 * centres —
 *
 *     "woah, pal!"  683.1      "what's the"  693.9
 *     "password?"   696.7      the field     723.2
 *
 * — a 40px spread, which is what reads as the group being slightly askew.
 * The axis they move to is their own mean, 699.2, because that is the one
 * that moves the composition least; anchoring on the copy alone would have
 * dragged the field 29px and pushed it toward the edge of the palm it is
 * drawn on.
 *
 * Kept SEPARATE from the drawn offsets above rather than folded into them.
 * Those numbers are Noah's artwork and should stay legible as such; these are
 * a measured correction in screen space, and the two would be impossible to
 * tell apart once added together.
 *
 * Divided by cos(3.77 degrees) because dx runs along the copy's own rotated
 * axis, not the screen's.
 */
const COPY_CENTRING = [21.41, 6.78, 3.21];
/** ...and the smidge. 16 units at the copy's scale, 10.7px at 1512. The lift
 *  is applied along the same rotated axis, so it carries the line 0.89 units
 *  to the RIGHT as well — already taken out of COPY_CENTRING[0] above. */
const COPY_LIFT = -16 * COPY_SCALE;
const COPY_LINES = COPY_LINES_DRAWN.map((l, i) => ({
  ...l,
  dx: l.dx + COPY_CENTRING[i],
  dy: l.dy + (i === 0 ? COPY_LIFT : 0),
}));
/** Akzidenz sits its baseline about this far below the top of a line box at
 *  line-height 1; the demo positions type by baseline, CSS by box top. */
const BASELINE_RATIO = 0.75;
const COPY_FADE = 0.25;

/** The entry box, from the demo's <rect>: centre, size and tilt, in units,
 *  shrunk and moved with the copy above. */
/** The field's share of the centring above: -24px at 1512, in units. Its own
 *  rotation is about its centre, so this moves the centre directly. */
const FIELD_CENTRING = -30.44;
/*
 * OFF THE EDGE OF THE PALM (2026-08-29). Noah: "shrink the password box a bit
 * and nudge it slightly to the right. It's currently a bit too close to the
 * edge of the palm."
 *
 * Measured at 1512 the box ran 588.6..810 with the palm's own edge sampling
 * as skin from about 585 -- three or four pixels of clearance, which is none.
 *
 * MOST OF THE MOVE IS THE SHRINK, deliberately. The box was brought onto one
 * axis with the three lines of copy four days ago (see COPY_CENTRING), and
 * sliding it bodily right would undo that. Shrinking happens about its own
 * centre, so 13% off the width buys 14 units of clearance on the left for
 * nothing; the nudge then only has to supply the last 12. The centre ends up
 * 12 units right of the shared axis rather than 26, so the group still reads
 * as centred.
 */
const FIELD_SHRINK = 0.87;
const FIELD_NUDGE_X = 12;
const FIELD = {
  cx: 948.4 + COPY_SHIFT_X + FIELD_CENTRING + FIELD_NUDGE_X,
  cy: 779.6,
  w: 327.3 * COPY_SCALE * FIELD_SHRINK,
  h: 61.3 * COPY_SCALE * FIELD_SHRINK,
  rot: -3.97,
  stroke: 3 * COPY_SCALE,
};

/**
 * How the typed password is drawn (2026-08-25).
 *
 * Noah: "the password dots should be sized to fill up the type box when the
 * correct password is entered. Since [the site password] would be 10
 * characters, the password dots should be sized to allow a maximum of 10
 * dots in the box."
 *
 * (Quoted with the password removed, 2026-08-29. It was written out here
 * verbatim, which put it in the repository and in every server source map
 * the build produces — a secret stops being one the moment it is a code
 * comment. MAX_DOTS below carries the only part that matters: the count.)
 *
 * DRAWN, NOT TYPED. The dots used to be whatever bullet the font puts in a
 * `type="password"` input, spaced by a letter-spacing guess — which cannot be
 * made to satisfy "exactly ten fit" for any particular box width, because the
 * bullet's own advance is a property of the typeface and changes with it. So
 * the input is still the real control and still holds the real value, but it
 * is transparent, and the dots are circles positioned at a stride of exactly
 * one tenth of the box's inner width. Ten fit because ten is what the
 * arithmetic divides by.
 */
const MAX_DOTS = 10;
/** Inset from the box's inner edge, so the first and last dot don't touch it. */
const FIELD_PAD = 9 * COPY_SCALE;

/**
 * The caret, from the demo's `<line x1="79.48" y1="76.03" x2="79.81"
 * y2="80.81"/>` — a short hand-drawn mark inside the box near its left edge,
 * which 2026-08-24 added as static artwork.
 *
 * IT NOW MOVES, 2026-08-25. Noah: "I noticed there was a line added to the
 * inside of the type box. This is good, but I would like this line to
 * actually function as the text cursor. It should start on the left and go
 * to the right when the user is typing."
 *
 * Only its length and its slight lean survive from the demo — 3.3 units of
 * drift over 47.8 of height, which is what makes it read as drawn by hand
 * rather than as a rule. Its position is now one dot-stride per character.
 * Expressed as fractions of the box so it keeps that proportion when the box
 * is resized, which it just was.
 */
const CARET = { hFrac: 0.78, leanFrac: 0, w: 3 * COPY_SCALE };
/*
 * THE LEAN IS GONE, 2026-08-25. Noah: "The text cursor isn't parallel to the
 * side of the box, please rotate this a smidge to be parallel."
 *
 * It was 0.069 — the demo's own 3.3 units of drift over 47.8 of height, which
 * is 3.95 degrees off vertical. Faithful, and wrong here, because of WHERE it
 * is drawn. The demo puts its line in page space, untransformed, next to a box
 * that carries a -3.97 degree rotation; this draws the caret INSIDE the box's
 * rotated frame so it can line up with the dots. In that frame the box's sides
 * are vertical, so the demo's tilt no longer cancels against the box's — it
 * adds to it, leaving the caret 7.9 degrees off the edge beside it. Vertical in
 * the local frame IS parallel to the side of the box, which is what was
 * actually being asked for.
 */

// 0.25 -> 0.5, 2026-08-24: "Let's double the amount of time until we get to
// the thumbs up."
const TURN_SECONDS = 0.5;
const HOLD_SECONDS = 1;      // "hold on the thumbs up for about a second"
const BACKDROP_FADE = 0.3;   // "while the homepage fades away"
const LEAVE_SECONDS = 0.45;

/** Ink for anything drawn ON the hand — fixed, see the note at the top. */
const HAND_INK = "#231f20";

/** Below this there is nothing worth asking the server about. */
const MIN_LENGTH = 4;
/** Long enough that a fast typist sends one request, not one per key. */
const DEBOUNCE_MS = 140;

/*
 * THE PHONE ARTBOARD (2026-08-25). Noah: "have the hand take up the majority
 * of the screen without anything bleeding off the sides of the phone screen."
 *
 * Same device as the hero and the project grid: shrink the artboard rather
 * than resize the hand, so the copy, the entry box, the dots and the caret —
 * all positioned in these units, and all fitted to the palm by measurement —
 * scale together and stay exactly where they were put.
 *
 * The number is the hand's own width plus a margin. The cropped artwork is
 * HAND_BOX.w = 701.4 units across and starts at x = 595.3, so an artboard of
 * (595.3 + 701.4) minus what is only empty space to its left, plus a gutter,
 * lands at 820: the hand then occupies 701/820 = 86% of the screen's width
 * with the rest as margin, and cannot bleed because the artboard IS the
 * screen.
 */
const PHONE_ARTBOARD = 820;
/*
 * ...and the height it is centred in — 2026-08-25: "make sure the hand and
 * animation is more centered in the center of the phone screen."
 *
 * The Stage was 1080 scaled by the artboard ratio, which is 461 units — barely
 * more than half the hand's own 793, so the composition hung out of the bottom
 * of its own frame and could not be centred by it. Twice the hand's centre
 * line is the height that puts the hand exactly in the middle by construction,
 * whatever the crop turns out to be.
 */
const PHONE_STAGE_H = HAND_BOX.y * 2 + HAND_BOX.h;
/** Slide the whole composition left so the hand is centred on the narrower
 *  artboard rather than sitting where a 1920-wide one put it. */
const PHONE_SHIFT_X =
  (PHONE_ARTBOARD - HAND_BOX.w) / 2 - HAND_BOX.x;

/** The artboard this screen is laid out on, which the PAGE has to agree with
 *  — it owns the `--u` declaration and the wrapper's width. Exported rather
 *  than duplicated so the two cannot drift apart. */
export function usePasswordArtboard(): { w: number; h: number } {
  return useIsPhone()
    ? { w: PHONE_ARTBOARD, h: PHONE_STAGE_H }
    : { w: 1920, h: 1080 };
}

export default function PasswordHand({
  onSubmit,
  onFinished,
}: {
  /** Resolves true when the value is the site password. */
  onSubmit: (value: string) => Promise<boolean>;
  /** Called once the thumbs up has faded — hand off to the loading screen. */
  onFinished: () => void;
}) {
  const phone = useIsPhone();
  const shiftX = phone ? PHONE_SHIFT_X : 0;
  const artboard = phone ? PHONE_ARTBOARD : 1920;

  const [phase, setPhase] = useState<Phase>("enter");
  const [value, setValue] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- frames -------------------------------------------------------- */

  const draw = useCallback((i: number) => {
    const c = canvasRef.current;
    const img = framesRef.current[i];
    if (!c || !img?.complete || !img.naturalWidth) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }, []);

  useEffect(() => {
    let alive = true;
    framesRef.current = HAND_FRAMES.map((src, i) => {
      const img = new Image();
      // Frame 1 is the one held on screen for as long as it takes to type a
      // password, so it is the only one anything waits on; the other
      // fourteen have until the turn starts to arrive.
      img.onload = () => {
        if (alive && i === 0) draw(0);
      };
      img.src = src;
      return img;
    });
    return () => {
      alive = false;
    };
  }, [draw]);

  /* ---- fly-in -------------------------------------------------------- */

  useEffect(() => {
    const el = handRef.current;
    if (!el) return;
    // A reduced-motion reader gets the same sequence with the durations
    // taken out rather than a different code path — the phase still advances
    // from the tween's own onComplete, which also keeps setPhase out of the
    // effect body (react-hooks/set-state-in-effect).
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // ENTER_FROM is in artboard units and gsap wants pixels. offsetWidth is
    // the LAYOUT width, so it still reads the full box while the element is
    // mid-tween at scale 0 — getBoundingClientRect would report the scaled
    // width and divide by itself to nonsense.
    const u = el.offsetWidth / HAND_BOX.w;
    const tween = gsap.fromTo(
      el,
      {
        x: ENTER_FROM.x * u,
        y: ENTER_FROM.y * u,
        rotate: ENTER_FROM.rotate,
        scale: ENTER_FROM.scale,
      },
      {
        x: 0,
        y: 0,
        rotate: 0,
        scale: 1,
        duration: reduced ? 0 : ENTER_SECONDS,
        ease: "power3.out",
        onComplete: () => setPhase("ask"),
      }
    );
    return () => {
      tween.kill();
    };
  }, []);

  /* ---- the copy, once the hand has landed ----------------------------- */

  useEffect(() => {
    if (phase !== "ask" || !copyRef.current) return;
    const tween = gsap.fromTo(
      copyRef.current,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: COPY_FADE,
        ease: "power1.out",
        // AFTER the fade, not before it. autoAlpha's starting state is
        // visibility:hidden, and focus() on a hidden element is a no-op —
        // which left the reader typing into nothing until they thought to
        // click the box.
        onComplete: () => inputRef.current?.focus(),
      }
    );
    return () => {
      tween.kill();
    };
  }, [phase]);

  /* ---- checking as they type ------------------------------------------ */

  /** One tenth of the box's inner width, so exactly MAX_DOTS fit. */
  const dotStride = (FIELD.w - FIELD_PAD * 2) / MAX_DOTS;
  const caretX = FIELD_PAD + dotStride * Math.min(value.length, MAX_DOTS);

  const refused = useRef(new Set<string>());
  /* Checks are QUEUED BEHIND EACH OTHER rather than skipped while one is in
   * flight, and the difference is a password that silently does nothing. Type
   * a few characters, pause long enough to send one request, then finish the
   * word while that request is still travelling: a "drop it if busy" guard
   * throws away the check for the finished password, and since the value never
   * changes again nothing ever retries it. The reader is left looking at a
   * correct password and a hand that will not move. Chaining costs one promise
   * and cannot lose the last value; `refused` keeps the queue from re-asking
   * anything twice. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (phase !== "ask") return;
    const v = value;
    // Nothing worth asking about yet, and no point re-asking about something
    // the server has already turned down.
    if (v.length < MIN_LENGTH || refused.current.has(v)) return;
    const t = window.setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (refused.current.has(v)) return;
        if (await onSubmit(v)) setPhase("go");
        else refused.current.add(v);
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [value, phase, onSubmit]);

  /* ---- the turn, the hold, the exit ----------------------------------- */

  useEffect(() => {
    if (phase !== "go") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = { i: 0 };
    const tl = gsap.timeline({ onComplete: onFinished });

    tl.to(copyRef.current, { autoAlpha: 0, duration: 0.12, ease: "none" }, 0);
    tl.to(
      step,
      {
        i: HAND_FRAMES.length - 1,
        duration: reduced ? 0 : TURN_SECONDS,
        // Lands rather than stopping dead, without being slow enough to read
        // as fifteen separate pictures.
        ease: "power1.out",
        onUpdate: () => draw(Math.round(step.i)),
      },
      0
    );
    tl.to(".js-password-backdrop", { autoAlpha: 0, duration: BACKDROP_FADE, ease: "none" }, 0);

    tl.to({}, { duration: reduced ? 0 : HOLD_SECONDS });

    const out = reduced ? 0 : LEAVE_SECONDS;
    tl.to(handRef.current, { autoAlpha: 0, duration: out, ease: "power1.inOut" }, "leave");
    // Goes opaque under the thumbs up so the loading screen this hands over
    // to is already there when the route changes — nothing flashes between.
    tl.to(curtainRef.current, { opacity: 1, duration: out, ease: "power1.inOut" }, "leave");

    return () => {
      tl.kill();
    };
  }, [phase, draw, onFinished]);

  return (
    <>
      <Stage
        heightUnits={phone ? PHONE_STAGE_H : 1080}
        // The entry box is small, tilted and sitting on a photograph, so it
        // does not read as a click target the way a form field would. Anywhere
        // on this screen puts the cursor in it.
        onPointerDown={() => inputRef.current?.focus()}
      >
        <Place
          x={HAND_BOX.x + shiftX}
          y={HAND_BOX.y}
          w={HAND_BOX.w}
          h={HAND_BOX.h}
          className="pointer-events-none"
        >
          <div
            ref={handRef}
            className="w-full h-full"
            style={{
              // The fly-in turns and grows about the PAGE'S centre — see
              // PAGE_CENTER. Expressed relative to this div's own box (which
              // sits at HAND_BOX), same as the old artwork-corner origin was.
              transformOrigin: `calc(var(--u) * ${
                artboard / 2 - HAND_BOX.x - shiftX
              }) calc(var(--u) * ${PAGE_CENTER.y - HAND_BOX.y})`,
            }}
          >
            <canvas
              ref={canvasRef}
              width={HAND_PIXELS.width}
              height={HAND_PIXELS.height}
              className="w-full h-full"
            />
          </div>
        </Place>

        <div ref={copyRef} className="absolute inset-0" style={{ visibility: "hidden" }}>
          <div
            className="absolute"
            style={{
              left: `calc(var(--u) * ${COPY_ANCHOR.x + shiftX})`,
              top: `calc(var(--u) * ${COPY_ANCHOR.y - COPY_ANCHOR.size * BASELINE_RATIO})`,
              transform: `rotate(${COPY_ANCHOR.rot}deg)`,
              transformOrigin: "0 0",
              color: HAND_INK,
              fontSize: uFont(COPY_ANCHOR.size),
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {COPY_LINES.map((l) => (
              <div
                key={l.text}
                className="absolute"
                style={{
                  left: `calc(var(--u) * ${l.dx})`,
                  top: `calc(var(--u) * ${l.dy})`,
                }}
              >
                {l.text}
              </div>
            ))}
          </div>

          {/* THE WHOLE FIELD IN ONE ROTATED FRAME. The outline used to be
              drawn in a page-space SVG with its own matching rotate, which
              worked while it was the only thing in the box; now that the
              dots and the caret have to line up inside it to a fraction of a
              unit, one rotation shared by all three is the only way they
              cannot drift apart. */}
          <div
            className="absolute"
            style={{
              left: `calc(var(--u) * ${FIELD.cx - FIELD.w / 2 + shiftX})`,
              top: `calc(var(--u) * ${FIELD.cy - FIELD.h / 2})`,
              width: `calc(var(--u) * ${FIELD.w})`,
              height: `calc(var(--u) * ${FIELD.h})`,
              transform: `rotate(${FIELD.rot}deg)`,
            }}
          >
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${FIELD.w} ${FIELD.h}`}
              aria-hidden="true"
            >
              {/* Inset by half the stroke so the outline sits inside the box
                  rather than straddling its edge. An SVG stroke rather than a
                  CSS border: a border-width snaps to whole device pixels,
                  which thickens or thins it depending on which way the
                  rounding falls, while this scales with the viewBox exactly
                  as the demo's own vector does. */}
              <rect
                x={FIELD.stroke / 2}
                y={FIELD.stroke / 2}
                width={FIELD.w - FIELD.stroke}
                height={FIELD.h - FIELD.stroke}
                fill="none"
                stroke={HAND_INK}
                strokeWidth={FIELD.stroke}
              />
              {Array.from({ length: Math.min(value.length, MAX_DOTS) }, (_, i) => (
                <circle
                  key={i}
                  cx={FIELD_PAD + dotStride * (i + 0.5)}
                  cy={FIELD.h / 2}
                  r={dotStride * 0.26}
                  fill={HAND_INK}
                />
              ))}
              {/* Sits AFTER the last dot, and stops advancing once the box is
                  full — there is nowhere further right for it to go. */}
              <line
                x1={caretX}
                y1={(FIELD.h * (1 - CARET.hFrac)) / 2}
                x2={caretX + FIELD.h * CARET.leanFrac}
                y2={FIELD.h - (FIELD.h * (1 - CARET.hFrac)) / 2}
                stroke={HAND_INK}
                strokeWidth={CARET.w}
              />
            </svg>

            {/* The real control, and invisible. It still owns the value, the
                focus and the keystrokes; everything above is a drawing of
                what it contains. `color` and `caretColor` transparent rather
                than `opacity: 0` on the element, so it stays hit-testable and
                focusable in every browser without any doubt about it. */}
            <input
              ref={inputRef}
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              // The value is checked on every keystroke; Enter is swallowed
              // rather than wired up, so there is nothing to submit and no
              // reload if a browser decides this lone input is a form.
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              autoComplete="off"
              spellCheck={false}
              aria-label="Password"
              className="absolute inset-0 w-full h-full bg-transparent outline-none"
              style={{
                color: "transparent",
                caretColor: "transparent",
                fontSize: uFont(FIELD.h * 0.62),
              }}
            />
          </div>

        </div>
      </Stage>

      <div
        ref={curtainRef}
        className="fixed inset-0 pointer-events-none"
        style={{ background: "var(--color-paper)", opacity: 0, zIndex: 5 }}
      />
    </>
  );
}
