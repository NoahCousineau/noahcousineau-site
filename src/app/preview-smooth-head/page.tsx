'use client';

import RotatingHead from '@/components/RotatingHead';
import { useState } from 'react';

/**
 * PREVIEW-ONLY page — NOT linked from site nav, not part of the live homepage.
 * Renders the new interpolated/smoothed rotating-head sprite sheet side by
 * side with the current live staggered version so Noah can compare before
 * deciding whether to swap the homepage hero over to it.
 *
 * Visit at /preview-smooth-head while the dev server is running.
 */
export default function PreviewSmoothHead() {
  const [speed, setSpeed] = useState(60);

  return (
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Rotating Head — Staggered (31 frames, LIVE) vs Smoothed (59 frames, preview)</h1>
      <label style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        Auto-rotate speed: {speed}ms/frame
        <input type="range" min={20} max={200} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
      </label>
      <div style={{ display: 'flex', gap: '60px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Current LIVE (31 frames, staggered)</h2>
          <RotatingHead isDarkMode={false} variant="staggered" autoRotateSpeed={speed} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2>NEW smoothed (59 frames, interpolated)</h2>
          <RotatingHead isDarkMode={false} variant="smooth" autoRotateSpeed={speed} />
        </div>
      </div>
    </div>
  );
}
