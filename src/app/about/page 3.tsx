"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import MickeyWatch from "@/components/MickeyWatch";

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

// Degrees the head wrapper is rotated (see the header section below) —
// EyeTracker needs this to counter-rotate the screen-space cursor vector
// before applying it as a translate on a child of that rotated element
// (CSS transforms compose: a child's own translate happens in the
// parent's already-rotated local space, so without this correction the
// pupils would visibly drift in the wrong direction, offset by the
// head's tilt, instead of tracking straight toward the cursor).
const HEAD_ROTATION_DEG = 42;

// Eye socket centers as a fraction (0-1) of the head image's own box,
// measured directly from head.png's alpha-channel hole positions (see
// comment above). Independent per-eye so each eye tracks the cursor from
// its own true position, not a shared head-center approximation.
const LEFT_EYE_CENTER = { x: 0.2992, y: 0.4165 };
const RIGHT_EYE_CENTER = { x: 0.6153, y: 0.4117 };

// How far (in px, at the eye's own displayed size) a pupil/eye may drift
// from dead-center. Kept small and radius-clamped so the socket's edges
// never expose the transparent hole/red background behind — Noah:
// "it's important the eyes don't move too much... it will look
// unnatural and reveal the red background behind."
const MAX_EYE_OFFSET_PX = 3.2;

/** One tracked eye: computes its own instantaneous vector to the cursor
 * and translates by up to MAX_EYE_OFFSET_PX toward it — no easing/lerp,
 * per Noah's "instantaneous" requirement.
 *
 * BUGFIX (2026-08-17, round 4): originally this computed the eye's
 * on-screen anchor by reading the HEAD wrapper's getBoundingClientRect()
 * and multiplying by socketCenter fractions. That's wrong once the head
 * is rotated: getBoundingClientRect() on a rotated element returns the
 * AXIS-ALIGNED BOUNDING BOX of the rotated shape, not the original
 * unrotated box — so rect.left/rect.width no longer correspond to the
 * head's true corners, and the computed "eye center" silently drifted to
 * the wrong screen position. This is very likely why the cross-eyed
 * convergence didn't match Noah's reference. Fixed by giving each eye a
 * ref to ITSELF: since this div is positioned with left/top percentages
 * relative to the head's own (unrotated) content box, the browser
 * renders it at the correct on-screen spot regardless of the ancestor's
 * rotation — so eyeRef.current.getBoundingClientRect()'s center IS the
 * true rotated socket position, with no manual trig needed for the
 * anchor (only the OUTPUT offset vector still needs counter-rotating,
 * since that's a translate applied inside the rotated local space). */
