/**
 * Measuring a cut-out's true shape from its alpha channel, for physics.
 *
 * Extracted from the About page's ragdoll head so the project-grid objects
 * can be thrown around with the same collision behaviour rather than a second
 * approximation of it. The head still runs its own copy of the integrator;
 * this is the part that was worth sharing first, because it is the part that
 * took several passes to get right.
 *
 * THREE DESCRIPTIONS OF ONE SHAPE, because the three things the physics asks
 * of a silhouette genuinely want different answers:
 *
 * 1. `support` — THE SUPPORT FUNCTION, NOT A RAY CAST. For each direction,
 *    how far the shape reaches ALONG that direction taken over the whole
 *    shape — max of (p - pivot) · d — rather than the distance to the edge
 *    along a ray from the pivot. The two are not the same and the difference
 *    is not subtle: a ray answers "what is directly below the pivot", but the
 *    lowest point of a rotated shape is generally off to one side and sits
 *    lower than that. Using rays made the head settle up to 31px through the
 *    floor at its resting angle. Resting against a flat edge IS a support
 *    query, so this is exact for the floor and the walls.
 *
 * 2. `radius` — THE ACTUAL PERIMETER, along a ray this time. 2026-08-23,
 *    Noah: "it would be good if the bounding area for each shape was closer
 *    to its actual perimeter." Between two BODIES the support function is
 *    the wrong tool: it is the convex hull's reach, so an ampersand keeps
 *    every neighbour a hand's width away from the empty middle of the "&",
 *    and a hammer holds things off the notch under its head. Support is only
 *    exact for a convex shape, and none of these are. This is the honest
 *    distance to the outline in each direction, so concave shapes can
 *    actually nest. It is used ONLY for body-body contact — never against
 *    the floor, where erring short would put an object through the rule.
 *
 * 3. `hull` — the convex hull, as points, so the solver can ask WHERE a body
 *    touches rather than only how far it reaches. Balance needs the contact
 *    to be a region and not a number: an object is stable when its centre of
 *    mass sits over the patch it is standing on, and topples when it does
 *    not. See the toppling note in useDropField.
 *
 * `pivot` is the centroid of the opaque area, which for a flat cut-out of
 * uniform material IS its centre of mass — which is what makes the balance
 * test above physically meaningful rather than a heuristic about the middle
 * of the box.
 */

/** One sample per degree; the whole table is a few hundred multiply-adds. */
export const SUPPORT_BUCKETS = 360;

export type Silhouette = {
  /** Centre of area (= centre of mass), as a fraction (0-1) of the box. */
  pivot: { x: number; y: number };
  /** Support distance per degree, as a fraction of the image's WIDTH. */
  support: Float32Array;
  /** Distance to the OUTLINE per degree, as a fraction of the WIDTH. */
  radius: Float32Array;
  /** Convex hull, [x0,y0,x1,y1,...], relative to the pivot, in WIDTH fractions. */
  hull: Float32Array;
};

/** A regular polygon, for the fallback/disc shapes. */
function circleHull(r: number, n = 24): Float32Array {
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out[i * 2] = Math.cos(t) * r;
    out[i * 2 + 1] = Math.sin(t) * r;
  }
  return out;
}

export function defaultSilhouette(): Silhouette {
  return {
    pivot: { x: 0.5, y: 0.5 },
    support: new Float32Array(SUPPORT_BUCKETS).fill(0.4),
    radius: new Float32Array(SUPPORT_BUCKETS).fill(0.4),
    hull: circleHull(0.4),
  };
}

/** A disc's reach is its radius in every direction — half its own box. */
export function discSilhouette(): Silhouette {
  return {
    pivot: { x: 0.5, y: 0.5 },
    support: new Float32Array(SUPPORT_BUCKETS).fill(0.5),
    radius: new Float32Array(SUPPORT_BUCKETS).fill(0.5),
    hull: circleHull(0.5),
  };
}

/**
 * Support in an arbitrary direction, as a fraction of width.
 *
 * Takes the LARGER of the two neighbouring samples rather than interpolating:
 * interpolating a support function always errs low, and erring low here means
 * the shape sinks through whatever it is resting on. At one-degree spacing
 * the resulting overestimate is bounded by 1/cos(0.5deg).
 */
