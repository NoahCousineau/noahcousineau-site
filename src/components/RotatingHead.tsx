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

  /* ONE rAF OWNS THE FRAME, AND NOTHING RE-RENDERS TO TURN THE HEAD
   * (2026-08-30). Noah: "the head dragging rotation is still a bit stiff on
   * the mobile home page, please work to make this feel more natural."
   *
   * It was stiff because every touchmove wrote React state TWICE — the frame
   * and the velocity — so a 120Hz flick asked for 240 renders a second, each
   * one re-running effects and tearing down and rebuilding the momentum rAF,
   * because `velocity` was in its own dependency array. The head was being
   * animated by the reconciler, which is not what the reconciler is for.
   *
   * Now the frame and the velocity are refs, one loop reads them and draws,
   * and React is only told when a drag starts and stops — which is the only
   * thing it renders anything for. */
  const frameRef = useRef(0);
  /** Frames per SECOND, so drag and friction are both measured against time. */
  const velRef = useRef(0);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  /** The rounded frame currently on the canvas, so a still head isn't redrawn. */
  const drawnRef = useRef<number | null>(null);

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
  /* Friction as a fraction of speed retained per SECOND. 0.06 lands within a
     hair of the old per-frame 0.95 at 60Hz (0.95^60 = 0.046) while being the
     same on every refresh rate — see the loop below. */
  const FRICTION_PER_SEC = 0.06;
  /** Frames/s under which the head is standing still. */
  const MIN_VEL = 0.35;
  /** About three turns a second. A flick should feel strong, not unreadable. */
  const MAX_VEL = 90;
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
      // Force the loop to repaint: a new sprite sheet at the same frame
      // number is still a different picture.
      drawnRef.current = null;
      drawFrame(frameRef.current);
    };

    return () => {
      spriteSheetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDarkMode, variant, drawFrame]);

  /* THE ONE LOOP.
   *
   * Everything that can turn the head lands here: a drag writes the frame
   * directly, a release leaves a velocity behind for this to spend, and when
   * there is neither it winds back up to the idle turntable speed. A single
   * owner is what lets those three hand over cleanly — the arrangement before
   * this had an auto-rotate rAF and a momentum rAF each suppressing itself
   * when it believed the other should be running, negotiating through React
   * state that arrived a render late. That gap is what you felt at the end of
   * a flick.
   *
   * Everything is per-second and multiplied by real elapsed time, so the head
   * turns at the same rate on a 60Hz phone and a 120Hz one. The old friction
   * was `v *= 0.95` PER FRAME, which on a ProMotion iPhone decayed twice as
   * fast as it was tuned for: a flick that should coast for a second died in
   * half of one, on the exact devices Noah was testing. */
  const tickRef = useRef(0);
  const prevFrameRef = useRef<number | null>(null);
  useEffect(() => {
    const framesPerSec = 1000 / autoRotateSpeed;
    let raf = 0;
    let last: number | null = null;

    /* A HEAD NOBODY CAN SEE DOES NOT NEED PAINTING (2026-08-31).
     *
     * This canvas is 900x1350 and lives at the top of the home page, and it
     * was repainting every frame for the whole length of the document — so
     * the entire time a reader was down at the project grid, the main thread
     * was still drawing a head three screens above them. On a phone that is
     * paint bandwidth taken directly out of the scroll. It picks up again
     * from wherever it left off, and `last` is cleared on the way back in so
     * the time spent away is not integrated in one jump. */
    const canvas = canvasRef.current;
    let onScreen = true;
    const io = canvas
      ? new IntersectionObserver(
          ([e]) => {
            onScreen = e.isIntersecting;
            if (onScreen) last = null;
          },
          { rootMargin: "15% 0px" }
        )
      : null;
    if (io && canvas) io.observe(canvas);

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (!onScreen) return;
      /* Clamped: returning from a background tab hands you a dt of several
         seconds, and spending it in one go teleports the head. */
      const dt = last === null ? 0 : Math.min((t - last) / 1000, 0.05);
      last = t;

      if (!draggingRef.current) {
        if (velRef.current !== 0) {
          frameRef.current += velRef.current * dt;
          velRef.current *= Math.pow(FRICTION_PER_SEC, dt);
          if (Math.abs(velRef.current) < MIN_VEL) {
            velRef.current = 0;
            /* The wait starts when the head actually STOPS, not when the
               finger lifted — starting the clock at the release would spend
               most of it on a head that is still visibly spinning. */
            pausedAtRef.current = t;
          }
        } else {
          let rate = 1;
          const pausedAt = pausedAtRef.current;
          if (pausedAt !== null) {
            const since = t - pausedAt;
            if (since < resumeRotationDelay) {
              rate = 0; // "stay still for five seconds"
            } else {
              // Quadratic rather than linear: a linear ramp leaves the head at
              // half speed halfway through, which reads as it already being
              // back to normal. Squaring keeps the first half of the ramp
              // genuinely slow, so the acceleration is the thing you notice.
              const p = Math.min(1, (since - resumeRotationDelay) / RESUME_RAMP_MS);
              rate = p * p;
              if (p >= 1) pausedAtRef.current = null;
            }
          }
          if (rate > 0) frameRef.current += framesPerSec * rate * dt;
        }
      }

      // Kept in range so a long session can't drift into huge numbers.
      frameRef.current =
        ((frameRef.current % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;

      /* Only when the picture would actually differ. drawFrame rounds, so
         redrawing between two thirds of a frame paints the same pixels — and
         during the post-spin pause the head is not moving at all. This is the
         difference between a canvas repaint every frame forever and one only
         when the head turns, which is worth having on a phone that is also
         trying to scroll. */
      const rounded = Math.round(frameRef.current) % TOTAL_FRAMES;
      if (drawnRef.current !== rounded) {
        drawFrame(frameRef.current);
        drawnRef.current = rounded;

        /* Publish the rotation as a monotonic tick, so the stars and pencil
           marks behind the head run on the same beat — see lib/headFrame.ts
           for why this accumulates a signed step rather than exporting the
           frame directly. */
        const prev = prevFrameRef.current;
        if (prev !== null && rounded !== prev) {
          let s = rounded - prev;
          // The short way round: 30 -> 0 is one frame forward, not thirty back.
          if (s > TOTAL_FRAMES / 2) s -= TOTAL_FRAMES;
          if (s < -TOTAL_FRAMES / 2) s += TOTAL_FRAMES;
          tickRef.current += s;
          setHeadTick(tickRef.current);
        }
        prevFrameRef.current = rounded;
      }
    };

    raf = requestAnimationFrame(step);
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [autoRotateSpeed, resumeRotationDelay, TOTAL_FRAMES, drawFrame]);

  /* A RELEASE IS MEASURED OVER A WINDOW, NOT OFF THE LAST TWO POINTS.
   *
   * The velocity a flick leaves behind used to be whichever pair of samples
   * happened to be last, divided by a `Math.max(dt, 16)` floor — so a pair
   * 4ms apart, which is ordinary on a 120Hz screen, was read as if it had
   * taken 16ms and came out four times too slow, while a stray jitter on the
   * final point came out as a throw. Averaging the tail of the gesture is
   * both steadier and closer to what the hand actually did. */
  const samplesRef = useRef<{ x: number; t: number }[]>([]);
  const startRef = useRef({ x: 0, frame: 0 });

  const beginDrag = (x: number) => {
    draggingRef.current = true;
    setIsDragging(true);
    velRef.current = 0;
    pausedAtRef.current = null;
    startRef.current = { x, frame: frameRef.current };
    samplesRef.current = [{ x, t: performance.now() }];
  };

  const moveDrag = (x: number) => {
    frameRef.current =
      startRef.current.frame + (x - startRef.current.x) / dragSensitivity;
    const now = performance.now();
    const s = samplesRef.current;
    s.push({ x, t: now });
    // The last 90ms only — the tail of the gesture is what a flick is.
    while (s.length > 2 && now - s[0].t > 90) s.shift();
  };

  const endDrag = () => {
    draggingRef.current = false;
    setIsDragging(false);
    const s = samplesRef.current;
    const first = s[0];
    const last = s[s.length - 1];
    let v = 0;
    if (first && last) {
      const ms = last.t - first.t;
      /* A finger that came to rest before lifting has no throw in it, however
         fast it was moving a moment earlier — so a stale window is zero
         rather than the velocity it used to have. This is what stops a head
         you positioned deliberately from drifting off as you let go. */
      if (ms > 8 && performance.now() - last.t < 120) {
        v = (last.x - first.x) / (ms / 1000) / dragSensitivity;
      }
    }
    velRef.current = Math.max(-MAX_VEL, Math.min(MAX_VEL, v));
    if (velRef.current === 0) pausedAtRef.current = performance.now();
    samplesRef.current = [];
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    beginDrag(e.clientX);
    const onMove = (ev: MouseEvent) => moveDrag(ev.clientX);
    const onUp = () => {
      endDrag();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  /* THE HEAD MUST NOT EAT THE PAGE'S SCROLL (2026-08-30).
   *
   * Noah: "scrolling at a fast speed seems to freeze the site." Measured on a
   * 390x844 phone, this canvas is 398x597 — the full width of the screen and
   * seven tenths of its height — and it carried `touch-action: none`. So a
   * thumb that began a flick anywhere on the head produced EXACTLY ZERO
   * scroll. Not slow, not janky: nothing moved. Confirmed by driving real
   * compositor touch gestures at the middle of the screen and reading a
   * scrollY of 0, while the same gesture 6px from the left edge scrolled
   * 1199px. On the home page the head is the first thing under your thumb,
   * so this was most of "the site freezes".
   *
   * `pan-y` hands vertical back to the browser and keeps horizontal for the
   * turntable, which is the axis the head actually spins on — so the two
   * gestures stop competing for the same pixels. The direction is then
   * settled here on the first movement large enough to read: sideways is the
   * head's, up or down is the page's, and once the page has it this lets go
   * entirely rather than fighting a scroll it cannot win. */
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t0 = e.touches[0];
    if (!t0) return;
    const originX = t0.clientX;
    const originY = t0.clientY;
    /** 0 undecided, 1 the head's gesture, -1 the page's. */
    let claim = 0;

    const detach = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
    const onMove = (ev: TouchEvent) => {
      const p = ev.touches[0];
      if (!p) return;
      if (claim === 0) {
        const dx = p.clientX - originX;
        const dy = p.clientY - originY;
        // Under 6px is a fingertip resting, not a direction.
        if (Math.hypot(dx, dy) < 6) return;
        claim = Math.abs(dx) > Math.abs(dy) ? 1 : -1;
        if (claim === -1) {
          detach();
          return;
        }
        beginDrag(p.clientX);
        return;
      }
      // This gesture belongs to the head, and `{ passive: false }` below is
      // what makes saying so effective — document-level touchmove has been
      // passive by default since Chrome 56 and Safari 11.3.
      if (ev.cancelable) ev.preventDefault();
      moveDrag(p.clientX);
    };
    const onEnd = () => {
      if (claim === 1) endDrag();
      detach();
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
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
          touch-pan-y select-none
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
