// Single source of truth for the Mickey Watch layout.
// Produced by tools/editors/mickey-watch-editor.html (moved out of public/
// on 2026-08-30 — it was being served to the internet) — when you tweak positions
// there, paste the new "Copy Config" JSON in here so the live site matches.
//
// All width/height/x/y values are px on a 600x600 reference canvas
// (same as the editor's canvas-container). The component scales this
// proportionally to whatever size it's actually rendered at, so the
// live site will always match what you see in the editor.
//
// IMPORTANT — about hourHand.rotation / minuteHand.rotation:
// The editor's "Set 3:00" (etc) button sets an ABSOLUTE rotation for
// previewing one fixed pose. The live site instead rotates the hands
// continuously with the real current time. So these two rotation
// numbers are stored here as a CALIBRATION OFFSET, not a literal degree
// value: they're added on top of the normal clock-math angle so the
// hands sit correctly at every moment, not just the one time you posed
// them at in the editor.
//
// How to update after using the editor:
// 1. In the editor, use "Set 3:00" (or any exact time) and dial in the
//    pose you want, then copy the config.
// 2. Note which absolute time you posed it at (hours, minutes) and the
//    rotation values the editor gives you for that pose.
// 3. offset = poseRotation - (hours*30 + minutes*0.5)   [hour hand]
//    offset = poseRotation - (minutes*6)                [minute hand]
// 4. Put that offset in hourHand.rotation / minuteHand.rotation below.
//
// Example: posed at 3:00 (hours=3, minutes=0) with hourHand rotation=0,
// minuteHand rotation=267 in the editor:
//   hourHand offset   = 0   - (3*30 + 0*0.5) = 0 - 90  = -90
//   minuteHand offset = 267 - (0*6)          = 267 - 0 = 267

export interface MickeyWatchLayer {
  width: number;
  height: number;
  x: number;
  y: number;
  rotation?: number;
}

export interface MickeyWatchConfig {
  body: MickeyWatchLayer;
  watchFace: MickeyWatchLayer;
  hourHand: MickeyWatchLayer;
  minuteHand: MickeyWatchLayer;
  rotationAxis: { x: number; y: number }; // percent of canvas (0-100)
}

export const MICKEY_WATCH_CANVAS_SIZE = 600;

// Posed in the editor at 3:00 (hourHand rotation=0, minuteHand rotation=267)
// -> converted to calibration offsets per the formula above.
//
// NOTE on hand x/y: these must be the hand's UNROTATED offset from the
// axis (its position at rotation=0deg), because the component now pivots
// each hand around the true watch axis (not its own box center). If you
// pose a hand in the editor at some non-zero rotation and read off x/y
// while it's rotated, you must first "de-rotate" that offset back to 0deg
// before pasting it here — see the editor, which now shows/exports the
// correct unrotated x/y directly so this conversion isn't needed by hand.
export const mickeyWatchConfig: MickeyWatchConfig = {
  // body.x nudged 10 -> -4 (2026-08-20, per Noah: "move the image of the
  // person standing (me) over just a hair"). Direction and amount measured
  // rather than eyeballed: the figure's own OPAQUE content centre sat
  // 13.8 canvas-px right of the watch face's opaque content centre (read
  // off the rendered editor via alpha-channel bounds), so -13.8 lands the
  // standing figure dead centre under the 12. Hands untouched, per
  // "Keep the clock hands the same" — which does mean the pointing finger
  // no longer sits exactly on the hand pivot.
  body: { width: 209, height: 265, x: -4, y: 50 },
  watchFace: { width: 559, height: 584, x: 0, y: -1 },
  /* HAND CALIBRATION (2026-08-20, per Noah: "properly rotate the hour hand
   * so the pointer finger is properly pointing at the corresponding hour
   * location.")
   *
   * These offsets were eyeballed in the editor and were each a few degrees
   * out. They're now derived rather than posed: for each hand PNG, the
   * fingertip is the farthest opaque pixel from that hand's rotation axis,
   * and the angle from axis to fingertip — measured clockwise from
   * straight up, the same convention the clock math uses — is the hand's
   * built-in direction at rotation 0. The offset that makes the finger land
   * on the true hour is simply the negative of that angle, since the
   * component adds offset on top of the clock angle.
   *
   *   hour   fingertip sits at  98.10deg  ->  offset -98.10
   *   minute fingertip sits at  90.17deg  ->  offset -90.17
   *
   * RE-MEASURED 2026-09-01, because both were still about 4.2deg fast. Noah:
   * "the clock is just slightly fast. It hit midnight and it looked like the
   * hands were pointing a bit past where they should go."
   *
   * The earlier numbers (93.92 / 85.93) were taken by finding the fingertip
   * in the hand PNG and measuring from the axis — correct in principle, but
   * measured against the image STRETCHED to the layer box. The <img> is
   * `object-fit: contain`, so what actually renders is letterboxed: the hour
   * arm is 504x207 shown inside a 111x144 box, which fits to the width and
   * leaves the height at 36 rather than 144. Measuring on the stretched
   * version put the fingertip several degrees off, in the same direction for
   * both hands — which is why the whole clock read fast rather than one hand
   * disagreeing with the other.
   *
   * Re-measured on the letterboxed geometry the site really draws, at 6x
   * supersampling, and taken as the centroid of the outermost shell of opaque
   * pixels rather than the single farthest one. Stable to a tenth of a degree
   * across shell thresholds of 0.999, 0.99 and 0.97, which the stretched
   * measurement was not.
   *
   * 4.2deg is about eight minutes on the hour hand and forty seconds on the
   * minute hand — small, and exactly the "bit past where they should go" at
   * midnight, when both hands should be dead on the 12.
   *
   * The minute hand is corrected too even though Noah only flagged the
   * hour: it was the further out of the two, and leaving it would mean the
   * hands disagreed about what time it is.
   *
   * Checked against the artwork before trusting the math — the face's
   * numerals sit on true 30deg marks (mean deviation -1.6deg measured off
   * watch-face.png's alpha channel), so exact clock angles really do point
   * at the drawn numbers. */
  hourHand: { width: 111, height: 144, x: 59, y: 12, rotation: -98.10 },
  minuteHand: { width: 182, height: 234.1, x: 76.2, y: 15.26, rotation: -90.17 },
  rotationAxis: { x: 50, y: 47 },
};