function TrackedEye({
  src,
  leftPct,
  topPct,
  widthPct,
}: {
  src: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rotRad = (-HEAD_ROTATION_DEG * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    function handleMove(e: MouseEvent) {
      const el = eyeRef.current;
      if (!el) return;
      // Reset any existing offset transform before measuring, so the
      // rect reflects this eye's neutral (centered) position rather than
      // compounding on top of the previous frame's translate.
      const prevTransform = el.style.transform;
      el.style.transform = "translate(-50%, -50%)";
      const rect = el.getBoundingClientRect();
      el.style.transform = prevTransform;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const screenX = (dx / dist) * MAX_EYE_OFFSET_PX;
      const screenY = (dy / dist) * MAX_EYE_OFFSET_PX;
      // Counter-rotate the screen-space vector into the rotated head's
      // local coordinate space (see HEAD_ROTATION_DEG comment above).
      setOffset({
        x: screenX * cos - screenY * sin,
        y: screenX * sin + screenY * cos,
      });
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <>
      {/* Off-white backing disc — sits BEHIND the eye (rendered first) at
          a size between the socket and the eye, so if the (now smaller,
          per Noah's "eyes feel slightly too big" feedback) eye doesn't
          perfectly cover the socket at extreme offsets, this shows a
          skin-toned fill instead of the transparent hole exposing the
          red header behind it. Static (untranslated) so it always fully
          backs the socket regardless of the eye's current offset. */}
      <div
        className="absolute"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct * 1.35}%`,
          aspectRatio: "1/1",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "#f3ddc9",
        }}
      />
      <div
        ref={eyeRef}
        className="absolute"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          aspectRatio: "1/1",
          transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
          borderRadius: "50%",
          overflow: "hidden",
        }}
      >
        <Image src={src} alt="" fill className="object-cover" />
      </div>
    </>
  );
}


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

/** Arced text via SVG textPath. `flip` reverses the arc to open upward
 * (concave-down "smile") vs. downward; `startOffset` nudges start point.
 *
 * DECOUPLED CURVATURE VS POSITION (2026-08-18, round 9) — Noah on the
 * clock section: "arched too much" AND "not close to the edge of the
 * white circle" at the same time. Two separate bugs fixed here:
 * 1. `cy` (vertical position) was hardcoded to equal `radius`
 *    (curvature) — turning one dial always moved the other. Added an
 *    optional `baselineY` prop so they're independent.
 * 2. The path's start/end X were always `cx -/+ radius`, i.e. a FULL
 *    semicircle chord (= the circle's own diameter) no matter how big
 *    `radius` got — so the arc's bulge height was always exactly
 *    `radius` regardless of scale, and cranking radius up just pushed
 *    the whole semicircle (and the text riding at its apex) miles off
 *    screen instead of flattening anything. Added an optional
 *    `spanDeg` prop (degrees of the circle actually traced, default
 *    180 = old full-semicircle behavior) so a LARGE radius can trace a
 *    SMALL angular slice under the text — that's what actually produces
 *    a gentle, nearly-flat arch: same text width, much bigger circle,
 *    much less curvature per pixel of text. */
function ArcText({
  text,
  radius,
  width,
  height,
  fontSize,
  flip = false,
  color = "#fff",
  id,
  baselineY,
  spanDeg = 180,
  centerY: centerYProp,
}: {
  text: string;
  radius: number;
  width: number;
  height: number;
  fontSize: number;
  flip?: boolean;
  color?: string;
  id: string;
  baselineY?: number;
  spanDeg?: number;
  centerY?: number;
}) {
  const cx = width / 2;
  // Downward-opening arc (smile shape, used for résumé headline): path
  // goes from left to right along the TOP of a circle whose center sits
  // below the visible area, so the visible slice curves upward at the
  // ends and dips at center — matches the "rainbow" arc in the design.
  const cy = baselineY ?? (flip ? radius : height - radius);
  // Circle center sits `radius` above (flip) or below (!flip) the
  // baseline; start/end points are at +/-(spanDeg/2) from the very
  // top/bottom of that circle, NOT at the full +/-90deg (diameter).
  //
  // TRUE-CONCENTRIC FIX (2026-08-18, round 10) — Noah: "text still too
  // far from the circle" even after matching radius exactly. Root
  // cause: `centerY` here was DERIVED from cy+/-radius, an independent
  // number from the actual visible white circle's own center — so
  // "same radius" did NOT guarantee "same circle", just same curvature
  // at a possibly different, non-concentric center. Added an optional
  // `centerY` override so the arc can be pinned to literally the same
  // center point as the real circle, making them truly concentric
  // (same circle, different radius) instead of two same-curvature but
  // offset arcs that only coincidentally look close.
  const centerY = centerYProp ?? (flip ? cy + radius : cy - radius);
  const halfSpanRad = (spanDeg / 2) * (Math.PI / 180);
  const startX = flip ? cx - radius * Math.sin(halfSpanRad) : cx - radius * Math.sin(halfSpanRad);
  const endX = cx + radius * Math.sin(halfSpanRad);
  const arcPointY = flip
    ? centerY - radius * Math.cos(halfSpanRad)
    : centerY + radius * Math.cos(halfSpanRad);
  const sweep = flip ? 1 : 0;
  const d = `M ${startX} ${arcPointY} A ${radius} ${radius} 0 0 ${sweep} ${endX} ${arcPointY}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible" }}>
      <path id={id} d={d} fill="none" />
      <text
        fill={color}
        fontFamily="var(--font-sans)"
        fontSize={fontSize}
        letterSpacing="0.02em"
        style={{ textTransform: "uppercase" }}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </svg>
  );
}

/** Text that traces the BOTTOM of a circle with letters kept upright
 * (readable normally, not upside-down) — matches Noah's clock-section
 * reference, where "CONTACT NOAH" sits along the lower curve right-side
 * up. Plain ArcText can't do this: SVG textPath always keeps a glyph's
 * "up" pointing toward the path's left-hand side as it travels forward,
 * so tracing the BOTTOM of a circle left-to-right (the natural reading
 * order) puts letters upside-down. The fix is to trace the arc
 * RIGHT-TO-LEFT along the same bottom curve instead — that flips which
 * side is "up" without flipping the glyphs themselves — and then reverse
 * the character order in the string so the visible reading order comes
 * out correct again. */
function BottomArcText({
  text,
  radius,
  width,
  height,
  fontSize,
  color = "#fff",
  id,
  baselineY,
  spanDeg = 180,
  centerY: centerYProp,
}: {
  text: string;
  radius: number;
  width: number;
  height: number;
  fontSize: number;
  color?: string;
  id: string;
  baselineY?: number;
  spanDeg?: number;
  centerY?: number;
}) {
  const cx = width / 2;
  const cy = baselineY ?? (height - radius);
  // Same span-decoupling fix as ArcText above: circle center sits
  // `radius` ABOVE the baseline for a bottom-opening bowl, and the
  // visible arc only traces +/-(spanDeg/2) around the very BOTTOM of
  // that circle rather than the full +/-90deg diameter — so a big
  // radius flattens the arch instead of just relocating it. Optional
  // `centerY` override (round 10) pins this to the SAME center point as
  // the real white circle for true concentricity — see ArcText's fuller
  // comment on why same-radius alone didn't guarantee that.
  const centerY = centerYProp ?? (cy - radius);
  const halfSpanRad = (spanDeg / 2) * (Math.PI / 180);
  const startX = cx + radius * Math.sin(halfSpanRad); // start on the RIGHT
  const endX = cx - radius * Math.sin(halfSpanRad); // end on the LEFT
  const arcPointY = centerY + radius * Math.cos(halfSpanRad);
  // sweep=0 tracing left-to-right along the bottom of the circle keeps
  // each glyph's "up" pointing outward/downward-away-from-center, i.e.
  // upright as seen by the viewer. (2026-08-18 round 9 fix — the
  // previous right-to-left/sweep=1 combo was rendering upside-down;
  // verified by direct on-screen inspection, not just geometry theory.)
  const d = `M ${cx - radius * Math.sin(halfSpanRad)} ${arcPointY} A ${radius} ${radius} 0 0 0 ${cx + radius * Math.sin(halfSpanRad)} ${arcPointY}`;
  const reversedText = text;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible" }}>
      <path id={id} d={d} fill="none" />
      <text
        fill={color}
        fontFamily="var(--font-sans)"
        fontSize={fontSize}
        letterSpacing="0.06em"
        style={{ textTransform: "uppercase" }}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {reversedText}
        </textPath>
      </text>
    </svg>
  );
}


