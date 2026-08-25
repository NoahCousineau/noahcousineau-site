"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArcText } from "@/components/ArcText";
import RagdollHead from "@/components/about/RagdollHead";
import ParallaxPhotos from "@/components/about/ParallaxPhotos";
import ApproachOnScroll from "@/components/about/ApproachOnScroll";
import ResumeArrows, { type ResumeArrowSpot } from "@/components/ResumeArrows";
import {
  HEADER_HEIGHT_CSS,
  HEADER_RULE_PCT,
  HEADER_RULE_UNITS,
  HEADER_INSET_UNITS,
} from "@/components/project/headerLayout";

/*
 * About Me page — built from Noah's design file
 * (~/Desktop/portfolio/design/02-about-me/About Me Design.svg, viewBox
 * 1920 x 5747.71). Five stacked sections: header, about-me statement,
 * résumé download, clock/contact, footer (page-specific, not the shared
 * site Footer).
 *
 * Uses the same `--u` artboard-unit convention as the rest of the site
 * (1 unit = 1/1920 of the container width) via a local containerType:
 * inline-size wrapper, matching how project pages and the homepage work.
 *
 * CURVED TEXT: built with a plain SVG <textPath> along an arc — cheapest
 * correct way to do arced type on the web, no extra libraries. Reused for
 * both "DOWNLOAD MY RÉSUMÉ" (smile-shaped arc, opens downward) and
 * "IT'S TIME TO CONTACT NOAH" (wraps most of a circle).
 *
 * HEADER measurements (2026-08-17, round 3) — Noah: "I want it large enough
 * where the side of the head is touching the right side of the browser and
 * the neck is touching the bottom of the red shape... resting within it."
 * Solved via rotated-bounding-box algebra: at the fixed 42deg tilt, the
 * head's UNROTATED box is W=424.94u x H=645.44u (aspect 1297/1970); its
 * rotated bounding box is 747.68u x 764u — sized so the rotated box's
 * right edge sits flush with the header's right edge (browser edge) and
 * its bottom edge sits flush with the header's bottom edge (red shape's
 * bottom), producing exactly the "resting inside the box" look Noah
 * described. (764u tall rotated box was chosen to just clear the white
 * banner above it, at banner-bottom ~316u + a hair of margin.)
 *
 * EYE-TRACKING (2026-08-17, round 3 rebuild) — Noah supplied a NEW head
 * asset with two SEPARATE eye-socket holes (not one merged hole) plus two
 * separate full-eyeball assets ("My Left Eye.png" / "My Right Eye.png",
 * each a 581x581 circular render: sclera + iris + pupil, no eyelid — the
 * head's own eyelid skin sits on top and masks each circle down to the
 * socket's narrow almond shape). Socket holes measured directly from the
 * new head.png's alpha channel (connected-component analysis, canvas
 * 1297x1970): left hole x:325-451/y:803-838 (center 29.9%/41.6% of the
 * head box), right hole x:733-863/y:791-831 (center 61.5%/41.2%). Each
 * eye asset is scaled so its iris diameter (~260px of the 581px canvas)
 * matches its socket's height, then centered on the socket's center —
 * this reproduces the "eyes look like AboutMeHead - Light Mode when
 * looking straight ahead" reference Noah pointed to.
 *
 * Tracking behavior per Noah's reference images/videos (Framer "Eyes
 * Follow Cursor", Ochi Design mouse interaction, googly-eyes tutorial):
 *   - INSTANT, no lag/lerp — "There shouldn't be any delay... it should
 *     be instantaneous to the position of the cursor" (unlike round 2's
 *     eased/lerped motion, deliberately removed here).
 *   - SMALL clamped radius per eye — "it's important the eyes don't move
 *     too much as it will look unnatural and reveal the red background
 *     behind [the socket hole]." MAX_PUPIL_OFFSET_PX is deliberately
 *     small and clamps to a circle (not a box) so the eye can never
 *     slide far enough to expose the transparent socket edge.
 *   - EACH eye computes its own angle to the cursor independently (not a
 *     single shared vector for both) — this is what produces the
 *     converging "cross-eyed" look in Noah's reference image when the
 *     cursor is very close to the face (both eyes' individual vectors
 *     point inward toward each other), and is why a single-vector
 *     approach (round 2) couldn't reproduce that reference at all.
 */

