"use client";

import Link from "next/link";
import Image from "next/image";
import MickeyWatch from "./MickeyWatch";

/**
 * Global footer (on every page). Comp: black bar, per Noah's sketch
 * (Homepage - Rough_Homepage - Static View.png):
 *   - Watch CENTERED in the bar, sized so there's ~30px of black bar
 *     showing above and below it (not stretched edge-to-edge).
 *   - Cousineau logo on the left, ~560px wide, bottom-aligned with the watch.
 *   - Contact info (email, phone, then a thin rule, then social links) on
 *     the right, also bottom-aligned with the watch.
 * Uses a shared bottom edge (items-end + a consistent padding-bottom) so
 * "aligned along the bottom of the watch" holds at any viewport width,
 * since the watch/logo/contact all sit in one flex row anchored to that
 * edge rather than being vertically centered independently.
 *
 * The project grid's center divider (Projects.tsx) stops at the top edge
 * of this bar, per the sketch — no divider line runs through the footer
 * itself, so it isn't reproduced here.
 */
export default function Footer() {
  return (
    <footer className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)] w-full relative">
      <div
        className="mx-auto max-w-[1920px] relative flex items-end justify-between gap-8 px-[clamp(1.5rem,4vw,4rem)]"
        style={{
          minHeight: "clamp(220px, 26vw, 460px)",
          paddingTop: "30px",
          paddingBottom: "30px",
        }}
      >
        {/* LEFT — Cousineau logo, ~560px wide, bottom-aligned with the watch */}
        <Link href="/" className="w-[clamp(220px,29.17vw,560px)] shrink-0">
          <Image
            src="/assets/home/cousineau-logo-white.svg"
            alt="Cousineau"
            width={711}
            height={119}
            loading="eager"
            className="w-full h-auto"
          />
        </Link>

        {/* CENTER — Mickey watch, sized to the bar's height minus the 30px
            top/bottom margins (aspect-square keeps it a true circle). */}
        <div
          className="aspect-square shrink-0 mx-auto"
          style={{ height: "clamp(160px, calc(26vw - 60px), 400px)" }}
        >
          <MickeyWatch />
        </div>

        {/* RIGHT — contact info (Akzidenz, inherited body font), bottom-
            aligned with the watch. Email/phone stacked, then a thin rule
            (same rule weight as the description text's), then the social
            links row — matching Noah's sketch. */}
        <div
          className="flex flex-col items-end gap-3 shrink-0"
          style={{ fontSize: "var(--text-caption)" }}
        >
          <div className="flex flex-col items-end gap-1">
            <a href="mailto:noah@noahcousineau.com" className="hover:opacity-60 transition-opacity">
              noah@noahcousineau.com
            </a>
            <a href="tel:+18625208040" className="hover:opacity-60 transition-opacity">
              (862) 520-8040
            </a>
          </div>
          <div className="w-full h-[2px] bg-[color:var(--color-paper)]" />
          <div className="flex gap-5 uppercase tracking-widest">
            <a href="https://www.instagram.com/cousineau_art_and_design/?hl=en" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">Instagram</a>
            <a href="https://www.linkedin.com/in/noah-cousineau/" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">LinkedIn</a>
            <a href="https://www.behance.net/noahcousineau" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">Behance</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
