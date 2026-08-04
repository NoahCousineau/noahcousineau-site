// Single source of truth for the Mickey Watch layout.
// Produced by /public/mickey-watch-editor.html — when you tweak positions
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
export const mickeyWatchConfig: MickeyWatchConfig = {
  body: { width: 209, height: 265, x: 11, y: 50 },
  watchFace: { width: 559, height: 584, x: 0, y: -1 },
  hourHand: { width: 111, height: 144, x: 59, y: 12, rotation: -90 },
  minuteHand: { width: 179, height: 230, x: 11, y: -76, rotation: 267 },
  rotationAxis: { x: 50, y: 47 },
};
