"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useThrowable } from "@/lib/useThrowable";
import { useIsPhone } from "@/lib/useIsPhone";
import { AWAY_SCREEN_SHOWN } from "@/components/AwayOverlay";
import type { FrameAnimation } from "@/lib/projectObjects";

/**
 * A hand-shot object sitting in a project tile: click it and it animates,
 * grab it and you can throw it around the tile.
 *
 * 2026-08-22, per Noah: "All of the projects now have a corresponding
 * animation with a few frames starting at 1... When the user clicks on the
 * element, it 'animated' by going through the frames", then: "I would like
 * for there to be a bit of rocking motion, as if someone is taking a bite and
 * there's a bit of energy. Critically, I would like the animation to stop on
 * the last frame for all of these. The animation shouldn't repeat. Also
 * critically, I want the icons I make to be able to be throwable, like the
 * head on the about me page."
 *
 * PLAYS ONCE. After the last frame the animation is spent: clicking again
 * does nothing. It comes back only by scrolling the tile out of view and
 * returning to it, which is the same rule as before — "When we see the
 * element, it should be in frame 1" — and resetting on EXIT means the snap
 * back to whole happens where nobody can watch it.
 *
 * THE ROCK is applied to a wrapper INSIDE the throwable element, never to the
 * throwable element itself. The physics owns that outer transform completely
 * and rewrites it every frame; animating rotation on the same node would have
 * the two fighting for the same property, and the rock would simply vanish
 * the moment the object had ever been picked up.
 *
 * WHY EVERY FRAME IS IN THE DOM AT ONCE, stacked and all but one transparent:
 * the frames must be decoded before the first play rather than during it.
 * Swapping a single img's src would fetch the next frame at the moment of the
 * click, and an animation that stalls on its second frame reads as broken
 * rather than as a bite.
 */

/** Per-frame hold. Nudged up from 150 — Noah: "just a tad slower". */
const FRAME_MS = 210;
/** Peak rock, in degrees. Small: it should read as recoil, not a spin. */
const ROCK_DEG = 7;
/** How long a single stroke takes to travel end to end. Kept just under the
 *  frame hold so each line finishes drawing before the next begins. */
const DRAW_WIPE_MS = 190;

/** clip-path insets: fully hidden at the stroke's starting end, and revealed. */
const WIPE_HIDDEN = { l2r: "inset(0 100% 0 0)", b2t: "inset(100% 0 0 0)" };
const WIPE_SHOWN = "inset(0 0 0 0)";

