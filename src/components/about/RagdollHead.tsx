"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

/*
 * RAGDOLL HEAD (2026-08-20, per Noah: "I want to be able to click and hold
 * on the head and have the cursor hold the head. I want the ability for it
 * to ragdoll within the red space, so a user can throw the head and it
 * moves around.")
 *
 * Grab it, drag it, throw it. On release it keeps the velocity of the
 * throw, falls under gravity, tumbles, and bounces off the four walls of
 * the red header, losing energy each time until it settles — and then STAYS
 * WHERE IT LANDS (Noah's explicit choice over springing back to its
 * designed spot).
 *
 * The eye-tracking from the original static head is preserved: each eye
 * still computes its own vector to the cursor and counter-rotates it into
 * the head's local space. The one change is that the head's rotation is no
 * longer the fixed 42deg constant it used to be — it changes every frame
 * once thrown — so the eyes read the live angle from `rotationRef` instead
 * of a module constant. Without that, the pupils would drift sideways by
 * exactly the tumble angle the moment the head was thrown.
 *
 * PHYSICS NOTES
 * - State lives in refs and is written straight to the DOM via transform
 *   inside a single rAF loop. Driving this through React state would queue
 *   a re-render per frame for an animation React has no reason to know
 *   about, and would fight the eyes' own per-frame updates.
 * - Collision uses the head's ROTATED axis-aligned bounding box, computed
 *   analytically (w|cos| + h|sin|) rather than by reading
 *   getBoundingClientRect() every frame. Measuring per frame would force a
 *   synchronous layout on every tick right after writing a transform — the
 *   classic layout-thrash pattern — and would also lag one frame behind
 *   the transform it's meant to describe.
 * - The loop parks itself when the head is asleep and restarts on grab, so
 *   an untouched page isn't burning a rAF slot forever.
 */

// Head's designed resting angle in the header (unchanged from the original
// static build — the whole composition was measured around this tilt).
const BASE_ROTATION_DEG = 42;

// Eye socket centers as a fraction (0-1) of the head image's own box,
// measured directly from head.png's alpha-channel hole positions.
const LEFT_EYE_CENTER = { x: 0.2992, y: 0.4165 };
const RIGHT_EYE_CENTER = { x: 0.6153, y: 0.4117 };

// How far (px) a pupil may drift from dead-center. Kept small and
// radius-clamped so the socket edges never expose the transparent hole /
// red background behind — Noah: "it's important the eyes don't move too
// much... it will look unnatural and reveal the red background behind."
const MAX_EYE_OFFSET_PX = 3.2;

// --- Physics constants (px/s, px/s^2) -------------------------------------
const GRAVITY = 2600;
/** Energy kept after a wall bounce. Below ~0.4 it thuds; above ~0.7 it
 * pings around long enough to feel out of control. */
const RESTITUTION = 0.52;
/** Horizontal energy kept when scraping along the floor. */
const FLOOR_FRICTION = 0.82;
/** Per-second air drag on both travel and spin. */
const AIR_DRAG = 0.35;
const ANGULAR_DRAG = 0.9;
/** Below these, the head is considered at rest and the loop parks. */
const SLEEP_SPEED = 26;
const SLEEP_SPIN = 12;
/** Throw speed ceiling — stops a violent flick from launching the head
 * across the box faster than the eye can follow. */
const MAX_THROW_SPEED = 2600;

/** One tracked eye: computes its own instantaneous vector to the cursor
 * and translates by up to MAX_EYE_OFFSET_PX toward it — no easing/lerp,
 * per Noah's "instantaneous" requirement.
 *
 * Anchors off the eye element's OWN rect rather than deriving a position
 * from the head's rect: getBoundingClientRect() on a rotated element
 * returns the axis-aligned box of the rotated shape, whose corners are not
 * the head's corners, so a derived anchor silently drifts. This div is
 * positioned by percentage inside the head's unrotated content box, so the
 * browser puts it in the right place at any rotation and its own rect
 * centre IS the true socket position.
 */
