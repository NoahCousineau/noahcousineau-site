import Link from "next/link";

/*
 * THE 404 (added 2026-08-30, launch hardening).
 *
 * Without this file Next serves its own built-in 404: unstyled white, black
 * system type, no way back. That page matters more than usual here — the
 * site is moving off Webflow, so every old Webflow URL anyone has bookmarked
 * or linked lands on it the moment the DNS flips.
 *
 * Deliberately NOT on the artboard unit. Everything else scales with
 * viewport WIDTH, which on a phone puts the small type around 4px (see
 * CLAUDE.md). A dead end is the one screen that has to stay readable at
 * every size, so this one page uses plain clamp() with a real floor.
 *
 * The layout supplies the theme toggle, the home mark and the footer, so
 * there are three ways out of here even before the links below.
 */

export const metadata = { title: "Page not found — Noah Cousineau" };

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "72vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "clamp(1.25rem, 3vw, 2.5rem)",
        padding: "clamp(6rem, 14vw, 12rem) clamp(1.5rem, 6vw, 7rem) clamp(4rem, 8vw, 8rem)",
        color: "var(--color-ink)",
        background: "var(--color-paper)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: "clamp(1.1rem, 2.2vw, 1.6rem)",
          lineHeight: 1.2,
          opacity: 0.6,
          margin: 0,
        }}
      >
        404
      </p>

      <h1
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(2.25rem, 8vw, 6.5rem)",
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          textWrap: "balance",
          maxWidth: "16ch",
          margin: 0,
        }}
      >
        This page isn&rsquo;t here.
      </h1>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(1rem, 1.6vw, 1.25rem)",
          lineHeight: 1.5,
          maxWidth: "42ch",
          opacity: 0.7,
          margin: 0,
        }}
      >
        It may have moved when the site was rebuilt. The work is all still
        around &mdash; start from one of these.
      </p>

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "clamp(1rem, 3vw, 2.5rem)",
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(1rem, 1.6vw, 1.25rem)",
          marginTop: "clamp(0.5rem, 2vw, 1.5rem)",
        }}
      >
        <Link href="/" style={{ color: "var(--color-accent)", textUnderlineOffset: "0.25em" }}>
          Home
        </Link>
        <Link href="/work" style={{ color: "var(--color-accent)", textUnderlineOffset: "0.25em" }}>
          Work
        </Link>
        <Link href="/about" style={{ color: "var(--color-accent)", textUnderlineOffset: "0.25em" }}>
          About
        </Link>
      </nav>
    </main>
  );
}
