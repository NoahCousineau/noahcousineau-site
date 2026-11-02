/**
 * The hand-shot object that stands for each project, and how big to draw it.
 *
 * Lives in lib/ rather than next to the home grid because it now has two
 * consumers: the grid tiles, where the object is clicked to play, and the
 * header of the project's own page, where the same object reappears —
 * 2026-08-22, Noah: "On all the project pages, the icon that is used on the
 * home page will return in the right... I don't want these hero icons to
 * animate as they do on the homepage, I want them to stay static."
 *
 * KEYED BY REAL PROJECT SLUG. The home grid calls the "more work" tile
 * "other", which is a display id and not a route; that translation happens at
 * the grid, so a page can look itself up by its own slug.
 *
 * CLICK-TO-PLAY OBJECTS IN THE TILES (2026-08-22, per Noah: "Right now we
 * have videos playing in the grid sections. Nothing's wrong with this, but
 * I'm looking for a more interesting interaction... I really enjoy how [the
 * about-me head] is looking and essentially want it to happen on the
 * homepage.")
 *
 * Frames are registered before export so the subject doesn't hop between
 * them, each with its own anchor: the apple holds its STEM (the only part
 * that survives being eaten), the heart and the sun their CENTRE ("Have the
 * heart grow from the center"; the sun "starting as a dot"), the flame its
 * BASE ("Have the flame growing from the base") and the ampersand its TIP
 * ("It starts from the bottom right corner and then traces out the '&'").
 * Valley Strong is matched by TEMPLATE — a house is drawn around a person,
 * and the person is only isolatable in frame 1, so frame 1 is located inside
 * each later frame. See tools/project-animations/build_objects.py.
 */

export type FrameAnimation = {
  /** Frame image paths, in order, starting at frame 1. */
  frames: string[];
  /** Intrinsic size of every (registered, identically sized) frame. */
  width: number;
  height: number;
  /**
   * How the object reacts as it plays.
   *
   * "rock" (default) kicks it a few degrees per frame, as though absorbing a
   * bite. "draw" is for Valley Strong, where a house is drawn around a person
   * — Noah: "I don't need each of the lines to shake like the others, but I
   * do want some sense that the line is being drawn on."
   */
  style?: "rock" | "draw";
  /**
   * For artwork that is DRAWN OUT rather than swapped: where each frame's new
   * mark begins and how far it reaches, in the canvas's own pixels, one entry
   * per frame (index 0 unused — frame 1 is the starting picture). On the home
   * grid each new frame is uncovered through a disc growing from (x, y) out
   * to radius r, so a line is drawn on from the end the pen started at, at
   * whatever angle it runs and however it curves, and the strokes follow one
   * another without a hold between them.
   *
   * 2026-11-01, Noah, on Valley Strong and the ampersand: "Since these depend
   * on being drawn out, let's have these feel like they're being drawn out
   * more instead of appearing in stages." They had been straight left-to-
   * right or bottom-to-top wipes, two seconds apart.
   *
   * Measured, not placed by eye: tools/project-animations/stroke_reveals.py.
   */
  strokes?: ({ x: number; y: number; r: number } | null)[];
  /**
   * What the object does as each frame lands on the home grid, in place of
   * the plain rock. See components/home/objectFlourishes.ts.
   *
   * 2026-11-01, Noah: "have more charming and dynamic animations between
   * frames. For example, when the Sprouts apple is bitten, there should be a
   * little bit of a shake." Then, of the first pass: "a bit too much
   * wiggle... I don't want any shearing or stretching of the items... a
   * little too cartoony. I still want a bit of a stop motion feel." So every
   * one is a small nudge of a solid object — the apple shakes off a bite,
   * the heart hops, the sun turns, the flame sways — stepped like stop motion.
   * "none" for frames that go by too fast for a nudge to land.
   */
  flourish?: "bite" | "beat" | "burst" | "flicker" | "none";
  /**
   * How long each frame holds on the home grid while the object plays, in
   * ms. Defaults to the grid's own pace (see ProjectFrameAnimation). Set per
   * object from Noah's notes of 2026-11-01, as each one's story wants its
   * own speed: the apple eaten "faster... the whole eating animation should
   * take a total of about two seconds", the heart and sun "just slightly
   * faster from the small size to the big", the flame faster again, and the
   * ampersand "drawn almost instantaneously".
   *
   * Short enough, and the object plays its frames as one run, booking a
   * single slot for all of it rather than queueing for each — otherwise a
   * busy grid would stretch the apple's two seconds back out.
   */
  frameMs?: number;
};

