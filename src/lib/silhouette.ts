/**
 * Measuring a cut-out's true shape from its alpha channel, for physics.
 *
 * Extracted from the About page's ragdoll head so the project-grid objects
 * can be thrown around with the same collision behaviour rather than a second
 * approximation of it. The head still runs its own copy of the integrator;
 * this is the part that was worth sharing first, because it is the part that
 * took several passes to get right.
 *
 * THE SUPPORT FUNCTION, NOT A RAY CAST. For each direction, this records how
 * far the shape reaches ALONG that direction taken over the whole shape —
 * max of (p - pivot) · d — rather than the distance to the edge along a ray
 * from the pivot. The two are not the same and the difference is not subtle:
 * a ray answers "what is directly below the pivot", but the lowest point of a
 * rotated shape is generally off to one side and sits lower than that. Using
 * rays made the head settle up to 31px through the floor at its resting
 * angle. Resting against a flat edge IS a support query, so this is exact for
 * that contact rather than a closer approximation.
 */

/** One sample per degree; the whole table is a few hundred multiply-adds. */
export const SUPPORT_BUCKETS = 360;

export type Silhouette = {
  /** Centre of area, as a fraction (0-1) of the image's box. */
  pivot: { x: number; y: number };
  /** Support distance per degree, as a fraction of the image's WIDTH. */
  support: Float32Array;
};

export function defaultSilhouette(): Silhouette {
  return {
    pivot: { x: 0.5, y: 0.5 },
    support: new Float32Array(SUPPORT_BUCKETS).fill(0.4),
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
 * Scan a decoded image's alpha channel into a Silhouette.
 *
 * Only the per-row horizontal EXTREMES are fed into the support table, and
 * that is exact rather than an optimisation: for a fixed row, (p - pivot) · d
 * is linear in x, so its maximum over that row is always at the row's
 * leftmost or rightmost opaque pixel. Every interior pixel is irrelevant,
 * which turns this from a per-pixel job into a per-row one.
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

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  const edgeX: number[] = [];
  const edgeY: number[] = [];
  for (let y = 0; y < H; y++) {
    let rowMin = -1;
    let rowMax = -1;
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] <= alphaThreshold) continue;
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
  if (count === 0) return null;

  const px = sumX / count;
  const py = sumY / count;
  const support = new Float32Array(SUPPORT_BUCKETS);
  const n = edgeX.length;
  for (let b = 0; b < SUPPORT_BUCKETS; b++) {
    const th = (b * Math.PI) / 180;
    const dx = Math.cos(th);
    const dy = Math.sin(th);
    let best = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = (edgeX[i] - px) * dx + (edgeY[i] - py) * dy;
      if (v > best) best = v;
    }
    support[b] = best / W;
  }
  return { pivot: { x: px / W, y: py / H }, support };
}
