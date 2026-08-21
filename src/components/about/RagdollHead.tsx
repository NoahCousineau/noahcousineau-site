"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

/*
 * RAGDOLL HEAD — grab it, drag it, throw it. On release it keeps the
 * velocity of the throw, falls under gravity, tumbles, rolls along the
 * floor and bounces off the walls of the red header, losing energy until it
 * settles — and then STAYS WHERE IT LANDS (Noah's explicit choice over
 * springing back to its designed spot).
 *
 * COLLIDES WITH THE VISIBLE HEAD, NOT ITS BOX (2026-08-20, per Noah: "I
 * wish it used the edge of the red space as the 'floor' or the bottom most
 * point it can touch. Right now it's floating a bit too much above it.")
 *
 * head.png carries a lot of transparent margin — the artwork's lowest
 * opaque pixel sits well above the bottom of its own image box. Colliding
 * the element's layout box against the container therefore parked the head
 * with a band of empty pixels resting on the floor, reading as hovering.
 * The physics body is now the image's ALPHA BOUNDS: measured once from the
 * decoded PNG, carried as fractions of the element box, and rotated with
 * the head each frame. Because that opaque rect is off-centre within the
 * box, rotating it moves its centre too — hence the rotated offset applied
 * below, not just a rotated size.
 *
 * ROLLING (same round, per "I also want to make sure the head rolls and has
 * proper physics. Right now there's a feeling of it getting stuck.")
 * Contact with the floor now drives spin from horizontal speed the way a
 * wheel rolls (omega = v / r), instead of receiving a single impulse at the
 * moment of impact and then being killed by drag. Angular drag is much
 * lower, floor friction bleeds speed over about a second rather than
 * instantly, and the sleep thresholds sit low enough that the head is
 * genuinely finished moving before it parks.
 *
 * SIZE: 25% smaller than the original build, per Noah. The right/bottom
 * insets scale with it, since both were derived from the head's own
 * transparent margins.
 *
 * Eye tracking is unchanged except that each eye reads the head's LIVE
 * angle from `rotationRef`; a fixed constant would send the pupils sideways
 * by the tumble angle the moment the head was thrown.
 */

// Head's designed resting angle in the header.
const BASE_ROTATION_DEG = 42;

// Designed resting geometry, in artboard units. All three scaled by 0.75
// together (from 424.94 / 42.98 / -40.31) so the smaller head still sits
// flush to the header's right edge with its neck meeting the bottom.
const HEAD_WIDTH_UNITS = 318.705;
const HEAD_RIGHT_UNITS = 32.235;
const HEAD_BOTTOM_UNITS = -30.2325;

// Eye socket centres as a fraction (0-1) of the head image's own box,
// measured from head.png's alpha-channel hole positions.
const LEFT_EYE_CENTER = { x: 0.2992, y: 0.4165 };
const RIGHT_EYE_CENTER = { x: 0.6153, y: 0.4117 };

// How far (px) a pupil may drift from dead-centre. Kept small and
// radius-clamped so the socket edges never expose the transparent hole.
const MAX_EYE_OFFSET_PX = 3.2;

// --- Physics constants (px/s, px/s^2) -------------------------------------
const GRAVITY = 2600;
/** Energy kept after a bounce. */
const RESTITUTION = 0.5;
/** Fraction of horizontal speed shed per second while touching the floor.
 * Tuned so a good throw rolls for roughly a second before settling. */
const FLOOR_FRICTION_PER_SEC = 1.15;
/** Per-second drag on travel and spin while airborne. Angular drag is much
 * lower than the first build's 0.9, which was strangling the tumble. */
const AIR_DRAG = 0.22;
const ANGULAR_DRAG = 0.3;
/** How fast floor contact pulls spin toward the true rolling rate. */
const ROLL_LOCK_RATE = 10;
/** Below these, on the floor, the head is done. */
const SLEEP_SPEED = 16;
const SLEEP_SPIN = 8;
/** Throw ceiling, so a violent flick can't outrun the eye. */
const MAX_THROW_SPEED = 2600;

