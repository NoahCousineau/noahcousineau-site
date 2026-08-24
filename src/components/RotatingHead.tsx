'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lightModeStaggeredAdjustments } from '@/lib/rotatingHeadConfig';
import { setHeadTick } from '@/lib/headFrame';

interface FrameAdjustment {
  x: number;
  y: number;
  crop: { left: number; right: number; top: number; bottom: number };
  scale: number;
}

interface FrameAdjustmentsMap {
  [key: string]: FrameAdjustment;
}

interface RotatingHeadProps {
  isDarkMode?: boolean;
  variant?: 'staggered' | 'smooth'; // For future smooth variants
  autoRotateSpeed?: number;
  resumeRotationDelay?: number;
  dragSensitivity?: number;
  containerClassName?: string;
}

export default function RotatingHead({
  isDarkMode = false,
  variant = 'staggered',
  autoRotateSpeed = 100,
  resumeRotationDelay = 3000,
  dragSensitivity = 20,
  containerClassName = '',
}: RotatingHeadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteSheetRef = useRef<HTMLImageElement | null>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [velocity, setVelocity] = useState(0);

  // Constants - web-optimized (0.4x scale)
  //
  // DARK IS ONE FRAME SHORTER THAN LIGHT (2026-08-23). Noah, on the
  // turntable: "there's a few frames where I'm looking forward... because
  // there's an additional frame, it feels like the rotation gets stuck."
  // The dark shoot genuinely captured a near-duplicate angle the light shoot
  // didn't; tools/dark-head-pipeline/build_dark_frames_from_edit.py drops
  // that one photo when it builds the dark sheet, so dark has 30 staggered
  // frames against light's 31. They can disagree because
  // `lightModeStaggeredAdjustments` is keyed by POSITION IN THE SEQUENCE,
  // not by original photo number, and the dropped photo was the LAST one —
  // so dark's positions 1-30 still line up with light's positions 1-30
  // exactly; nothing needed remapping, dark just stops one short.
  const TOTAL_FRAMES = variant === 'smooth' ? 59 : isDarkMode ? 30 : 31;
  const GRID_COLS = variant === 'smooth' ? 8 : 6;
  const FRAME_WIDTH = 960;
  const FRAME_HEIGHT = 1440;
  const DISPLAY_WIDTH = 900;
  const DISPLAY_HEIGHT = 1350;

  // Get frame adjustments based on variant. The smoothed variant's frames
  // are freshly interpolated and haven't been individually calibrated yet
  // (unlike the staggered variant, which has hand-tuned per-frame x/y/scale
  // in rotatingHeadConfig.ts) — it renders with no per-frame adjustment
  // until/unless Noah asks for that calibration pass. Memoized so this
  // object has a stable identity across renders (only changes when variant
  // changes), keeping the drawFrame useCallback below from being redefined
  // — and its dependent effects re-run — on every render.
  const frameAdjustments: FrameAdjustmentsMap = useMemo(
    () => (variant === 'staggered' ? (lightModeStaggeredAdjustments as FrameAdjustmentsMap) : {}),
    [variant]
  );

  // Draw frame on canvas. Declared before the sprite-load effect below
  // (which calls it in an onload callback) to avoid a temporal-dead-zone
  // reference — wrapped in useCallback so the two effects that depend on
  // it can list it as a dependency without re-running every render.
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !spriteSheetRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Round to nearest frame for sprite sheet lookup
    const roundedFrame = Math.round(frameIndex);
    const safeFrame = ((roundedFrame % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;

    // Calculate position in sprite sheet grid
    const col = safeFrame % GRID_COLS;
    const row = Math.floor(safeFrame / GRID_COLS);
    const srcX = col * FRAME_WIDTH;
    const srcY = row * FRAME_HEIGHT;

    // Get adjustment for this frame
    const adj = frameAdjustments[(safeFrame + 1).toString()];
    const offsetX = adj?.x || 0;
    const offsetY = adj?.y || 0;
    const scale = (adj?.scale || 100) / 100;

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Apply transformations
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.translate(centerX + offsetX, centerY + offsetY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    // Draw frame
    ctx.drawImage(
      spriteSheetRef.current,
      srcX,
      srcY,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.restore();
  }, [TOTAL_FRAMES, GRID_COLS, FRAME_WIDTH, FRAME_HEIGHT, frameAdjustments]);

  // Load sprite sheet
  useEffect(() => {
    const spriteSheet = new Image();
    // Use WebP for web (much smaller)
    let spriteUrl: string;
    if (variant === 'smooth') {
      spriteUrl = '/images/rotating-head/sprite-sheet-light-smoothed-verified.webp';
    } else {
      spriteUrl = isDarkMode
        ? '/images/rotating-head/sprite-sheet-dark-staggered.webp'
        : '/images/rotating-head/sprite-sheet-light-staggered.webp';
    }
    
    spriteSheet.src = spriteUrl;

    spriteSheet.onload = () => {
      spriteSheetRef.current = spriteSheet;
      drawFrame(currentFrame);
    };

    return () => {
      spriteSheetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDarkMode, variant, drawFrame]);

  // Auto-rotation loop
  useEffect(() => {
    if (!isAutoRotating) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % TOTAL_FRAMES);
    }, autoRotateSpeed);

    return () => clearInterval(interval);
  }, [isAutoRotating, autoRotateSpeed, TOTAL_FRAMES]);

  // Momentum/inertia animation
  useEffect(() => {
    if (isDragging || velocity === 0) return;

    let animationId: number;
    const animate = () => {
      setVelocity((prev) => {
        const newVelocity = prev * 0.95; // Friction factor

        if (Math.abs(newVelocity) < 0.01) {
          return 0; // Stop when velocity is negligible
        }

        setCurrentFrame((frame) => (frame + newVelocity / dragSensitivity) % TOTAL_FRAMES);
        return newVelocity;
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isDragging, velocity, dragSensitivity, TOTAL_FRAMES]);

  // Draw whenever frame changes
  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, isDarkMode, variant, drawFrame]);

  /* Publish the rotation as a monotonic tick, so the stars and pencil marks
   * behind the head can run on the same beat — see lib/headFrame.ts for why
   * this accumulates a signed step instead of exporting `currentFrame`
   * directly. Kept here rather than in the parent because this is the only
   * place the frame actually advances (auto-rotation AND drag momentum both
   * land in `currentFrame`). Writing to a module store is not React state,
   * so this doesn't re-render anything that hasn't subscribed. */
  const tickRef = useRef(0);
  const prevFrameRef = useRef<number | null>(null);
  useEffect(() => {
    // `currentFrame` is fractional and can go negative while a drag has
    // momentum, so this needs a true modulo, not `%`.
    const f = ((Math.round(currentFrame) % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
    const prev = prevFrameRef.current;
    if (prev !== null && f !== prev) {
      let step = f - prev;
      // The short way round: 30 -> 0 is one frame forward, not thirty back.
      if (step > TOTAL_FRAMES / 2) step -= TOTAL_FRAMES;
      if (step < -TOTAL_FRAMES / 2) step += TOTAL_FRAMES;
      tickRef.current += step;
      setHeadTick(tickRef.current);
    }
    prevFrameRef.current = f;
  }, [currentFrame, TOTAL_FRAMES]);

  // Drag handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setIsAutoRotating(false);
    setVelocity(0); // Reset velocity when starting new drag

    const startX = e.clientX;
    const startFrame = currentFrame;
    let lastX = startX;
    let lastTime = Date.now();

    const handleMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX;
      const currentTime = Date.now();
      const deltaX = currentX - startX;
      const frameDelta = deltaX / dragSensitivity; // Use decimal for smooth movement
      setCurrentFrame(startFrame + frameDelta);

      // Calculate velocity for momentum
      const deltaPixels = currentX - lastX;
      const deltaTime = Math.max(currentTime - lastTime, 16); // Min 16ms (60fps)
      const instantVelocity = (deltaPixels / deltaTime) * 16; // Pixels per frame
      setVelocity(instantVelocity);

      lastX = currentX;
      lastTime = currentTime;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Don't resume auto-rotation - just let momentum play out
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Touch handler
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setIsAutoRotating(false);
    setVelocity(0);

    const startX = e.touches[0].clientX;
    const startFrame = currentFrame;
    let lastX = startX;
    let lastTime = Date.now();

    const handleTouchMove = (e: TouchEvent) => {
      const currentX = e.touches[0].clientX;
      const currentTime = Date.now();
      const deltaX = currentX - startX;
      const frameDelta = deltaX / dragSensitivity; // Use decimal for smooth movement
      setCurrentFrame(startFrame + frameDelta);

      // Calculate velocity for momentum
      const deltaPixels = currentX - lastX;
      const deltaTime = Math.max(currentTime - lastTime, 16);
      const instantVelocity = (deltaPixels / deltaTime) * 16;
      setVelocity(instantVelocity);

      lastX = currentX;
      lastTime = currentTime;
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      // Don't resume auto-rotation
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${containerClassName}`}>
      <canvas
        ref={canvasRef}
        width={DISPLAY_WIDTH}
        height={DISPLAY_HEIGHT}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`
          cursor-grab active:cursor-grabbing
          ${isDragging ? 'opacity-90' : 'opacity-100'}
          transition-opacity
        `}
        style={{ background: 'transparent' }}
      />
    </div>
  );
}
