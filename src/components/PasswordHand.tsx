"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Stage, Place, uFont } from "./Stage";
import {
  HAND_BOX,
  HAND_ART_ORIGIN,
  HAND_FRAMES,
  HAND_PIXELS,
} from "@/lib/passwordHand";

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

/** Fly-in, relative to where the hand lands: the demo goes
 *  translate(90.83 45.61) rotate(-12.57) scale(0) -> translate(43.01 9.54)
 *  rotate(0) scale(.07), i.e. it starts small, tilted, down and to the right. */
const ENTER_FROM = { x: 478.2, y: 360.7, rotate: -12.57, scale: 0 };
const ENTER_SECONDS = 0.62;

/** Noah's copy, positioned by its baselines. `dy` is measured down from the
 *  first line's baseline, `dx` across from where it starts. */
const COPY_ANCHOR = { x: 775.3, y: 574.5, rot: -3.77, size: 68.3 };
const COPY_LINES = [
  { dx: 0, dy: 0, text: "woah, pal!" },
  { dx: 11.2, dy: 83.6, text: "what’s the" },
  { dx: -1.5, dy: 146.2, text: "password?" },
];
/** Akzidenz sits its baseline about this far below the top of a line box at
 *  line-height 1; the demo positions type by baseline, CSS by box top. */
const BASELINE_RATIO = 0.75;
const COPY_FADE = 0.25;

/** The entry box, from the demo's <rect>: centre, size and tilt, in units. */
const FIELD = { cx: 948.4, cy: 773.6, w: 327.3, h: 61.3, rot: -3.97, stroke: 3 };

const TURN_SECONDS = 0.25;   // "about a quarter second"
const HOLD_SECONDS = 1;      // "hold on the thumbs up for about a second"
const BACKDROP_FADE = 0.3;   // "while the homepage fades away"
const LEAVE_SECONDS = 0.45;

/** Ink for anything drawn ON the hand — fixed, see the note at the top. */
const HAND_INK = "#231f20";

/** Below this there is nothing worth asking the server about. */
const MIN_LENGTH = 4;
/** Long enough that a fast typist sends one request, not one per key. */
const DEBOUNCE_MS = 140;

export default function PasswordHand({
  onSubmit,
  onFinished,
}: {
  /** Resolves true when the value is the site password. */
  onSubmit: (value: string) => Promise<boolean>;
  /** Called once the thumbs up has faded — hand off to the loading screen. */
  onFinished: () => void;
}) {
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
        heightUnits={1080}
        // The entry box is small, tilted and sitting on a photograph, so it
        // does not read as a click target the way a form field would. Anywhere
        // on this screen puts the cursor in it.
        onPointerDown={() => inputRef.current?.focus()}
      >
        <Place
          x={HAND_BOX.x}
          y={HAND_BOX.y}
          w={HAND_BOX.w}
          h={HAND_BOX.h}
          className="pointer-events-none"
        >
          <div
            ref={handRef}
            className="w-full h-full"
            style={{
              // The fly-in turns and grows about the UNCROPPED artwork's
              // corner, which is where Noah's demo puts its transform. The
              // crop starts inside that, hence the negative offset.
              transformOrigin: `calc(var(--u) * ${HAND_ART_ORIGIN.x - HAND_BOX.x}) calc(var(--u) * ${HAND_ART_ORIGIN.y - HAND_BOX.y})`,
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
              left: `calc(var(--u) * ${COPY_ANCHOR.x})`,
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

          <div
            className="absolute"
            style={{
              left: `calc(var(--u) * ${FIELD.cx - FIELD.w / 2})`,
              top: `calc(var(--u) * ${FIELD.cy - FIELD.h / 2})`,
              width: `calc(var(--u) * ${FIELD.w})`,
              height: `calc(var(--u) * ${FIELD.h})`,
              transform: `rotate(${FIELD.rot}deg)`,
              border: `calc(var(--u) * ${FIELD.stroke}) solid ${HAND_INK}`,
            }}
          >
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
              className="w-full h-full bg-transparent outline-none text-center"
              style={{
                color: HAND_INK,
                fontSize: uFont(FIELD.h * 0.62),
                letterSpacing: "calc(var(--u) * 6)",
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
