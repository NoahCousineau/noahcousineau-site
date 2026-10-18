"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { useThrowable } from "@/lib/useThrowable";

/**
 * THE C MARK ROLLS IN ALONG THE FOOTER (2026-10-18).
 *
 * Noah: "removing my head on the footer... I want to remove this on desktop.
 * Instead, I would like for my secondary logo (the circular C logo), to take
 * its place. Instead of coming from below, I want this to roll in along the
 * bottom of the browser window. When the user gets to the bottom of the page,
 * the C logo will look like it's just coming to a stop. It will be at a
 * slight angle, not perfectly straight. The user can then throw the C logo
 * around like the other objects on pages. The C logo will also link to the
 * about me page, just as the head does."
 *
 * DESKTOP ONLY. The phone and the in-between tier keep the head exactly as it
 * was — see the mount in Footer.tsx.
 *
 * TWO THINGS DRIVE ONE TRANSFORM, so they take turns rather than fight.
 * Scrolling owns it first: the mark is a wheel, and the reveal spacer's
 * progress is how far it has rolled, so it tracks the scroll in both
 * directions and "comes to a stop" simply because the scroll does. Rotation
 * is not decoration here — it is the distance travelled divided by the
 * radius, which is what makes it read as rolling rather than sliding.
 *
 * Once it arrives, useThrowable takes the same transform over and the mark
 * can be picked up and thrown like the objects on the home grid and the head
 * on the about page. The handover is seamless because the hook starts from
 * translate(0,0) and a rotation seeded through `rotationRef` to exactly the
 * angle the roll finished on. The moment it is grabbed, scrolling gives up
 * control for good — otherwise scrolling back up would snatch a thrown mark
 * out of the air and slide it back to the kerb.
 */

/** Across, as a fraction of the artboard. The head sat here too, under the
 *  right-hand link columns, so the mark takes its place. */
const REST_CENTRE_X_UNITS = (1409.32 + 1630.09 + 204.22) / 2;
/** The head is 300 units wide; the mark matches it. */
const DIAMETER_UNITS = 300;
/** Not perfectly straight, per Noah. The C's opening is what shows the
 *  angle, so this is the whole point of where it stops. */
const REST_DEG = -12;
/** Clear of the left edge before it starts, so it rolls in from off screen. */
const RUN_UP_UNITS = 240;
/** Collision outline. A white-on-transparent raster of the same mark: the
 *  hook decodes it to measure the silhouette, and never displays it. */
const MASK_SRC = "/assets/shared/c-logo-mask.png";

