"use client";

import { useEffect, useRef } from "react";

/*
 * InViewVideo — self-hosted video that starts playing the moment it
 * scrolls into view and pauses when it scrolls out. No play button, no
 * native controls, muted (required for autoplay), loops while visible.
 * Per Noah: "have the video start playing when the user sees it, there
 * shouldn't be a play button and then it starts going."
 */
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
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

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      controls={false}
      className={`w-full h-full ${objectFit === "contain" ? "object-contain" : "object-cover"} ${className}`}
      style={{ display: "block", lineHeight: 0 }}
    />
  );
}
