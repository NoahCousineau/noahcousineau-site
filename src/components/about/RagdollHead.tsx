"use client";

import { useEffect, useRef } from "react";
import HeadWithEyes from "@/components/HeadWithEyes";
import { useTheme } from "@/components/ThemeProvider";
import { headAsset } from "@/lib/headAssets";

/*
 * RAGDOLL HEAD — grab it, drag it, throw it. On release it keeps the
 * velocity of the throw, falls under gravity, tumbles, rolls along the
 * floor and bounces off the walls of the red header, losing energy until it
 * settles — and then STAYS WHERE IT LANDS (Noah's explicit choice over
 * springing back to its designed spot).
 *
 * COLLISION SHAPE: THE SILHOUETTE'S SUPPORT FUNCTION (2026-08-21, fourth
 * pass — Noah: "The head roll is better, but it's still going below the red
 * border. Try moving the head horizontally. You'll see that the top of the
 * head and the neck are pretty good. the sides of the head can dip a bit.")
 *
 * History of this collision shape, each round closing the gap further:
 *   1. The element's own rotated LAYOUT BOX — left a big band of the
 *      artwork's transparent margin resting on the floor, reading as
 *      hovering.
 *   2. The rotated RECTANGLE bounding just the opaque pixels — closer, but
 *      a rotated rectangle's own axis-aligned bounding box is strictly
 *      LARGER than the rectangle at any non-90deg-multiple angle (worst
 *      near 45deg, and the head rests at 42deg), so it still stopped
 *      measurably before the visible edge.
 *   3. An ELLIPSE inscribed in that same rect — tighter still, but a head
 *      isn't a perfect ellipse either, so an angle-dependent residual
 *      remained.
 *   4. A RADIAL EXTENT MAP measured off the real alpha channel — the right
 *      data, asked the wrong question. It stored the distance to the edge
 *      ALONG each ray, so "how far down does the shape reach?" returned the
 *      distance to the point directly BELOW the pivot. For anything longer
 *      than it is wide, the actual lowest point is off to one side and sits
 *      lower than that, so the head settled short by the difference and sank
 *      through the border. The error vanishes at the ends of the long axis
 *      and peaks across it — which is exactly why Noah saw the top of the
 *      head and the neck behaving while "the sides of the head can dip".
 *
 * This round asks the right question: the SUPPORT FUNCTION, the furthest
 * the shape reaches in a given direction taken over the whole shape rather
 * than along one ray. Resting against a flat floor or wall IS a support
 * query, so this is exact for those contacts, not a closer approximation.
 * See the measurement effect for how it's built (per-row extremes only,
 * which is provably sufficient) and `supportAt` for why lookups round up.
 *
 * PIVOT = CENTRE OF AREA. Noah, same round: "You can disregard the center
 * of mass issue when using this" — the skull-weighting added in the
 * previous pass existed to make a head-plus-neck shape tumble as though the
 * skull were the heavy end, and with the neck gone the silhouette is close
 * enough to a plain oval that its own centre of area is both the honest
 * centre of mass and the better pivot to roll about. Rotation origin and
 * collision share this one point, so the visual tumble and the physics
 * can't drift apart.
 *
 * ROLLING: contact with the floor drives spin from horizontal speed the
 * way a wheel rolls (omega = v / r, using the current DOWN extent as r),
 * instead of a single impulse at impact killed by drag. Angular drag is
 * light, floor friction bleeds speed over about a second, and the sleep
 * thresholds sit low enough that the head is genuinely finished moving
 * before it parks.
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

// Designed resting geometry, in artboard units. Width and the right inset
// were scaled by 0.75 together (from 424.94 / 42.98) so the smaller head
// still sits flush to the header's right edge.
const HEAD_WIDTH_UNITS = 318.705;
const HEAD_RIGHT_UNITS = 32.235;
/** Only a starting guess now. The loop solves the true resting offset from
 * the measured silhouette on the first frame (see the SEAT THE DESIGNED
 * REST POSE note), because the right number differs between the light and
 * dark heads — they're different photographs with different proportions. */