export default function FooterCLogo({
  containerRef,
  triggerRef,
}: {
  /** The footer's artboard. Must be this element's offsetParent. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** The desktop reveal spacer — arriving at the bottom of it is arriving at
   *  the footer, since the footer itself is fixed and never scrolls. */
  triggerRef: React.RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const elRef = useRef<HTMLAnchorElement>(null);
  /** True once the roll has finished and the physics owns the transform. */
  const [settled, setSettled] = useState(false);
  /** Set the instant it is grabbed; scrolling never drives it again. */
  const grabbed = useRef(false);
  /** Distinguishes a click (navigate) from the end of a drag (do not). */
  const dragDistance = useRef(0);

  const { rotationRef } = useThrowable({
    elementRef: elRef,
    containerRef,
    imageSrcs: [MASK_SRC],
    enabled: settled,
    draggable: true,
  });

  /* Seeded before the physics is switched on, so its first frame draws the
     mark exactly where the roll left it rather than snapping upright. */
  const seedRotation = useCallback(() => {
    rotationRef.current = REST_DEG;
  }, [rotationRef]);

  /** Mirrors `settled` for the scroll handler, which must not be rebuilt
   *  every time it changes — rebuilding is what redrew the mark back off
   *  screen the moment it arrived. */
  const settledRef = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    const container = containerRef.current;
    /* THE CURTAIN, NOT THE SPACER (2026-10-18). On desktop the footer is
       fixed behind `.site-content`, which slides up to uncover it; the spacer
       only buys the scroll distance. Measured with the spacer as the trigger:
       progress never left 0 and the mark sat off screen at its starting
       angle through the whole page. The head watches the curtain for the same
       reason — see PeekingHead. */
    const curtain = document.querySelector<HTMLElement>(".site-content");
    const trigger = curtain ?? triggerRef.current;
    if (!el || !container || !trigger) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);

    /** Where it rolls from and how far, in px at the current width. */
    const geometry = () => {
      const unit = container.clientWidth / 1920;
      const radius = (DIAMETER_UNITS * unit) / 2;
      const restCentre = REST_CENTRE_X_UNITS * unit;
      // Far enough left that the whole mark is off screen before it starts.
      const distance = restCentre + radius + RUN_UP_UNITS * unit;
      return { radius, distance };
    };

    const draw = (progress: number) => {
      const { radius, distance } = geometry();
      const remaining = distance * (1 - progress);
      // Rolling, not sliding: the angle IS the arc length over the radius.
      const spin = radius > 0 ? (-remaining / radius) * (180 / Math.PI) : 0;
      el.style.transform = `translate(${-remaining}px, 0px) rotate(${REST_DEG + spin}deg)`;
    };

    const arrive = () => {
      draw(1);
      seedRotation();
      settledRef.current = true;
      setSettled(true);
    };

    if (reduced) {
      // No roll to watch; it is simply already there.
      arrive();
      return;
    }

    const st = ScrollTrigger.create({
      trigger,
      // The curtain's bottom edge crossing the viewport: its whole travel
      // from "the footer starts to show" to "the footer is all there is".
      start: "bottom bottom",
      end: "bottom top",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (grabbed.current) return;
        const p = self.progress;
        if (p >= 0.999) {
          if (!settledRef.current) arrive();
          return;
        }
        if (settledRef.current) {
          settledRef.current = false;
          setSettled(false);
        }
        draw(p);
      },
    });
    // Paint where the scroll actually is, rather than assuming the top.
    if (st.progress >= 0.999) arrive();
    else draw(st.progress);

    return () => st.kill();
  }, [containerRef, triggerRef, seedRotation]);

  return (
    <a
      ref={elRef}
      href="/about"
      aria-label="About me"
      className="absolute block select-none cursor-pointer"
      style={{
        left: `calc(var(--u) * ${REST_CENTRE_X_UNITS})`,
        bottom: 0,
        width: `calc(var(--u) * ${DIAMETER_UNITS})`,
        height: `calc(var(--u) * ${DIAMETER_UNITS})`,
        // Its own centre is the pivot, which is what a wheel turns about.
        marginLeft: `calc(var(--u) * ${-DIAMETER_UNITS / 2})`,
        color: "var(--color-paper)",
      }}
      onPointerDown={() => {
        grabbed.current = true;
        dragDistance.current = 0;
      }}
      onPointerMove={(e) => {
        if (e.buttons) dragDistance.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      }}
      onClick={(e) => {
        // A press that travelled is a throw, not a visit to the about page.
        e.preventDefault();
        if (dragDistance.current <= 4) router.push("/about");
      }}
    >
      {/* Inline rather than an <img> so it takes the footer's own paper
          colour and follows the theme when the footer inverts. */}
      <svg viewBox="0 0 191.54 191.54" width="100%" height="100%" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M95.77,191.54C42.96,191.54,0,148.58,0,95.77S42.96,0,95.77,0s95.77,42.96,95.77,95.77-42.96,95.77-95.77,95.77ZM95.77,8.92C47.88,8.92,8.92,47.88,8.92,95.77s38.96,86.85,86.85,86.85,86.85-38.96,86.85-86.85S143.66,8.92,95.77,8.92Z"
        />
        <path
          fill="currentColor"
          d="M151.56,115.1c-1.59.07-3.22.2-4.78-.04-4.2-.65-8.43-.03-12.63-.51-.92-.11-1.38.28-1.9,1.17-2.01,3.43-3.04,7.25-4.56,10.87-.55,1.31-1.26,2.47-2.04,3.64-1.77,2.68-4.33,4.35-6.92,6.06-6.5,4.29-13.59,6.55-21.41,6.46-7.18-.08-14.13-1.5-20.96-3.52-2.73-.81-5.07-2.27-6.73-4.78-2.12-3.2-4.53-6.2-6.68-9.38-1.63-2.42-2.86-5.03-3.07-8.04-.13-1.76-.57-3.5-.84-5.26-1-6.37-2.15-12.71-1.3-19.23.6-4.6,1.9-8.98,4.06-13.04.75-1.42,1.55-2.81,1.9-4.33.56-2.43,1.57-4.4,3.44-6.18,3.8-3.62,7.31-7.54,10.96-11.32,2.18-2.26,4.53-4.14,7.93-4.19,1.58-.02,3.15-.39,4.72-.66,6.92-1.2,13.81-.9,20.69.36,1.37.25,2.82.15,4.1.87,3.01,1.69,6.16,3.2,7.81,6.53.2.41.53.78.86,1.11,3.04,3.06,5.02,6.7,6.04,10.89.55,2.27.63,2.26,2.93,2.26,4.13,0,8.27-.02,12.4.01,2.03.02,4.08.73,6.25-.35,0-.3.06-.51,0-.67-2.53-6.03-5.07-12.06-7.6-18.1-.29-.7-.64-1.32-1.15-1.9-4.8-5.51-9.51-11.09-14.36-16.55-2.88-3.24-6.69-5.12-10.87-5.94-5.67-1.11-11.4-2.06-17.14-2.72-3.04-.35-6.07-1.3-9.2-.71-2.76.52-5.53,1.11-8.34,1.16-5.37.1-9.77,2.3-14.07,5.38-4.29,3.08-8.51,6.1-11.58,10.48-.86,1.23-1.79,2.4-2.73,3.58-4.03,5.07-7.79,10.31-10.53,16.21-.27.58-.56,1.15-.69,1.82-1.06,5.51-1.97,11.05-3.32,16.49-2.45,9.83-2,19.68-.72,29.56.39,2.98,1.56,5.78,2.3,8.68.93,3.63,1.43,7.47,3,10.81,2.89,6.15,5.67,12.44,10.74,17.32,1.49,1.43,2.94,2.84,4.75,3.84,2.05,1.13,4.12,2.22,6.12,3.43,3.96,2.39,8.08,4.27,12.76,4.8,5.2.59,10.17,2.46,15.52,2.36,3.76-.07,7.45-.48,11.11-1.22,1.83-.37,3.72-.22,5.5-.93,5.91-2.33,11.85-4.6,17.79-6.88,2.27-.87,4.36-1.95,6.12-3.74,2.36-2.41,5.14-4.43,7.36-6.95,4.71-5.37,9.93-10.59,9.39-18.65-.01-.18.12-.36.15-.54.31-2.69.6-5.39.93-8.08.14-1.15-.17-1.77-1.48-1.71Z"
        />
      </svg>
    </a>
  );
}