export type ProjectObject = FrameAnimation & {
  /**
   * Rendered height as a fraction of the home grid's ROW height.
   *
   * NOT eyeballed per object. Every animation is built so its final frame
   * matches the apple's size, and the fraction is then derived from each
   * set's canvas width relative to the apple's — which is what makes a tall
   * flame and a round heart read as "about the size of the apple", Noah's
   * words, instead of one axis agreeing while the other runs away.
   */
  heightFraction: number;
  /**
   * The frame the project page's header shows, standing still — Noah: "They
   * will also be at the largest size they are in the animation sequence
   * (either frame 1 or the final frame)."
   *
   * Measured, as the geometric mean of each frame's opaque bounding box.
   * Sprouts is the only set that SHRINKS (621 -> 546 across five frames, the
   * apple being eaten), so it alone shows frame 1; every other object grows
   * into its last frame. Two sets peak one frame early by a hair — the
   * ampersand at 640.6 against 624.1, Valley Strong at 511.7 against 510.3 —
   * but that is bounding-box noise as a tube is tidied and a line is
   * straightened, not the artwork getting smaller, and the finished drawing
   * is the one that belongs at the top of the page.
   */
  heroFrame: number;
};

export const PROJECT_OBJECTS: Record<string, ProjectObject> = {

  "valley-strong-credit-union": {
    frames: [1, 2, 3, 4, 5, 6, 7].map(
      (n) => `/assets/home/project-animations/valley-strong/${n}.webp`
    ),
    width: 700,
    height: 496,
    heightFraction: 0.315,
    heroFrame: 7,
    style: "draw",
    // Floor from its left end, each wall from the bottom, the left roof from
    // its eave, the right roof from the peak, then the smile.
    strokes: [
      null,
      { x: 141, y: 436, r: 400 },
      { x: 128, y: 437, r: 300 },
      { x: 518, y: 428, r: 269 },
      { x: 44, y: 167, r: 330 },
      { x: 344, y: 40, r: 353 },
      { x: 330, y: 233, r: 67 },
    ],
  },
  "sprouts-farmers-market": {
    frames: [1, 2, 3, 4, 5].map((n) => `/assets/home/project-animations/sprouts/${n}.webp`),
    width: 700,
    height: 689,
    heightFraction: 0.36,
    heroFrame: 1,
    flourish: "bite",
    // Four bites, first to last in just under two seconds.
    frameMs: 620,
  },
  "corita-art-center": {
    frames: [1, 2, 3, 4].map((n) => `/assets/home/project-animations/cac/${n}.webp`),
    width: 700,
    height: 714,
    heightFraction: 0.367,
    heroFrame: 4,
    flourish: "beat",
    frameMs: 1500,
  },
  "socal-earth": {
    frames: [1, 2, 3, 4].map((n) => `/assets/home/project-animations/socal-earth/${n}.webp`),
    width: 700,
    height: 724,
    heightFraction: 0.37,
    heroFrame: 4,
    flourish: "burst",
    frameMs: 1500,
  },
  "cultural-olympiad-poster": {
    frames: [1, 2, 3, 4, 5].map((n) => `/assets/home/project-animations/olympics/${n}.webp`),
    width: 700,
    height: 931,
    heightFraction: 0.428,
    heroFrame: 5,
    flourish: "flicker",
    // Catches fast, like a flame does — Noah: "speed up the flame of the
    // cultural olympiad" — then keeps burning; see burnPattern.
    frameMs: 550,
  },
  // The "more work" tile. A length of blue tube laid out by hand into an
  // ampersand, growing from its free end — Noah: "It starts from the bottom
  // right corner and then traces out the '&'."
  //
  // ALMOST AT ONCE (2026-11-01). It was briefly drawn on like the house, each
  // length uncovered through a growing disc — but the tube is re-laid between
  // shots, so where the old and new photographs disagreed the disc's edge
  // showed as a circle cut through the tube. Noah: "there's a weird effect
  // happening where a circle is appearing. Make the & drawn almost
  // instantaneously." So it runs its seven frames as plain cuts, one per
  // eighteenth of a second: a third of a second from first stage to last,
  // too fast for anything but the tube whipping into shape.
  "more-work": {
    frames: [1, 2, 3, 4, 5, 6, 7].map(
      (n) => `/assets/home/project-animations/ampersand/${n}.webp`
    ),
    width: 700,
    height: 760,
    heightFraction: 0.395,
    heroFrame: 7,
    flourish: "none",
    frameMs: 56,
  },
};
