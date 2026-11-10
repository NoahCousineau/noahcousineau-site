"use client";

import { useState } from "react";
import Image from "next/image";

/*
 * YouTubeFacade — a poster frame that becomes the real embed on click.
 *
 * WHY (2026-11-09): the bare <iframe> pulled 1.19MB over 17 requests to
 * youtube.com on the Sprouts page BEFORE any scrolling, on a page that is
 * already the heaviest on the site — all of it spent on a player nobody
 * had asked to start. The poster below is one self-hosted JPEG the image
 * optimiser serves as a ~20KB AVIF, and youtube.com is not contacted at
 * all until someone actually presses play.
 *
 * Self-hosted rather than the usual lite-youtube trick of hotlinking
 * i.ytimg.com: hotlinking still announces every page view to Google and
 * still costs a third-party connection on load, which is most of what we
 * came here to remove.
 *
 * The click count is unchanged. The old iframe did not autoplay either —
 * it showed YouTube's play button and waited — so one click started the
 * video before and one click starts it now; `autoplay=1` on the swapped-in
 * src is what keeps that promise, since by then the viewer has pressed it.
 */
export function YouTubeFacade({
  id,
  poster,
  alt,
  sizes,
}: {
  id: string;
  poster: string;
  alt: string;
  sizes: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1`}
        className="absolute inset-0 w-full h-full"
        title={alt}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${alt}`}
      className="group/yt absolute inset-0 w-full h-full cursor-pointer border-0 p-0 bg-black
                 focus-visible:outline-none"
    >
      {/* alt="" — the button already carries the label, so describing the
          poster again would make a screen reader read the same thing twice. */}
      <Image src={poster} alt="" fill sizes={sizes} className="object-cover" />
      {/* The focus ring has to be a layer ABOVE the poster, not an outline on
          the button. `<Image fill>` is an absolutely-positioned child, and a
          positioned descendant paints after its parent's own outline — so an
          inset outline on the button is drawn and then covered by the picture,
          which is exactly what happened here: :focus-visible matched, the
          computed style said `2px solid #fff`, and the rendered pixels did not
          change at all. Two tones because the poster underneath can be any
          colour; one of the two always separates from it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 opacity-0 group-focus-visible/yt:opacity-100"
        style={{ boxShadow: "inset 0 0 0 3px #fff, inset 0 0 0 6px rgba(0,0,0,0.65)" }}
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-transform duration-300 group-hover/yt:scale-110 motion-reduce:transition-none motion-reduce:group-hover/yt:scale-100"
        style={{
          /* Same clamp idiom as the "click for sound" badge: `--u` is a pure
             linear zoom, so an unfloored size disappears on a phone. */
          width: "clamp(3rem, calc(var(--u) * 86), 5.5rem)",
          height: "clamp(3rem, calc(var(--u) * 86), 5.5rem)",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          color: "#fff",
        }}
      >
        <svg width="38%" height="38%" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}
