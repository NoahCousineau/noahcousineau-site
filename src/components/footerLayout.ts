/**
 * Footer layout constants shared across components that need to line up
 * with the footer's own artboard coordinates, without those components
 * importing Footer.tsx directly.
 *
 * Extracted 2026-08-20 when FallenHand needed the third project column's x
 * to put "next project" in it — importing it straight from Footer.tsx
 * created a cycle (Footer renders FallenHand, FallenHand would import
 * Footer), which crashed the /about prerender with "Cannot access 'n'
 * before initialization" (a classic circular-import TDZ failure, since
 * /about pulls in Footer via the global ConditionalFooter). This file has
 * no component in it, so nothing can cycle back through it.
 */

/** x of the "valley strong credit union" / "more work" column, artboard
 * units. FallenHand aligns "next project" to this same x. */
export const THIRD_COLUMN_X = 516.99;