function TrackedEye({
  src,
  leftPct,
  topPct,
  widthPct,
  rotationRef,
}: {
  src: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  /** Live total rotation of the head, in degrees. Read per-event so the
   * counter-rotation stays correct while the head tumbles. */
  rotationRef: React.RefObject<number>;
}) {
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const el = eyeRef.current;
      if (!el) return;
      // Reset any existing offset transform before measuring, so the rect
      // reflects this eye's neutral (centered) position rather than
      // compounding on the previous frame's translate.
      const prev = el.style.transform;
      el.style.transform = "translate(-50%, -50%)";
      const rect = el.getBoundingClientRect();
      el.style.transform = prev;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const screenX = (dx / dist) * MAX_EYE_OFFSET_PX;
      const screenY = (dy / dist) * MAX_EYE_OFFSET_PX;

      // Counter-rotate the screen-space vector into the rotated head's
      // local space: a child's translate happens in its parent's already
      // rotated frame, so without this the pupils track a direction
      // offset by the head's current angle.
      const rad = (-rotationRef.current * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      el.style.transform = `translate(-50%, -50%) translate(${
        screenX * cos - screenY * sin
      }px, ${screenX * sin + screenY * cos}px)`;
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [rotationRef]);

  return (
    <>
      {/* Off-white backing disc BEHIND the eye, slightly larger, so an
          extreme offset can never expose the transparent socket hole (and
          the red header through it). Static so it always fully backs the
          socket regardless of the eye's current offset. */}
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
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          overflow: "hidden",
        }}
      >
        <Image src={src} alt="" fill className="object-cover" />
      </div>
    </>
  );
}

