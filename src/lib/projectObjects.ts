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
   * For "draw": which way each stroke is laid down, one entry per frame
   * (index 0 unused — frame 1 is the starting picture, not a stroke).
   *
   * A crossfade alone made each line "just appear", which is not what drawing
   * looks like — Noah: "There line should feel like it's being drawn from one
   * end to the other, not just appearing." Directions are measured, not
   * guessed: each stroke is picked out by subtracting the previous frame
   * (dilated, to absorb the re-photography jitter) and taking the principal
   * axis of what remains.
   */
  wipes?: ("l2r" | "b2t")[];
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
    // Measured from the frame differences: floor, left wall, right wall, the
    // two roof slopes, then the smile. Index 0 is unused (the starting
    // figure). See tools/project-animations/stroke_directions.py.
    wipes: ["l2r", "l2r", "b2t", "b2t", "l2r", "l2r", "b2t"],
  },
  "sprouts-farmers-market": {
    frames: [1, 2, 3, 4, 5].map((n) => `/assets/home/project-animations/sprouts/${n}.webp`),
    width: 700,
    height: 689,
    heightFraction: 0.36,
    heroFrame: 1,
  },
  "corita-art-center": {
    frames: [1, 2, 3, 4].map((n) => `/assets/home/project-animations/cac/${n}.webp`),
    width: 700,
    height: 714,
    heightFraction: 0.367,
    heroFrame: 4,
  },
  "socal-earth": {
    frames: [1, 2, 3, 4].map((n) => `/assets/home/project-animations/socal-earth/${n}.webp`),
    width: 700,
    height: 724,
    heightFraction: 0.37,
    heroFrame: 4,
  },
  "cultural-olympiad-poster": {
    frames: [1, 2, 3, 4, 5].map((n) => `/assets/home/project-animations/olympics/${n}.webp`),
    width: 700,
    height: 931,
    heightFraction: 0.428,
    heroFrame: 5,
  },
  // The "more work" tile. A length of blue tube laid out by hand into an
  // ampersand, growing from its free end — Noah: "It starts from the bottom
  // right corner and then traces out the '&'." Seven stop-motion stages, so
  // it cuts rather than crossfades: the tube is physically re-laid between
  // shots and the part already down shifts, which a crossfade would smear
  // into a double image. The rock carries the energy of it being flopped
  // into place.
  "more-work": {
    frames: [1, 2, 3, 4, 5, 6, 7].map(
      (n) => `/assets/home/project-animations/ampersand/${n}.webp`
    ),
    width: 700,
    height: 760,
    heightFraction: 0.395,
    heroFrame: 7,
  },
};
