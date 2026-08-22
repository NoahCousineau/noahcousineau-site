"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useThrowable } from "@/lib/useThrowable";

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

export type FrameAnimation = {
  /** Frame image paths, in order, starting at frame 1. */
  frames: string[];
  /** Intrinsic size of every (registered, identically sized) frame. */
  width: number;
  height: number;
};

/** Per-frame hold. Nudged up from 150 — Noah: "just a tad slower". */
const FRAME_MS = 210;
/** Peak rock, in degrees. Small: it should read as recoil, not a spin. */
const ROCK_DEG = 7;

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
  const { frames, width, height } = animation;
  const [index, setIndex] = useState(0);
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
  }, []);

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

  const { reset: resetThrow } = useThrowable({
    elementRef: hostRef,
    containerRef,
    imageSrc: frames[0],
    onClick: play,
  });

  /* Back to frame 1, upright and back in place, whenever the tile leaves the
   * viewport — so returning to it finds the object whole again. */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) return;
        clearTimer();
        spent.current = false;
        setIndex(0);
        resetThrow();
        if (rockRef.current) {
          rockRef.current.style.transition = "none";
          rockRef.current.style.transform = "rotate(0deg)";
        }
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimer();
    };
  }, [clearTimer, resetThrow]);

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
          {frames.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt=""
              fill
              sizes="25vw"
              priority={i === 0}
              draggable={false}
              className="object-contain pointer-events-none"
              style={{ opacity: i === index ? 1 : 0 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
