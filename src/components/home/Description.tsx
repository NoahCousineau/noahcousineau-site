"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
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
/* Vertical centre of the three-line block, artboard units: the top of line 1
 * (y381) to the rule under line 3 (y882). 2026-08-23, Noah: "let's have the
 * 'Noah Cousineau is a graphic...' information stop scrolling in the center
 * of the page" — the pin used to start at `top top`, which parks the STAGE's
 * top edge at the viewport's top and leaves the type wherever that happens to
 * put it. Starting the pin a measured distance earlier or later instead lands
 * this point on the viewport's middle at every window size. */
const LINES_CENTER_UNITS = (381 + 882) / 2;

/** Top of "His work can be seen below.", artboard units. */
const LINE4_TOP_UNITS = 1387;
/** Where that line comes to rest, as a fraction of viewport height from the
 *  top. Noah: "stop scroll about 3/4 up the page" — three quarters of the way
 *  UP is a quarter of the way DOWN. */
const LINE4_TARGET_TOP = 0.25;

/* The fingertip, as a percentage of the hand artwork's own box — measured off
 * pointing-hand.png's alpha (topmost opaque pixel, 519/1597 across and
 * 23/2719 down). The twang rotates about this point, so it is the one pixel
 * that never moves: an arrow buried in a target vibrates along its shaft
 * while its head stays put. */
const HAND_TIP = { xPct: 32.5, yPct: 0.85 };

export default function Description() {
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

      /** Live value of one artboard unit in px — the stage spans the same
       *  1920-unit canvas as everything else, capped at 1920px wide. */
      const uPx = () => stage.offsetWidth / 1920;
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

      let handFired = false;
      const fireHand = () => {
        if (handFired || !handDropRef.current) return;
        handFired = true;
        const el = handDropRef.current;
        // Measure where it is about to land, then start from just past the
        // top of the window — whatever that distance happens to be at this
        // viewport and this point in the timeline.
        gsap.set(el, { y: 0, autoAlpha: 1 });
        const from = -(el.getBoundingClientRect().bottom + 40);
        const shot = gsap.timeline();
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
            docTop() - (window.innerHeight / 2 - LINES_CENTER_UNITS * uPx()),
          // Three reveals and their holds, then the travel down to the last
          // line and its own beat — see the phases below.
          end: "+=320%",
          pin: true,
          anticipatePin: 1,
          scrub: 0.6,
          invalidateOnRefresh: true,
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
            (LINE4_TOP_UNITS - LINES_CENTER_UNITS) * uPx()
          ),
        duration: 1.7,
        ease: "none",
      });

      if (line4) tl.to(line4, { yPercent: 0, duration: REVEAL, ease: "power3.out" });
      // The arrow arrives once the line is standing and readable.
      tl.call(fireHand);
      // The beat Noah wants the reader to spend on that line, with the hand
      // landing into it. Long enough to cover the shot and its twang.
      tl.to({}, { duration: HOLD * 2.2 });
    }, root);
    return () => ctx.revert();
  }, []);

  const rule = (y: number) => (
    <Place x={36} y={y} w={1841} className="z-0">
      <div style={{ height: "calc(var(--u) * 6)", background: "var(--color-ink)" }} />
    </Place>
  );

  const LINE_MAX_W = 1841; // x36 -> x1877, the artboard's right margin
  const serif = { fontFamily: "var(--font-serif)" };

  return (
    // Stage height 2266 -> 2460 (2026-08-20): part of Noah's site-wide "add
    // more vertical space between sections of copy and images". Adding it to
    // the Stage rather than to the individual <Place> coordinates keeps every
    // element's artboard position — and therefore the composition — exactly
    // as designed, and just lengthens the run-out before the projects grid.
    <div ref={pinRef}>
    <Stage heightUnits={2460} className="overflow-hidden">
      <div ref={root} className="absolute inset-0">
        {/* Lines 1–3. Each is wrapped in an overflow-hidden mask so it can
            rise out from behind its own rule on scroll — see the LINE
            REVEAL note in the effect above. The mask must clip, so it
            can't be merged into <Place> (which positions but doesn't
            clip), and the animated element is the inner div, leaving the
            mask itself untransformed as a fixed window. */}
        {/* Line 1 y381 (was y81, moved down 300u) */}
        <Place x={36} y={381} className="z-10">
          <div className="overflow-hidden" style={{ paddingBottom: "calc(var(--u) * 26)" }}>
            <div className="js-desc-line">
              <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
                Noah Cousineau is a <span className="italic" style={serif}>graphic designer</span>
              </FitText>
            </div>
          </div>
        </Place>
        {rule(522)}

        {/* Line 2 y565 (was y265, moved down 300u) */}
        <Place x={36} y={565} className="z-10">
          <div className="overflow-hidden" style={{ paddingBottom: "calc(var(--u) * 26)" }}>
            <div className="js-desc-line">
              <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
                who uses wit, play, and humor to solve
              </FitText>
            </div>
          </div>
        </Place>
        {rule(706)}

        {/* Line 3 y741 (was y441, moved down 300u) */}
        <Place x={36} y={741} className="z-10">
          <div className="overflow-hidden" style={{ paddingBottom: "calc(var(--u) * 26)" }}>
            <div className="js-desc-line">
              <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
                your <span className="italic" style={serif}>visual problems</span><span className="italic" style={serif}>.</span>
              </FitText>
            </div>
          </div>
        </Place>
        {rule(882)}

        {/* "His work can be seen below." y1387 (was y1187, moved down 300u).
            "work" set in Quinn Text italic (serif) per spec, matching the
            emphasis treatment used elsewhere ("graphic designer", "visual
            problems"). Trailing period added per feedback.

            Rises out from behind its own rule (y1528) exactly like lines
            1–3 — same mask, same 135 yPercent, same ease (2026-08-21, per
            Noah: "Let's also have the 'his work can be seen below' on the
            home page animate upwards like the rest of the text"). Its rule
            sits 141u below it, the identical gap lines 1–3 use, so the
            same masking geometry works unchanged.

            Part of the pinned timeline since 2026-08-23, which is what lets
            it come to a real stop a quarter down the screen — see the LINE
            4 note in the effect for why that needed the content to travel
            inside the pin rather than the line to get its own trigger. */}
        <Place x={45} y={1387} className="z-10">
          <div className="overflow-hidden" style={{ paddingBottom: "calc(var(--u) * 26)" }}>
            <div className="js-desc-line-4">
              <FitText maxWidthUnits={1600} fontSizeUnits={105} className="leading-[1] tracking-tight">
                His <span className="italic" style={serif}>work</span> can be seen below.
              </FitText>
            </div>
          </div>
        </Place>

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
        <Place x={806} y={1600} w={308} h={523} className="z-20">
          <div ref={handDropRef} className="w-full js-desc-hand-drop">
            <div
              className="w-full"
              style={{ transform: "scale(0.75) rotate(180deg)", transformOrigin: "50% 50%" }}
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

        {/* Rule line below text — 36u gap after "His work can be seen below"
            baseline (y1387 + ~105 line height + 36u), matching the same
            36u text-to-rule gap used after lines 1–3 above. */}
        {rule(1528)}
      </div>
    </Stage>
    </div>
  );
}
