"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * A hand-shot object sitting in a project tile that animates when clicked —
 * the apple on the Sprouts tile is eaten down to a core, and each project
 * gets its own gag.
 *
 * 2026-08-22, per Noah: "All of the projects now have a corresponding
 * animation with a few frames starting at 1. When we see the element, it
 * should be in frame 1. When the user clicks on the element, it 'animated' by
 * going through the frames... When the user clicks on the apple, we'll see
 * the apple get eaten until its just a core."
 *
 * WHY EVERY FRAME IS IN THE DOM AT ONCE, all stacked and all but one at
 * opacity 0: the frames have to be decoded before the first play, not during
 * it. Swapping a single <img>'s src would fetch frame 2 at the moment of the
 * click, and a five-frame animation that stalls on its second frame reads as
 * broken rather than as a bite. Stacking costs one <img> per frame and makes
 * the swap a style change with nothing to wait for.
 *
 * THE TILE IS A LINK, and that is the awkward part of the interaction: a
 * click has to mean "animate" on the object and "open the project"
 * everywhere else in the cell. So this element swallows its own clicks. That
 * is a real trade — the object is the most clickable-looking thing in the
 * tile and it deliberately does not navigate — and worth watching in use, but
 * it is the only reading of "when the user clicks on the element, it
 * animates" that leaves the animation visible for long enough to see.
 */

export type FrameAnimation = {
  /** Frame image paths, in order, starting at frame 1. */
  frames: string[];
  /** Intrinsic size of every (registered, identically sized) frame. */
  width: number;
  height: number;
};

export default function ProjectFrameAnimation({
  animation,
  frameMs = 150,
  className = "",
  style,
}: {
  animation: FrameAnimation;
  /** How long each frame holds. */
  frameMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { frames, width, height } = animation;
  const [index, setIndex] = useState(0);
  const timer = useRef<number | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const play = useCallback(() => {
    clearTimer();
    // Reduced motion gets the punchline without the flicker: the object is
    // shown already eaten rather than cutting between five frames.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIndex(frames.length - 1);
      return;
    }
    setIndex(0);
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        if (i >= frames.length - 1) {
          clearTimer();
          return i;
        }
        return i + 1;
      });
    }, frameMs);
  }, [clearTimer, frameMs, frames.length]);

  /* Back to frame 1 whenever the tile is off screen — "When we see the
   * element, it should be in frame 1." Resetting on EXIT rather than on entry
   * means the reset happens where nobody can watch it snap back; coming into
   * view it is simply already whole again. */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          clearTimer();
          setIndex(0);
        }
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimer();
    };
  }, [clearTimer]);

  const onActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Keep the click off the surrounding <Link>.
    e.preventDefault();
    e.stopPropagation();
    play();
  };

  const eaten = index >= frames.length - 1;

  return (
    <div
      ref={hostRef}
      className={`absolute select-none ${className}`}
      style={style}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onActivate(e);
      }}
      role="button"
      tabIndex={0}
      aria-label={eaten ? "Play again" : "Play animation"}
    >
      <div className="relative w-full" style={{ aspectRatio: `${width}/${height}` }}>
        {frames.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            sizes="25vw"
            // Only frame 1 is worth fetching eagerly; the rest load alongside
            // but must not compete with the page's real above-the-fold work.
            priority={i === 0}
            draggable={false}
            className="object-contain pointer-events-none"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  );
}