const HEAD_BOTTOM_UNITS = 0;

// --- Physics constants (px/s, px/s^2) -------------------------------------
const GRAVITY = 2600;
/** Energy kept after a bounce. */
const RESTITUTION = 0.5;
/** Fraction of horizontal speed shed per second while touching the floor.
 * Tuned so a good throw rolls for roughly a second before settling. */
const FLOOR_FRICTION_PER_SEC = 1.15;
/** Per-second drag on travel and spin while airborne. */
const AIR_DRAG = 0.22;
const ANGULAR_DRAG = 0.3;
/** How fast floor contact pulls spin toward the true rolling rate. */
const ROLL_LOCK_RATE = 10;
/** Below these, on the floor, the head is done. */
const SLEEP_SPEED = 16;
const SLEEP_SPIN = 8;
/** Throw ceiling, so a violent flick can't outrun the eye. */
const MAX_THROW_SPEED = 2600;

// --- Measured shape (populated async from the decoded PNG) ---------------
/** One sample per degree. The whole table is a few hundred multiply-adds to
 * build, once, so there's no reason to be coarser. */
const BUCKET_COUNT = 360;

type ShapeData = {
  /** Centre of area of the silhouette, as a fraction (0-1) of the box. */
  pivot: { x: number; y: number };
  /** SUPPORT function: for each direction, how far the silhouette reaches
   * from the pivot ALONG that direction — i.e. max over the shape of
   * (p - pivot) · d. Stored as a fraction of the element's own WIDTH, so
   * one multiply converts it to px at any rendered size. Index i is the
   * direction i degrees clockwise from screen-right. */
  support: Float32Array;
};

/** Reasonable guesses for the brief window before the PNG has decoded —
 * close enough that nothing looks broken if a drag happens immediately. */
function defaultShape(): ShapeData {
  return { pivot: { x: 0.5, y: 0.45 }, support: new Float32Array(BUCKET_COUNT).fill(0.35) };
}

/** Support in an arbitrary direction (degrees, any range), as a fraction of
 * width. Takes the LARGER of the two neighbouring samples rather than
 * interpolating between them: interpolation of a support function always
 * errs low, and erring low here means the head sinks through the floor,
 * which is the exact bug this table was introduced to fix. At 1-degree
 * spacing the resulting overestimate is bounded by 1/cos(0.5deg) — about
 * 4 hundredths of a pixel on this head. */
function supportAt(support: Float32Array, deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  const i0 = Math.floor(d) % BUCKET_COUNT;
  const i1 = (i0 + 1) % BUCKET_COUNT;
  return Math.max(support[i0], support[i1]);
}

