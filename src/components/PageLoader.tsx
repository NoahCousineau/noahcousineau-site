"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getLenis } from "./SmoothScroll";

/**
 * PageLoader — full-viewport loading overlay that covers the screen while
 * a page's images/videos finish loading, then fades out.
 *
 * WHY THIS EXISTS: Noah wants every project image served at full native
 * resolution (no compression) for visual fidelity, which means pages can
 * take a real, noticeable amount of time to finish loading all their
 * media — especially project pages with 60+ full-res images. Rather than
 * let the page "pop in" piecemeal while images trickle in (looking
 * broken/unfinished), this shows a deliberate full-screen loading state
 * — the same pattern used by many high-production portfolio sites
 * (progress bar / animated mark while assets load, then a reveal).
 *
 * THIS IS A PLACEHOLDER VISUAL — Noah said he'll redesign the actual
 * loading animation later. Do not treat the current visual (simple
 * pulsing wordmark + progress bar) as final; it exists only to prove out
 * the *mechanism* (gate content behind real asset-load progress) so the
 * visual can be swapped freely later without touching the loading logic.
 *
 * HOW IT WORKS:
 * 1. Mounted with `key={pathname}` by the parent (see layout.tsx) — this
 *    is the React-idiomatic way to "reset on route change": rather than
 *    manually calling setState inside an effect to reset state (which
 *    triggers a lint error, `react-hooks/set-state-in-effect`, and an
 *    extra render pass), changing the `key` prop makes React unmount the
 *    old instance and mount a brand-new one with fresh initial state
 *    every time the route changes. No manual reset logic needed here.
 * 2. On mount, poll the DOM for every <img> and <video> currently
 *    rendered in <main> and count how many have finished loading
 *    (img.complete / video.readyState >= 3), updating a percentage.
 * 3. New <img>/<video> elements that appear after the initial scan
 *    (e.g. from client-side rendering) are picked up via a
 *    MutationObserver so the count doesn't lock in stale early.
 * 4. Once 100% of currently-known media has loaded (or a MAX_WAIT_MS
 *    safety timeout elapses, so a single broken/slow asset can't hang
 *    the loader forever), fade the overlay out and unmount it.
 * 5. Respects prefers-reduced-motion: skips the fade transition (instant
 *    show/hide) but the gating logic itself is unaffected.
 *
 * USAGE: mount near the root of the tree, keyed by pathname, as a sibling
 * to the actual page content (see layout.tsx) — it's a fixed-position
 * overlay, not a wrapper, so it doesn't affect layout.
 */

const MAX_WAIT_MS = 8000; // safety net: never block longer than this
const POLL_INTERVAL_MS = 100;

export default function PageLoader() {
  const pathname = usePathname();
  // Keying by pathname forces React to unmount/remount PageLoaderInner on
  // every route change, giving it fresh initial state for free (see the
  // component doc comment above for why this is preferred over manually
  // resetting state inside an effect).
  return <PageLoaderInner key={pathname} />;
}

function PageLoaderInner() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Every mount of this component (one per route, thanks to the
    // `key={pathname}` wrapper above) starts its own fresh timer — no
    // manual state reset needed since useState's initial values above
    // already give us visible=true/fading=false/progress=0 on mount.
    startTimeRef.current = Date.now();

    // ALWAYS LAND AT THE TOP OF A NEW PAGE (2026-08-23, per Noah, as a
    // general site-wide rule: "whenever a page finishes loading, please
    // always make sure it starts at the top of the page"). This overlay is
    // opaque and full-viewport while it's up, so doing this immediately on
    // mount — rather than waiting for `finish()` — is invisible to the
    // reader and means the page is already correctly positioned by the
    // moment the fade-out reveals it.
    //
    // Plain `window.scrollTo` alone isn't enough: Lenis (see
    // SmoothScroll.tsx) intercepts wheel/touch input and drives the
    // document scroll itself from its own internal target/animated
    // position, which this jump does not touch. Left alone, Lenis's next
    // rAF tick can pull the page back toward whatever position it still
    // thinks is current — reproducible by navigating away from a scrolled
    // page and back. `immediate: true` snaps Lenis's own state to 0 in the
    // same frame instead of easing there.
    window.scrollTo(0, 0);
    getLenis()?.scrollTo(0, { immediate: true });

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let observer: MutationObserver | null = null;

    function getMediaElements(): (HTMLImageElement | HTMLVideoElement)[] {
      const root = document.querySelector("main") || document.body;
      return Array.from(root.querySelectorAll("img, video"));
    }

    function isMediaLoaded(el: HTMLImageElement | HTMLVideoElement): boolean {
      if (el instanceof HTMLImageElement) {
        // naturalWidth === 0 on a "complete" image usually means it
        // failed to load (404, etc.) — count it as done anyway so a
        // single broken image can't block the whole page forever.
        return el.complete;
      }
      // HAVE_FUTURE_DATA (3) or better means enough of the video is
      // buffered to start playing — good enough to reveal the page;
      // we don't need the whole video downloaded.
      return el.readyState >= 3;
    }

    function checkProgress() {
      if (cancelled) return;
      const elements = getMediaElements();
      if (elements.length === 0) {
        setProgress(100);
        finish();
        return;
      }
      const loadedCount = elements.filter(isMediaLoaded).length;
      const pct = Math.round((loadedCount / elements.length) * 100);
      setProgress(pct);

      const elapsed = Date.now() - startTimeRef.current;
      if (loadedCount === elements.length || elapsed >= MAX_WAIT_MS) {
        finish();
      }
    }

    function finish() {
      if (cancelled) return;
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (observer) observer.disconnect();
      setProgress(100);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setVisible(false);
        return;
      }
      setFading(true);
      // Match the CSS transition duration below (400ms) before unmounting.
      window.setTimeout(() => setVisible(false), 400);
    }

    // Give the DOM a tick to render the new page's <img>/<video> tags
    // before the first measurement (avoids a false "0 elements = 100%"
    // reading on the very first frame of a route change).
    const initialDelay = window.setTimeout(() => {
      checkProgress();
      pollId = setInterval(checkProgress, POLL_INTERVAL_MS);

      // Watch for media elements added after our initial scan (e.g. a
      // component that mounts more <img> tags slightly later).
      observer = new MutationObserver(() => checkProgress());
      observer.observe(document.querySelector("main") || document.body, {
        childList: true,
        subtree: true,
      });
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(initialDelay);
      if (pollId) clearInterval(pollId);
      if (observer) observer.disconnect();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        background: "var(--color-paper, #fff)",
        opacity: fading ? 0 : 1,
        transition: "opacity 400ms ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* PLACEHOLDER VISUAL — swap freely later. The pulsing wordmark +
          progress bar only exist to prove the loading mechanism works;
          Noah will redesign this. */}
      <div
        style={{
          fontFamily: "var(--font-serif, Georgia, serif)",
          fontStyle: "italic",
          fontSize: "clamp(20px, 3vw, 32px)",
          color: "var(--color-ink, #0d0d0d)",
          animation: "pageLoaderPulse 1.4s ease-in-out infinite",
        }}
      >
        Cousineau
      </div>
      <div
        style={{
          width: "min(240px, 60vw)",
          height: "2px",
          background: "rgba(13,13,13,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "var(--color-ink, #0d0d0d)",
            transition: "width 150ms ease-out",
          }}
        />
      </div>
      <style>{`
        @keyframes pageLoaderPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
