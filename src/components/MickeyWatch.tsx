'use client';

import { useEffect, useRef, useState } from 'react';

interface MickeyWatchProps {
  isDarkMode?: boolean;
  containerClassName?: string;
}

export default function MickeyWatch({
  isDarkMode = false,
  containerClassName = '',
}: MickeyWatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());

  const TOTAL_FRAMES = 240;
  const DISPLAY_WIDTH = 280;
  const DISPLAY_HEIGHT = 280;

  // SVG design center point
  const SVG_WIDTH = 447.93;
  const SVG_HEIGHT = 936.56;
  const SVG_CENTER_X = 223.96;
  const SVG_CENTER_Y = 477.41;

  // Scale to fit within canvas
  const SCALE = DISPLAY_WIDTH / SVG_WIDTH;
  const scaledCenterX = SVG_CENTER_X * SCALE;
  const scaledCenterY = SVG_CENTER_Y * SCALE;

  // Get frame index for an angle in degrees
  const getFrameIndex = (angleDeg: number): number => {
    const normalized = ((angleDeg % 360) + 360) % 360;
    return Math.round(normalized / 1.5) % TOTAL_FRAMES;
  };

  // Load frame image asynchronously
  const loadFrame = async (frameIdx: number): Promise<HTMLImageElement | null> => {
    const cached = frameImagesRef.current.get(frameIdx);
    if (cached) return cached;

    return new Promise((resolve) => {
      const img = new Image();
      img.src = `/images/mickey-watch/hand_${frameIdx.toString().padStart(3, '0')}.png`;
      img.onload = () => {
        frameImagesRef.current.set(frameIdx, img);
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      };
    });
  };

  // Draw the watch face
  const drawWatchFace = (ctx: CanvasRenderingContext2D) => {
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

    // Watch circle (white background of watch)
    const radius = (SVG_WIDTH / 2 - 20) * SCALE;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(scaledCenterX, scaledCenterY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Border circle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * SCALE;
    ctx.beginPath();
    ctx.arc(scaledCenterX, scaledCenterY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Hour tick marks
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.8 * SCALE;
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * (Math.PI / 180);
      const innerR = radius - 7 * SCALE;
      const outerR = radius - 2 * SCALE;

      const x1 = scaledCenterX + innerR * Math.cos(angle);
      const y1 = scaledCenterY + innerR * Math.sin(angle);
      const x2 = scaledCenterX + outerR * Math.cos(angle);
      const y2 = scaledCenterY + outerR * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Numbers (Quinn italic style)
    ctx.fillStyle = '#000000';
    ctx.font = `italic ${11 * SCALE}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 1; i <= 12; i++) {
      const angle = ((i * 30 - 90) * Math.PI) / 180;
      const numR = radius - 20 * SCALE;
      const x = scaledCenterX + numR * Math.cos(angle);
      const y = scaledCenterY + numR * Math.sin(angle);
      ctx.fillText(i.toString(), x, y);
    }
  };

  // Draw hand image at given rotation
  const drawHandFrame = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement | null,
    framIndex: number
  ) => {
    if (!image) return;

    ctx.save();
    ctx.translate(scaledCenterX, scaledCenterY);

    // The hand image is 1048x343
    // Rotate it based on the frame index (each frame is 1.5°)
    const angleDeg = framIndex * 1.5;
    ctx.rotate((angleDeg * Math.PI) / 180);

    // Scale the hand image to fit
    // The arm should extend from center to near the edge
    const maxReach = (SVG_WIDTH / 2 - 30) * SCALE;
    const handScale = maxReach / (image.width / 2);

    const drawWidth = image.width * handScale;
    const drawHeight = image.height * handScale;

    // Draw centered on rotation point (0,0 after translate)
    ctx.drawImage(
      image,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    ctx.restore();
  };

  // Draw center cap/post
  const drawCenterCap = (ctx: CanvasRenderingContext2D) => {
    const capRadius = 3.5 * SCALE;
    
    // Black center
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(scaledCenterX, scaledCenterY, capRadius, 0, Math.PI * 2);
    ctx.fill();

    // White outer ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8 * SCALE;
    ctx.beginPath();
    ctx.arc(scaledCenterX, scaledCenterY, capRadius + 1 * SCALE, 0, Math.PI * 2);
    ctx.stroke();
  };

  // Main draw function
  const drawWatch = async (now: Date) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

    // Draw face
    drawWatchFace(ctx);

    // Calculate angles
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Minute hand angle: 6° per minute + 0.1° per second
    const minuteAngleDeg = minutes * 6 + seconds * 0.1;
    const minuteFrameIdx = getFrameIndex(minuteAngleDeg);

    // Load and draw minute hand
    const minuteImg = await loadFrame(minuteFrameIdx);
    drawHandFrame(ctx, minuteImg, minuteFrameIdx);

    // Draw center cap (overlays the hand rotation point)
    drawCenterCap(ctx);
  };

  // Animation loop
  useEffect(() => {
    let lastSecond = -1;

    const animate = () => {
      const now = new Date();
      // Only redraw when second changes (avoids unnecessary redraws)
      if (now.getSeconds() !== lastSecond) {
        lastSecond = now.getSeconds();
        drawWatch(now);
      }
      requestAnimationFrame(animate);
    };

    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={`flex items-center justify-center ${containerClassName}`}>
      <canvas
        ref={canvasRef}
        width={DISPLAY_WIDTH}
        height={DISPLAY_HEIGHT}
        className="w-full h-full"
        style={{
          background: 'transparent',
          maxWidth: '280px',
          maxHeight: '280px',
          imageRendering: 'crisp-edges',
        }}
      />
    </div>
  );
}