export default function RagdollHead({
  containerRef,
}: {
  /** The red header the head is confined to. */
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef<number>(BASE_ROTATION_DEG);
  const shape = useRef<ShapeData>(defaultShape());

  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const spin = useRef(0);
  const dragging = useRef(false);
  const asleep = useRef(true);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const samples = useRef<{ x: number; y: number; t: number }[]>([]);
  const grabOffset = useRef({ x: 0, y: 0 });
  /** True once the reader has actually grabbed the head. Before that it owns
   * its designed rest pose; after, wherever they left it is the truth. */
  const interacted = useRef(false);
  /** Ask the loop to seat the head exactly on the floor next frame. */
  const needsSnap = useRef(true);

  // Which head is on screen — the light cut-out, or the sunglasses one in
  // dark mode. The silhouettes differ, so this drives a re-measure.
  const { theme } = useTheme();
  const headSrc = headAsset(theme).src;

  // Measure the artwork's true silhouette. Done from the decoded PNG rather
  // than hardcoded so it stays correct if the asset is re-exported — and so
  // that swapping themes re-derives the collision shape for the head that's
  // actually being drawn, instead of colliding the new artwork against the
  // old one's outline.
  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.src = headSrc;
    img.onload = () => {
      if (cancelled) return;
      const W = 200;
      const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W));
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      // Faint antialiased fringe pixels shouldn't count as part of the
      // solid silhouette — they'd inflate the measured extent and
      // reintroduce a small version of the gap this is fixing.
      const ALPHA_THRESHOLD = 40;
      const isOpaque = (x: number, y: number) => d[(y * W + x) * 4 + 3] > ALPHA_THRESHOLD;

      // Centre of area, and the silhouette's per-row horizontal extremes.
      // Those extremes are all the support function needs and it is EXACT
      // from them, not an approximation: for a fixed row, (p - pivot) · d
      // is linear in x, so its maximum over that row is always attained at
      // the row's leftmost or rightmost opaque pixel. Every interior pixel
      // is therefore irrelevant, which turns the table below from a
      // per-pixel job into a per-row one.
      let sumX = 0, sumY = 0, count = 0;
      const edgeX: number[] = [];
      const edgeY: number[] = [];
      for (let y = 0; y < H; y++) {
        let rowMin = -1, rowMax = -1;
        for (let x = 0; x < W; x++) {
          if (!isOpaque(x, y)) continue;
          if (rowMin < 0) rowMin = x;
          rowMax = x;
          sumX += x;
          sumY += y;
          count++;
        }
        if (rowMin >= 0) {
          edgeX.push(rowMin, rowMax);
          edgeY.push(y, y);
        }
      }
      if (count === 0) return; // fully transparent somehow; keep the default
      const pivotPx = { x: sumX / count, y: sumY / count };

      // SUPPORT FUNCTION, not a ray cast (2026-08-21 — Noah: "it's still
      // going below the red border... the sides of the head can dip a bit").
      //
      // The previous table stored, for each angle, the distance to the
      // silhouette edge ALONG that ray. Collision then asked "how far does
      // the shape reach straight down?" and got the distance to the single
      // point directly beneath the pivot. But the lowest point of a rotated
      // shape is generally NOT the point directly beneath its pivot — for
      // anything longer than it is wide, the true lowest point sits off to
      // one side, and the ray answer is short by the difference. The head
      // therefore settled that much too low, worst at the rotations where
      // the shape is most elongated across the vertical — which is exactly
      // "the sides dip" and exactly why the top of the head and the neck
      // (the ends of the long axis, where ray and support agree) looked
      // fine.
      //
      // The support function asks the right question directly: the furthest
      // the shape reaches in a direction, over the whole shape. Resting on
      // a flat floor or wall is precisely a support query, so this is exact
      // rather than merely closer.
      const supportPx = new Float32Array(BUCKET_COUNT);
      const n = edgeX.length;
      for (let b = 0; b < BUCKET_COUNT; b++) {
        const th = (b * Math.PI) / 180;
        const dx = Math.cos(th);
        const dy = Math.sin(th);
        let best = -Infinity;
        for (let i = 0; i < n; i++) {
          const v = (edgeX[i] - pivotPx.x) * dx + (edgeY[i] - pivotPx.y) * dy;
          if (v > best) best = v;
        }
        supportPx[b] = best;
      }

      shape.current = {
        pivot: { x: pivotPx.x / W, y: pivotPx.y / H },
        support: supportPx.map((v) => v / W),
      };

      // The CSS rotation origin follows the same measured pivot, so the
      // visual tumble and the collision math share one reference point —
      // see the PIVOT note above.
      if (wrapRef.current) {
        wrapRef.current.style.transformOrigin = `${shape.current.pivot.x * 100}% ${shape.current.pivot.y * 100}%`;
      }
      // A theme swap changes the silhouette AND the box's aspect ratio under
      // a head that may be parked mid-scene. If the reader has thrown it
      // somewhere, wake the loop so it falls the last few pixels and
      // re-settles against its new outline rather than freezing in a pose
      // that no longer fits. If they haven't touched it, it still owns its
      // designed rest pose, so re-seat it there exactly instead.
      if (interacted.current) asleep.current = false;
      else needsSnap.current = true;
    };
    return () => {
      cancelled = true;
    };
  }, [headSrc]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const container = containerRef.current;
    if (!wrap || !container) return;

    const apply = () => {
      wrap.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) rotate(${rotationRef.current}deg)`;
    };

    /** The pivot's screen position (container-relative) at the current
     * pos offset. `offsetLeft`/`offsetTop`/`offsetWidth`/`offsetHeight`
     * are pure CSS-layout quantities — completely unaffected by the
     * element's own `transform` — so this is correct at any rotation with
     * no caching and no assumptions about rotating-box symmetry (the
     * previous version derived this from the RENDERED, rotated rect and
     * only worked because it assumed the rotation origin was exactly the
     * box's own centre; with the pivot now off-centre that assumption no
     * longer holds, so this reads the true layout position directly
     * instead). Container is guaranteed to be `wrap`'s offsetParent: the
     * red header section is `position: relative` and `wrap` is its direct
     * child with nothing positioned in between. */
    const pivotScreen = () => ({
      x: wrap.offsetLeft + shape.current.pivot.x * wrap.offsetWidth + pos.current.x,
      y: wrap.offsetTop + shape.current.pivot.y * wrap.offsetHeight + pos.current.y,
    });

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

      /* SEAT THE DESIGNED REST POSE FROM THE MEASURED SHAPE, rather than
       * from a hand-tuned CSS inset. The old inset was dialled in against a
       * head that had a neck hanging past the header's bottom edge; with the
       * neck gone — and with a second, differently-proportioned head in dark
       * mode — any single hardcoded number is wrong for at least one of
       * them. Solving for it puts the chin exactly on the border in both,
       * and keeps doing so if either artwork is ever re-exported. */
      if (needsSnap.current && !dragging.current) {
        const cr0 = container.getBoundingClientRect();
        if (cr0.height > 0 && wrap.offsetWidth > 0) {
          const drop = supportAt(shape.current.support, 90 - rotationRef.current) * wrap.offsetWidth;
          pos.current.y += cr0.height - drop - pivotScreen().y;
          needsSnap.current = false;
          apply();
        }
      }

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
        const p = pivotScreen();
        const W = wrap.offsetWidth;
        const rot = rotationRef.current;
        // Screen-space cardinal extents from the pivot, converted to the
        // silhouette's own (unrotated) angle frame: a point at image-angle
        // θ ends up at screen-angle θ+rot after a CSS rotate(rot) (CSS
        // rotation is clockwise-positive in this Y-down coordinate system,
        // matching atan2(dy,dx) directly), so the image-angle to query for
        // a given screen direction is that direction's angle minus rot.
        const right = supportAt(shape.current.support, 0 - rot) * W;
        const down = supportAt(shape.current.support, 90 - rot) * W;
        const left = supportAt(shape.current.support, 180 - rot) * W;
        const up = supportAt(shape.current.support, 270 - rot) * W;

        const minX = left;
        const maxX = cr.width - right;
        const minY = up;
        const maxY = cr.height - down;

        // CORNER REST — below this incoming speed, a side-wall touch just
        // clamps position, with no bounce/torque injected. Without this, a
        // head settling in a corner (touching a side wall AND the floor in
        // the same frame) could clamp against the wall every single frame
        // at a near-zero but non-zero velocity, each touch re-injecting a
        // tiny amount of spin/velocity via the bounce response below —
        // never quite crossing the sleep thresholds, so it drifted for a
        // very long time instead of settling. Confirmed by isolating the
        // two cases: a straight floor drop (no wall involved) settled
        // cleanly in a handful of frames; a corner drop kept drifting.
        // Below this threshold there's nothing worth bouncing anyway — the
        // touch just becomes a rest against the wall, the way it would
        // for a real object with imperceptible momentum.
        const WALL_REST_SPEED = 20;

        if (p.x < minX) {
          pos.current.x += minX - p.x;
          if (Math.abs(vel.current.x) > WALL_REST_SPEED) {
            vel.current.x = Math.abs(vel.current.x) * RESTITUTION;
            spin.current -= vel.current.y * 0.06;
          } else {
            vel.current.x = 0;
          }
        } else if (p.x > maxX) {
          pos.current.x -= p.x - maxX;
          if (Math.abs(vel.current.x) > WALL_REST_SPEED) {
            vel.current.x = -Math.abs(vel.current.x) * RESTITUTION;
            spin.current += vel.current.y * 0.06;
          } else {
            vel.current.x = 0;
          }
        }

        if (p.y < minY) {
          pos.current.y += minY - p.y;
          vel.current.y = Math.abs(vel.current.y) * RESTITUTION;
        } else if (p.y > maxY) {
          // Sit exactly on the floor — the bottom of the VISIBLE head now
          // meets the bottom of the red header, with no transparent gap.
          pos.current.y -= p.y - maxY;
          // FLOOR REST, NOT AN UNCONDITIONAL BOUNCE (2026-08-21 — the
          // rEff fix above tamed the runaway growth but rotation was still
          // drifting at a near-constant rate instead of decaying, over many
          // forced frames). Root cause: this branch had no floor-equivalent
          // of WALL_REST_SPEED below. Every frame at rest, gravity adds a
          // fresh GRAVITY*dt to vel.y, and this line unconditionally flipped
          // it — so vel.y chattered forever a bit above SLEEP_SPEED instead
          // of ever reaching exactly 0, and each of THOSE touches also fed
          // the left/right-wall branches' `spin -= vel.y*0.06` coupling
          // whenever the head was in a corner, continuously re-injecting
          // spin. Same fix as the wall case: below a small incoming speed,
          // just clamp to the floor with zero vertical velocity rather than
          // bouncing a fraction of it back.
          if (vel.current.y > WALL_REST_SPEED) {
            vel.current.y = -vel.current.y * RESTITUTION;
          } else {
            vel.current.y = 0;
          }

          // Roll: ground contact ties spin to horizontal speed the way a
          // wheel rolls, easing toward it rather than snapping so a skid
          // becomes a roll instead of an instant lock. `down` (the current
          // pivot-to-floor distance) is the effective rolling radius.
          //
          // FLOOR RADIUS, NOT 1px (2026-08-21 — Noah: "still a little bit of
          // gap or dip" persisted after the wall-rest fix above, traced to
          // this line). Now that the pivot is skull-weighted instead of
          // centred, `down` swings widely with rotation — small whenever the
          // TOP of the head is what's facing the floor, since that's close
          // to the skull pivot. `Math.max(down, 1)` let it collapse to a
          // couple of px there, and rollSpin = vel.x / rEff blew up toward
          // thousands of deg/s at that instant — which the roll-lock then
          // aggressively chased every frame, so rotation kept ACCELERATING
          // through those angles instead of decaying (confirmed by reading
          // the live transform across forced frames: -0.99°, -1.02°, -1.24°,
          // -1.17°, -1.40° per frame — growing, not shrinking). Flooring at a
          // fraction of the head's own width keeps the radius physically
          // plausible at every angle, so a small vel.x can no longer demand
          // an enormous spin.
          const rEff = Math.max(down, W * 0.2);
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
      interacted.current = true;
      dragging.current = true;
      wrap.setPointerCapture(e.pointerId);
      wrap.style.cursor = "grabbing";
      const p = pointerPos(e);
      const piv = pivotScreen();
      grabOffset.current = { x: piv.x - p.x, y: piv.y - p.y };
      samples.current = [{ ...p, t: performance.now() }];
      vel.current = { x: 0, y: 0 };
      wake();
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const p = pointerPos(e);
      // Solve for the pos offset that puts the pivot at (pointer +
      // grabOffset): pivotScreen() = layoutPivot + pos, so
      // pos = target - layoutPivot = target - (pivotScreen() - pos.current).
      const targetX = p.x + grabOffset.current.x;
      const targetY = p.y + grabOffset.current.y;
      const piv = pivotScreen();
      const layoutPivotX = piv.x - pos.current.x;
      const layoutPivotY = piv.y - pos.current.y;
      pos.current.x = targetX - layoutPivotX;
      pos.current.y = targetY - layoutPivotY;
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
        // Default before the pivot is measured; the load effect overwrites
        // this with the measured centre of area once it's known.
        transformOrigin: "50% 45%",
        willChange: "transform",
      }}
    >
      <HeadWithEyes rotationRef={rotationRef} priority alt="Noah Cousineau" />
    </div>
  );
}
