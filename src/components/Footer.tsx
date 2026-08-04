"use client";

import Link from "next/link";
import Image from "next/image";
import MickeyWatch from "./MickeyWatch";

/**
 * Global footer (on every page). Comp: black bar.
 * LEFT = Mickey Mouse watch with time-synced arm hands (custom animation)
 * Contact info sits immediately right of the clock, LEFT-ALIGNED to it.
 * RIGHT = the real white "Cousineau" logo SVG Noah supplied.
 */

export default function Footer() {
  return (
    <footer className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)] w-full">
      <div className="mx-auto max-w-[1920px] px-[calc(var(--u)*15)] py-[6vh] flex flex-col md:flex-row md:items-center md:justify-between gap-10">
        {/* LEFT GROUP — clock (larger) + contact, left-aligned to the clock.
            Stacks vertically below ~480px so the clock+contact row can't
            force horizontal scroll on small phones. */}
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 min-w-0">
          <div className="w-[clamp(120px,20vw,280px)] aspect-square shrink-0">
            <MickeyWatch />
          </div>
          <div className="flex flex-col items-center sm:items-start gap-2 min-w-0" style={{ fontSize: "var(--text-caption)" }}>
            <a href="mailto:noah@noahcousineau.com" className="hover:opacity-60 transition-opacity">
              noah@noahcousineau.com
            </a>
            <a href="tel:+18625208040" className="hover:opacity-60 transition-opacity">
              (862) 520-8040
            </a>
            <div className="flex gap-5 uppercase tracking-widest mt-1">
              <a href="https://www.instagram.com/cousineau_art_and_design/?hl=en" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">Instagram</a>
              <a href="https://www.linkedin.com/in/noah-cousineau/" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">LinkedIn</a>
              <a href="https://www.behance.net/noahcousineau" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">Behance</a>
            </div>
          </div>
        </div>

        {/* RIGHT — the real white Cousineau logo SVG */}
        <Link href="/" className="w-[clamp(160px,22vw,320px)] shrink-0">
          <Image
            src="/assets/home/cousineau-logo-white.svg"
            alt="Cousineau"
            width={711}
            height={119}
            className="w-full h-auto"
          />
        </Link>
      </div>
    </footer>
  );
}