export default function ProjectFrameAnimation({
  animation,
  containerRef,
  className = "",
  style,
}: {
  animation: FrameAnimation;
  /** The tile the object is thrown around inside. */
  containerRef: React.RefObject<HTMLElement | null>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { frames, width, height, style: motion = "rock", wipes } = animation;
  /** The rendered frame images, so a stroke can be drawn straight to the DOM. */
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const phone = useIsPhone();
  const [index, setIndex] = useState(0);
  /* Mirrors `index` for the physics, which reads it inside a rAF loop and must
   * not be re-subscribed on every frame change. */
  const frameRef = useRef(0);
  const spent = useRef(false);
  const timer = useRef<number | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rockRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  /* One decaying kick per frame — overshoot, then back with less each time,
   * so it reads as the object absorbing a bite rather than swinging. Written
   * straight to the style so it costs no React render inside the loop. */
  const rock = useCallback((step: number) => {
    if (motion === "draw") return; // holds still; the crossfade carries it
    const el = rockRef.current;
    if (!el) return;
    const decay = Math.pow(0.62, step);
    const dir = step % 2 === 0 ? 1 : -1;
    el.style.transition = "none";
    el.style.transform = `rotate(${ROCK_DEG * decay * dir}deg)`;
    // Settle back toward upright before the next frame lands.
    window.requestAnimationFrame(() => {
      el.style.transition = `transform ${FRAME_MS * 0.85}ms cubic-bezier(.2,.7,.3,1)`;
      el.style.transform = "rotate(0deg)";
    });
  }, [motion]);

  const play = useCallback(() => {
    if (spent.current) return; // plays once; see the note above
    spent.current = true;
    clearTimer();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIndex(frames.length - 1);
      return;
    }
    let i = 0;
    setIndex(0);
    rock(0);
    timer.current = window.setInterval(() => {
      i += 1;
      setIndex(i);
      rock(i);
      if (i >= frames.length - 1) clearTimer();
    }, FRAME_MS);
  }, [clearTimer, frames.length, rock]);

  /* NO PHYSICS ON A PHONE (2026-08-30). Noah: "could the issue be the
   * project icons at all? If so, make it so they don't have draggable
   * physics anymore, just still have the stop motion animation when clicked
   * on in mobile."
   *
   * He was right. useThrowable re-schedules its rAF at the TOP of the step
   * function, unconditionally — the loop runs every frame for the life of
   * the tile whether anything is moving or not. The home grid mounts one per
   * project, so six physics loops were doing collision maths and writing
   * transforms on every frame, permanently, competing with the scroll on a
   * device that is already struggling to give the main thread frames.
   *
   * Dragging an icon is a pointer interaction that a phone barely affords
   * anyway. The stop-motion still plays on a tap — see the tap handler on the
   * host element below, which takes over the job `onClick` did through the
   * physics hook. */
  const { reset: resetThrow, wake } = useThrowable({
    elementRef: hostRef,
    containerRef,
    imageSrcs: frames,
    frameRef,
    onClick: play,
    enabled: !phone,
  });

  /* Run the stroke.
   *
   * Driven straight to the element rather than through React state: the wipe
   * is a visual detail nothing else renders from, and a state round trip per
   * stroke would re-render every frame image mid-animation.
   *
   * The start state must be committed to the DOM before the transition to the
   * end state, or the browser coalesces the two and the line simply appears —
   * the very thing this replaces. A forced reflow does that synchronously.
   * Nested requestAnimationFrames are the more common way to write this and
   * were what I reached for first, but they make the reveal depend on frames
   * actually being produced: with the tab backgrounded the second callback
   * never ran and the stroke sat permanently hidden, so the drawing lost a
   * line. Reading offsetWidth cannot be deferred, so the wipe always starts. */
  useEffect(() => {
    if (motion !== "draw" || index === 0) return;
    const el = imgRefs.current[index];
    if (!el) return;
    const dir = wipes?.[index] ?? "l2r";
    el.style.transition = "none";
    el.style.clipPath = WIPE_HIDDEN[dir];
    void el.offsetWidth; // flush, so the browser has a start state to move from
    el.style.transition = `clip-path ${DRAW_WIPE_MS}ms linear`;
    el.style.clipPath = WIPE_SHOWN;
  }, [index, motion, wipes]);

  useEffect(() => {
    frameRef.current = index;
    // The outline just changed, and these shapes mostly grow. Hand control
    // back to gravity so a bigger object settles onto a border rather than
    // hanging where its smaller self came to rest.
    wake();
  }, [index, wake]);


  /** Whole again: frame 1, upright, back where it started. */
  const restore = useCallback(() => {
    clearTimer();
    spent.current = false;
    setIndex(0);
    resetThrow();
    if (rockRef.current) {
      rockRef.current.style.transition = "none";
      rockRef.current.style.transform = "rotate(0deg)";
    }
  }, [clearTimer, resetThrow]);

  /* Restore whenever the tile leaves the viewport — so returning to it finds
   * the object whole — and whenever the away screen covers the page, which is
   * the other moment nobody can see it happen. Noah: "It would also be good if
   * the animations reset when the clock screen comes on." */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) restore();
      },
      { threshold: 0 }
    );
    io.observe(el);
    window.addEventListener(AWAY_SCREEN_SHOWN, restore);
    return () => {
      io.disconnect();
      window.removeEventListener(AWAY_SCREEN_SHOWN, restore);
      clearTimer();
    };
  }, [clearTimer, restore]);

  return (
    <div
      ref={hostRef}
      className={`absolute select-none touch-none ${className}`}
      style={style}
      // The tile is a <Link>; these objects handle their own presses and must
      // not also navigate. Noah: "The apple should be it's own clickable
      // interaction. I'm hoping that the big grid square will indicate that
      // the user can click on this back area and get taken to a new page."
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // With the physics hook disabled on a phone it is no longer listening
        // for the press, so the tap has to start the animation from here.
        if (phone) play();
      }}
      onDragStart={(e) => e.preventDefault()}
      role="button"
      tabIndex={0}
      aria-label="Play animation"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          play();
        }
      }}
    >
      <div ref={rockRef} className="w-full">
        <div className="relative w-full" style={{ aspectRatio: `${width}/${height}` }}>
          {frames.map((src, i) => {
            // While a stroke is being drawn the PREVIOUS frame stays fully
            // visible underneath, so the picture drawn so far never flickers;
            // only the incoming frame is clipped, and the sole difference
            // between the two is the line arriving.
            const isUnderneath = motion === "draw" && i === index - 1;
            return (
              <Image
                key={src}
                ref={(el) => {
                  imgRefs.current[i] = el;
                }}
                src={src}
                alt=""
                fill
                sizes="25vw"
                /* EAGER, ALL OF THEM (2026-08-30). Noah: "the grid isn't
                   already loaded when the mobile home page is loaded. I'll
                   scroll past it to the footer, only for it to appear and
                   make me get lost on my position on the page... When I
                   scroll, everything should be ready."
                   
                   Only frame 0 was eager and the rest were lazy, so a tile
                   held one frame and fetched the others the moment it came
                   into view — which is the tile visibly assembling itself
                   under the reader's thumb. Eager means the loading screen
                   waits for them instead, which is the trade Noah asked for:
                   "I'm okay with the loading screen taking longer if it
                   equates to a smoother experience."
                   
                   Affordable because these are small: measured, each frame
                   renders into a 97px box on a phone, so the optimiser is
                   serving thumbnails, not artwork. */
                priority={i === 0}
                loading="eager"
                draggable={false}
                className="object-contain pointer-events-none"
                style={{ opacity: i === index || isUnderneath ? 1 : 0 }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
