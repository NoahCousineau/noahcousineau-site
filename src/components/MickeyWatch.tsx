'use client';

import { useEffect, useRef, useState } from 'react';

interface MickeyWatchProps {
  containerClassName?: string;
}

export default function MickeyWatch({
  containerClassName = '',
}: MickeyWatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const TOTAL_FRAMES = 240;
  const DISPLAY_SIZE = 280;

  // SVG design specs
  const SVG_VIEWBOX_WIDTH = 447.93;
  const SVG_VIEWBOX_HEIGHT = 936.56;
  const ROTATION_CENTER_X = 223.96;
  const ROTATION_CENTER_Y = 477.41;

  // Scale calculations
  const SCALE = DISPLAY_SIZE / SVG_VIEWBOX_WIDTH;
  const scaledCenterX = ROTATION_CENTER_X * SCALE;
  const scaledCenterY = ROTATION_CENTER_Y * SCALE;

  // Get frame for minute hand angle
  const getFrameIndex = (angleDeg: number): number => {
    const normalized = ((angleDeg % 360) + 360) % 360;
    return Math.round(normalized / 1.5) % TOTAL_FRAMES;
  };

  // Preload key hand frames (to keep memory reasonable)
  useEffect(() => {
    const keyFrames = [0, 30, 60, 90, 120, 150, 180, 210];
    let loadedCount = 0;

    keyFrames.forEach((frameIdx) => {
      const img = new Image();
      img.src = `/images/mickey-watch/hand_${frameIdx.toString().padStart(3, '0')}.png`;
      img.onload = () => {
        framesRef.current.set(frameIdx, img);
        loadedCount++;
        if (loadedCount === keyFrames.length) {
          setImagesLoaded(true);
        }
      };
    });

    // Preload current frame too
    setTimeout(() => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const minuteAngleDeg = minutes * 6 + seconds * 0.1;
      const frameIdx = getFrameIndex(minuteAngleDeg);

      const img = new Image();
      img.src = `/images/mickey-watch/hand_${frameIdx.toString().padStart(3, '0')}.png`;
      img.onload = () => {
        framesRef.current.set(frameIdx, img);
      };
    }, 100);
  }, []);

  // Load on-demand frame
  const getFrame = (frameIdx: number): HTMLImageElement | null => {
    let img = framesRef.current.get(frameIdx);
    if (!img) {
      img = new Image();
      img.src = `/images/mickey-watch/hand_${frameIdx.toString().padStart(3, '0')}.png`;
      framesRef.current.set(frameIdx, img);
    }
    return img.complete ? img : null; // Only return if loaded
  };

  // Draw watch face
  const drawWatchFace = (ctx: CanvasRenderingContext2D) => {
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

    const radius = (SVG_VIEWBOX_WIDTH / 2 - 25) * SCALE;

    // Watch circle
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * SCALE;
    ctx.beginPath();
    ctx.arc(scaledCenterX, scaledCenterY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hour tick marks
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

    // Numbers (1-12)
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
  };

  // Draw hand (minute hand)
  const drawHand = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, frameIdx: number) => {
    if (!image || !image.complete) return;

    ctx.save();
    ctx.translate(scaledCenterX, scaledCenterY);

    // Rotate based on frame index (1.5° per frame)
    const angleDeg = frameIdx * 1.5;
    ctx.rotate((angleDeg * Math.PI) / 180);

    // Scale arm to fit watch
    const maxReach = (SVG_VIEWBOX_WIDTH / 2 - 40) * SCALE;
    const imageScale = (maxReach * 2) / image.width;

    const drawWidth = image.width * imageScale;
    const drawHeight = image.height * imageScale;

    // Draw centered at rotation point
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    ctx.restore();
  };

  // Draw center cap
  const drawCenterCap = (ctx: CanvasRenderingContext2D) => {
    const capRadius = 3 * SCALE;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(scaledCenterX, scaledCenterY, capRadius, 0, Math.PI * 2);
    ctx.fill();
  };

  // Main draw function
  const drawWatch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

    // Draw face
    drawWatchFace(ctx);

    // Get current time
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Minute hand angle
    const minuteAngleDeg = minutes * 6 + seconds * 0.1;
    const minuteFrameIdx = getFrameIndex(minuteAngleDeg);

    // Draw minute hand
    const handImg = getFrame(minuteFrameIdx);
    if (handImg) {
      drawHand(ctx, handImg, minuteFrameIdx);
    }

    // Draw center cap
    drawCenterCap(ctx);
  };

  // Animation loop
  useEffect(() => {
    // Initial draw
    drawWatch();

    // Update every second
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
  }, [imagesLoaded]);

  return (
    <div className={`flex items-center justify-center ${containerClassName}`}>
      <canvas
        ref={canvasRef}
        width={DISPLAY_SIZE}
        height={DISPLAY_SIZE}
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
