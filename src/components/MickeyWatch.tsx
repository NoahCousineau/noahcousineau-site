'use client';

import { useEffect, useRef } from 'react';

interface MickeyWatchProps {
  containerClassName?: string;
}

export default function MickeyWatch({
  containerClassName = '',
}: MickeyWatchProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const DISPLAY_SIZE = 280;
  
  // SVG design center from WatchDesign_Axis.svg
  const ROTATION_CENTER_X = 223.96;
  const ROTATION_CENTER_Y = 477.41;
  const SVG_WIDTH = 447.93;
  const SVG_HEIGHT = 936.56;

  // Scale from SVG to our display size
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
      }}
    >
      {/* Watch face drawn with SVG */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* Watch circle border */}
        <circle
          cx={ROTATION_CENTER_X}
          cy={ROTATION_CENTER_Y}
          r={SVG_WIDTH / 2 - 25}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
        />

        <circle
          cx={ROTATION_CENTER_X}
          cy={ROTATION_CENTER_Y}
          r={SVG_WIDTH / 2 - 25}
          fill="none"
          stroke="#000000"
          strokeWidth="1"
        />

        {/* Hour markers */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30) * (Math.PI / 180);
          const radius = SVG_WIDTH / 2 - 25;
          const innerR = radius - 8;
          const outerR = radius - 3;

          const x1 = ROTATION_CENTER_X + innerR * Math.cos(angle);
          const y1 = ROTATION_CENTER_Y + innerR * Math.sin(angle);
          const x2 = ROTATION_CENTER_X + outerR * Math.cos(angle);
          const y2 = ROTATION_CENTER_Y + outerR * Math.sin(angle);

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#000000"
              strokeWidth="1"
            />
          );
        })}

        {/* Numbers 1-12 */}
        {Array.from({ length: 12 }).map((_, i) => {
          const num = i + 1;
          const angle = ((num * 30 - 90) * Math.PI) / 180;
          const radius = SVG_WIDTH / 2 - 25;
          const numR = radius - 22;
          const x = ROTATION_CENTER_X + numR * Math.cos(angle);
          const y = ROTATION_CENTER_Y + numR * Math.sin(angle);

          return (
            <text
              key={`num-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fontStyle="italic"
              fontFamily="Georgia, serif"
              fill="#000000"
            >
              {num}
            </text>
          );
        })}
      </svg>

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
