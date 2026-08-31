"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { useIsPhone } from "@/lib/useIsPhone";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stage, Place } from "./Stage";
import { FitText } from "./FitText";

/**
 * DESCRIPTION — master slice y1000–2366.
 * Editorial: three big single lines at x36 (Akzidenz Regular, no bold — per
 * spec), with Quinn Text Italic emphasis on "graphic designer" and "visual
 * problems"; thin horizontal RULES sit in the gaps between lines, PLUS one
 * more rule directly under "His work can be seen below" (previously missing).
 * Pointing finger (drop shadow) rotates on scroll: "resistance at first,
 * then swings down fast with easy ease." FitText caps every line at the
 * artboard's right margin (x1877, i.e. 1841 units from x36).
 */
/*
 * WHERE THE LINES SIT. Desktop keeps its measured positions exactly — first
 * line at y381, then a 184-unit pitch, with the rule 141 below each line.
 *
 * The phone reuses that rhythm on its own narrower artboard (see
 * PHONE_ARTBOARD): the numbers are the same, but a unit is nearly twice as
 * many pixels there, so the type comes out roughly twice the size without
 * any of it being rescaled by hand — the same device the hero and the
 * project grid use.
 *
 * At module scope since 2026-08-25 because the phone's closer position is now
 * DERIVED from them rather than written out as its own number.
 */
const LINE_TOP = 381;
const LINE_PITCH = 184;
const RULE_OFFSET = 141;
const lineY = (i: number) => LINE_TOP + i * LINE_PITCH;
/** The foot of the first paragraph on a phone: the rule under its fifth line,
 *  plus that rule's own 6-unit weight. */
const PHONE_PARA1_BOTTOM_UNITS = LINE_TOP + 4 * LINE_PITCH + RULE_OFFSET + 6;

/* Vertical centre of the three-line block, artboard units: the top of line 1
 * (y381) to the rule under line 3 (y882). 2026-08-23, Noah: "let's have the
 * 'Noah Cousineau is a graphic...' information stop scrolling in the center
 * of the page" — the pin used to start at `top top`, which parks the STAGE's
 * top edge at the viewport's top and leaves the type wherever that happens to
 * put it. Starting the pin a measured distance earlier or later instead lands
 * this point on the viewport's middle at every window size. */
const LINES_CENTER_UNITS = (381 + 882) / 2;
/** The same midpoint for the phone's five lines: first line's top to the last
 *  line's rule. Kept beside the desktop one so the pair stay comparable. */
const PHONE_LINES_CENTER_UNITS = (381 + (381 + 4 * 184 + 141)) / 2;

/** Top of "His work can be seen below.", artboard units. */
const LINE4_TOP_UNITS = 1387;
/** A phone screen's HEIGHT expressed in this artboard's units, for the
 *  server render and the first client render. 844px at u = 390/1000 is 2164;
 *  the hook below replaces it with the real one as soon as there is a window
 *  to measure. */
const PHONE_SCREEN_UNITS_FALLBACK = 2164;

/**
 * One phone screen, in artboard units, measured.
 *
 * IT HAS TO BE MEASURED, and that is the whole reason this exists rather than
 * being another constant. `--u` is derived from the viewport's WIDTH
 * (`100cqw / 1000`), so a distance written in units is a fixed fraction of
 * the width and has no fixed relationship to the height at all. "One screen
 * down" is a height, and the two only agree on one device.
 *
 * That is exactly how the old `+ 700` went wrong: 700 units reads like a
 * screen and is 273px on a 390px-wide phone, less than a third of an 844px
 * one.
 */
