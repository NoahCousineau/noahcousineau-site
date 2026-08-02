'use client';

import React, { useEffect, useRef, useState } from 'react';
import { lightModeStaggeredAdjustments } from '@/lib/rotatingHeadConfig';

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

  // Constants - web-optimized (0.4x scale)
  const TOTAL_FRAMES = 31;
  const GRID_COLS = 6;
  const GRID_ROWS = 6;
  const FRAME_WIDTH = 960;
  const FRAME_HEIGHT = 1440;
  const DISPLAY_WIDTH = 1500;  // Increased from 600 (2.5x)
  const DISPLAY_HEIGHT = 2250;  // Increased from 900 (2.5x)

  // Get frame adjustments based on variant
  const frameAdjustments: FrameAdjustmentsMap = variant === 'staggered' 
    ? (lightModeStaggeredAdjustments as FrameAdjustmentsMap)
    : {};

  // Load sprite sheet
  useEffect(() => {
    const spriteSheet = new Image();
    // Use WebP for web (much smaller)
    const spriteUrl = isDarkMode
      ? '/images/rotating-head/sprite-sheet-dark-staggered.webp'
      : '/images/rotating-head/sprite-sheet-light-staggered.webp';
    
    spriteSheet.src = spriteUrl;

    spriteSheet.onload = () => {
      spriteSheetRef.current = spriteSheet;
      drawFrame(currentFrame);
    };

    return () => {
      spriteSheetRef.current = null;
    };
  }, [isDarkMode, variant]);

  // Draw frame on canvas
  const drawFrame = (frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !spriteSheetRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const safeFrame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;

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
  };

  // Auto-rotation loop
  useEffect(() => {
    if (!isAutoRotating) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % TOTAL_FRAMES);
    }, autoRotateSpeed);

    return () => clearInterval(interval);
  }, [isAutoRotating, autoRotateSpeed]);

  // Draw whenever frame changes
  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, isDarkMode, variant]);

  // Drag handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setIsAutoRotating(false);

    const startX = e.clientX;
    const startFrame = currentFrame;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const frameDelta = Math.round(deltaX / dragSensitivity);
      setCurrentFrame(startFrame + frameDelta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      setTimeout(() => {
        setIsAutoRotating(true);
      }, resumeRotationDelay);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Touch handler
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setIsAutoRotating(false);

    const startX = e.touches[0].clientX;
    const startFrame = currentFrame;

    const handleTouchMove = (e: TouchEvent) => {
      const deltaX = e.touches[0].clientX - startX;
      const frameDelta = Math.round(deltaX / dragSensitivity);
      setCurrentFrame(startFrame + frameDelta);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      setTimeout(() => {
        setIsAutoRotating(true);
      }, resumeRotationDelay);
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
      
      <div className="text-sm text-gray-500">
        {isDragging ? 'Drag to spin' : 'Click and drag to spin'}
      </div>
    </div>
  );
}
