"use client";

import Link from "next/link";
import Image from "next/image";
import MickeyWatch from "./MickeyWatch";

/**
 * Global footer (on every page). Comp: black bar, per Noah's sketch.
 * LEFT = Cousineau logo (white SVG). CENTER = Mickey Mouse watch with
 * time-synced arm hands. RIGHT = contact info + socials (Akzidenz, the
 * site's default sans body font).
 *
 * The project grid's center divider (Projects.tsx) stops at the top edge
 * of this bar, per the sketch — no divider line runs through the footer
 * itself, so it isn't reproduced here.
 */
export default function Footer() {
  return (
    <footer className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)] w-full relative">
      <div
        className="mx-auto max-w-[1920px] relative"
        style={{ containerType: "inline-size", ["--u" as string]: "calc(100cqw / 1920)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-10 px-[calc(var(--u)*36)] py-[6vh]">
          {/* LEFT — Cousineau logo */}
          <Link href="/" className="w-[clamp(140px,16vw,240px)] justify-self-center md:justify-self-start">
            <Image
              src="/assets/home/cousineau-logo-white.svg"
              alt="Cousineau"
              width={711}
              height={119}
              loading="eager"
              className="w-full h-auto"
            />
          </Link>

          {/* CENTER — Mickey watch */}
          <div className="w-[clamp(180px,20vw,320px)] aspect-square justify-self-center">
            <MickeyWatch />
          </div>

          {/* RIGHT — contact info (Akzidenz, inherited body font) */}
          <div
            className="flex flex-col items-center md:items-end gap-2 justify-self-center md:justify-self-end"
            style={{ fontSize: "var(--text-caption)" }}
          >
            <a href="mailto:noah@noahcousineau.com" className="hover:opacity-60 transition-opacity">
              noah@noahcousineau.com
            </a>
            <a href="tel:+186****8040" className="hover:opacity-60 transition-opacity">
              (862) 520-8040
            </a>
            <div className="flex gap-5 uppercase tracking-widest mt-1">
              <a href="https://www.instagram.com/cousineau_art_and_design/?hl=en" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">Instagram</a>
              <a href="https://www.linkedin.com/in/noah-cousineau/" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">LinkedIn</a>
              <a href="https://www.behance.net/noahcousineau" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">Behance</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
