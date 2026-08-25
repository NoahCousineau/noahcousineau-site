/*
 * The shared geometry of a page header — the project pages' and the About
 * page's, which now have the same one.
 *
 * 2026-08-22, Noah, on the project pages: "There will then be a line that
 * spans the entire width of the browser. This will be located about 10% above
 * the bottom height." And on About: "I would like to get rid of the red
 * background and apply the same horizontal line. I don't want extra objects
 * on the about me, these will only have the head."
 *
 * Extracted rather than written twice because the rule's position IS the
 * floor both pages' physics rests on: the head and the falling objects each
 * live in a box that ends at HEADER_RULE_Y_UNITS, which is the whole reason
 * they come to rest exactly on the line. Two copies of that number would
 * drift, and the failure would show up as things hovering or sinking.
 */

/**
 * Header height — VIEWPORT-HEIGHT based, not width based. 2026-08-23, Noah:
 * "please move the bottom line of the header areas up more. It should be
 * about 15% of the page height from the bottom."
 *
 * This used to be a pure artboard-unit height (1056u, ~55% of the WIDTH),
 * which is exactly why it needed moving: `--u` is `100cqw / 1920`, tied to
 * viewport WIDTH, so the rule's position relative to the viewport's HEIGHT
 * swung all over the place depending on the window's aspect ratio. Measured
 * on the live site before this change: 16.9% up from the bottom at
 * 1512x900, but only 12.0% at 1920x1080, and 20.8% at 1280x800 — three
 * different answers to "how far up is the rule" for the same design, none
 * of them reliably "about 15%". A wide/short window — a large desktop
 * display is exactly this shape — landed at the low end, which reads as
 * "the line is too close to the bottom", the complaint that prompted this.
 *
 * Expressing the height itself as a share of `dvh` (see the RULE_SHARE note
 * below for why 90%, and Footer.tsx for why `dvh` over `vh`) fixes the
 * inconsistency at its root: the rule now lands at the same fraction of the
 * viewport's HEIGHT everywhere, because it's finally measured against the
 * thing Noah actually specified.
 */
const HEADER_HEIGHT_VH = 94.4;

/**
 * ...but not below this, and the reason is that the TYPE has a floor and the
 * viewport unit does not.
 *
 * --text-project-title and the two credit sizes are clamp()ed with rem
 * minimums, so on a very short viewport they stop shrinking while a pure
 * dvh height keeps going. 29rem is the same floor this header has always
 * used — see the ORIGINAL note this replaced: measured at narrow/short
 * viewports, the title and credits together want about 300px, and anything
 * shorter ran the credits straight through the rule.
 */
export const HEADER_MIN_HEIGHT = "29rem";

/** The whole expression, so the two pages can't disagree about it. */
/* Both of these are declared in globals.css so a phone can override them
 * with a media query — see the block there. The values above are kept as the
 * record of where the desktop numbers came from; globals.css repeats them. */
export const HEADER_HEIGHT_CSS = "var(--header-height)";

/**
 * Where the rule sits: 90% down the header, unchanged from the original
 * "about 10% above the bottom" — only what the 100% now MEANS changed (the
 * viewport's height, not the header's own width-derived one). Composed with
 * HEADER_HEIGHT_VH above: 90% of 94.4dvh is 85dvh, i.e. 15% up from the
 * bottom of the viewport, which is the number Noah actually asked for.
 *
 * Still a PERCENTAGE, not a unit count or a bare dvh value, because the
 * header's height still isn't a pure dvh expression — the rem floor above
 * takes over on short viewports, and a rule pinned at a fixed dvh would sit
 * below the header's own bottom edge there instead of 10% up from it.
 */
/* 90% -> 92.5% (2026-08-23: "move the horizontal line on the project
 * headers down just slightly"). Composed with HEADER_HEIGHT_VH that puts
 * the rule at ~87.3dvh, i.e. 12.7% up from the bottom rather than 15%. */
export const HEADER_RULE_PCT = "var(--header-rule-pct)";

/** Rule weight — the same 6u the home page's grid rules are drawn at. */
export const HEADER_RULE_UNITS = 6;

/** Inset of the title/credits block from the top and sides. Unchanged from
 *  the hero-image header, so the type sits exactly where it did. */
export const HEADER_INSET_UNITS = 40;
