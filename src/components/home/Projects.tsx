"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Stage, Place, uFont } from "./Stage";
import { HOVER_VIDEO, HOVER_FALLBACK } from "@/lib/projects";

/**
 * PROJECTS — master slice y2600–4100. Two columns (x186 / x1145), three rows
 * (y2728 / 3329 / 3848). Titles fs~232 in white boxes. The six tiles shown on
 * the sketch: Sprouts, Corita, SoCal Earth, Valley Strong, Forced Perspective,
 * and a final "other / work" tile that links to the full index.
 */
const TILES: { slug: string; label: string; isIndex?: boolean }[] = [
  { slug: "sprouts-farmers-market", label: "sprouts / farmers market" },
  { slug: "corita-art-center", label: "corita / art center" },
  { slug: "socal-earth", label: "socal / earth" },
  { slug: "valley-strong-credit-union", label: "valley strong / credit union" },
  { slug: "forced-perspective", label: "forced / perspective" },
  { slug: "other", label: "other / work", isIndex: true },
];

const COL_X = [186, 1145];
const ROW_Y = [2728, 3329, 3848];
const TILE_W = 630;
const TILE_H = 232;

function Tile({
  slug,
  label,
  isIndex,
}: {
  slug: string;
  label: string;
  isIndex?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const vid = isIndex ? null : HOVER_VIDEO[slug];

  function play() {
    if (!vid || !videoRef.current) return;
    videoRef.current.play().catch(() => {});
  }
  function stop() {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  }

  const href = isIndex ? "/work" : `/work/${slug}`;

  return (
    <Link
      href={href}
      className="group relative block w-full h-full overflow-hidden bg-black"
      onMouseEnter={play}
      onMouseLeave={stop}
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
        <div className="absolute inset-0">
          <Image
            src={HOVER_FALLBACK[slug] ?? "/assets/home/portrait.webp"}
            alt={label}
            fill
            sizes="33vw"
            className="object-cover scale-100 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        </div>
      )}
      <div
        className="relative z-10 m-[calc(var(--u)*24)] inline-block bg-white text-[color:var(--color-ink)] px-3 py-1.5 uppercase font-bold leading-none"
        style={{ fontSize: uFont(30) }}
      >
        {label}
      </div>
    </Link>
  );
}

export default function Projects() {
  return (
    <Stage heightUnits={4200} className="overflow-hidden">
      <Place x={45} y={2619} className="z-10">
        <span className="block uppercase opacity-60" style={{ fontSize: uFont(35) }}>
          Links to projects. Animation plays on hover
        </span>
      </Place>

      {TILES.map((t, i) => (
        <Place key={t.slug} x={COL_X[i % 2]} y={ROW_Y[Math.floor(i / 2)]} w={TILE_W} h={TILE_H}>
          <Tile slug={t.slug} label={t.label} isIndex={t.isIndex} />
        </Place>
      ))}
    </Stage>
  );
}
