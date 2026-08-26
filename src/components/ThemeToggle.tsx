"use client";

import { useTheme } from "./ThemeProvider";

/**
 * The dark-mode switch.
 *
 * A PLAIN TOGGLE, AND UNLABELLED ON PURPOSE (2026-08-24). Noah: "Let's change
 * the sunglasses icon to a horizontal toggle switch. The switch should just be
 * a black circle in an outlined pill shape (colors reversed when in dark
 * mode). I don't want any descriptive text by the switch, this should be an
 * easter egg that users find."
 *
 * It used to be a pair of sunglasses, which was the joke — in dark mode both
 * heads put shades on, so the control showed the thing about to happen. That
 * is the opposite of an easter egg: it announced itself. A switch that says
 * nothing about what it switches is the ask, so the `title` tooltip is gone
 * too — it was the last thing that would have told anyone what this does
 * before they pressed it. `aria-label` stays: it is not visible, and a
 * control with no accessible name is not a secret, it is a bug.
 *
 * "COLORS REVERSED WHEN IN DARK MODE" comes free from `mix-blend-difference`,
 * which is what this already used and why it survives the redesign. The
 * outline and the knob are both `currentColor` over white, and difference
 * blending inverts them against whatever is actually behind — black on the
 * light pages, white in dark mode, and still legible over the project grid's
 * black field, which a theme-branched fill would not be.
 *
 * PLACEMENT mirrors HomeLink's inset so the two corner controls stay a
 * matched pair. Unlike HomeLink it keeps its own vertical position: the
 * 2026-08-24 "shift the 'c' logo up" was about that mark specifically.
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
      className="fixed z-[60] mix-blend-difference text-white
                 p-2 -m-2 cursor-pointer select-none
                 transition-opacity duration-200 hover:opacity-60
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      style={{
        // /20 -> /40, 2026-08-24: "move both the home page and the
        // sunglasses icon closer to the border of the browser window."
        right: "calc(min(100vw, 1920px) / 40)",
        /* `top-5` spelled out so --chrome-drop can be added to it (2026-08-25:
           "move the 'c' and toggle down by a small amount"). The variable is
           0 on a desktop, so this is the same 1.25rem it has always been;
           HomeLink's floor adds the identical term, which is what keeps the
           two marks on the shared centreline they were aligned to earlier
           today. See --chrome-drop in globals.css. */
        top: "calc(1.25rem + var(--chrome-drop))",
        // Until the stored preference is known the knob would be guessing
        // which end to sit at, and a visible slide on hydration reads as a
        // glitch. Holding it invisible for that one tick costs nothing — the
        // control is decorative until clicked.
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
        {/* Inset by half the stroke so the outline sits INSIDE the 34x16 box
            rather than straddling its edge and getting clipped. */}
        <rect
          x="0.8"
          y="0.8"
          width="32.4"
          height="14.4"
          rx="7.2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        {/* Transformed rather than having its `cx` animated: CSS transitions
            on SVG geometry attributes are newer and patchier than transitions
            on `transform`, and this has to be right in every browser that
            gets as far as finding the thing. */}
        <circle
          cx="8.6"
          cy="8"
          r="4.4"
          fill="currentColor"
          style={{
            transform: dark ? "translateX(16.8px)" : "translateX(0px)",
            transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
    </button>
  );
}
