"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArcText } from "@/components/ArcText";
import RagdollHead from "@/components/about/RagdollHead";
import ApproachOnScroll from "@/components/about/ApproachOnScroll";
import ResumeArrows, { type ResumeArrowSpot } from "@/components/ResumeArrows";
import { useIsPhone } from "@/lib/useIsPhone";
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
  widthUnits = 420,
  alt = "Noah Cousineau résumé",
  invertOnDark = false,
  edge = true,
}: {
  frontSrc: string;
  backSrc: string;
  /** NEGATIVE spins the other way. The loop below eases toward this value
   *  continuously rather than adding a fixed step, so a negative target needs
   *  nothing else — 2026-08-29, for the newsletter envelope: "it will have the
   *  same 3D effect, but will rotate in the opposite way." */
  rotationSpeedDegPerSec?: number;
  /** Doubled on phones — see the call site. */
  widthUnits?: number;
  alt?: string;
  /** For line artwork, which reads as ink on paper and has to become ink on
   *  black. The envelope is a pencil drawing: measured, its ink is 0.079 mean
   *  saturation on the front and 0.121 on the back, against 0.56-0.99 for the
   *  photographic objects elsewhere — the same test the header icons use to
   *  decide what may safely take a plain CSS invert. */
  invertOnDark?: boolean;
  /** The paper thickness slabs. A sheet of card has them; a line drawing of
   *  an envelope on a transparent ground does not, and showing them would
   *  frame the drawing in two grey bars it has no edges to justify. */
  edge?: boolean;
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
        width: `calc(var(--u) * ${widthUnits})`,
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
      {/* CAST SHADOW — the other thing that only makes sense for a sheet
          of card. It is a blurred black slab behind the object, sized to
          the object's own box; behind a line drawing on a transparent
          ground it reads as a grey smear floating in mid-air rather than
          as a shadow of anything. Tied to `edge` because it answers the
          same question: is this a physical sheet or a drawing of one? */}
      {edge && (
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
      )}
      <div
        className="w-full h-full relative"
        style={{ transformStyle: "preserve-3d", transform: `rotateY(${angle}deg) rotateZ(-9deg)` }}
      >
        {/* Front face */}
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <Image src={frontSrc} alt={`${alt} — front`} fill className={`object-contain pointer-events-none${invertOnDark ? " invert-on-dark" : ""}`} />
        </div>
        {/* Back face — rotated 180deg so it faces outward on the opposite side */}
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <Image src={backSrc} alt={`${alt} — back`} fill className={`object-contain pointer-events-none${invertOnDark ? " invert-on-dark" : ""}`} />
        </div>
        {/* Edge strips — approximate paper thickness along all 4 sides */}
        {/* Paper thickness. Skipped for line artwork — see the `edge`
            prop: a drawing of an envelope on a transparent ground has no
            edges these two grey bars could be. */}
        {edge && (
          <>
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
          </>
        )}
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
/** The envelope's equivalent — the server-render fallback only, since the
 *  aim is measured from the DOM. Higher up its section than the résumé's,
 *  matching the smaller top padding. */
const NEWSLETTER_CARD_CENTRE = { x: 960, y: 430 };
/* x1.5 on 2026-08-25 — Noah: "on desktop, let's increase the size of the
 * clay arrows by 1.5x." Only `w` is given; each arrow's height follows from
 * its own aspect ratio inside ResumeArrows, so one number per arrow is the
 * whole change. */
const RESUME_ARROW_SCALE = 1.5;
/* TWO EACH, 2026-08-29. Noah: "let's distribute the arrows so only two point
 * at the resume and only two point at the envelope."
 *
 * One a side rather than two on one side, so each object is flanked. The
 * lower-left and upper-right of the original four are kept for the résumé —
 * they are the pair Noah's own sketch put furthest from the card, and the
 * aim is measured from the DOM anyway (see targetRef), so a spot only has to
 * be a plausible place for an arrow to sit. */
const RESUME_ARROW_SPOTS: ResumeArrowSpot[] = [
  { x: 273, y: 560, w: 150 * RESUME_ARROW_SCALE },
  { x: 1600, y: 862, w: 147 * RESUME_ARROW_SCALE },
];
/* The newsletter section is shorter than the résumé's — 60 units of top
 * padding against 260 — so its pair sits higher up the section. */
const NEWSLETTER_ARROW_SPOTS: ResumeArrowSpot[] = [
  { x: 294, y: 300, w: 132 * RESUME_ARROW_SCALE },
  { x: 1574, y: 560, w: 138 * RESUME_ARROW_SCALE },
];

export default function About() {
  const phone = useIsPhone();
  // The header doubles as the ragdoll head's physics arena. That arena is
  // NOT the whole section: it is the box above the rule, which is what makes
  // the head come to rest exactly on the line rather than at the foot of the
  // page. See components/project/headerLayout.ts.
  const arenaRef = useRef<HTMLDivElement>(null);
  /* THE ARROWS AIM AT THE SPINNING OBJECT, NOT THE HEADLINE (2026-08-30).
   * Noah: "let's make sure the arrows are pointing at the envelope and
   * resume. Right now they're not angled correctly."
   *
   * They were aimed at the <a>, which is the arc of type — and type sits well
   * above the thing it names. Measured at 1512: the résumé's link centre is
   * 228px above the card, the newsletter's 282px above the envelope. Every
   * arrow was therefore aimed correctly at the wrong point, which reads as an
   * arrow pointing past its object. These wrappers give the aim a box a
   * reader would actually call "the résumé" and "the envelope". */
  const resumeCardRef = useRef<HTMLDivElement>(null);
  const envelopeRef = useRef<HTMLDivElement>(null);

  return (
    <main
      className="artboard w-full"
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
            /* 2026-08-25: "treat the 'about me' title type the same way we
               are treating project title type on the mobile project pages" —
               which is doubled, and pushed down clear of the "C" mark. Both
               numbers are the project header's, so the two pages stay in
               step. */
            /* FOLLOW THE CHROME DOWN (2026-08-31). Noah: "continue working on
               optimizing the site in the in-between modes."

               Between 768 and 1439 the C mark is pushed down by
               `--chrome-drop`, so that on a project page it clears the rule
               under the section title. That drop is site-wide, and this page
               has no such rule — what it has is its own title in the very
               same corner. Measured on /about: at 1512 the C ends at y=45.5
               and the words start at 47.3, clear by under two pixels; at 1400
               the C drops to 86.8 and lands squarely on them, and it stays
               there all the way down to 768.

               Adding the same drop here keeps the two in the relationship the
               desktop layout already had, rather than inventing a second
               number that would have to be kept in step by hand. Outside the
               band the variable is not defined and the fallback is 0, so the
               desktop position is untouched — which is the requirement. */
            top: phone
              ? `calc(var(--u) * 300)`
              : `calc(var(--u) * ${HEADER_INSET_UNITS} + var(--chrome-drop-compensate, 0px))`,
            left: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
            right: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
          }}
        >
          <div
            className="lowercase w-full"
            style={{
              padding: "calc(var(--u) * 20) calc(var(--u) * 56)",
              fontFamily: "var(--font-sans)",
              fontSize: phone
                ? "calc(var(--text-project-title) * 2)"
                : "var(--text-project-title)",
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
        /* TOP PADDING CUT BY 75% (2026-08-29). Noah: "there's a gap on the
           about me page that is in-between the top of the about me paragraph
           and the header line. Let's reduce this space by 75%." 300 -> 75
           units. The 300 was sized to give the parallax photo bed room to
           read as depth; that bed is gone (see the note below), so the space
           was holding nothing. The BOTTOM padding stays at 300 — it is what
           separates this section from the résumé. */
        style={{ padding: "calc(var(--u) * 75) calc(var(--u) * 120) calc(var(--u) * 300)" }}
      >
        {/* THE PHOTO BED AND THE "BIG STATEMENT" STARBURST ARE GONE
            (2026-08-29). Noah: "I don't think I'm going to have the time to
            do what I want with the about me text in the about me section.
            Please keep the text, but remove the floating images and the 'big
            statement' piece."

            Both were placeholders waiting on artwork that is not going to
            arrive before launch — the starburst was a clip-path polygon with
            the literal words "Big statement" in it, and ParallaxPhotos was
            drifting stand-in images. Shipping either would have been shipping
            a note-to-self. The copy is real and stays.

            The section keeps `relative isolate` and its padding: the copy is
            still z-10 over nothing in particular, and the vertical space is
            what gives this section its own beat between the header and the
            résumé. */}

        {/* Body copy. Noah's final text, sent 2026-08-30 to replace the
            placeholder that had stood here since 2026-08-24 ("the about me
            paragraph is one of the last things I have to work on").
            Transcribed exactly as written — four paragraphs now rather than
            two, which the single-column grid takes without any change. */}
        <div
          // ONE COLUMN, 2026-08-24: "For the about me text, have the text in
          // one wide column instead of two short ones." Was one column below
          // md and two above. The column count still lives in classes rather
          // than an inline gridTemplateColumns, because an inline value won a
          // specificity fight against the responsive classes once before and
          // pinned the grid to two columns at every width.
          className="relative z-10 mt-16 grid grid-cols-1 text-left"
          style={{
            /* PARAGRAPH SPACING (2026-08-30). Noah: "add a slight bit more
               space between the paragraphs of text in the about me section
               only."

               Was Tailwind's gap-y-6 — a flat 24px at every width, which is
               under a third of a line at desktop where this copy sets at
               57.6px with a 1.38 line-height. Proportional now, so the gap
               grows with the type it separates, with a floor so the phone
               (where 52 units is only 10px) still gains a little rather than
               losing what it had. 24 -> 28px at 390 and 900, 24 -> 41px at
               1512. Scoped to this block, so nothing else on the site moves. */
            rowGap: "max(28px, calc(var(--u) * 52))",
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
            Engineering is the study of problem solving. This was the core
            learning that I derived from my bachelors program in Aerospace
            Engineering and from my career as an engineer. Despite dedicating
            so much time to becoming an engineer, there was one other key
            learning that I gained from my experience; I hated engineering.
          </p>
          <p className="m-0">
            For a field that seemed to be teaming with creativity and
            possibility, I found myself mired by dull calculations,
            regimented procedures, and serious consequences to errors. If I
            was going to devote myself to a career, I wanted to ensure it was
            one where I could be creative and not be so grave and solemn.
            This yearning for levity and creativity brought me to another
            passion of mine, graphic design.
          </p>
          <p className="m-0">
            After a graduate graphic design program and working as a designer,
            I’ve found something curious about my industry. Many designers
            carry themselves with the same onus that I was required to have as
            an engineer. Designers can be serious, stern, and humorless in
            their character and work. If we find ourselves in a field full of
            self expression and creativity, why be so stark about it?
          </p>
          <p className="m-0">
            Like engineering, design is also a study of problem solving.
            Unlike engineering, design can be solved however the designer
            wants. I find that I still have a calculated problem-solving
            approach to design like I did as an engineer. This time, I just
            chose to have fun while solving the problem.
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
        {/* Off on phones for now — 2026-08-25: "Remove the clay arrows from
            the mobile version for now." */}
        {!phone && (
          /* targetRef is what actually aims them — RESUME_CARD_CENTRE is
             only the server-render fallback now. See the note in
             ResumeArrows.tsx: the card travels inside ApproachOnScroll and
             the arrows carry their own parallax, so a written-down
             coordinate was 19-26 degrees out and getting worse as the
             section scrolled. */
          <ResumeArrows
            target={RESUME_CARD_CENTRE}
            spots={RESUME_ARROW_SPOTS}
            targetRef={resumeCardRef}
          />
        )}
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
              /* 2026-08-25, phones: "please double the size of the 'download
                 my resume' text and paper." The ArcText draws into this box,
                 so doubling the box doubles the type and its arc together. */
              style={
                phone
                  ? { width: "calc(var(--u) * 1800)", height: "calc(var(--u) * 566)" }
                  : { width: "calc(var(--u) * 1050)", height: "calc(var(--u) * 330)" }
              }
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
            <div ref={resumeCardRef}>
              <DraggableResumeCard
                frontSrc="/assets/about/resume-preview.jpg"
                backSrc="/assets/about/resume-back.png"
                widthUnits={phone ? 840 : 420}
              />
            </div>
          </div>
        </ApproachOnScroll>
      </section>

      {/* ================= NEWSLETTER ================= */}
      {/* 2026-08-29, Noah: "Below the resume section, add a section that has
          the text 'Subscribe to my newsletter'. It is treated the same exact
          way the resume section is where there is arched text and a spinning
          object."

          DELIBERATELY THE SAME COMPONENTS, not a copy of them: the same
          ArcText, the same ApproachOnScroll, the same DraggableResumeCard.
          "Treated the same exact way" is a instruction about the pair of
          sections reading as siblings, and the cheapest way to guarantee that
          is for them to be the same code with different content. What differs
          is only what Noah named — the artwork, the direction of spin, and
          that a pencil drawing has to invert in the dark.

          No clay arrows here. They point at the résumé, and Noah's sketch put
          them there specifically; two sets of arrows on one page would stop
          either being an arrow pointing at something. */}
      <section
        className="relative w-full flex flex-col items-center"
        style={{ padding: "calc(var(--u) * 60) calc(var(--u) * 120) calc(var(--u) * 340)", marginBottom: "calc(var(--u) * 200)" }}
      >
        {/* Its own pair, aimed at the envelope — outside ApproachOnScroll for
            the same two reasons as the résumé's: that wrapper carries the
            scroll zoom (which would grow the arrows with the card) and is not
            full width (which would make every x-coordinate land short). */}
        {!phone && (
          <ResumeArrows
            target={NEWSLETTER_CARD_CENTRE}
            spots={NEWSLETTER_ARROW_SPOTS}
            targetRef={envelopeRef}
          />
        )}
        <ApproachOnScroll>
          <div className="relative w-full flex flex-col items-center">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdVU0sAC4ZmMUfeLH3tRPOqwPQC1v7MzKLoMk5YxFoA7Sy3Gg/viewform?usp=header"
              target="_blank"
              rel="noreferrer"
              className="block no-underline"
              style={
                phone
                  ? { width: "calc(var(--u) * 1800)", height: "calc(var(--u) * 566)" }
                  : { width: "calc(var(--u) * 1050)", height: "calc(var(--u) * 330)" }
              }
            >
              <ArcText
                id="newsletter-arc"
                text="Subscribe To My Newsletter"
                width={1050}
                height={330}
                radius={630}
                baselineY={20}
                fontSize={69}
                flip={true}
                color="var(--color-ink)"
              />
            </a>

            {/* THE ENVELOPE SPINS THE OTHER WAY. `rotationSpeedDegPerSec` is
                the value the loop eases toward, so a negative target is the
                whole change — "the same 3D effect, but will rotate in the
                opposite way".

                `edge` off because the paper-thickness slabs are two grey bars
                sized for a sheet of card, and this is a line drawing on a
                transparent ground with no edges for them to be. `invertOnDark`
                on because it is pencil: 0.079 mean ink saturation on the
                front, 0.121 on the back. */}
            <div ref={envelopeRef}>
              <DraggableResumeCard
                frontSrc="/assets/about/envelope-front.webp"
                backSrc="/assets/about/envelope-back.webp"
                /* Flipped again 2026-08-30: "the envelope is still rotating
                   the wrong direction, make it rotate the other way" — so back
                   to negative, which is opposite the résumé's. Sized +20% on
                   2026-08-29: 420 -> 504, 840 -> 1008. */
                rotationSpeedDegPerSec={-75}
                widthUnits={phone ? 1008 : 504}
                alt="Subscribe to Noah Cousineau's newsletter"
                invertOnDark
                edge={false}
              />
            </div>
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
