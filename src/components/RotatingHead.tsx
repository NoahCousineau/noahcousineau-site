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
  /** How long the head stays still after a drag before it starts winding
   *  back up. 5000 -> 2200 on 2026-08-30 — Noah: "make it so the head
   *  continues rotating a little sooner than it currently does after the user
   *  stops it." Five seconds was Noah's own original number, but that was
   *  before the ramp existed: the head does not snap back to speed, it eases
   *  over RESUME_RAMP_MS, so the pause reads longer than it measures. */
  resumeRotationDelay?: number;
  dragSensitivity?: number;
  containerClassName?: string;
}

export default function RotatingHead({
  isDarkMode = false,
  variant = 'staggered',
  autoRotateSpeed = 100,
  resumeRotationDelay = 2200,
  dragSensitivity = 20,
  containerClassName = '',
}: RotatingHeadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteSheetRef = useRef<HTMLImageElement | null>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [velocity, setVelocity] = useState(0);

  /* WHEN THE HEAD CAME TO REST AFTER A SPIN, or null if it is simply
   * turning on its own (2026-08-24). Noah: "If the user spins the head, the
   * head should only stay still for five seconds before slowly accelerating
   * back to its original speed."
   *
   * A ref, not state, because the auto-rotation loop below reads it every
   * animation frame and must not be torn down and rebuilt when it changes —
   * which is exactly what a dependency would do, resetting the ramp on the
   * frame it started. */
  const pausedAtRef = useRef<number | null>(null);
  /** Whether the current stillness is the end of a drag rather than the
   *  page having just loaded — only the former should wait and ramp. */
  const spunRef = useRef(false);

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
  /** How long the head takes to get back up to speed once the wait is over.
   *  Long enough that the acceleration is legible as acceleration; short
   *  enough that it is back to normal before anyone wonders if it is. */
  const RESUME_RAMP_MS = 2600;
  const FRAME_WIDTH = 960;
  const FRAME_HEIGHT = 1440;
  // The canvas BACKING STORE, in device-independent pixels — how much detail
  // is drawn, not how big it appears. See the note on the <canvas> below for
  // why those are now two different things.
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

  /* Auto-rotation, and the wait-then-ramp back to it after a spin.
   *
   * A requestAnimationFrame loop rather than the setInterval this used to be,
   * because the rate is no longer constant: "slowly accelerating back to its
   * original speed" needs a speed that can be a fraction of the cruise rate
   * and change every frame, and setInterval only offers whole-millisecond
   * periods reset by tearing the timer down. Driving it off elapsed time also
   * means the head turns at the same real-world rate whatever the display's
   * refresh rate, which the old one-frame-per-tick timer did not guarantee.
   *
   * `currentFrame` is fractional and already was — drag momentum has always
   * written fractional frames into it, and drawFrame rounds — so advancing by
   * a fractional amount per animation frame needs nothing else to change.
   *
   * Suppressed entirely while a drag is in progress or momentum is still
   * carrying the head, so there is only ever one thing writing the frame. */
  useEffect(() => {
    if (isDragging || velocity !== 0) return;

    const framesPerSec = 1000 / autoRotateSpeed;
    let raf = 0;
    let last: number | null = null;

    const step = (t: number) => {
      const dt = last === null ? 0 : (t - last) / 1000;
      last = t;

      let rate = 1;
      const pausedAt = pausedAtRef.current;
      if (pausedAt !== null) {
        const since = t - pausedAt;
        if (since < resumeRotationDelay) {
          rate = 0; // "stay still for five seconds"
        } else {
          // Quadratic rather than linear: a linear ramp leaves the head at
          // half speed halfway through, which reads as it already being back
          // to normal. Squaring keeps the first half of the ramp genuinely
          // slow, so the acceleration is the thing you notice.
          const p = Math.min(1, (since - resumeRotationDelay) / RESUME_RAMP_MS);
          rate = p * p;
          if (p >= 1) pausedAtRef.current = null;
        }
      }

      if (rate > 0) {
        setCurrentFrame((prev) => (prev + framesPerSec * rate * dt) % TOTAL_FRAMES);
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isDragging, velocity, autoRotateSpeed, resumeRotationDelay, TOTAL_FRAMES]);

  /* Start the five-second wait at the moment the head actually stops, which
   * is when momentum has run out — not when the pointer came up. Releasing a
   * fast flick and having the clock start there would spend most of the wait
   * on a head that is still visibly spinning. */
  useEffect(() => {
    if (isDragging) {
      spunRef.current = true;
      pausedAtRef.current = null;
      return;
    }
    if (velocity !== 0) return;
    if (spunRef.current) {
      spunRef.current = false;
      pausedAtRef.current = performance.now();
    }
  }, [isDragging, velocity]);

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

  /* Touch handler.
   *
   * THE PAGE USED TO WIN THIS GESTURE (2026-08-30). Noah: "the drag head spin
   * doesn't work well on mobile. The head barely moves when I try to flick it
   * and the page can sometimes move up and down."
   *
   * Three things, all of them the same story. The canvas had no touch-action,
   * so the browser was free to read a horizontal drag as the start of a
   * scroll. The move handler never called preventDefault, so nothing told it
   * otherwise. And the listener was registered without `{ passive: false }`,
   * which since Chrome 56 and Safari 11.3 means document-level touchmove is
   * passive by default and preventDefault would have been ignored even if it
   * had been called. So the page scrolled, the browser cancelled the touch
   * sequence, and the head stopped turning part-way through the flick —
   * exactly "barely moves". */
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setVelocity(0);

    const startX = e.touches[0].clientX;
    const startFrame = currentFrame;
    let lastX = startX;
    let lastTime = Date.now();

    const handleTouchMove = (e: TouchEvent) => {
      // This gesture belongs to the head, not to the document.
      if (e.cancelable) e.preventDefault();
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
      document.removeEventListener('touchcancel', handleTouchEnd);
      // Auto-rotation resumes on its own — see the wait-then-ramp above.
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);
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
          touch-none select-none
          cursor-grab active:cursor-grabbing
          ${isDragging ? 'opacity-90' : 'opacity-100'}
          transition-opacity
        `}
        /*
         * SIZED IN ARTBOARD UNITS, which it was not until 2026-08-23. The
         * width/height ATTRIBUTES above are the bitmap; with no CSS size a
         * canvas also lays out at that bitmap size, so this was a fixed 900px
         * element in a layout where everything else scales with `--u`. Its
         * container (Hero's Place, 650x950u) clips, and on a desktop that only
         * ever trimmed the sprite's transparent margin — but on a 390px phone
         * the container is 132px wide and the canvas was still 900, so the
         * home page showed a 132px window onto the middle of the head. An ear.
         *
         * 1200 x 1800 units was exactly 900 x 1350 at the desktop `--u` of
         * 0.75 — a no-op at the widths the design was built at, only taking
         * effect as the viewport narrows. 2026-08-24, Noah: "reduce the size
         * of the spinning head by 15%" — 1020 x 1530 (x0.85) now DOES
         * downscale the 900x1350 backing store a hair at desktop widths,
         * which is fine (shrinking a bitmap loses nothing the way enlarging
         * one would). The px fallback keeps the old behaviour if this is
         * ever mounted outside an artboard.
         */
        style={{
          background: 'transparent',
          width: 'calc(var(--u, 0.6375px) * 1020)',
          height: 'calc(var(--u, 0.6375px) * 1530)',
        }}
      />
    </div>
  );
}
