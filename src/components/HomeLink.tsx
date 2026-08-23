"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A way back to the home page, mirroring the theme toggle.
 *
 * 2026-08-23, Noah: "Let's also have a home icon on the project pages and
 * about me page. Let's make it opposite of the sunglasses icon, so it will
 * be on the left... Just do a generic house for now, I might switch this
 * out later. Keep it the same size as the sunglasses icon."
 *
 * SCOPED, UNLIKE THE TOGGLE. ThemeToggle.tsx is global — dark mode applies
 * everywhere, including the home page. A link back to the home page does
 * not belong ON the home page, so this checks the route itself rather than
 * being unconditionally mounted; same pattern as ConditionalFooter.tsx.
 * "the project pages and about me page" is `/work/*` and `/about` — /work
 * (the index) and /password stay off it, neither being a page you'd already
 * be reading long enough to want a way out mid-scroll.
 *
 * SAME SIZE AS THE SUNGLASSES: matched stroke width (1.6) and viewBox
 * height (16) so the two read as a pair, not two different icon systems
 * that happen to share a corner.
 */
export default function HomeLink() {
  const pathname = usePathname() ?? "";
  const show = pathname === "/about" || pathname.startsWith("/work/");
  if (!show) return null;

  return (
    <Link
      href="/"
      aria-label="Back to home"
      title="Home"
      className="fixed top-5 left-5 z-[60] mix-blend-difference text-white
                 p-2 -m-2 cursor-pointer select-none
                 transition-opacity duration-200 hover:opacity-60
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <svg
        width="34"
        height="16"
        viewBox="0 0 34 16"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {/* Generic house: roofline + walls + a door, centred in the same
            34x16 box the sunglasses use. */}
        <path
          d="M9 15V8.4L17 2l8 6.4V15"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M15.2 15v-4.6h3.6V15"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