function usePhoneScreenUnits(phone: boolean) {
  const [units, setUnits] = useState(PHONE_SCREEN_UNITS_FALLBACK);
  useEffect(() => {
    if (!phone) return;
    const measure = () =>
      setUnits(window.innerHeight / (window.innerWidth / PHONE_ARTBOARD));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [phone]);
  return units;
}

/** The Stage's own height, artboard units — 2460 -> 1810, 2026-08-23 per
 *  Noah: "There's now a lot of space between the hand and the project grid
 *  so let's reduce that as well." This governs the RUN-OUT: how much
 *  document space Stage reserves after the pin releases before Projects
 *  begins. Only needs to clear the rule at y1528 (+ its 6u) with a
 *  deliberate but no longer padded-out gap — the outer clip that used to
 *  make this number load-bearing for containment is gone (see the note at
 *  the Stage below), so this is purely a spacing choice now. */
const STAGE_HEIGHT_UNITS = 1500;
/*
 * PHONE (2026-08-25). Noah: "Increase the size of the arrow hand. Bring up
 * the grid content to be closer to the arrow hand."
 *
 * The hand is scaled rather than repositioned: it rests with its tip on the
 * rule and its fall is measured live at the moment it is thrown, so both
 * follow the size automatically. 0.75 -> 1.5 doubles it, which on a 390px
 * screen takes it from a 90px prop to a 180px one.
 *
 * The run-out is the Stage height, which is document space reserved after
 * the pin releases and before Projects begins — nothing is drawn in it. On a
 * phone that is a whole screen of blank scrolling between the hand landing
 * and the first tile, so it comes down to just past the rule at y1528.
 */
/*
 * The phone's own artboard, 1000 units wide against the page's 1920 — the
 * same device the hero and the project grid use, and for the same reason.
 * Every coordinate below keeps working; a unit is simply nearly twice as many
 * pixels, so the copy comes out roughly twice the size without any of it
 * being rescaled by hand. Noah: "Scale the text up accordingly."
 */
const PHONE_ARTBOARD = 1000;

/*
 * THE HAND, ON A PHONE (2026-08-25).
 *
 * Noah: "For the arrow hand on mobile, please scale this up by 50%. Have it
 * lower on the screen, it's currently conflicting with the 'his work can be
 * seen below' area." And: "scoot up the project grid so that it's a quarter
 * of the screen height away from the bottom of the hand."
 *
 * The artwork is 308 units wide in its Place and 1597x2719 native, so 524
 * tall; the scale is taken about the box's own centre. Everything below is
 * derived from those two numbers rather than typed in, because the last
 * round's version had the hand ABOVE the closer once the closer moved down a
 * screen — positions that are written out separately drift apart the moment
 * one of them moves.
 *
 * 2026-08-25: "on mobile the arrow hand is too large, let's reduce it by
 * 75%." 2.25 x 0.25. At 2.25 the hand was 693 units wide, which on the
 * 1000-unit phone artboard is 69% of the screen — the reduction is as large
 * as it is because the starting point was that far out. It lands at 173
 * units, 17% of the screen, against the desktop hand's 12% of a 1512 window:
 * the same kind of accent at each size rather than the phone's centrepiece.
 */
/* ...and back up 1.5x on 2026-08-29: "the arrow hand is a bit too small on
 * the mobile home screen. Let's increase the size by 1.5x." 0.5625 -> 0.84375,
 * which lands the hand at 260 units of the 1000-unit phone artboard, 26% of
 * the screen. The -75% before it had overshot. */
const PHONE_HAND_SCALE = 2.25 * 0.25 * 1.5;
const HAND_BOX_W = 308;
const HAND_BOX_H = 524;
/** How far the hand's centre hangs below the closer's last rule. Was the
 *  difference between two written-out numbers (3000 against a rule at 2247);
 *  kept as that same 753 now that the closer's position is derived, so the
 *  hand travels with it instead of being left behind when the gap grows. */
const PHONE_HAND_DROP_UNITS = 753;
/** A quarter of a phone screen, in this artboard's units: 844px at
 *  u = 390/1000 is 2164 units, so a quarter is 541. */
/* 541 -> 240, 2026-08-29: "on the mobile home screen, let's reduce the amount
 * of space between the project grid and the bottom of the hand by a decent
 * amount." 541 was a quarter of a phone screen, chosen when the hand was more
 * than three times its current size and needed the room; the hand has since
 * been cut to 0.84 scale and the gap was left holding nothing. */
const PHONE_GRID_GAP_UNITS = 240;
/* The run-out — document space reserved after the pin releases and before
 * Projects begins. On a phone it has to clear the hand, which now hangs well
 * below where the copy ends, plus the quarter-screen gap Noah asked for. */
const phoneStageHeightUnits = (handCentreY: number) =>
  handCentreY + (HAND_BOX_H * PHONE_HAND_SCALE) / 2 + PHONE_GRID_GAP_UNITS;
/** Where that line comes to rest, as a fraction of viewport height from the
 *  top. Noah: "stop scroll about 3/4 up the page" — three quarters of the way
 *  UP is a quarter of the way DOWN — then, once he saw it: "let's shift the
 *  'his work can be seen below' and the hand up slightly more." 0.25 -> 0.17. */
const LINE4_TARGET_TOP = 0.17;

/* The fingertip, as a percentage of the hand artwork's own box — measured off
 * pointing-hand.png's alpha (topmost opaque pixel, 519/1597 across and
 * 23/2719 down). The twang rotates about this point, so it is the one pixel
 * that never moves: an arrow buried in a target vibrates along its shaft
 * while its head stays put. */
const HAND_TIP = { xPct: 32.5, yPct: 0.85 };

export default function Description() {
  const phone = useIsPhone();
  /* Declared up here because the scroll effects below close over them. */
  /* A WHOLE SCREEN BETWEEN THE PARAGRAPHS (2026-08-25). Noah: "let's make
   * sure that the two descriptive paragraphs don't appear on the screen at
   * the same time. Add enough space to make this possible."
   *
   * Both paragraphs live in the same `root`, which the timeline translates
   * rigidly — so the distance between the foot of the first and the top of
   * the second is CONSTANT on screen, whatever the scroll is doing. That
   * makes the condition exact rather than a matter of taste: they can never
   * share a screen precisely when that distance is at least one viewport
   * tall, and the gap only has to be measured, not tuned.
   *
   * It was 664 units, which is 259px of an 844px screen — measured, both
   * paragraphs were co-visible across about 800px of scrolling. */
  const phoneScreenUnits = usePhoneScreenUnits(phone);
  const phoneCloserY = PHONE_PARA1_BOTTOM_UNITS + phoneScreenUnits;
  const closerY = phone ? phoneCloserY : LINE4_TOP_UNITS;
  const phoneHandCentreY =
    phoneCloserY + LINE_PITCH + RULE_OFFSET + PHONE_HAND_DROP_UNITS;
  const linesCentre = phone ? PHONE_LINES_CENTER_UNITS : LINES_CENTER_UNITS;
  const root = useRef<HTMLDivElement>(null);
  /** Carries the fall. Unrotated, so its `y` is plain screen-space travel. */
  const handDropRef = useRef<HTMLDivElement>(null);
  /** Carries the vibration, pivoting on the fingertip. */
  const handTwangRef = useRef<HTMLDivElement>(null);
  // The element ScrollTrigger pins while the three lines reveal.
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const stage = pinRef.current;
      if (!stage) return;

      /** Live value of one artboard unit in px.
       *
       * DIVIDED BY THE ARTBOARD THIS SECTION IS ACTUALLY DRAWN ON, which was
       * not true until 2026-08-25 and is a real bug rather than a tidy-up.
       * The constant 1920 was correct when this was the only canvas on the
       * page; the phone layout then gave the section its own narrower one
       * (PHONE_ARTBOARD, declared as `--u: calc(100cqw / 1000)` on the
       * wrapper below) so the existing coordinates would render at nearly
       * twice the size, and this kept dividing by 1920.
       *
       * Measured on a 390px screen: a rule declared 928 units wide renders
       * 361.9px, so one unit is 0.390px — while this returned 390/1920 =
       * 0.203, low by exactly the 1920/1000 artboard ratio. Every phone
       * scroll number derived from it was therefore about half of what it
       * should have been: the pin's start offset, docTop's use below, and
       * above all the line-4 travel, which is why the closer never climbed
       * far enough to get the screen to itself. Desktop is unaffected — the
       * artboard there IS 1920, so the value is unchanged at 0.7875. */
      const uPx = () => stage.offsetWidth / (phone ? PHONE_ARTBOARD : 1920);
      /** Document-space top, via offset parents, so a transform on the stage
       *  (or ScrollTrigger's own pin spacer) can't skew the reading. */
      const docTop = () => {
        let y = 0;
        let el: HTMLElement | null = stage;
        while (el) {
          y += el.offsetTop;
          el = el.offsetParent as HTMLElement | null;
        }
        return y;
      };

      /* THE HAND IS AN ARROW NOW (2026-08-23, per Noah: "I think what would be
       * more interesting though is if it fell from above while the user was
       * reading 'his work can be seen below'. It would be fun if it shot down
       * like an arrow and then stopped and twanged in place. The tip of the
       * hand would be like the tip of the arrow and would be where it
       * currently is on the page.")
       *
       * It used to rotate from pointing-up to pointing-down, scrubbed against
       * the section's own scroll. That tween is gone; the hand now sits off
       * the top of the screen until the reader arrives at the last line.
       *
       * NOT SCRUBBED, unlike everything else in this component. A twang is a
       * decaying oscillation with its own tempo — scrubbing it would hand the
       * reader a wheel that drives the vibration back and forth, which reads
       * as a slider, not as an impact. It is fired once from the pinned
       * timeline and then plays at its own speed. */
      /* HIDDEN UNTIL IT IS THROWN, rather than parked at a fixed offset above
       * its resting place. The first version set y to -0.95 of a viewport and
       * left it at that: but the hand's resting spot is at y1600 on the
       * artboard, roughly 1200px below the fold while the three lines are
       * held, so shifting it up by 855px did not take it off the screen — it
       * brought it ON, straight across "who uses wit, play, and humor". Hiding
       * it outright is the honest expression of "it isn't here yet", and it
       * costs nothing to measure the real distance at the moment it is needed. */
      if (handDropRef.current) gsap.set(handDropRef.current, { autoAlpha: 0 });

      /* FIRES AGAIN ON THE WAY BACK UP (2026-08-25).
       *
       * Noah: "it's odd to see it appear once again when the user scrolls
       * down to the projects and then back up. Have it so if the user scrolls
       * back up to the 'Noah Cousineau is a graphic designer...' text, then
       * the hand arrow animation replays."
       *
       * The throw is not part of the scrubbed timeline — it is a separate
       * timeline that `tl.call` starts, so it plays at its own speed rather
       * than being dragged by the scroll wheel. `tl.call` DOES fire in both
       * directions as the playhead crosses it, so what stopped the replay was
       * this one-shot flag, and the fix is to clear it whenever the reader
       * leaves the pinned section: cross back up and the call point fires
       * again with a clean flag.
       *
       * Cleared on the way DOWN too (onLeave), which is what makes the return
       * trip replay, and the hand is left visible there — it has landed, and
       * hiding it as the reader scrolls away from something they just watched
       * arrive would be its own kind of odd. Going up past the START hides it
       * instead, because at that point it has not been thrown yet.
       */
      /* THE THROW IS ONCE PER VISIT FROM THE TOP (2026-08-25).
       *
       * Noah: "the arrow hand interaction is better. It's still reappearing a
       * bit too soon. Let's only have it fall again if the user scrolls all
       * the way to the top of the page."
       *
       * Until now the one-shot flag was cleared on BOTH exits from the pinned
       * section, so any scroll that left the section and came back threw the
       * hand again — a few hundred pixels of travel was enough to re-arm it,
       * which is the "too soon" he is describing. Clearing it is now the job
       * of one trigger at the very top of the document and nothing else.
       *
       * That splits what used to be a single `resetHand(hide)` into three
       * separate things, because the old function conflated them and the
       * whole bug was that arming came along for free with hiding:
       *
       *   hideHand   — take it off the screen, LEAVING the flag set
       *   showLanded — put it back in its landed pose, no throw
       *   armHand    — the only thing that lets it fall again
       *
       * showLanded is what stops "no replay" from meaning "no hand": coming
       * back up into the section after it has already fallen, the hand is
       * simply there, at rest, the way it was left. The reader sees the
       * arrival gesture once per trip down the page, and the composition is
       * never missing a piece in between. */
      let handFired = false;
      let handShot: gsap.core.Timeline | null = null;
      // Killing a throw mid-flight used to strand the hand 773px above its
      // resting place and fully VISIBLE. Hiding in the same breath is what
      // makes it safe: an interrupted throw that is also invisible has
      // nothing to strand.
      const hideHand = () => {
        handShot?.kill();
        handShot = null;
        if (handDropRef.current) {
          gsap.set(handDropRef.current, { autoAlpha: 0, y: 0 });
        }
      };
      const showLanded = () => {
        handShot?.kill();
        handShot = null;
        if (handDropRef.current) {
          gsap.set(handDropRef.current, { autoAlpha: 1, y: 0 });
        }
        if (handTwangRef.current) gsap.set(handTwangRef.current, { rotate: 0 });
      };
      const armHand = () => {
        handFired = false;
        hideHand();
      };
      const fireHand = () => {
        if (handFired || !handDropRef.current) return;
        handFired = true;
        const el = handDropRef.current;
        // A fast scrub can cross the call point again before the previous
        // throw has finished; without this they would run on top of one
        // another and fight over `y`.
        handShot?.kill();
        // Measure where it is about to land, then start from just past the
        // top of the window — whatever that distance happens to be at this
        // viewport and this point in the timeline.
        gsap.set(el, { y: 0, autoAlpha: 1 });
        const from = -(el.getBoundingClientRect().bottom + 40);
        const shot = gsap.timeline();
        handShot = shot;
        // Accelerating into the landing: an arrow is fastest at the moment
        // it hits, which is what sells the stop.
        shot.fromTo(el, { y: from }, { y: 0, duration: 0.4, ease: "power3.in" });
        if (handTwangRef.current) {
          shot.to(handTwangRef.current, {
            keyframes: [
              { rotate: 7.5, duration: 0.1, ease: "sine.out" },
              { rotate: -5.2, duration: 0.13, ease: "sine.inOut" },
              { rotate: 3.4, duration: 0.12, ease: "sine.inOut" },
              { rotate: -2.1, duration: 0.11, ease: "sine.inOut" },
              { rotate: 1.2, duration: 0.1, ease: "sine.inOut" },
              { rotate: -0.6, duration: 0.09, ease: "sine.inOut" },
              { rotate: 0, duration: 0.08, ease: "sine.inOut" },
            ],
          });
        }
      };

      /* LINE REVEAL, HELD (2026-08-20, per Noah: "I also want the site to
       * feel like it's holding on this more. As we [scroll] down to this
       * section, the site should feel as if its still. Have the first line
       * appear and then hold for a bit of scrolling. Then the same for the
       * next line, then the last. We can then scroll down into the project
       * areas.")
       *
       * The section PINS: for the length of the sequence the page stops
       * travelling and the reader's scrolling is spent revealing lines
       * instead. That is what produces "feel as if it's still" — a plain
       * scrubbed reveal would still be sliding the whole section up the
       * screen while the lines arrived.
       *
       * The holds are empty tweens between the reveals. Scrub maps scroll
       * distance onto timeline time, so a stretch of timeline where nothing
       * animates becomes a stretch of scrolling where nothing moves — which
       * is exactly the beat Noah asked for after each line.
       *
       * Each line rises out from behind its own rule: line 1 sits above the
       * rule at y522, line 2 above y706, line 3 above y882, and each is
       * wrapped in an overflow-hidden mask whose bottom edge is that rule.
       * Translating the type down by more than its own height parks it
       * entirely behind the rule; animating back to 0 makes it rise out.
       *
       * yPercent (not a pixel offset) because these lines are set in
       * artboard units and rescale with the viewport — a fixed pixel offset
       * would under- or over-hide the type at other widths. 135 rather than
       * a bare 100 covers the mask's descender padding too (see the masks
       * in the markup below), so nothing peeks above the rule at rest. */
      const lines = gsap.utils.toArray<HTMLElement>(".js-desc-line");
      gsap.set(lines, { yPercent: 135 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          /* CENTRED, not top-aligned. A numeric start (a scroll position in
           * px) rather than "top top": the pin has to begin wherever puts
           * LINES_CENTER_UNITS on the viewport's middle, and that offset
           * depends on both the viewport height and the current unit size,
           * neither of which a keyword can express. Re-read on every refresh
           * so a resize re-centres rather than drifting. */
          start: () =>
            docTop() - (window.innerHeight / 2 - linesCentre * uPx()),
          /* Three reveals and their holds, then the travel down to the last
             line and its own beat — see the phases below.

             HALF AS LONG ON A PHONE (2026-08-30). Noah: "there's too much
             space between the individual sections." Measured at 390px, this
             was the entire complaint: 320% of the viewport is 2701px of
             scrolling between the pointing hand and the first project, and
             the measurement of the page's largest empty run came back at
             exactly 2701px. On a desktop that is a mouse wheel and a big
             screen; on a phone it is three and a third screens of thumb for
             two lines of type, with nothing arriving in between.

             The reveal itself is unchanged — the same phases, the same
             holds, scrubbed against a shorter runway, so it simply plays at
             a pace that suits the way the page is actually being scrolled. */
          /* 320% -> 220% on a desktop, 160% -> 110% on a phone (2026-08-30).
             Noah: "remove a lot of the blank space... the site feels void at
             times when scrolling. Use your best judgement."
             
             This number IS the blank space. It is the scroll distance the
             pinned reveal occupies, and measured as the page's largest empty
             run at every width: 2388px on a desktop and 1428px on a phone
             even after the first halving. The reveal itself is unchanged —
             same phases, same holds, scrubbed against a shorter runway — so
             what goes is the dead scrolling between beats, not any of the
             beats. */
          end: () => (phone ? "+=110%" : "+=220%"),
          pin: true,
          anticipatePin: 1,
          scrub: 0.6,
          invalidateOnRefresh: true,
          /* BOTH EXITS HIDE IT NOW (2026-08-25). Noah: "the arrow hand is
           * 'glitching' in and out when we scroll back up. Have it completely
           * disappear after the user sees the project pages. It only
           * reappears after the user scrolls all the way back up."
           *
           * The previous version cleared the flag on the way down but left
           * the hand where it landed, on the grounds that hiding something
           * the reader just watched arrive is its own kind of odd. What that
           * actually produced is the flicker he is describing: the hand stays
           * on the page below the fold, and every small scroll near the
           * boundary re-crosses the call point and throws it again, so it
           * blinks in and out around the seam. Hiding on exit removes the
           * thing that can blink — past the section there is nothing to see,
           * and coming back up plays the throw once, cleanly, from the top. */
          /* The DOWNWARD exit only clears the flag; hiding is handled by the
           * separate trigger below, which waits until the section has
           * genuinely left the screen. This one fires at the END OF THE PIN,
           * which is still a run-out short of the project grid — hiding here
           * made the hand vanish at the very moment it is supposed to be
           * pointing at what comes next. */
          /* Neither exit re-arms any more — see the note on armHand above.
             Going DOWN past the pin's end the hand is left exactly where it
             landed, because that run-out is where it is pointing at the grid.
             Going UP past the pin's start it has no business being on screen,
             so it is hidden — but the flag stays set, so coming back down
             shows it landed rather than throwing it again. */
          onLeaveBack: hideHand,
        },
      });

      const REVEAL = 1;
      const HOLD = 0.85;
      lines.forEach((line, i) => {
        tl.to(line, { yPercent: 0, duration: REVEAL, ease: "power3.out" });
        // A hold after every line, including the last, so the third line
        // gets a beat to land before the page starts moving again.
        tl.to({}, { duration: i === lines.length - 1 ? HOLD * 0.7 : HOLD });
      });

      /* LINE 4 — "His work can be seen below."
       *
       * NOW PART OF THE PINNED TIMELINE (2026-08-23). It used to run on its
       * own scrubbed trigger, because while the section was pinned at its
       * top edge this line — a full screen further down the artboard — was
       * still below the fold, so a slot in the sequence would have played
       * its whole reveal unseen. Noah: "I also want the 'His work can be
       * seen below' to stop scroll about 3/4 up the page", which it cannot
       * do while the thing it lives in is what is being held still.
       *
       * So the pin now covers this too, and the content TRAVELS inside it:
       * with the stage held, sliding `root` up by a measured amount brings
       * the line from below the fold to a quarter down the screen, and the
       * hold that follows is it "stopping" there. Scrub means a stretch of
       * timeline with nothing animating is a stretch of scrolling with
       * nothing moving, which is the same trick the holds between lines 1-3
       * already use — the line genuinely stops, rather than easing to a
       * near-halt. Travelling the CONTENT instead of releasing the pin is
       * what keeps that stop under the timeline's control. */
      const line4 = root.current?.querySelector<HTMLElement>(".js-desc-line-4");
      if (line4) gsap.set(line4, { yPercent: 135 });

      /* Δ = (how far the block's centre sits above the viewport middle) +
       * (how far line 4 sits below that centre on the artboard), which lands
       * line 4's top exactly LINE4_TARGET_TOP down the screen. A function so
       * it is re-measured on resize rather than baked in at build time. */
      tl.to(root.current, {
        y: () =>
          -(
            window.innerHeight * (0.5 - LINE4_TARGET_TOP) +
            (closerY - linesCentre) * uPx()
          ),
        duration: 1.7,
        ease: "none",
      });

      if (line4) tl.to(line4, { yPercent: 0, duration: REVEAL, ease: "power3.out" });
      // The arrow arrives once the line is standing and readable.
      /* GONE ONCE THE SECTION IS GONE (2026-08-25). Noah: "the arrow hand is
       * 'glitching' in and out when we scroll back up. Have it completely
       * disappear after the user sees the project pages. It only reappears
       * after the user scrolls all the way back up."
       *
       * The flicker came from the hand outliving its own section: it stayed
       * on the page below the fold, and small scrolls near the pin's boundary
       * re-crossed the call point and threw it again, so it blinked around
       * the seam. This hides it the moment the whole section has passed the
       * top of the window — well after the pin ends, so the hand still gets
       * to point at the grid on the way out — and re-arms it only when the
       * reader comes back above that line, which is what "all the way back
       * up" means. */
      ScrollTrigger.create({
        // The PIN, not the inner content box. `root` is absolutely positioned
        // inside a pinned Stage, so its bottom edge is a fixed-position number
        // that never passes anything — measured at the foot of the page it
        // read -1252 while this trigger had never fired. The pinned element
        // has a real spacer in the document, so "bottom top" on it means what
        // it says: the section, run-out included, has left upward.
        trigger: pinRef.current,
        start: "bottom top",
        onEnter: hideHand,
        // Back into view from below: restore the landed pose rather than
        // re-throwing, which is the whole point of the 2026-08-25 change.
        onLeaveBack: () => {
          if (handFired) showLanded();
        },
      });

      /* THE ONLY THING THAT RE-ARMS THE THROW: being at the top of the page.
       *
       * An absolute scroll position rather than an element, because "the top
       * of the page" is not any one element's edge — it is scroll zero. The
       * 2px start is what makes `onLeaveBack` mean "came back to rest at the
       * very top" instead of firing on sub-pixel jitter around 0 while Lenis
       * settles. */
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: "top top-=2",
        onLeaveBack: armHand,
      });

      tl.call(fireHand);
      // The beat Noah wants the reader to spend on that line, with the hand
      // landing into it. Long enough to cover the shot and its twang.
      tl.to({}, { duration: HOLD * 2.2 });
    }, root);
    return () => ctx.revert();
    /* REBUILT WHEN THE LAYOUT SWITCHES, and it has to be. `useIsPhone` answers
     * false for the server render and the first client render, so on a phone
     * this timeline is first built against the DESKTOP centring and closer
     * position; without these dependencies it would keep them, and the pin
     * would hold the wrong point on the viewport's middle for the whole
     * session. gsap.context + revert() means rebuilding is clean. */
  }, [closerY, linesCentre, phone]);

  const serif = { fontFamily: "var(--font-serif)" };

  /*
   * THE COPY, AS DATA, BECAUSE THE TWO LAYOUTS BREAK IT DIFFERENTLY
   * (2026-08-25).
   *
   * Noah, for phones: "Let's break this into a few more lines... 'Noah
   * Cousineau is a / graphic designer who / uses wit, play, and / humor to
   * solve / your visual problems.'" and "'His work can / be seen below'".
   *
   * Same sentence, different breaks — five lines instead of three, and the
   * italic runs land in different places because of it ("graphic designer"
   * opens a line here and closes one there). Writing the JSX out twice would
   * mean two copies of the sentence that have to be kept saying the same
   * thing; a list of lines keeps one copy of each phrase and lets the layout
   * decide where they sit.
   */
  const em = (t: string) => (
    <span className="italic" style={serif}>
      {t}
    </span>
  );
  const DESKTOP_LINES = [
    <>Noah Cousineau is a {em("graphic designer")}</>,
    <>who uses wit, play, and humor to solve</>,
    <>your {em("visual problems")}{em(".")}</>,
  ];
  const PHONE_LINES = [
    <>Noah Cousineau is a</>,
    <>{em("graphic designer")} who</>,
    <>uses wit, play, and</>,
    <>humor to solve</>,
    <>your {em("visual problems")}{em(".")}</>,
  ];
  const DESKTOP_CLOSER = [<>His {em("work")} can be seen below.</>];
  const PHONE_CLOSER = [<>His {em("work")} can</>, <>be seen below</>];

  const lineSet = phone ? PHONE_LINES : DESKTOP_LINES;
  const closerSet = phone ? PHONE_CLOSER : DESKTOP_CLOSER;


  /* THE MASK ENDS AT THE RULE. Not "the line's height plus enough padding to
   * clear its descenders", which is what it was, and which is the bug.
   *
   * 2026-08-25, Noah: "make sure that the text doesn't cross the horizontal
   * lines when we scroll. For example, 'Noah Cousineau is a' crosses the
   * horizontal line when we scroll down. I don't want this, I always want it
   * to appear above the line."
   *
   * The old rule was `height of the type + MASK_PAD`, with MASK_PAD guessed
   * at 26 on a desktop and 46 on a phone after descenders got sliced. Both
   * numbers describe the TYPE and neither knows where the rule is, so on a
   * phone the window came out 146-154 units deep against a rule sitting at
   * 141 — every one of the five lines reached 4-5px past its own rule.
   *
   * RULE_OFFSET is the answer to the question the padding was guessing at:
   * the mask is the gap between a line's top and its rule, so it can no more
   * cross that rule than a window can be wider than its frame. It stops being
   * a number to tune.
   *
   * And there is room to spare, which is what makes this safe rather than a
   * trade against the clipping this padding was added to fix. Measured with
   * canvas TextMetrics over every run in every phone line, roman and italic:
   * the deepest ink of the lot is "graphic designer"'s descender at 115.1
   * units below the line's top, against a 141-unit window. 26 units clear. */
  const MASK_DEPTH_UNITS = RULE_OFFSET;

  const railWidth = phone ? PHONE_ARTBOARD - 72 : 1841;
  const rule = (y: number) => (
    <Place key={`r${y}`} x={36} y={y} w={railWidth} className="z-0">
      <div style={{ height: "calc(var(--u) * 6)", background: "var(--color-ink)" }} />
    </Place>
  );

  const LINE_MAX_W = railWidth; // x36 -> the artboard's right margin

  return (
    // Stage height 2266 -> 2460 (2026-08-20): part of Noah's site-wide "add
    // more vertical space between sections of copy and images". Adding it to
    // the Stage rather than to the individual <Place> coordinates keeps every
    // element's artboard position — and therefore the composition — exactly
    // as designed, and just lengthens the run-out before the projects grid.
    //
    // NO OUTER overflow-hidden (removed 2026-08-23). Each line already clips
    // itself via its own tight reveal-mask (the overflow-hidden wrapper
    // directly around each `.js-desc-line*`) — the outer one was redundant
    // for that and turned out to be actively wrong once line 4 needed to
    // travel to the TOP of the viewport: Stage is pinned wherever it happens
    // to be on screen when the centering trigger fires, which is only ever
    // ABOVE the viewport's top on wide/short screens. Measured on a 390x844
    // (mobile) viewport: the centering math freezes Stage's own top edge at
    // 294px down, but LINE4_TARGET_TOP=0.17 asks for content at 844*0.17 =
    // 143px — ABOVE Stage's frozen top edge. With the clip in place, that
    // was a real, reproducible bug: getBoundingClientRect reported the
    // correct position (143px, on-screen) while the actual pixels were
    // blank, because overflow-hidden on Stage discarded them regardless —
    // it clips relative to STAGE's own frozen box, not to the viewport, so
    // "on-screen" and "inside Stage's box" are different questions once
    // content is asked to rise above where Stage itself is anchored. Desktop
    // (1512x900) never showed this: that aspect ratio puts Stage's frozen
    // top ABOVE y=0 (i.e., already above the viewport) with room to spare.
    <div
      ref={pinRef}
      // Local to this section: the Hero above and the Projects grid below
      // each declare their own, and `main` keeps the 1920-based unit for
      // anything that has not opted out.
      style={phone ? { ["--u" as string]: `calc(100cqw / ${PHONE_ARTBOARD})` } : undefined}
    >
    <Stage heightUnits={phone ? phoneStageHeightUnits(phoneHandCentreY) : STAGE_HEIGHT_UNITS}>
      <div ref={root} className="absolute inset-0">
        {/* Lines 1–3. Each is wrapped in an overflow-hidden mask so it can
            rise out from behind its own rule on scroll — see the LINE
            REVEAL note in the effect above. The mask must clip, so it
            can't be merged into <Place> (which positions but doesn't
            clip), and the animated element is the inner div, leaving the
            mask itself untransformed as a fixed window. */}
        {/* Lines 1..N and their rules. Each line is wrapped in an
            overflow-hidden mask so it can rise out from behind its own rule
            on scroll — see the LINE REVEAL note in the effect above. The mask
            must clip, so it can't be merged into <Place> (which positions but
            doesn't clip), and the animated element is the inner div, leaving
            the mask itself untransformed as a fixed window. */}
        {lineSet.map((content, i) => (
          <Place key={`l${i}`} x={36} y={lineY(i)} className="z-10">
            <div
              className="overflow-hidden"
              style={{ height: `calc(var(--u) * ${MASK_DEPTH_UNITS})` }}
            >
              <div className="js-desc-line">
                <FitText
                  maxWidthUnits={LINE_MAX_W}
                  fontSizeUnits={105}
                  className="leading-[1] tracking-tight"
                >
                  {content}
                </FitText>
              </div>
            </div>
          </Place>
        ))}
        {lineSet.map((_, i) => rule(lineY(i) + RULE_OFFSET))}

        {/* The closer — "His work can be seen below." Rises out from behind
            its own rule exactly like the lines above: same mask, same 135
            yPercent, same ease (2026-08-21, per Noah: "Let's also have the
            'his work can be seen below' on the home page animate upwards like
            the rest of the text").

            Part of the pinned timeline since 2026-08-23, which is what lets
            it come to a real stop a quarter down the screen — see the LINE 4
            note in the effect for why that needed the content to travel
            inside the pin rather than the line to get its own trigger.

            ON A PHONE IT GETS THE SCREEN TO ITSELF (2026-08-25). Noah: "have
            the first descriptive as the only thing visible on the screen. The
            user then scrolls down to see the 'His work can be seen below'
            copy on a separate screen." The five lines above end at
            lineY(4) + 105; this starts a full viewport further down, so
            whatever is on screen when the last line lands, this is not part
            of it. */}
        {closerSet.map((content, i) => (
          <Place key={`c${i}`} x={45} y={closerY + i * LINE_PITCH} className="z-10">
            <div
              className="overflow-hidden"
              style={{ height: `calc(var(--u) * ${MASK_DEPTH_UNITS})` }}
            >
              <div className="js-desc-line-4">
                <FitText
                  maxWidthUnits={phone ? LINE_MAX_W : 1600}
                  fontSizeUnits={105}
                  className="leading-[1] tracking-tight"
                >
                  {content}
                </FitText>
              </div>
            </div>
          </Place>
        ))}
        {closerSet.map((_, i) => rule(closerY + i * LINE_PITCH + RULE_OFFSET))}

        {/* Pointing finger at y1600. It arrives like an arrow — dropping in
            from above the viewport, striking, and vibrating to a stop — see
            the note in the effect.

            THREE NESTED WRAPPERS, one transform each, because they need
            different origins and composing them onto a single element would
            make each one fight the others:
              1. the fall, in plain screen space (no rotation on this box, so
                 `y` means down-the-screen and nothing else);
              2. the resting pose, scale + the half-turn that points the
                 finger downward — static, and identical to where the old
                 scrubbed rotation used to end up, so the hand still comes to
                 rest exactly where it always has;
              3. the twang, pivoting on the fingertip rather than the box's
                 centre, which is what makes the tip the one point that
                 doesn't move. Nested INSIDE the half-turn, so "the tip" is
                 the real tip on screen and not its mirror image. */}
        <Place
          x={phone ? (PHONE_ARTBOARD - HAND_BOX_W) / 2 : 806}
          y={phone ? phoneHandCentreY - HAND_BOX_H / 2 : 1600}
          w={HAND_BOX_W}
          h={523}
          className="z-20"
        >
          <div ref={handDropRef} className="w-full js-desc-hand-drop">
            <div
              className="w-full"
              style={{
                transform: `scale(${phone ? PHONE_HAND_SCALE : 0.75}) rotate(180deg)`,
                transformOrigin: "50% 50%",
              }}
            >
              <div
                ref={handTwangRef}
                className="w-full js-desc-hand-twang"
                style={{ transformOrigin: `${HAND_TIP.xPct}% ${HAND_TIP.yPct}%` }}
              >
                <Image
                  src="/assets/home/pointing-hand.png"
                  alt=""
                  width={1597}
                  height={2719}
                  sizes="20vw"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </Place>

      </div>
    </Stage>
    </div>
  );
}
