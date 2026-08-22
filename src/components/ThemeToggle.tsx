"use client";

import { useTheme } from "./ThemeProvider";

/**
 * The dark-mode switch.
 *
 * It's a pair of sunglasses because that's the joke Noah asked for — in dark
 * mode both heads put shades on ("I want this to have a humorous twist as
 * well... where I have sunglasses"), so the control shows the thing that's
 * about to happen. Filled lenses when they're on, empty frames when they're
 * off.
 *
 * PLACEMENT is the one part of this that's a guess. The site has no global
 * nav to hang it off, so it sits fixed in the top-right — conventional,
 * out of the way of every page's composition, and clear of the footer's
 * link columns. It's deliberately a single self-contained component with no
 * layout dependencies, so moving it is a one-line change: drop it into the
 * footer's Stage, or give it different inset values, and nothing else has
 * to move.
 *
 * mix-blend-difference means it stays legible against whatever is behind it
 * — white type over the black project grid, black over paper — without
 * needing to know what page it's on. It's the same trick Nav.tsx uses.
 */
export default function ThemeToggle() {
  const { theme, toggle, hydrated } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Lights on" : "Lights off"}
      className="fixed top-5 right-5 z-[60] mix-blend-difference text-white
                 p-2 -m-2 cursor-pointer select-none
                 transition-opacity duration-200 hover:opacity-60
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      style={{
        // Until the stored preference is known the icon would be guessing,
        // and a visible flip on hydration reads as a glitch. Holding it
        // invisible for that one tick costs nothing — the control is
        // decorative until clicked.
        opacity: hydrated ? undefined : 0,
      }}
    >
      <svg
        width="34"
        height="16"
        viewBox="0 0 34 16"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {/* Brow bar + bridge */}
        <path
          d="M1 3.2h32M14.6 5.4c1.6-.9 3.2-.9 4.8 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Two aviator lenses. Filled when dark mode is on. */}
        <path
          d="M2.2 4.2h12.2l-1.5 7.2c-.4 2-2.1 3.4-4.1 3.4H7.2c-2.2 0-4-1.6-4.3-3.7L2.2 4.2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={dark ? "currentColor" : "none"}
        />
        <path
          d="M19.6 4.2h12.2l-.7 6.9c-.3 2.1-2.1 3.7-4.3 3.7h-1.6c-2 0-3.7-1.4-4.1-3.4l-1.5-7.2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={dark ? "currentColor" : "none"}
        />
      </svg>
    </button>
  );
}