/** One tracked eye: computes its own instantaneous vector to the cursor and
 * translates up to MAX_EYE_OFFSET_PX toward it — no easing, per Noah's
 * "instantaneous" requirement.
 *
 * Anchors off the eye element's OWN rect: getBoundingClientRect() on a
 * rotated element returns the axis-aligned box of the rotated shape, whose
 * corners are not the head's corners, so deriving the socket position from
 * the head's rect silently drifts. This div is placed by percentage inside
 * the head's unrotated content box, so the browser puts it in the right
 * spot at any rotation and its own rect centre IS the socket. */
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
  /** Live total rotation of the head, degrees. */
  rotationRef: React.RefObject<number>;
}) {
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const el = eyeRef.current;
      if (!el) return;
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

      // Counter-rotate into the head's local space: a child's translate
      // happens in its parent's already-rotated frame.
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
      {/* Off-white backing disc BEHIND the eye so an extreme offset can
          never expose the transparent socket hole. */}
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
  /** The red header the head is confined to. */
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef<number>(BASE_ROTATION_DEG);

  // Alpha bounds of head.png as fractions of the element box. Starts as the
  // full box and tightens once the PNG has been measured.
  const opaque = useRef({ x0: 0, y0: 0, x1: 1, y1: 1 });

  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const spin = useRef(0);
  const dragging = useRef(false);
  const asleep = useRef(true);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const samples = useRef<{ x: number; y: number; t: number }[]>([]);
  const grabOffset = useRef({ x: 0, y: 0 });

  // Measure the artwork's opaque bounds once. Done from the decoded image
  // rather than hardcoded so it stays correct if the asset is re-exported.
  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.src = "/assets/about/head.png";
    img.onload = () => {
      if (cancelled) return;
      // A small raster is plenty: this only needs to be accurate to a
      // fraction of a percent of the head's size.
      const W = 160;
      const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W));
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      let minX = W, minY = H, maxX = -1, maxY = -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return;
      opaque.current = {
        x0: minX / W,
        y0: minY / H,
        x1: (maxX + 1) / W,
        y1: (maxY + 1) / H,
      };
    };
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const container = containerRef.current;
    if (!wrap || !container) return;

    const apply = () => {
      wrap.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) rotate(${rotationRef.current}deg)`;
    };

    /** The physics body: the artwork's opaque rect, rotated. Returns its
     * half-extents plus the offset of its centre from the element's centre
     * (rotation about the element centre carries the off-centre opaque rect
     * around with it). */
    const body = () => {
      const W = wrap.offsetWidth;
      const H = wrap.offsetHeight;
      const o = opaque.current;
      const ow = (o.x1 - o.x0) * W;
      const oh = (o.y1 - o.y0) * H;
      // Opaque centre relative to the element centre, unrotated.
      const ox = ((o.x0 + o.x1) / 2 - 0.5) * W;
      const oy = ((o.y0 + o.y1) / 2 - 0.5) * H;
      const rad = (rotationRef.current * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      return {
        hw: (ow * Math.abs(c) + oh * Math.abs(s)) / 2,
        hh: (ow * Math.abs(s) + oh * Math.abs(c)) / 2,
        // Rotated offset of the opaque centre.
        rx: ox * c - oy * s,
        ry: ox * s + oy * c,
      };
    };

    /** Element centre at zero offset, derived from the rendered rect minus
     * the current offset — no style mutation, correct whenever called. */
    const measureBase = () => {
      const r = wrap.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - cr.left - pos.current.x,
        y: r.top + r.height / 2 - cr.top - pos.current.y,
      };
    };

    let base = measureBase();
    const initialMeasure = requestAnimationFrame(() => {
      base = measureBase();
    });
    const onResize = () => {
      base = measureBase();
    };
    window.addEventListener("resize", onResize);

    /* Runs for as long as the component is mounted and skips the physics
     * while at rest. It used to stop and restart itself behind a rafRef
     * gate; any path that cancelled a frame without clearing the ref shut
     * that gate permanently and froze the head. An idle frame costs one
     * boolean test, which is cheaper than that class of bug. */
    const step = (ts: number) => {
      rafRef.current = requestAnimationFrame(step);

      if (lastTs.current == null) lastTs.current = ts;
      // Clamp dt so a backgrounded tab returning can't integrate one huge
      // step and hurl the head through a wall.
      const dt = Math.min((ts - lastTs.current) / 1000, 1 / 30);
      lastTs.current = ts;

      if (asleep.current && !dragging.current) return;

      if (!dragging.current) {
        vel.current.y += GRAVITY * dt;
        const drag = Math.max(0, 1 - AIR_DRAG * dt);
        vel.current.x *= drag;
        vel.current.y *= drag;
        spin.current *= Math.max(0, 1 - ANGULAR_DRAG * dt);

        pos.current.x += vel.current.x * dt;
        pos.current.y += vel.current.y * dt;
        rotationRef.current += spin.current * dt;

        const cr = container.getBoundingClientRect();
        const b = body();
        // Position of the VISIBLE head's centre, which is what collides.
        const cx = base.x + pos.current.x + b.rx;
        const cy = base.y + pos.current.y + b.ry;

        const minX = b.hw;
        const maxX = cr.width - b.hw;
        const minY = b.hh;
        const maxY = cr.height - b.hh;

        if (cx < minX) {
          pos.current.x += minX - cx;
          vel.current.x = Math.abs(vel.current.x) * RESTITUTION;
          spin.current -= vel.current.y * 0.06;
        } else if (cx > maxX) {
          pos.current.x -= cx - maxX;
          vel.current.x = -Math.abs(vel.current.x) * RESTITUTION;
          spin.current += vel.current.y * 0.06;
        }

        if (cy < minY) {
          pos.current.y += minY - cy;
          vel.current.y = Math.abs(vel.current.y) * RESTITUTION;
        } else if (cy > maxY) {
          // Sit exactly on the floor — the bottom of the VISIBLE head now
          // meets the bottom of the red header, with no transparent gap.
          pos.current.y -= cy - maxY;
          if (vel.current.y > 0) vel.current.y = -vel.current.y * RESTITUTION;

          // Roll: ground contact ties spin to horizontal speed the way a
          // wheel rolls, easing toward it rather than snapping so a skid
          // becomes a roll instead of an instant lock.
          const rEff = Math.max(b.hh, 1);
          const rollSpin = (vel.current.x / rEff) * (180 / Math.PI);
          spin.current += (rollSpin - spin.current) * Math.min(1, ROLL_LOCK_RATE * dt);
          vel.current.x *= Math.max(0, 1 - FLOOR_FRICTION_PER_SEC * dt);

          if (
            Math.abs(vel.current.y) < SLEEP_SPEED &&
            Math.abs(vel.current.x) < SLEEP_SPEED &&
            Math.abs(spin.current) < SLEEP_SPIN
          ) {
            vel.current.x = 0;
            vel.current.y = 0;
            spin.current = 0;
            asleep.current = true;
          }
        }
      }

      apply();
    };

    const wake = () => {
      asleep.current = false;
    };

    const pointerPos = (e: PointerEvent) => {
      const cr = container.getBoundingClientRect();
      return { x: e.clientX - cr.left, y: e.clientY - cr.top };
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      // One rect read, and it keeps the walls honest across anything that
      // shifted the layout since mount (font swap, image load, zoom).
      base = measureBase();
      dragging.current = true;
      wrap.setPointerCapture(e.pointerId);
      wrap.style.cursor = "grabbing";
      const p = pointerPos(e);
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
      // Keep the last ~90ms: long enough to smooth jitter, short enough
      // that a throw reflects the final gesture.
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
        /* pointer already gone — nothing to release */
      }
      wrap.style.cursor = "grab";

      const s = samples.current;
      if (s.length >= 2) {
        const first = s[0];
        const last = s[s.length - 1];
        const dtSec = (last.t - first.t) / 1000;
        if (dtSec > 0) {
          let vx = (last.x - first.x) / dtSec;
          let vy = (last.y - first.y) / dtSec;
          const speed = Math.hypot(vx, vy);
          if (speed > MAX_THROW_SPEED) {
            vx = (vx / speed) * MAX_THROW_SPEED;
            vy = (vy / speed) * MAX_THROW_SPEED;
          }
          vel.current = { x: vx, y: vy };
          spin.current = vx * 0.2;
        }
      }
      samples.current = [];
      wake();
    };

    wrap.style.cursor = "grab";
    wrap.style.touchAction = "none";
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);
    // Safety net: if pointer capture is ever lost, a window-level release
    // still ends the drag instead of leaving the head glued to the cursor.
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    rafRef.current = requestAnimationFrame(step);
    apply();

    return () => {
      cancelAnimationFrame(initialMeasure);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        // Null it, don't just cancel: a stale id here would keep a remount
        // from ever starting a new loop.
        rafRef.current = null;
      }
    };
  }, [containerRef]);

  return (
    <div
      ref={wrapRef}
      className="absolute select-none"
      style={{
        right: `calc(var(--u) * ${HEAD_RIGHT_UNITS})`,
        bottom: `calc(var(--u) * ${HEAD_BOTTOM_UNITS})`,
        width: `calc(var(--u) * ${HEAD_WIDTH_UNITS})`,
        transform: `rotate(${BASE_ROTATION_DEG}deg)`,
        transformOrigin: "center center",
        willChange: "transform",
      }}
    >
      <div className="relative w-full" style={{ aspectRatio: "1297/1970" }}>
        {/* Eyes render BEHIND the head image — head.png's transparent socket
            holes mask each eye to the correct almond shape, with the eyelid
            skin painted into head.png on top. Eyes must come first in DOM
            order for that masking to work. */}
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
