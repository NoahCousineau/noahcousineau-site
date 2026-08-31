"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * InViewVideo — self-hosted video with TWO modes:
 *
 * 1. AMBIENT (default): starts playing the moment it scrolls into view and
 *    pauses when it scrolls out. No play button, no chrome, muted, loops.
 *    Per Noah: "have the video start playing when the user sees it, there
 *    shouldn't be a play button and then it starts going."
 *
 * 2. ACTIVATED (2026-08-20, per Noah: "the ability for the user to click on
 *    the video and have audio and play/pause controls"): clicking the video
 *    unmutes it and reveals the browser's native control bar (play/pause,
 *    scrubber, volume, fullscreen). Once activated, the video stops looping
 *    silently in the background and behaves like a real player.
 *
 * EXCLUSIVE AUDIO: only one video on the page may be unmuted at a time.
 * Activating one re-mutes and de-activates every other. Without this,
 * scrolling a long project page after clicking two videos would stack
 * overlapping audio tracks — the pages here can hold a dozen videos.
 * Coordination goes through a module-level registry rather than a React
 * context so it works no matter where in the tree the videos are rendered
 * (project grids build their cells through several generic wrappers).
 *
 * CLICK vs. NATIVE CONTROLS: once the control bar is visible, clicks that
 * land on it must reach the browser, not our toggle handler — otherwise
 * pressing native "pause" would fire both the native action and our own
 * toggle, cancelling out. The handler therefore ignores clicks within
 * CONTROL_BAR_GUARD_PX of the bottom edge, which is where every browser
 * draws that bar.
 */

/** Registered de-activators for every mounted video, used to enforce the
 * one-unmuted-video-at-a-time rule described above. */
const activeVideos = new Set<() => void>();

/** Height of the native control bar to leave alone on click, in px. Chrome
 * and Safari both draw it well within this. */
const CONTROL_BAR_GUARD_PX = 56;

export function InViewVideo({
  src,
  className = "",
  objectFit = "cover",
}: {
  src: string;
  className?: string;
  /** "cover" (default) fills the box, cropping overflow. "contain" scales
   * the video proportionally to fit entirely within the box (letterboxed
   * on whichever axis doesn't match), never cropping — use this when a
   * portrait/odd-aspect video sits in a landscape-shaped cell and the
   * full frame must stay visible. */
  objectFit?: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // User has clicked this video: sound on, native controls shown.
  const [activated, setActivated] = useState(false);
  // User explicitly paused via the native controls — suppresses the
  // scroll-into-view autoplay so the video doesn't fight them by
  // restarting itself every time it re-enters the viewport.
  const userPausedRef = useRef(false);

  const deactivate = useCallback(() => {
    const el = ref.current;
    if (el) el.muted = true;
    userPausedRef.current = false;
    setActivated(false);
  }, []);

  // Ambient autoplay/pause on scroll. Deliberately does NOT depend on
  // `activated`: an activated video should still pause when it leaves the
  // viewport (nobody wants audio from a video three screens up) and resume
  // when it comes back, unless the user paused it themselves.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (userPausedRef.current) return;
          el.play().catch(() => {
            /* autoplay can be blocked before user interaction on some
               browsers even when muted+playsInline; silently no-op —
               the video just sits on its poster frame until it can. */
          });
        } else {
          el.pause();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Register/unregister this video's de-activator for exclusive audio.
  useEffect(() => {
    activeVideos.add(deactivate);
    return () => {
      activeVideos.delete(deactivate);
    };
  }, [deactivate]);

  // Keep `userPaused` in sync with whatever the native controls do, so the
  // IntersectionObserver above respects a manual pause but forgets it as
  // soon as the user presses play again.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPlay = () => {
      userPausedRef.current = false;
    };
    // Only treat a pause as intentional once the player is activated —
    // the observer itself pauses the video on scroll-out, which must not
    // be mistaken for the user pressing pause.
    const onPause = () => {
      if (activated) userPausedRef.current = true;
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [activated]);

  const handleClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const el = ref.current;
    if (!el) return;

    if (activated) {
      // Let the native control bar own clicks in its own strip.
      const rect = el.getBoundingClientRect();
      if (e.clientY > rect.bottom - CONTROL_BAR_GUARD_PX) return;
      if (el.paused) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
      return;
    }

    // First click: take over audio from any other activated video, then
    // unmute and reveal controls on this one.
    activeVideos.forEach((fn) => {
      if (fn !== deactivate) fn();
    });
    el.muted = false;
    // A video that has been looping silently is mid-stream; leave the
    // playhead where it is (matching what the viewer is looking at) and
    // just make sure it's rolling with sound.
    el.play().catch(() => {});
    setActivated(true);
  };

  return (
    <div className="relative w-full h-full group/video">
      <video
        ref={ref}
        src={src}
        muted
        // Looping is right for silent ambient playback but wrong for a real
        // player with audio — an activated clip should end rather than
        // restart under the viewer.
        loop={!activated}
        playsInline
        /* "none", not "metadata" (2026-08-30). These autoplay when they
           scroll into view, so the browser was already going to fetch the
           whole file the moment one appeared — and asking for metadata on top
           of that started a second fetch of every video on the page before
           anyone had scrolled anywhere near it. On a phone that is tens of
           megabytes spent on videos most visitors never reach. Nothing is
           requested now until the observer actually starts playback. */
        preload="none"
        controls={activated}
        onClick={handleClick}
        className={`w-full h-full cursor-pointer ${objectFit === "contain" ? "object-contain" : "object-cover"} ${className}`}
        style={{ display: "block", lineHeight: 0 }}
      />
      {/* Sound affordance — the ambient videos are otherwise
          indistinguishable from silent looping art, so nothing signals that
          they're clickable. Shows only before activation and only on hover,
          kept small and low-contrast so it reads as a hint rather than UI
          furniture on a design portfolio. pointer-events-none so it never
          swallows the click it's advertising. */}
      {!activated && (
        <div
          className="absolute pointer-events-none opacity-0 group-hover/video:opacity-100 transition-opacity duration-300 flex items-center gap-[0.5em] rounded-full"
          style={{
            bottom: "calc(var(--u) * 24)",
            left: "calc(var(--u) * 24)",
            padding: "calc(var(--u) * 10) calc(var(--u) * 18)",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontFamily: "var(--font-sans)",
            /* FLOORED, because 16 artboard units is not a size on a small
               window (2026-08-29). `--u` is a pure linear zoom, so this badge
               measured 3.25px at a 390px viewport -- present, styled, and
               completely unreadable. The clamp gives it a floor in rem and a
               ceiling so it cannot run away on a wide display either; the
               same idiom the section titles already use. Unchanged from about
               1320px up, where 16 units is already past the floor. */
            fontSize: "clamp(0.6875rem, calc(var(--u) * 16), 1rem)",
            lineHeight: 1,
            backdropFilter: "blur(4px)",
          }}
        >
          <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 5a9 9 0 0 1 0 14" />
          </svg>
          <span className="lowercase">click for sound</span>
        </div>
      )}
    </div>
  );
}