/** Draggable 3D card — same drag-to-spin interaction model as the
 * homepage's RotatingHead (mouse/touch drag maps horizontal movement to
 * rotation, releases into momentum with friction decay), but spinning a
 * real two-sided 3D card (CSS 3D transform, front/back faces + thin
 * "edge" strips for a touch of paper thickness) around its Y axis instead
 * of stepping through a sprite sheet.
 *
 * ALWAYS-ON ROTATION (2026-08-18, round 5) — Noah: "make it so there's
 * always a constant rotation to the resume. The dragging just can stop
 * or allow the user to spin the resume, but there should always be a
 * default rotation rate." Auto-rotate is only suppressed WHILE the
 * pointer is actively down, and ALWAYS resumes automatically once
 * released — so the card is never left permanently static after a
 * drag/click.
 *
 * SMOOTH + FASTER (2026-08-18, round 7) — Noah asked to triple the speed
 * again AND fix choppiness. Root cause of the choppiness: the previous
 * version drove rotation with `setInterval(fn, 60ms)` stepping by a
 * fixed degree increment per tick — that decouples the animation from
 * the browser's actual paint/refresh timing (setInterval callbacks drift
 * and can bunch up or skip under load), producing visible stutter.
 * Replaced with a single continuous requestAnimationFrame loop driven by
 * elapsed wall-clock time (deltaMs), so the rotation rate is expressed
 * in true degrees-PER-SECOND and advances in lockstep with every actual
 * paint frame — buttery smooth regardless of frame-rate variance, and
 * trivially both "3x again" (52.5 -> 157.5 deg/s) without touching the
 * loop mechanics.
 *
 * BELIEVABLE LIGHT-SOURCE SHADOW (2026-08-18, round 7) — Noah: "make the
 * shadow appear more believable, as if the viewer had a light pointed at
 * it." Beyond the existing width-foreshortening (scaleX tracks
 * |cos(angle)|, unchanged), a shadow lit from the viewer's position
 * should also get FAINTER and TIGHTER as the card turns edge-on (less
 * surface area is catching/blocking the light, so less shadow is cast)
 * and DARKER + SOFTER when the card is flat-on (full surface blocking
 * the light, casting its fullest, most diffuse shadow) — both now also
 * driven by the same |cos(angle)| factor, alongside the pre-existing
 * width scale. */
