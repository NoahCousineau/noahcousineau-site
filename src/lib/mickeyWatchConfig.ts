// Single source of truth for the Mickey Watch layout.
// Produced by /public/mickey-watch-editor.html — when you tweak positions
// there, paste the new "Copy Config" JSON in here so the live site matches.
//
// All width/height/x/y values are px on a 600x600 reference canvas
// (same as the editor's canvas-container). The component scales this
// proportionally to whatever size it's actually rendered at, so the
// live site will always match what you see in the editor.

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

export const mickeyWatchConfig: MickeyWatchConfig = {
  body: { width: 209, height: 167, x: 4, y: 18 },
  watchFace: { width: 471, height: 584, x: 0, y: -1 },
  hourHand: { width: 83, height: 144, x: 42, y: -3 },
  minuteHand: { width: 127, height: 154, x: 10, y: -56 },
  rotationAxis: { x: 50, y: 47 },
};
