"use client";

import Link from "next/link";
import Image from "next/image";
import MickeyWatch from "./MickeyWatch";

/**
 * Global footer (on every page). Comp: black bar, per Noah's sketch
 * (Homepage - Rough_Homepage - Static View.png), tuned per feedback rounds:
 *   - Watch is TRUE-CENTERED on the bar's full width (absolutely positioned
 *     at 50%, independent of the logo/contact block widths — a plain flex
 *     row with justify-between does NOT center it correctly once the logo
 *     and contact blocks are different widths, since the flex gap eats
 *     into one side more than the other).
 *   - Cousineau logo sits to the LEFT, smaller than before, hugging the
 *     left edge.
 *   - Contact info on the right: lowercase Akzidenz (site's sans, the
 *     default body font — no italic/serif here), 1.5x the base caption
 *     size, email + phone side by side on one line, then a thin rule,
 *     then the social links row.
 *   - Logo and contact are both bottom-aligned with the watch's bottom
 *     edge (via a shared padding-bottom + items-end on the row, with the
 *     watch absolutely positioned to that same bottom edge).
 */
export default function Footer() {
  return (
    <footer className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)] w-full relative">
      <div
        className="mx-auto max-w-[1920px] relative flex items-end justify-between px-[clamp(1.5rem,4vw,4rem)]"
        style={{
          minHeight: "clamp(220px, 28vw, 460px)",
          paddingTop: "30px",
          paddingBottom: "30px",
        }}
      >
        {/* LEFT — Cousineau logo: smaller, hugging the left edge */}
        <Link href="/" className="w-[clamp(140px,16vw,300px)] shrink-0">
          <Image
            src="/assets/home/cousineau-logo-white.svg"
            alt="Cousineau"
            width={711}
            height={119}
            loading="eager"
            className="w-full h-auto"
          />
        </Link>

        {/* CENTER — Mickey watch, TRUE-centered on the bar (absolute, 50%
            + translateX), sized to exactly fill the bar's minHeight minus
            the 30px top/bottom margins — i.e. the SAME formula as the
            footer row's own minHeight above, minus the 60px of vertical
            padding, so the watch can never overflow the bar (a prior bug:
            these two clamp() expressions had drifted out of sync and the
            watch overflowed above the bar). */}
        <div
          className="aspect-square absolute left-1/2 -translate-x-1/2 bottom-[30px]"
          style={{ height: "clamp(160px, calc(28vw - 60px), 400px)" }}
        >
          <MickeyWatch />
        </div>

        {/* RIGHT — contact info: lowercase, Akzidenz (font-sans, the site
            default — matches body text), 1.5x the base caption size. Email
            + phone sit side by side on one row (not stacked), then a thin
            rule, then the social links row. */}
        <div
          className="flex flex-col items-end gap-3 shrink-0 lowercase"
          style={{ fontFamily: "var(--font-sans)", fontSize: "calc(var(--text-caption) * 1.5)" }}
        >
          <div className="flex items-baseline gap-4 whitespace-nowrap">
            <a href="mailto:noah@noahcousineau.com" className="hover:opacity-60 transition-opacity">
              noah@noahcousineau.com
            </a>
            <a href="tel:+18625208040" className="hover:opacity-60 transition-opacity">
              (862) 520-8040
            </a>
          </div>
          <div className="w-full h-[2px] bg-[color:var(--color-paper)]" />
          <div className="flex gap-5 tracking-widest">
            <a href="https://www.instagram.com/cousineau_art_and_design/?hl=en" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">instagram</a>
            <a href="https://www.linkedin.com/in/noah-cousineau/" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">linkedin</a>
            <a href="https://www.behance.net/noahcousineau" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">behance</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