export default function RagdollHead({
  containerRef,
}: {
  /** The red header section the head is confined to. */
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Live total rotation (base tilt + tumble), shared with the eyes.
  const rotationRef = useRef<number>(BASE_ROTATION_DEG);

  // Offset from the head's designed CSS position, in px. Everything below
  // works in this delta space so the original right/bottom-anchored layout
  // stays the source of truth for where the head "belongs".
  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const spin = useRef(0);
  const dragging = useRef(false);
  const asleep = useRef(true);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  // Rolling pointer samples for throw velocity — a single last-frame delta
  // is far too noisy to read as intent.
  const samples = useRef<{ x: number; y: number; t: number }[]>([]);
  const grabOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    const container = containerRef.current;
    if (!wrap || !container) return;

    const apply = () => {
      wrap.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) rotate(${rotationRef.current}deg)`;
    };

    /** Half-extents of the head's rotated axis-aligned bounding box. */
    const halfExtents = () => {
      const w = wrap.offsetWidth;
      const h = wrap.offsetHeight;
      const rad = (rotationRef.current * Math.PI) / 180;
      const c = Math.abs(Math.cos(rad));
      const s = Math.abs(Math.sin(rad));
      return { hw: (w * c + h * s) / 2, hh: (w * s + h * c) / 2 };
    };

    /** Head centre in container coordinates, at zero offset. Measured with
     * the transform temporarily cleared so it describes the DESIGNED
     * position, which is what `pos` is a delta from. */
    const baseCentre = () => {
      const prev = wrap.style.transform;
      wrap.style.transform = `rotate(${BASE_ROTATION_DEG}deg)`;
      const r = wrap.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      wrap.style.transform = prev;
      return { x: r.left + r.width / 2 - cr.left, y: r.top + r.height / 2 - cr.top };
    };

    let base = baseCentre();
    const onResize = () => {
      base = baseCentre();
    };
    window.addEventListener("resize", onResize);

    const step = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      // Clamp dt so a backgrounded tab returning doesn't integrate one
      // enormous step and hurl the head through a wall.
      const dt = Math.min((ts - lastTs.current) / 1000, 1 / 30);
      lastTs.current = ts;

      if (!dragging.current) {
        vel.current.y += GRAVITY * dt;
        const drag = Math.max(0, 1 - AIR_DRAG * dt);
        vel.current.x *= drag;
        vel.current.y *= drag;
        spin.current *= Math.max(0, 1 - ANGULAR_DRAG * dt);

        pos.current.x += vel.current.x * dt;
        pos.current.y += vel.current.y * dt;
        rotationRef.current += spin.current * dt;

        // --- Walls -------------------------------------------------------
        const cr = container.getBoundingClientRect();
        const { hw, hh } = halfExtents();
        const cx = base.x + pos.current.x;
        const cy = base.y + pos.current.y;

        const minX = hw;
        const maxX = cr.width - hw;
        const minY = hh;
        const maxY = cr.height - hh;

        if (cx < minX) {
          pos.current.x += minX - cx;
          vel.current.x = Math.abs(vel.current.x) * RESTITUTION;
          spin.current += vel.current.y * 0.08;
        } else if (cx > maxX) {
          pos.current.x -= cx - maxX;
          vel.current.x = -Math.abs(vel.current.x) * RESTITUTION;
          spin.current -= vel.current.y * 0.08;
        }

        if (cy < minY) {
          pos.current.y += minY - cy;
          vel.current.y = Math.abs(vel.current.y) * RESTITUTION;
        } else if (cy > maxY) {
          pos.current.y -= cy - maxY;
          vel.current.y = -Math.abs(vel.current.y) * RESTITUTION;
          // Scraping the floor bleeds horizontal speed and converts some
          // of it into tumble, which is what sells the ragdoll read.
          vel.current.x *= FLOOR_FRICTION;
          spin.current = spin.current * 0.5 + vel.current.x * 0.35;

          // Settle: once the bounce is small and it's on the floor, stop.
          if (Math.abs(vel.current.y) < SLEEP_SPEED && Math.abs(vel.current.x) < SLEEP_SPEED) {
            vel.current.x = 0;
            vel.current.y = 0;
            if (Math.abs(spin.current) < SLEEP_SPIN) {
              spin.current = 0;
              asleep.current = true;
            }
          }
        }
      }

      apply();

      if (asleep.current && !dragging.current) {
        rafRef.current = null;
        lastTs.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    const wake = () => {
      asleep.current = false;
      if (rafRef.current == null) {
        lastTs.current = null;
        rafRef.current = requestAnimationFrame(step);
      }
    };

    const pointerPos = (e: PointerEvent) => {
      const cr = container.getBoundingClientRect();
      return { x: e.clientX - cr.left, y: e.clientY - cr.top };
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      wrap.setPointerCapture(e.pointerId);
      wrap.style.cursor = "grabbing";
      const p = pointerPos(e);
      // Preserve where on the head it was grabbed, so it doesn't snap its
      // centre to the cursor.
      grabOffset.current = { x: base.x + pos.current.x - p.x, y: base.y + pos.current.y - p.y };
      samples.current = [{ ...p, t: performance.now() }];
      vel.current = { x: 0, y: 0 };
      wake();
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const p = pointerPos(e);
      pos.current.x = p.x + grabOffset.current.x - base.x;
      pos.current.y = p.y + grabOffset.current.y - base.y;
      const now = performance.now();
      samples.current.push({ ...p, t: now });
      // Keep only the last ~90ms of movement — long enough to smooth
      // jitter, short enough that a throw reflects the final gesture and
      // not where the pointer wandered a moment ago.
      while (samples.current.length > 2 && now - samples.current[0].t > 90) {
        samples.current.shift();
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      try {
        wrap.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone (e.g. cancelled) — nothing to release */
      }
      wrap.style.cursor = "grab";

      const s = samples.current;
      if (s.length >= 2) {
        const first = s[0];
        const last = s[s.length - 1];
        const dt = (last.t - first.t) / 1000;
        if (dt > 0) {
          let vx = (last.x - first.x) / dt;
          let vy = (last.y - first.y) / dt;
          const speed = Math.hypot(vx, vy);
          if (speed > MAX_THROW_SPEED) {
            vx = (vx / speed) * MAX_THROW_SPEED;
            vy = (vy / speed) * MAX_THROW_SPEED;
          }
          vel.current = { x: vx, y: vy };
          // Spin proportional to how hard it was thrown sideways.
          spin.current = vx * 0.22;
        }
      }
      samples.current = [];
      asleep.current = false;
      wake();
    };

    wrap.style.cursor = "grab";
    wrap.style.touchAction = "none";
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);
    apply();

    return () => {
      window.removeEventListener("resize", onResize);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  return (
    <div
      ref={wrapRef}
      className="absolute select-none"
      style={{
        // Designed resting position, unchanged from the original static
        // build (right edge flush with the header, neck touching its
        // bottom). `pos` is a delta from exactly this.
        right: "calc(var(--u) * 42.98)",
        bottom: "calc(var(--u) * -40.31)",
        width: "calc(var(--u) * 424.94)",
        transform: `rotate(${BASE_ROTATION_DEG}deg)`,
        transformOrigin: "center center",
        willChange: "transform",
      }}
    >
      <div className="relative w-full" style={{ aspectRatio: "1297/1970" }}>
        {/* Eyes render BEHIND the head image — head.png's transparent socket
            holes mask each eye down to the correct narrow almond shape
            (the eyelid skin is painted into head.png, on top). Eyes must be
            first in DOM order for that masking to work. */}
        <TrackedEye
          src="/assets/about/eye-left.png"
          leftPct={LEFT_EYE_CENTER.x * 100}
          topPct={LEFT_EYE_CENTER.y * 100}
          widthPct={11.2}
          rotationRef={rotationRef}
        />
        <TrackedEye
          src="/assets/about/eye-right.png"
          leftPct={RIGHT_EYE_CENTER.x * 100}
          topPct={RIGHT_EYE_CENTER.y * 100}
          widthPct={11.6}
          rotationRef={rotationRef}
        />
        <Image
          src="/assets/about/head.png"
          alt="Noah Cousineau"
          fill
          className="object-contain relative z-10 pointer-events-none"
          priority
          draggable={false}
        />
      </div>
    </div>
  );
}