function DraggableResumeCard({
  frontSrc,
  backSrc,
  rotationSpeedDegPerSec = 75, // Noah: dial back from 100 to 75
}: {
  frontSrc: string;
  backSrc: string;
  rotationSpeedDegPerSec?: number;
}) {
  const [angle, setAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragSensitivity = 3; // degrees per px dragged — tuned so a normal drag swings the card naturally

  // Single continuous rAF loop drives BOTH the always-on auto-spin and
  // the post-drag momentum decay, all as smooth deltaTime-based degrees-
  // per-second math — no setInterval, no fixed per-tick stepping.
  //
  // NEVER-STOPS DECAY (2026-08-18, round 8) — Noah: after a drag release
  // the card would decay ALL THE WAY to a dead stop before the separate
  // auto-spin effect kicked back in, producing a visible full pause.
  // Fixed by making velocityRef the single source of truth for the
  // card's speed at all times (removing the old isDragging-branch
  // between "decay toward 0" and "reset and use the constant prop"), and
  // having it continuously ease toward rotationSpeedDegPerSec (the
  // resting cruise speed) instead of toward 0. Right after a fast flick
  // it eases DOWN from the flick speed to cruise speed; with no flick at
  // all it's already at/near cruise speed so there's nothing to visibly
  // settle — either way the card is always turning, never fully still.
  const velocityRef = useRef(rotationSpeedDegPerSec); // deg/sec, current speed
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId: number;
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const deltaSec = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      if (!isDragging) {
        // Ease velocity toward the resting cruise speed exponentially
        // (frame-rate independent) rather than snapping to it — this is
        // what makes a post-flick spin smoothly SLOW DOWN into the
        // steady cruise instead of stopping and restarting.
        const EASE_HALF_LIFE_SEC = 0.6;
        const t = 1 - Math.pow(0.5, deltaSec / EASE_HALF_LIFE_SEC);
        velocityRef.current += (rotationSpeedDegPerSec - velocityRef.current) * t;
        setAngle((a) => (a + velocityRef.current * deltaSec) % 360);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isDragging, rotationSpeedDegPerSec]);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    velocityRef.current = 0;

    const getX = (ev: MouseEvent | TouchEvent) => ("touches" in ev ? ev.touches[0].clientX : ev.clientX);
    const startX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startAngle = angle;
    let lastX = startX;
    let lastTime = Date.now();

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const currentX = getX(ev);
      const currentTime = Date.now();
      const deltaX = currentX - startX;
      setAngle(startAngle + deltaX * dragSensitivity * 0.1);

      const deltaPixels = currentX - lastX;
      const deltaTimeMs = Math.max(currentTime - lastTime, 16);
      // Convert to deg/sec (velocityRef is now a rate, not a per-tick delta).
      velocityRef.current = ((deltaPixels / deltaTimeMs) * 1000 * dragSensitivity * 0.1);

      lastX = currentX;
      lastTime = currentTime;
    };
    const handleUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchmove", handleMove);
    document.addEventListener("touchend", handleUp);
  };

  // Thin "edge" strips give the card a hint of paper thickness — 4 thin
  // divs (top/bottom/left/right) rotated 90deg out of the card plane,
  // shaded slightly darker than the page faces so the spinning card
  // reads as a real (if very thin) object rather than a flat plane.
  const THICKNESS_PX = 3;

  // Shared light-facing factor: 1 = card flat-on to the viewer (full
  // surface catching the light, full shadow), 0 = card edge-on (minimal
  // surface, minimal shadow). Drives width, opacity, and blur together
  // below so all three read as one coherent physical shadow instead of
  // three independently-tweaked numbers.
  const facingFactor = Math.abs(Math.cos((angle * Math.PI) / 180));

  return (
    <div
      className="relative cursor-grab active:cursor-grabbing select-none"
      style={{
        width: "calc(var(--u) * 420)",
        aspectRatio: "1700/2200",
        perspective: "1400px",
        marginTop: "calc(var(--u) * -130)",
      }}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
    >
      {/* Static drop shadow, BEHIND the card, representing a shadow cast
          on the wall/backdrop by a light at the viewer's position rather
          than the card dropping a shadow downward onto the page below
          it. All three of its physical properties now track the same
          facingFactor: WIDTH (scaleX, unchanged from round 6 — a thin
          edge-on card blocks a narrow sliver of light), OPACITY (a
          nearly-edge-on card blocks almost no light, so its shadow
          should nearly vanish, not just narrow), and BLUR (more surface
          area flat-on to a light source casts a softer, more diffuse
          shadow; edge-on casts a tighter, crisper sliver) — together
          this reads as one real shadow reacting to the card's orientation
          rather than a single axis being animated in isolation. */}
      <div
        className="absolute rounded-2xl"
        style={{
          inset: "6%",
          background: "rgba(0,0,0,1)",
          opacity: 0.12 + 0.28 * facingFactor,
          filter: `blur(${14 + 20 * facingFactor}px)`,
          transform: `translateZ(-40px) scale(0.94) scaleX(${Math.max(0.06, facingFactor)})`,
          zIndex: -1,
        }}
      />
      <div
        className="w-full h-full relative"
        style={{ transformStyle: "preserve-3d", transform: `rotateY(${angle}deg) rotateZ(-9deg)` }}
      >
        {/* Front face */}
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <Image src={frontSrc} alt="Noah Cousineau résumé — front" fill className="object-contain pointer-events-none" />
        </div>
        {/* Back face — rotated 180deg so it faces outward on the opposite side */}
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <Image src={backSrc} alt="Noah Cousineau résumé — back" fill className="object-contain pointer-events-none" />
        </div>
        {/* Edge strips — approximate paper thickness along all 4 sides */}
        <div
          className="absolute bg-[#dcdcdc]"
          style={{ left: 0, right: 0, top: 0, height: `${THICKNESS_PX}px`, transform: `translateY(-${THICKNESS_PX / 2}px) rotateX(90deg)`, transformOrigin: "top" }}
        />
        <div
          className="absolute bg-[#dcdcdc]"
          style={{ left: 0, right: 0, bottom: 0, height: `${THICKNESS_PX}px`, transform: `translateY(${THICKNESS_PX / 2}px) rotateX(90deg)`, transformOrigin: "bottom" }}
        />
        <div
          className="absolute bg-[#dcdcdc]"
          style={{ top: 0, bottom: 0, left: 0, width: `${THICKNESS_PX}px`, transform: `translateX(-${THICKNESS_PX / 2}px) rotateY(90deg)`, transformOrigin: "left" }}
        />
        <div
          className="absolute bg-[#dcdcdc]"
          style={{ top: 0, bottom: 0, right: 0, width: `${THICKNESS_PX}px`, transform: `translateX(${THICKNESS_PX / 2}px) rotateY(90deg)`, transformOrigin: "right" }}
        />
      </div>
    </div>
  );
}

