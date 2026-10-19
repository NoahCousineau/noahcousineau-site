"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { useThrowable } from "@/lib/useThrowable";
import { whenScrollSettles } from "@/lib/scrollSettled";

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
/** The head was 300 units wide and the mark matched it; Noah asked for "a
 *  bit bigger" on 2026-10-18. */
const DIAMETER_UNITS = 360;
/** Not perfectly straight, per Noah. The C's opening is what shows the
 *  angle, so this is the whole point of where it stops. */
const REST_DEG = -12;
/** Clear of the RIGHT edge before it starts (2026-10-18). Noah: "make sure
 *  we have a sense that it's rolling in from right to left from outside of
 *  the browser when we scroll down." Only just clear: the mark is hidden
 *  behind the curtain until the footer starts to show, so every extra unit
 *  of run-up is distance it has to cover in the same stretch of scrolling,
 *  which is what made it hurry. */
const RUN_UP_UNITS = 140;

/* A TIMED ROLL, NOT A SCRUBBED ONE (2026-10-18, second pass). Noah: "The C
 * is still rolling in aggressively. Let's slow it down a lot and make it
 * feel like it comes to a natural smooth stop."
 *
 * It was tied to the scroll, which meant the reader set its speed: a flick
 * of the wheel threw it across the footer. Worse, the speed could not be
 * reduced much, because the mark is hidden behind the curtain until the
 * footer starts to show — about one screen of scrolling for the whole roll,
 * and easing can only redistribute that, never lengthen it. Measured at the
 * calmest it got that way, it still peaked at 0.91px per pixel scrolled.
 *
 * So arriving at the footer now STARTS a roll of its own, the way the head's
 * rise has always worked, and the clock is the animation's rather than the
 * reader's. That buys the two things asked for: a duration long enough to
 * read, and an ease-out that lands it rather than stopping it. Entering at
 * speed and losing it is also what a real one would do — it arrives already
 * rolling, and friction takes it.
 *
 * Scrolling back up reverses it, matching the head.
 */
const ROLL_SECONDS = 2.6;
/** A beat after reaching the footer before it appears, per Noah's earlier
 *  note. Free now: it no longer costs the roll any of its length. */
const ROLL_DELAY_SECONDS = 0.45;
/** With Reduce Motion on: still an arrival, just a brief one. */
const REDUCED_ROLL_SECONDS = 0.7;
/** Collision outline. A white-on-transparent raster of the same mark: the
 *  hook decodes it to measure the silhouette, and never displays it. */
const MASK_SRC = "/assets/shared/c-logo-mask.png";

/* ON A PHONE IT IS JUST A LOOSE OBJECT (2026-10-18). Noah: "On mobile, I
 * would like for the head in the footer to also be removed. Let's add the C
 * logo in the footer ONLY on pages where there is no finger... treat it how
 * the loose objects on the homepage are. It should be draggable and able to
 * be tilted around with the phone. Its boundary is restricted to the footer
 * area."
 *
 * No roll there: the home grid's objects do not arrive, they sit where they
 * are put until something moves them, and that is the behaviour being
 * matched. The physics is live from the first frame so the phone's tilt can
 * reach it, and the footer's own artboard is the box it cannot leave.
 */
export type CLogoMode = "roll" | "loose";

/** Phone: smaller than the head it replaces, and big enough to catch. */
/* A third smaller, and on the floor of the window (2026-10-18, Noah). */
const LOOSE_DIAMETER_UNITS = 505;
const LOOSE_CENTRE_X_UNITS = 960;
const LOOSE_BOTTOM_UNITS = 0;

