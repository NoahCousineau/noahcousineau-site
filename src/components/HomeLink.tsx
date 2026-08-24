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
 * SAME SIZE AS THE SUNGLASSES: 16px tall, matching the sunglasses' native
 * viewBox height, so the two read as a pair sharing a corner.
 *
 * THE MARK (2026-08-23, per Noah, replacing the placeholder house with his
 * own "C" roundel — see Personal Branding/Favicon.svg, identical to
 * public/favicon.svg): "Make sure it stays in its original colors for both
 * light and dark modes." Unlike the sunglasses/old house, which use
 * `mix-blend-difference` + `currentColor` specifically so a single stroke
 * colour auto-inverts against whatever is behind it, this mark's fill is
 * hardcoded to its own #231f20 and NEVER changes — no blend mode, no theme
 * branching. That is a deliberate instruction, not an oversight: it is
 * legible on every page's light-mode paper background and reads faint on a
 * dark-mode background, the same as it would in any other fixed-colour
 * brand mark. */
export default function HomeLink() {
  const pathname = usePathname() ?? "";
  const show = pathname === "/about" || pathname.startsWith("/work/");
  if (!show) return null;

  return (
    <Link
      href="/"
      aria-label="Back to home"
      title="Home"
      className="fixed top-5 left-5 z-[60]
                 p-2 -m-2 cursor-pointer select-none
                 transition-opacity duration-200 hover:opacity-60
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 191.54 191.54"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="#231f20"
          d="M95.77,191.54C42.96,191.54,0,148.58,0,95.77S42.96,0,95.77,0s95.77,42.96,95.77,95.77-42.96,95.77-95.77,95.77ZM95.77,8.92C47.88,8.92,8.92,47.88,8.92,95.77s38.96,86.85,86.85,86.85,86.85-38.96,86.85-86.85S143.66,8.92,95.77,8.92Z"
        />
        <path
          fill="#231f20"
          d="M151.56,115.1c-1.59.07-3.22.2-4.78-.04-4.2-.65-8.43-.03-12.63-.51-.92-.11-1.38.28-1.9,1.17-2.01,3.43-3.04,7.25-4.56,10.87-.55,1.31-1.26,2.47-2.04,3.64-1.77,2.68-4.33,4.35-6.92,6.06-6.5,4.29-13.59,6.55-21.41,6.46-7.18-.08-14.13-1.5-20.96-3.52-2.73-.81-5.07-2.27-6.73-4.78-2.12-3.2-4.53-6.2-6.68-9.38-1.63-2.42-2.86-5.03-3.07-8.04-.13-1.76-.57-3.5-.84-5.26-1-6.37-2.15-12.71-1.3-19.23.6-4.6,1.9-8.98,4.06-13.04.75-1.42,1.55-2.81,1.9-4.33.56-2.43,1.57-4.4,3.44-6.18,3.8-3.62,7.31-7.54,10.96-11.32,2.18-2.26,4.53-4.14,7.93-4.19,1.58-.02,3.15-.39,4.72-.66,6.92-1.2,13.81-.9,20.69.36,1.37.25,2.82.15,4.1.87,3.01,1.69,6.16,3.2,7.81,6.53.2.41.53.78.86,1.11,3.04,3.06,5.02,6.7,6.04,10.89.55,2.27.63,2.26,2.93,2.26,4.13,0,8.27-.02,12.4.01,2.03.02,4.08.73,6.25-.35,0-.3.06-.51,0-.67-2.53-6.03-5.07-12.06-7.6-18.1-.29-.7-.64-1.32-1.15-1.9-4.8-5.51-9.51-11.09-14.36-16.55-2.88-3.24-6.69-5.12-10.87-5.94-5.67-1.11-11.4-2.06-17.14-2.72-3.04-.35-6.07-1.3-9.2-.71-2.76.52-5.53,1.11-8.34,1.16-5.37.1-9.77,2.3-14.07,5.38-4.29,3.08-8.51,6.1-11.58,10.48-.86,1.23-1.79,2.4-2.73,3.58-4.03,5.07-7.79,10.31-10.53,16.21-.27.58-.56,1.15-.69,1.82-1.06,5.51-1.97,11.05-3.32,16.49-2.45,9.83-2,19.68-.72,29.56.39,2.98,1.56,5.78,2.3,8.68.93,3.63,1.43,7.47,3,10.81,2.89,6.15,5.67,12.44,10.74,17.32,1.49,1.43,2.94,2.84,4.75,3.84,2.05,1.13,4.12,2.22,6.12,3.43,3.96,2.39,8.08,4.27,12.76,4.8,5.2.59,10.17,2.46,15.52,2.36,3.76-.07,7.45-.48,11.11-1.22,1.83-.37,3.72-.22,5.5-.93,5.91-2.33,11.85-4.6,17.79-6.88,2.27-.87,4.36-1.95,6.12-3.74,2.36-2.41,5.14-4.43,7.36-6.95,4.71-5.37,9.93-10.59,9.39-18.65-.01-.18.12-.36.15-.54.31-2.69.6-5.39.93-8.08.14-1.15-.17-1.77-1.48-1.71Z"
        />
      </svg>
    </Link>
  );
}
