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

/** Header height, artboard units. Matches the proportion of Noah's mockup
 *  (a frame 1.82x as wide as it is tall), which puts the rule near the foot
 *  of the window at the widths the site is actually read at. */
export const HEADER_HEIGHT_UNITS = 1056;

/**
 * ...but not below this, and the reason is that the TYPE has a floor and the
 * artboard unit does not.
 *
 * --text-project-title and the two credit sizes are clamp()ed with rem
 * minimums, so below roughly 1030px of viewport they stop shrinking while
 * `--u` keeps going. Measured at 390px: the title and credits together want
 * about 300px, and a header sized purely in units offered 214 — the credits
 * ran straight through the rule and were clipped by the section. (That
 * mismatch is older than this header; the ID card overflowed the hero image
 * the same way, it was just less obvious against a photograph.)
 *
 * 29rem leaves the type its 300px and still gives the objects room to fall
 * into. It only binds below ~843px of viewport width, where 0.55x the width
 * drops under it; at every larger size the unit-based height wins.
 */
export const HEADER_MIN_HEIGHT = "29rem";

/** The whole expression, so the two pages can't disagree about it. */
export const HEADER_HEIGHT_CSS = `max(calc(var(--u) * ${HEADER_HEIGHT_UNITS}), ${HEADER_MIN_HEIGHT})`;

/**
 * Where the rule sits: 90% down, i.e. "about 10% above the bottom".
 *
 * A PERCENTAGE, not a unit count, because the header's height is no longer a
 * pure unit expression — at narrow widths the rem floor above takes over, and
 * a rule pinned at 950u would then sit wherever it happened to land rather
 * than 10% up from the bottom.
 */
export const HEADER_RULE_PCT = "90%";

/** Rule weight — the same 6u the home page's grid rules are drawn at. */
export const HEADER_RULE_UNITS = 6;

/** Inset of the title/credits block from the top and sides. Unchanged from
 *  the hero-image header, so the type sits exactly where it did. */
export const HEADER_INSET_UNITS = 40;
