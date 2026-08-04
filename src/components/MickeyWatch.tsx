'use client';

import { useEffect, useRef } from 'react';

interface MickeyWatchProps {
  containerClassName?: string;
}

export default function MickeyWatch({
  containerClassName = '',
}: MickeyWatchProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG design center from WatchDesign_Axis.svg
  const ROTATION_CENTER_X = 223.96;
  const ROTATION_CENTER_Y = 477.41;
  const SVG_WIDTH = 447.93;
  const SVG_HEIGHT = 936.56;

  // Scale to fit 280px display
  const DISPLAY_SIZE = 280;
  const SCALE = DISPLAY_SIZE / SVG_WIDTH;
  const scaledCenterX = ROTATION_CENTER_X * SCALE;
  const scaledCenterY = ROTATION_CENTER_Y * SCALE;

  // Render/update the watch
  const renderWatch = () => {
    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Calculate angles
    const hourAngleDeg = hours * 30 + minutes * 0.5;
    const minuteAngleDeg = minutes * 6 + seconds * 0.1;

    // Update hour hand rotation
    const hourHand = containerRef.current?.querySelector('[data-hand="hour"]') as HTMLDivElement;
    if (hourHand) {
      hourHand.style.transform = `rotate(${hourAngleDeg}deg)`;
    }

    // Update minute hand rotation
    const minuteHand = containerRef.current?.querySelector('[data-hand="minute"]') as HTMLDivElement;
    if (minuteHand) {
      minuteHand.style.transform = `rotate(${minuteAngleDeg}deg)`;
    }
  };

  // Animation loop
  useEffect(() => {
    renderWatch();
    const interval = setInterval(renderWatch, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center ${containerClassName}`}
      style={{
        width: `${DISPLAY_SIZE}px`,
        height: `${DISPLAY_SIZE}px`,
        backgroundColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Watch face image - the base */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundImage: 'url(/images/mickey-watch/watch-face.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          pointerEvents: 'none',
        }}
      />

      {/* Hour hand - positioned and rotated */}
      <div
        data-hand="hour"
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          transformOrigin: `${(scaledCenterX / DISPLAY_SIZE) * 100}% ${(scaledCenterY / DISPLAY_SIZE) * 100}%`,
        }}
      >
        <img
          src="/images/mickey-watch/hour-hand.png"
          alt="Hour hand"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Minute hand - positioned and rotated */}
      <div
        data-hand="minute"
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          transformOrigin: `${(scaledCenterX / DISPLAY_SIZE) * 100}% ${(scaledCenterY / DISPLAY_SIZE) * 100}%`,
        }}
      >
        <img
          src="/images/mickey-watch/minute-hand.png"
          alt="Minute hand"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Center cap */}
      <div
        style={{
          position: 'absolute',
          left: `${(scaledCenterX / DISPLAY_SIZE) * 100}%`,
          top: `${(scaledCenterY / DISPLAY_SIZE) * 100}%`,
          width: '8px',
          height: '8px',
          backgroundColor: '#000000',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