export default function About() {
  const headWrapRef = useRef<HTMLDivElement>(null);

  return (
    <main
      className="w-full"
      style={{ containerType: "inline-size", ["--u" as string]: "calc(100cqw / 1920)" }}
    >
      {/* ================= HEADER ================= */}
      <section
        className="relative w-full overflow-hidden"
        style={{ background: "var(--color-red)", height: "calc(var(--u) * 1080)" }}
      >
        {/* White "about me" label — reuses the exact ProjectIdBox card
            treatment (bg-paper, same padding scale, same font) but
            STRETCHED to span the majority of the header width — matching
            Noah's reference screenshot, where the white bar spans ~93% of
            the frame (measured: 1785u of 1920u, 70u/63u side insets) —
            and matching how ProjectIdBox itself spans nearly the full
            hero-image width on every project page (inset only by --gutter
            on each side), not a small inline-sized pill. */}
        <div
          className="absolute z-20"
          style={{
            top: "calc(var(--u) * 40)",
            left: "calc(var(--u) * 40)",
            right: "calc(var(--u) * 40)",
          }}
        >
          <div
            className="bg-[color:var(--color-paper)] lowercase w-full"
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

        {/* Head — right edge already flush (see content-bbox math above,
            unchanged this round). Vertical position recomputed 2026-08-18
            round 6 per Noah: "make it so the bottom of the red container
            meets the bottom-most point of the head" — same true-content
            alpha-bbox approach as the right-edge fix (not the rotated
            CSS bounding box, which includes blank transparent corners).
            The head's lowest opaque pixel, once rotated 42deg, sits
            282.41u below the image's own center; solving for the center
            position that puts that point exactly on the header's bottom
            edge (y=1080u) gives bottom:-40.31u (negative = the box's
            layout edge sits slightly below the header's bottom, which is
            expected/correct — the head's own transparent margin extends
            past its lowest opaque pixel, header overflow:hidden clips
            the rest). */}
        <div
          ref={headWrapRef}
          className="absolute"
          style={{
            right: "calc(var(--u) * 42.98)",
            bottom: "calc(var(--u) * -40.31)",
            width: "calc(var(--u) * 424.94)",
            transform: "rotate(42deg)",
            transformOrigin: "center center",
          }}
        >
          <div className="relative w-full" style={{ aspectRatio: "1297/1970" }}>
            {/* Eyes render BEHIND the head image — head.png's transparent
                socket holes mask each eye down to the correct narrow
                almond shape (eyelid skin is part of head.png, painted on
                top). Eyes must be listed first in the DOM/z-order for
                this masking to work; if the head were behind, the eyes'
                circular shape would show as a round patch over the face
                instead of the correct eye-shaped sliver. */}
            <TrackedEye
              src="/assets/about/eye-left.png"
              leftPct={LEFT_EYE_CENTER.x * 100}
              topPct={LEFT_EYE_CENTER.y * 100}
              widthPct={11.2}
            />
            <TrackedEye
              src="/assets/about/eye-right.png"
              leftPct={RIGHT_EYE_CENTER.x * 100}
              topPct={RIGHT_EYE_CENTER.y * 100}
              widthPct={11.6}
            />
            <Image src="/assets/about/head.png" alt="Noah Cousineau" fill className="object-contain relative z-10" priority />
          </div>
        </div>
      </section>

      {/* ================= ABOUT ME (statement + paragraph) ================= */}
      <section
        className="w-full flex flex-col items-center text-center"
        style={{ padding: "calc(var(--u) * 140) calc(var(--u) * 120)" }}
      >
        {/* "Big statement" starburst — placeholder shape via clip-path
            star polygon, yellow fill matching the design's #ffca05. */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: "calc(var(--u) * 420)",
            aspectRatio: "1/1",
            background: "#ffca05",
            clipPath:
              "polygon(50% 0%, 61% 18%, 82% 8%, 82% 30%, 100% 35%, 88% 50%, 100% 65%, 82% 70%, 82% 92%, 61% 82%, 50% 100%, 39% 82%, 18% 92%, 18% 70%, 0% 65%, 12% 50%, 0% 35%, 18% 30%, 18% 8%, 39% 18%)",
          }}
        >
          <span
            className="text-black text-center leading-tight"
            style={{ fontFamily: "var(--font-sans)", fontSize: "calc(var(--u) * 44)", fontWeight: 700 }}
          >
            Big
            <br />
            statement
          </span>
        </div>

        {/* Body paragraph — placeholder copy, Noah will replace. Split
            into two columns per the design, on desktop; single column
            on narrow viewports. */}
        <div
          className="mt-16 grid gap-x-12 gap-y-4 text-left"
          style={{
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            maxWidth: "calc(var(--u) * 1600)",
            fontFamily: "var(--font-sans)",
            fontSize: "calc(var(--u) * 24)",
            lineHeight: 1.5,
          }}
        >
          <p className="m-0">
            Placeholder copy — this is where the About Me paragraph will go.
            Being silly is serious work. This is not only a strong personal
            belief, but a reason why I switched careers from engineering to
            graphic design.
          </p>
          <p className="m-0">
            As an engineer, I worked on projects where miscalculation could
            cost real money or worse — an accident. In design school I
            leaned the opposite direction: work should connect, and connection
            often needs a little humor and levity. Placeholder text, to be
            replaced.
          </p>
        </div>
      </section>

      {/* ================= RESUME DOWNLOAD ================= */}
      <section
        className="w-full flex flex-col items-center"
        style={{ padding: "calc(var(--u) * 260) calc(var(--u) * 120) calc(var(--u) * 340)", marginBottom: "calc(var(--u) * 200)" }}
      >
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
      </section>

      {/* ================= CLOCK / CONTACT-PROMPT ================= */}
      {/* Sizing/orientation rebuilt to match Noah's reference screenshot
          (2026-08-18, round 5): circle radius only slightly bigger than
          the minute hand's length (measured directly off the watch
          asset's alpha-channel content bbox: hand tip sits ~170.6 of 600
          canvas units from the rotation axis; MickeyWatch is rendered at
          ~1.53x the visible white circle's diameter — clipped by the
          circle's own overflow-hidden — so that scaled-up hand length
          works out to ~1.15x the circle radius, matching the reference's
          "hand nearly reaches the edge" proportion). Text split into TWO
          separate arcs (top dome "IT'S TIME TO", bottom bowl "CONTACT
          NOAH") instead of one single semicircle phrase, matching the
          reference's two-line wrap — both arcs keep letters upright
          (readable, not upside-down), per the reference. */}
      <section
        className="relative w-full flex flex-col items-center justify-center overflow-hidden"
        style={{ background: "var(--color-ink)", padding: "calc(var(--u) * 140) 0" }}
      >
        <div className="relative flex items-center justify-center" style={{ width: "calc(var(--u) * 640)", aspectRatio: "1/1" }}>
          {/* White circle backdrop, clips the oversized watch to a clean edge */}
          <div className="absolute inset-0 rounded-full bg-white overflow-hidden">
            <div
              className="absolute"
              style={{
                width: "153%",
                height: "153%",
                left: "-26.5%",
                top: "-26.5%",
              }}
            >
              <MickeyWatch />
            </div>
          </div>
          {/* Top arc: "IT'S TIME TO" — dome shape, opens upward, letters
              upright, spans the upper ~130deg of the circle. */}
          <div className="absolute" style={{ width: "140%", height: "140%", left: "-20%", top: "-20%" }}>
            <ArcText
              id="clock-arc-top"
              text="It's Time To"
              width={100}
              height={100}
              radius={35.7}
              spanDeg={110}
              baselineY={10.53}
              fontSize={9.3}
              flip={true}
              color="#fff"
            />
          </div>
          {/* Bottom arc: "CONTACT NOAH" — bowl shape at the bottom,
              letters upright (not inverted) — built via BottomArcText
              below, which reverses path direction to keep glyphs
              right-side-up while still tracing the bottom curve. */}
          <div className="absolute" style={{ width: "140%", height: "140%", left: "-20%", top: "-20%" }}>
            <BottomArcText
              id="clock-arc-bottom"
              text="Contact Noah"
              width={100}
              height={100}
              radius={50}
              spanDeg={110}
              baselineY={97}
              fontSize={9.3}
              color="#fff"
            />
          </div>
        </div>
      </section>

      {/* ================= SPACER SECTION (black background) ================= */}
      <section
        className="w-full"
        style={{ 
          background: "var(--color-ink)",
          height: "calc(var(--u) * 300)"
        }}
      ></section>

      {/* ================= CONTACT INFO ================= */}
      <section
        className="w-full flex items-center justify-center"
        style={{ 
          padding: "calc(var(--u) * 100) calc(var(--u) * 50)",
          background: "var(--color-ink)"
        }}
      >
        <div className="flex items-center justify-between w-full" style={{ marginBottom: "calc(var(--u) * -80)" }}>
          <div
            className="text-center"
            style={{ 
              display: "inline-block"
            }}
          >
            <a
              href="mailto:noah@noahcousineau.com"
              className="text-center"
              style={{ 
                color: "white",
                textDecoration: "none",
                fontSize: "calc(var(--u) * 36)",
                letterSpacing: "0.02em",
                display: "block",
                borderBottom: "3px solid white",
                paddingBottom: "calc(var(--u) * 6)",
                whiteSpace: "nowrap"
              }}
            >
              noah@noahcousineau.com
            </a>
          </div>
          <div
            className="text-center"
            style={{ 
              display: "inline-block"
            }}
          >
            <a
              href="tel:(862)520-8040"
              className="text-center"
              style={{ 
                color: "white",
                textDecoration: "none",
                fontSize: "calc(var(--u) * 36)",
                letterSpacing: "0.02em",
                display: "block",
                borderBottom: "3px solid white",
                paddingBottom: "calc(var(--u) * 6)",
                whiteSpace: "nowrap"
              }}
            >
              (862) 520-8040
            </a>
          </div>
          <div
            className="text-center"
            style={{ 
              display: "inline-block"
            }}
          >
            <a
              href="https://www.linkedin.com/in/noah-cousineau/"
              target="_blank"
              rel="noreferrer"
              className="text-center"
              style={{ 
                color: "white",
                textDecoration: "none",
                fontSize: "calc(var(--u) * 36)",
                letterSpacing: "0.02em",
                display: "block",
                borderBottom: "3px solid white",
                paddingBottom: "calc(var(--u) * 6)",
                whiteSpace: "nowrap"
              }}
            >
              LinkedIn
            </a>
          </div>
          <div
            className="text-center"
            style={{ 
              display: "inline-block"
            }}
          >
            <a
              href="https://www.instagram.com/noahcousineau/"
              target="_blank"
              rel="noreferrer"
              className="text-center"
              style={{ 
                color: "white",
                textDecoration: "none",
                fontSize: "calc(var(--u) * 36)",
                letterSpacing: "0.02em",
                display: "block",
                borderBottom: "3px solid white",
                paddingBottom: "calc(var(--u) * 6)",
                whiteSpace: "nowrap"
              }}
            >
              Instagram
            </a>
          </div>
        </div>
      </section>

      {/* ================= ABOUT-PAGE FOOTER ================= */}
      {/* Custom footer for THIS PAGE ONLY — keep just the Cousineau logo,
          remove all the contact info/links from the generic footer. */}
      <footer
        className="w-full flex items-center justify-center"
        style={{ background: "var(--color-ink)", padding: "calc(var(--u) * 60) calc(var(--u) * 60)" }}
      >
        <Link href="/" className="block w-full">
          <Image
            src="/assets/home/cousineau-logo-white.svg"
            alt="Cousineau"
            width={711}
            height={119}
            className="w-full h-auto"
          />
        </Link>
      </footer>
    </main>
  );
}
