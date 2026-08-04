'use client';

import { useEffect, useRef, useState } from 'react';

interface MickeyWatchProps {
  containerClassName?: string;
}

export default function MickeyWatch({
  containerClassName = '',
}: MickeyWatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<{
    minuteHand: HTMLImageElement | null;
    hourHand: HTMLImageElement | null;
    body: HTMLImageElement | null;
  }>({
    minuteHand: null,
    hourHand: null,
    body: null,
  });

  const DISPLAY_WIDTH = 280;
  const DISPLAY_HEIGHT = 280;

  // SVG design specs from your WatchDesign_Axis.svg
  const ROTATION_CENTER_X = 223.96;
  const ROTATION_CENTER_Y = 477.41;
  const SVG_WIDTH = 447.93;
  const SVG_HEIGHT = 936.56;

  // Scale to fit 280px display
  const SCALE = DISPLAY_WIDTH / SVG_WIDTH;
  const scaledCenterX = ROTATION_CENTER_X * SCALE;
  const scaledCenterY = ROTATION_CENTER_Y * SCALE;

  // Load the images
  useEffect(() => {
    let loadedCount = 0;

    const loadImage = (src: string, key: keyof typeof imagesRef.current) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        imagesRef.current[key] = img;
        loadedCount++;
      };
    };

    loadImage('/images/mickey-watch/minute-hand.png', 'minuteHand');
    loadImage('/images/mickey-watch/hour-hand.png', 'hourHand');
    loadImage('/images/mickey-watch/body.png', 'body');
  }, []);

  // Draw the watch
  const drawWatch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

    // Fill with white background (for the watch face)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

    // Draw watch face circle border
    const radius = (SVG_WIDTH / 2 - 25) * SCALE;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * SCALE;
    ctx.beginPath();
    ctx.arc(scaledCenterX, scaledCenterY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw hour markers
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.7 * SCALE;
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * (Math.PI / 180);
      const innerR = radius - 6 * SCALE;
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

    // Draw numbers (1-12)
    ctx.fillStyle = '#000000';
    ctx.font = `italic ${10 * SCALE}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 1; i <= 12; i++) {
      const angle = ((i * 30 - 90) * Math.PI) / 180;
      const numR = radius - 18 * SCALE;
      const x = scaledCenterX + numR * Math.cos(angle);
      const y = scaledCenterY + numR * Math.sin(angle);
      ctx.fillText(i.toString(), x, y);
    }

    // Get current time
    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Calculate angles
    const hourAngleDeg = hours * 30 + minutes * 0.5;
    const minuteAngleDeg = minutes * 6 + seconds * 0.1;

    // Draw hour hand (shorter)
    if (imagesRef.current.hourHand && imagesRef.current.hourHand.complete) {
      drawHand(ctx, imagesRef.current.hourHand, hourAngleDeg, 0.6);
    }

    // Draw minute hand (longer)
    if (imagesRef.current.minuteHand && imagesRef.current.minuteHand.complete) {
      drawHand(ctx, imagesRef.current.minuteHand, minuteAngleDeg, 1.0);
    }

    // Draw center cap
    const capRadius = 3 * SCALE;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(scaledCenterX, scaledCenterY, capRadius, 0, Math.PI * 2);
    ctx.fill();
  };

  // Draw a single hand (arm photo)
  const drawHand = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    angleDeg: number,
    scale: number
  ) => {
    ctx.save();
    ctx.translate(scaledCenterX, scaledCenterY);
    ctx.rotate((angleDeg * Math.PI) / 180);

    // Scale the hand image to fit
    const handScale = ((SVG_WIDTH / 2 - 30) * SCALE * 2 * scale) / image.width;
    const drawWidth = image.width * handScale;
    const drawHeight = image.height * handScale;

    // Draw centered on rotation point
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    ctx.restore();
  };

  // Animation loop
  useEffect(() => {
    drawWatch();

    let lastSecond = -1;
    const animate = () => {
      const now = new Date();
      if (now.getSeconds() !== lastSecond) {
        lastSecond = now.getSeconds();
        drawWatch();
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