/**
 * Where the résumé card sits and where the arrows go, in the RESUME section's
 * own coordinate space — which is the full 1920-unit page width, since the
 * section is `w-full` and absolute children position against its padding box.
 *
 * The card is centred on the page (x960) and its vertical extent was measured
 * live rather than derived, because the arc-text link above it and the card's
 * own negative top margin make its position an accumulation rather than a
 * number anyone wrote down.
 *
 * SPOTS come off Noah's sketch read as fractions of its width: the left pair
 * sits around 7-21% across and the right pair around 75-92%, which at 1920
 * units puts their centres near x273/294 and x1574/1600. One high and one low
 * on each side, so all four converge on the card from its corners rather than
 * stacking on one axis.
 */
// Measured live in section units: the card occupies y515-886 and its centre
// — which is what the arrows aim at, and what its zoom scales about, so it
// holds still while the card grows — sits at (960, 700).
const RESUME_CARD_CENTRE = { x: 960, y: 700 };
const RESUME_ARROW_SPOTS: [
  ResumeArrowSpot,
  ResumeArrowSpot,
  ResumeArrowSpot,
  ResumeArrowSpot,
] = [
  { x: 273, y: 560, w: 150 },
  { x: 294, y: 850, w: 132 },
  { x: 1574, y: 555, w: 138 },
  { x: 1600, y: 862, w: 147 },
];

