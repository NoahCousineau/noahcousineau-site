/*
 * Where the hero's pieces sit, at each of the two layouts (2026-08-25).
 *
 * Noah, for phones only: "stack the head spin animation and the 'noah
 * cousineau graphic design'. Have this center aligned."
 *
 * SHARED BECAUSE THE HEAD IS NOT ONE ELEMENT. Hero.tsx renders the rotating
 * canvas and BehindHead.tsx renders the four paper cut-outs around it, as
 * SIBLINGS in the same Stage — the head slots between the yellow star and the
 * blue one by z-index alone, which is what lets them be separate components at
 * all. The cost of that is that "move the head" is not one edit: the stars are
 * positioned in absolute artboard units on the head's own measured ink centre,
 * so anything that moves one and not the others pulls the composition apart.
 * Both files read these numbers rather than keeping their own copy.
 *
 * `shiftX` is added to every x. On desktop it is the 30 units that centred the
 * composition in the window; on a phone it also carries the head from the
 * left-hand column into the middle of the screen.
 */
export type HeroLayout = {
  /** How many units wide the artboard is for this layout — see HERO_PHONE. */
  artboard: number;
  /** Added to the head's Place and to every BehindHead x. */
  shiftX: number;
  headY: number;
  headW: number;
  headH: number;
  lockupX: number;
  lockupY: number;
  lockupW: number;
  stageH: number;
};

/** Right column caps at the artboard margin (x1877), starting at x990. */
const RIGHT_MAX_W = 887;

export const HERO_DESKTOP: HeroLayout = {
  artboard: 1920,
  shiftX: 30,
  headY: 50,
  headW: 650,
  headH: 950,
  lockupX: 990,
  lockupY: 360,
  lockupW: RIGHT_MAX_W * 0.85,
  stageH: 1080,
};

/*
 * PHONE — A NARROWER ARTBOARD, which is the whole trick.
 *
 * The obvious way to stack these is to move the two Places and leave
 * everything else alone. Tried that first and the result is in the commit
 * history's screenshots: correctly stacked, correctly centred, and far too
 * small — the head occupied about a third of a 390px screen with dead space
 * above and below it. The reason is that `--u` is the viewport width over
 * 1920, so a 720-unit star is 720/1920 = 37% of the screen no matter what the
 * screen is. Moving elements around inside a 1920-unit artboard cannot change
 * how big anything is relative to the window.
 *
 * So the phone hero declares a 1000-unit artboard instead. Every existing
 * coordinate keeps working — the head is still 650 units wide, the yellow star
 * still 720 — but each unit is now nearly twice as many pixels, so the star
 * fills 72% of the screen rather than 37%. Nothing had to be rescaled
 * individually and nothing can drift out of proportion with anything else.
 *
 * The positions then follow from that width. The head's mean ink centre is at
 * 474 + shiftX (see BehindHead), so 26 puts it on 500 — the middle. Every
 * cut-out clears the edges at that offset: the yellow star spans 140-860, the
 * red 150-421, the blue 638-902.
 */
export const HERO_PHONE: HeroLayout = {
  artboard: 1000,
  shiftX: 26,
  headY: 60,
  headW: 650,
  headH: 950,
  lockupX: 50,
  lockupY: 1000,
  lockupW: 900,
  stageH: 1500,
};