export function supportAt(support: Float32Array, deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  const i0 = Math.floor(d) % SUPPORT_BUCKETS;
  return Math.max(support[i0], support[(i0 + 1) % SUPPORT_BUCKETS]);
}

/**
 * Distance to the outline in a direction, as a fraction of width. Same
 * round-up-rather-than-interpolate rule as supportAt, and for the same
 * reason — between two bodies, erring short is what lets them visibly
 * overlap.
 */
export function radiusAt(radius: Float32Array, deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  const i0 = Math.floor(d) % SUPPORT_BUCKETS;
  return Math.max(radius[i0], radius[(i0 + 1) % SUPPORT_BUCKETS]);
}

/** Andrew's monotone chain. Points as [x,y] pairs; returns them in order. */
function convexHull(pts: number[][]): number[][] {
  if (pts.length < 3) return pts;
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: number[][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: number[][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0)
      upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Scan a decoded image's alpha channel into a Silhouette.
 *
 * Works off the OUTLINE — every opaque pixel with a non-opaque neighbour —
 * rather than each row's horizontal extremes. The row-extremes trick is
 * exact for the support function (for a fixed row, (p - pivot) · d is linear
 * in x, so the row's max is always at one of its ends) and that is all this
 * used to compute. It is NOT enough for `radius`: the topmost edge of a wide
 * shape is interior to its row, so a ray pointing straight up would find
 * nothing there and the outline would read as the two far corners instead.
 * A real boundary walk costs one extra pass and answers all three questions.
 */
export function measureSilhouette(
  img: HTMLImageElement,
  sampleWidth = 200,
  alphaThreshold = 40
): Silhouette | null {
  const W = sampleWidth;
  const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, W, H).data;
  } catch {
    return null; // tainted canvas — caller keeps the default shape
  }

  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > alphaThreshold;

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  const bx: number[] = [];
  const by: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!opaque(x, y)) continue;
      sumX += x;
      sumY += y;
      count++;
      // On the outline if any 4-neighbour is clear (or off the canvas).
      if (!opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1)) {
        bx.push(x);
        by.push(y);
      }
    }
  }
  if (count === 0 || bx.length === 0) return null;

  const px = sumX / count;
  const py = sumY / count;

  const support = new Float32Array(SUPPORT_BUCKETS);
  const radius = new Float32Array(SUPPORT_BUCKETS);
  support.fill(-Infinity);

  const n = bx.length;
  const hullPts: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const dx = bx[i] - px;
    const dy = by[i] - py;
    hullPts[i] = [dx, dy];
    // Radius: bucket the point by its own bearing, keep the farthest.
    const dist = Math.hypot(dx, dy);
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (a < 0) a += 360;
    const bkt = Math.floor(a) % SUPPORT_BUCKETS;
    if (dist > radius[bkt]) radius[bkt] = dist;
  }

  // Support: max projection over the outline, per direction.
  for (let b = 0; b < SUPPORT_BUCKETS; b++) {
    const th = (b * Math.PI) / 180;
    const dxu = Math.cos(th);
    const dyu = Math.sin(th);
    let best = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = hullPts[i][0] * dxu + hullPts[i][1] * dyu;
      if (v > best) best = v;
    }
    support[b] = best / W;
  }

  // A very thin shape can leave a bearing with no outline pixel in it at
  // all. Fill from the nearest bucket that has one, so a gap reads as "about
  // as far as its neighbours" instead of as zero (which would let a
  // neighbouring body slide straight into the middle of this one).
  for (let b = 0; b < SUPPORT_BUCKETS; b++) {
    if (radius[b] > 0) continue;
    for (let step = 1; step < SUPPORT_BUCKETS; step++) {
      const lo = radius[(b - step + SUPPORT_BUCKETS) % SUPPORT_BUCKETS];
      const hi = radius[(b + step) % SUPPORT_BUCKETS];
      if (lo > 0 || hi > 0) {
        radius[b] = Math.max(lo, hi);
        break;
      }
    }
  }
  for (let b = 0; b < SUPPORT_BUCKETS; b++) radius[b] /= W;

  const hull = convexHull(hullPts);
  const hullFlat = new Float32Array(hull.length * 2);
  for (let i = 0; i < hull.length; i++) {
    hullFlat[i * 2] = hull[i][0] / W;
    hullFlat[i * 2 + 1] = hull[i][1] / W;
  }

  return { pivot: { x: px / W, y: py / H }, support, radius, hull: hullFlat };
}