export default function About() {
  // The header doubles as the ragdoll head's physics arena. That arena is
  // NOT the whole section: it is the box above the rule, which is what makes
  // the head come to rest exactly on the line rather than at the foot of the
  // page. See components/project/headerLayout.ts.
  const arenaRef = useRef<HTMLDivElement>(null);

  return (
    <main
      className="w-full"
      style={{ containerType: "inline-size", ["--u" as string]: "calc(100cqw / 1920)" }}
    >
      {/* ================= HEADER ================= */}
      {/* 2026-08-22, Noah: "On the about me page, I would like to get rid of
          the red background and apply the same horizontal line. I don't want
          extra objects on the about me, these will only have the head."

          So this is the project pages' header with the drop field left out —
          same height, same rule at the same 90%, same inset for the type. The
          red version is at commit a2bef06 if it wants coming back. */}
      <section
        className="relative w-full overflow-hidden"
        style={{ height: HEADER_HEIGHT_CSS }}
      >
        {/* The head's box, ending at the rule. */}
        <div
          ref={arenaRef}
          className="absolute inset-x-0 top-0"
          style={{ height: HEADER_RULE_PCT }}
        >
          {/* Head — grabbable and throwable, confined to the space above the
              rule. Its designed resting position and the eye-tracking both
              live in RagdollHead; see that file for the position math and the
              physics. */}
          <RagdollHead containerRef={arenaRef} />
        </div>

        <div
          className="absolute inset-x-0 z-10"
          style={{
            top: HEADER_RULE_PCT,
            height: `calc(var(--u) * ${HEADER_RULE_UNITS})`,
            background: "var(--color-ink)",
          }}
        />

        {/* "about me", in the place the white card used to put it. The card
            itself is gone for the same reason it went on the project pages:
            with the red away it is a white rectangle on a white page. */}
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            top: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
            left: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
            right: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
          }}
        >
          <div
            className="lowercase w-full"
            style={{
              padding: "calc(var(--u) * 20) calc(var(--u) * 56)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-project-title)",
              color: "var(--color-ink)",
            }}
          >
            about me
          </div>
        </div>
      </section>

      {/* ================= ABOUT ME (statement + paragraph) ================= */}
      {/* `relative` + `isolate` establish this section as the positioning
          and stacking context for the parallax photo bed behind the copy.
          Vertical padding opened up (140 -> 300) per Noah's ask for more
          scroll-through space; it also gives the parallax room to read —
          a short section would scroll past before the depth difference
          between near and far photos became legible. */}
      <section
        className="relative isolate w-full flex flex-col items-center text-center"
        style={{ padding: "calc(var(--u) * 300) calc(var(--u) * 120)" }}
      >
        {/* Life-story photos, drifting at depth behind the text. Uses
            placeholder artwork for now — see ParallaxPhotos. */}
        <ParallaxPhotos />

        {/* "Big statement" starburst — placeholder shape via clip-path
            star polygon, yellow fill matching the design's #ffca05. */}
        <div
          className="relative z-10 flex items-center justify-center"
          style={{
            width: "calc(var(--u) * 420)",
            aspectRatio: "1/1",
            background: "#ffca05",
            clipPath:
              "polygon(50% 0%, 61% 18%, 82% 8%, 82% 30%, 100% 35%, 88% 50%, 100% 65%, 82% 70%, 82% 92%, 61% 82%, 50% 100%, 39% 82%, 18% 92%, 18% 70%, 0% 65%, 12% 50%, 0% 35%, 18% 30%, 18% 8%, 39% 18%)",
          }}
        >
          <span
            className="text-[color:var(--color-ink)] text-center leading-tight"
            style={{ fontFamily: "var(--font-sans)", fontSize: "calc(var(--u) * 44)", fontWeight: 700 }}
          >
            Big
            <br />
            statement
          </span>
        </div>

        {/* Body paragraph — Noah's placeholder copy (2026-08-24: "the about
            me paragraph is one of the last things I have to work on. For
            now, please use this placeholder text... I'll give more attention
            to the about me paragraph... later"), not a lorem stand-in —
            real text, subject to a later pass. Split at a sentence boundary
            near its midpoint into the two columns the design calls for on
            desktop; single column on narrow viewports. */}
        <div
          // ONE COLUMN, 2026-08-24: "For the about me text, have the text in
          // one wide column instead of two short ones." Was one column below
          // md and two above. The column count still lives in classes rather
          // than an inline gridTemplateColumns, because an inline value won a
          // specificity fight against the responsive classes once before and
          // pinned the grid to two columns at every width.
          className="relative z-10 mt-16 grid grid-cols-1 gap-y-6 text-left"
          style={{
            maxWidth: "calc(var(--u) * 1600)",
            overflowWrap: "break-word",
            fontFamily: "var(--font-sans)",
            // Matched to the project pages' description copy (2026-08-20,
            // per Noah) — same expression ProjectStatement uses for its
            // lead paragraph, referenced rather than re-derived so the two
            // can't drift apart.
            fontSize: "calc(var(--text-lead) * 1.5)",
            lineHeight: 1.38125,
          }}
        >
          <p className="m-0">
            Being silly is serious work. This is not only a strong personal
            belief, but a reason why I switched careers from engineering to
            graphic design. As an engineer, I worked on serious projects
            where miscalculation could cost hundreds of thousands of
            dollars, or worse, an accident or injury. When I attended my
            masters program at ArtCenter College of Design, I was confused
            to see designers uphold themselves to similar levels of
            severity.
          </p>
          <p className="m-0">
            In a discipline where we need to connect to audiences, why be so
            incredibly grave and stark with our work? Why not be a little
            more human have some fun with it? I create work with humor,
            levity, and joy not only because I enjoy doing so, but because
            it resonates with audiences. In a somber and increasingly less
            human design landscape, there’s nothing more serious than
            having some fun.
          </p>
        </div>
      </section>

      {/* ================= RESUME DOWNLOAD ================= */}
      <section
        className="relative w-full flex flex-col items-center"
        style={{ padding: "calc(var(--u) * 260) calc(var(--u) * 120) calc(var(--u) * 340)", marginBottom: "calc(var(--u) * 200)" }}
      >
        {/* Clay arrows aimed at the résumé card, per Noah's sketch of this
            placement (2026-08-24: "The clay arrows shouldn't be in the footer
            at all. The only place it should appear is on the resume section
            in the 'about me' area. Look at the sketch for where I would like
            the arrows to point to.") — moved here wholesale from the footer,
            see ResumeArrows.tsx.

            OUTSIDE ApproachOnScroll, WHICH IS WHY THEY WORK (2026-08-25).
            They started inside it, which broke them twice over. That wrapper
            carries the scroll-driven zoom, so the arrows grew with the card —
            against "Have the arrows stay the same size, but keep the resume
            and 'download my resume' text grow as it is" — and, less visibly,
            it is not full width: it shrinks to its widest child, the 1050u
            arc-text link. So `--u` measured inside it came out at 0.537
            against the page's 0.787, and coordinates written for a 1680u
            content box landed a third too far right, running the right-hand
            pair off the edge of the window.

            Positioned against the SECTION instead, which is the full 1920u
            page width — the same space Noah's sketch is drawn in, so his
            fractions convert directly. Being outside the zoom is also what
            keeps the parallax legible: two transforms fighting over the same
            element read as neither. */}
        <ResumeArrows
          target={RESUME_CARD_CENTRE}
          spots={RESUME_ARROW_SPOTS}
        />
        {/* Headline and card travel toward the viewer together as this
            section scrolls in — see ApproachOnScroll. Wrapping BOTH (rather
            than the card alone) is what makes it read as one object arriving
            and closing out the page, which is the "natural conclusion"
            Noah described. */}
        <ApproachOnScroll>
          <div className="relative w-full flex flex-col items-center">
            <a
              href="/assets/_documents/noah-cousineau-resume.pdf"
              target="_blank"
              rel="noreferrer"
              className="block no-underline"
              style={{ width: "calc(var(--u) * 1050)", height: "calc(var(--u) * 330)" }}
            >
              <ArcText
                id="resume-arc"
                text="Download My Résumé"
                width={1050}
                height={330}
                radius={630}
                baselineY={20}
                fontSize={69}
                flip={true}
                color="var(--color-ink)"
              />
            </a>

            {/* Résumé card — draggable 3D object with a real back face and
                slight paper thickness (see DraggableResumeCard above). Lives
                outside the <a> above: dragging to spin needs its own
                mousedown/touchstart handler, which would conflict with a
                wrapping link's click-to-navigate — the download action is on
                the curved headline text instead. */}
            <DraggableResumeCard
              frontSrc="/assets/about/resume-preview.jpg"
              backSrc="/assets/about/resume-back.png"
            />
          </div>
        </ApproachOnScroll>
      </section>

      {/* CLOCK / CONTACT-PROMPT removed 2026-08-20 per Noah: "I want to
          remove the clock and the 'It's Time To Contact Noah' from the
          about me page. Instead, I want this to appear on a new page. When
          the user clicks off the website, I want a black screen to appear
          and the clock and text to appear on that screen." That lockup now
          lives in components/AwayOverlay.tsx, mounted site-wide from
          layout.tsx — moved intact (same circle, same oversized watch, same
          two upright arcs), only its trigger changed. */}

      {/* CONTACT INFO + page-specific footer removed 2026-08-20 per Noah:
          "Let's also delete the contact info and have the normal site footer
          on the about me page." The contact details now live on the away
          screen (components/AwayOverlay.tsx) flanking the clock, and the
          shared site footer is rendered for this route again by
          components/ConditionalFooter.tsx. */}

    </main>
  );
}
