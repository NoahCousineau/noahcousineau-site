"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { projects, HOVER_VIDEO, HOVER_FALLBACK } from "@/lib/projects";

/**
 * PROJECTS — third homepage area.
 * Grid of project tiles. On hover (pointer devices) the tile's video plays;
 * on touch / no-hover, the cover image shows. Titles sit in a white box for
 * legibility. Valley Strong has no video → image + CSS shimmer fallback.
 */
function Tile({ slug, title }: { slug: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const vid = HOVER_VIDEO[slug];

  function play() {
    if (!vid || !videoRef.current) return;
    videoRef.current.play().catch(() => {});
  }
  function stop() {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  }

  return (
    <Link
      href={`/work/${slug}`}
      className="group relative block aspect-[4/3] overflow-hidden bg-black"
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
    >
      {vid ? (
        <video
          ref={videoRef}
          src={vid}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />
      ) : (
        // No video: image with a slow zoom + sheen to imply motion
        <div className="absolute inset-0">
          <Image
            src={HOVER_FALLBACK[slug] ?? "/assets/home/portrait.webp"}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover scale-100 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        </div>
      )}

      {/* Title in white box for legibility */}
      <div className="relative z-10 m-4 inline-block bg-white text-[color:var(--color-ink)] px-3 py-1.5 uppercase tracking-wide font-bold"
           style={{ fontSize: "var(--text-caption)" }}>
        {title}
      </div>
    </Link>
  );
}

export default function Projects() {
  return (
    <section className="px-[--gutter] py-[10vh] max-w-[--maxw] mx-auto">
      <h2
        className="uppercase font-bold tracking-tight mb-[6vh]"
        style={{ fontSize: "var(--text-heading)" }}
      >
        Selected Work
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-[--gutter]">
        {projects.map((p) => (
          <Tile key={p.slug} slug={p.slug} title={p.title} />
        ))}
      </div>
    </section>
  );
}
