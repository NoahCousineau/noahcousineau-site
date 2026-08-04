'use client';

import { useEffect, useRef } from 'react';
import { mickeyWatchConfig, MICKEY_WATCH_CANVAS_SIZE as CANVAS } from '@/lib/mickeyWatchConfig';

interface MickeyWatchProps {
  containerClassName?: string;
}

// Converts a layer's editor-canvas px box into CSS percentages of the
// component's own container, using the same math as the editor:
//   left = canvasSize/2 + x - width/2
//   top  = canvasSize/2 + y - height/2
function layerBoxStyle(layer: { width: number; height: number; x: number; y: number }) {
  const leftPx = CANVAS / 2 + layer.x - layer.width / 2;
  const topPx = CANVAS / 2 + layer.y - layer.height / 2;
  return {
    left: `${(leftPx / CANVAS) * 100}%`,
    top: `${(topPx / CANVAS) * 100}%`,
    width: `${(layer.width / CANVAS) * 100}%`,
    height: `${(layer.height / CANVAS) * 100}%`,
  };
}

// Hands are positioned relative to the rotation axis, same as the editor:
//   axisX/Y = canvasSize * (rotationAxis% / 100)
//   left = axisX - width/2 + x
// IMPORTANT: x/y here are the hand's UNROTATED offset from the axis (i.e.
// where the box sits at rotation=0deg). The transform-origin below is
// derived from that same x/y so the hand always pivots around the true
// watch axis, not its own box center — this keeps the hand's tip glued
// to the axis at every rotation angle instead of orbiting/drifting.
function handBoxStyle(
  layer: { width: number; height: number; x: number; y: number },
  axis: { x: number; y: number }
) {
  const axisXPx = CANVAS * (axis.x / 100);
  const axisYPx = CANVAS * (axis.y / 100);
  const leftPx = axisXPx - layer.width / 2 + layer.x;
  const topPx = axisYPx - layer.height / 2 + layer.y;

  // Axis position expressed as a fraction of the hand's own box —
  // this is what transform-origin needs so rotation pivots on the axis.
  const originXPercent = (0.5 - layer.x / layer.width) * 100;
  const originYPercent = (0.5 - layer.y / layer.height) * 100;

  return {
    left: `${(leftPx / CANVAS) * 100}%`,
    top: `${(topPx / CANVAS) * 100}%`,
    width: `${(layer.width / CANVAS) * 100}%`,
    height: `${(layer.height / CANVAS) * 100}%`,
    transformOrigin: `${originXPercent}% ${originYPercent}%`,
  };
}

export default function MickeyWatch({
  containerClassName = '',
}: MickeyWatchProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const config = mickeyWatchConfig;

  // Render/update the watch hands based on current time.
  const renderWatch = () => {
    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const hourAngleDeg = hours * 30 + minutes * 0.5 + (config.hourHand.rotation || 0);
    const minuteAngleDeg = minutes * 6 + seconds * 0.1 + (config.minuteHand.rotation || 0);

    const hourHand = containerRef.current?.querySelector('[data-hand="hour"]') as HTMLDivElement;
    if (hourHand) {
      hourHand.style.transform = `rotate(${hourAngleDeg}deg)`;
    }

    const minuteHand = containerRef.current?.querySelector('[data-hand="minute"]') as HTMLDivElement;
    if (minuteHand) {
      minuteHand.style.transform = `rotate(${minuteAngleDeg}deg)`;
    }
  };

  useEffect(() => {
    renderWatch();
    const interval = setInterval(renderWatch, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${containerClassName}`}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
      }}
    >
      {/* Watch face (bottom-most) */}
      <div
        style={{
          position: 'absolute',
          ...layerBoxStyle(config.watchFace),
          pointerEvents: 'none',
        }}
      >
        <img
          src="/images/mickey-watch/watch-face.png"
          alt="Watch face"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Hour hand — sits BEHIND the body so the body figure occludes it,
          per design: the body reads as "in front", hour hand peeking out. */}
      <div
        data-hand="hour"
        style={{
          position: 'absolute',
          ...handBoxStyle(config.hourHand, config.rotationAxis),
          pointerEvents: 'none',
        }}
      >
        <img
          src="/images/mickey-watch/hour-hand.png"
          alt="Hour hand"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Body (arm/hand holding the watch out) — in front of the hour hand */}
      <div
        style={{
          position: 'absolute',
          ...layerBoxStyle(config.body),
          pointerEvents: 'none',
        }}
      >
        <img
          src="/images/mickey-watch/body.png"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Minute hand (top-most) */}
      <div
        data-hand="minute"
        style={{
          position: 'absolute',
          ...handBoxStyle(config.minuteHand, config.rotationAxis),
          pointerEvents: 'none',
        }}
      >
        <img
          src="/images/mickey-watch/minute-hand.png"
          alt="Minute hand"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    </div>
  );
}