export default function FooterCLogo({
  containerRef,
  triggerRef,
  mode = "roll",
}: {
  /** The footer's artboard. Must be this element's offsetParent, and it is
   *  also the boundary the physics keeps it inside. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** The desktop reveal spacer — arriving at the bottom of it is arriving at
   *  the footer, since the footer itself is fixed and never scrolls. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  mode?: CLogoMode;
}) {
  const loose = mode === "loose";
  const diameter = loose ? LOOSE_DIAMETER_UNITS : DIAMETER_UNITS;
  const router = useRouter();
  const elRef = useRef<HTMLAnchorElement>(null);
  /** True once the roll has finished and the physics owns the transform. */
  const [settled, setSettled] = useState(false);
  /** Set the instant it is grabbed; scrolling never drives it again. */
  const grabbed = useRef(false);

  const { rotationRef, reset } = useThrowable({
    elementRef: elRef,
    containerRef,
    imageSrcs: [MASK_SRC],
    // The tween owns the transform until the mark arrives; the physics
    // takes over at the end of the roll, in both modes.
    enabled: settled,
    draggable: true,
    tilt: loose,
    // Fired only when the press never became a drag.
    onClick: () => router.push("/about"),
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
    /* THE PHONE MARK ROLLS IN TOO (2026-10-19). Noah: "Let's make sure it
       doesn't start centered, but also rolls in. The size of it is good
       though."

       It used to be placed straight at its resting spot with the physics
       live from the first frame, so the phone footer always opened with the
       mark already sitting in the middle of it. It takes the same roll as
       the desktop one now. What stays different is where it stops, how big
       it is, and that a tilt can move it once it has landed.

       THE CURTAIN, NOT THE SPACER (2026-10-18), on desktop only. There the
       footer is fixed behind `.site-content`, which slides up to uncover
       it; the spacer only buys the scroll distance. Measured with the
       spacer as the trigger: progress never left 0 and the mark sat off
       screen at its starting angle through the whole page. On a phone there
       is no curtain — the footer is an ordinary element that scrolls — so
       the trigger is the footer itself. */
    const curtain = loose ? null : document.querySelector<HTMLElement>(".site-content");
    const trigger = curtain ?? triggerRef?.current ?? null;
    if (!el || !container || !trigger) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);

    /** Where it rolls from and how far, in px at the current width. */
    const geometry = () => {
      const width = container.clientWidth;
      const unit = width / 1920;
      const radius = (diameter * unit) / 2;
      const restCentre = (loose ? LOOSE_CENTRE_X_UNITS : REST_CENTRE_X_UNITS) * unit;
      // It starts beyond the RIGHT edge, far enough out to be fully hidden,
      // and rolls leftward to its resting place.
      const startCentre = width + radius + RUN_UP_UNITS * unit;
      return { radius, distance: startCentre - restCentre };
    };

    const draw = (progress: number) => {
      const { radius, distance } = geometry();
      // How far to the RIGHT of its resting place it still is.
      const remaining = distance * (1 - progress);
      /* Rolling, not sliding: the angle IS the arc length over the radius.
         Travelling left turns it anticlockwise, so the angle unwinds down to
         the resting one as it arrives. */
      const spin = radius > 0 ? (remaining / radius) * (180 / Math.PI) : 0;
      el.style.transform = `translate(${remaining}px, 0px) rotate(${REST_DEG + spin}deg)`;
    };

    const arrive = () => {
      draw(1);
      seedRotation();
      settledRef.current = true;
      setSettled(true);
    };

    /* REDUCED MOTION STILL ROLLS (2026-10-18). Noah: "The C is still showing
       up preloaded as well. This must be corrected."
       
       This used to skip the roll entirely and place the mark at rest, which
       is precisely "preloaded" — and on every page, for anyone with Reduce
       Motion switched on in their system settings. None of my tests emulated
       that setting, which is why I could not reproduce it; emulating it
       reproduced it first try (arrival x=1277, rolled=false).
       
       The setting asks for less motion, not for none at all on a decorative
       mark, so it gets a short, gentle version rather than being denied the
       arrival altogether. */

    /* A proxy the tween animates; `draw` turns it into the transform. */
    const state = { v: 0 };
    draw(0);

    const roll = gsap.to(state, {
      v: 1,
      duration: reduced ? REDUCED_ROLL_SECONDS : ROLL_SECONDS,
      delay: reduced ? 0 : ROLL_DELAY_SECONDS,
      // Enters with speed and loses it, which is how a rolling thing stops.
      ease: "power2.out",
      paused: true,
      onUpdate: () => {
        if (!grabbed.current) draw(state.v);
      },
      onComplete: () => {
        if (!grabbed.current) arrive();
      },
    });

    const st = ScrollTrigger.create({
      trigger,
      /* NEAR THE END OF THE REVEAL, NOT THE START (2026-10-18). Noah: "the C
         logo doesn't always roll in. Sometimes it's already loaded on the
         page. Make sure that there's a sense that it's rolling in smoothly
         the same way and the same time on every page on desktop."

         It used to set off the moment the curtain's bottom edge cleared the
         foot of the screen — the first instant the mark COULD be seen. On a
         short page that happens early in the scroll, so the roll finished
         before the reader had arrived and the mark was simply sitting there;
         on a long one it was still rolling when they got there. Measured
         1.2s after reaching the bottom: /, /about and /work were already at
         rest while socal-earth and more-work were still at 1309 and 1453.

         Firing when the reveal is about two thirds done ties it to arriving
         rather than to the page's length, so every page gets the same roll
         at the same moment — and, because the mark is only grabbable once it
         lands, the same is now true of picking it up. */
      /* Desktop watches the reveal and fires when it is about two thirds
         done; the phone watches the footer itself and fires once it is
         better than half on screen, which is the same moment in feel — the
         mark is rolling as the footer arrives rather than waiting for it. */
      start: loose ? "bottom bottom+=40%" : "bottom top+=35%",
      onEnter: () => {
        roll.play();
      },
      /* A THROWN MARK IS NOT SPECIAL ANY MORE (2026-10-19). Noah:
         "everytime we see the footer, it should reset to it's default state
         with the C rolling in". This used to bail out the moment the mark
         had been picked up — scrolling never drove it again for the rest of
         the page's life — so a reader who threw it once got a footer with
         the mark lying wherever it had landed, from then on.

         Order matters: hand the transform back to the tween BEFORE
         reversing, and zero the physics before that, or the two spend the
         reverse writing over each other. `reset` puts it back at its
         layout home, which is where `draw` measures the roll from. */
      onLeaveBack: () => {
        grabbed.current = false;
        if (settledRef.current) {
          settledRef.current = false;
          setSettled(false);
        }
        reset();
        roll.reverse();
      },
    });

    /* ALWAYS THE SAME ROLL (2026-10-18). Arriving with the footer already
       uncovered — a reload at the bottom, or a browser restoring the scroll
       position — never fires onEnter, so the mark would simply be THERE.
       It plays the whole roll instead. A shortened one was tried first and
       is exactly what Noah objected to: a different animation depending on
       how the reader got there.

       Asked once the scroll has settled, not at mount: see whenScrollSettles
       for what reading it too early did on a click-through. */
    const stopWaiting = whenScrollSettles(() => {
      if (st.progress > 0) roll.play();
    });

    return () => {
      stopWaiting();
      roll.kill();
      st.kill();
    };
  }, [containerRef, triggerRef, seedRotation, loose, rotationRef, diameter, reset]);

  return (
    <a
      ref={elRef}
      href="/about"
      aria-label="About me"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className="absolute block select-none"
      style={{
        left: `calc(var(--u) * ${loose ? LOOSE_CENTRE_X_UNITS : REST_CENTRE_X_UNITS})`,
        bottom: `calc(var(--u) * ${loose ? LOOSE_BOTTOM_UNITS : 0})`,
        width: `calc(var(--u) * ${diameter})`,
        height: `calc(var(--u) * ${diameter})`,
        // Its own centre is the pivot, which is what a wheel turns about.
        marginLeft: `calc(var(--u) * ${-diameter / 2})`,
        color: "var(--color-paper)",
        /* IT IS A THING TO PICK UP, NOT A LINK TO CLICK (2026-10-18). Noah:
           "the drag feature is awkward because it's showing a link to the
           about me page rather than being able to be thrown." An <a> is
           draggable by default, so grabbing it started the browser's own
           link-drag — complete with a ghost image — and the physics never
           saw the gesture. `draggable={false}` and the dragstart guard above
           stop that; the grab cursor says what it is now. Clicking still
           goes to the about page. */
        cursor: "grab",
        WebkitUserDrag: "none",
        WebkitTouchCallout: "none",
      } as React.CSSProperties}
      onPointerDown={() => {
        grabbed.current = true;
      }}
      /* The browser must never follow this href itself: useThrowable decides
         whether a press was a click or a drag, using the same threshold and
         the same samples it uses to throw the thing, and only then is the
         about page the right answer. Deciding it here in parallel was a
         second, worse judge of the same question — a short or slow drag
         counted as a click and navigated away mid-throw, which is what "I
         still can't drag the C logo" looks like from the other side. */
      onClick={(e) => e.preventDefault()}
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
