"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import { ProjectIdBox, type Credit } from "./ProjectIdBox";
import { PROJECT_OBJECTS } from "@/lib/projectObjects";
import { HEADER_ICONS, type HeaderIcon } from "@/lib/headerIcons";
import { useDropField, type DropSpec } from "@/lib/useDropField";
import {
  isPageReady,
  pageReadyServerSnapshot,
  subscribePageReady,
} from "@/lib/pageReady";
import {
  HEADER_HEIGHT_CSS,
  HEADER_RULE_PCT,
  HEADER_RULE_UNITS,
  HEADER_INSET_UNITS,
} from "./headerLayout";
import { useIsPhone } from "@/lib/useIsPhone";

/*
 * PROJECT PAGE HEADER (2026-08-22, icons round 2026-08-23).
 *
 * Noah: "I want the background images at the top of the pages gone. These
 * will be empty space. There will then be a line that spans the entire width
 * of the browser... A few seconds after the page loads, several graphics
 * will fall from above... The objects will drop with real physics and will
 * be able to be moved around."
 *
 * THE RULE IS THE FLOOR. The falling objects are confined to an arena that
 * ends exactly at the rule's top edge, rather than to the section with the
 * floor pushed up by some offset. That is why they come to rest ON the line
 * with nothing hanging through it: the physics has no idea the line exists,
 * it just has a box, and the box stops where the ink starts.
 *
 * THE ICONS ARE REAL NOW. "These pngs are meant to replace the placeholder
 * circles that are in the project header areas... By the end of this, there
 * should no longer be any placeholder circles." Each project's own set —
 * pencil / clay / paper drawings, HEADER_ICONS in lib/headerIcons.ts — falls
 * in alongside its hero object (the same click-to-play mark used on the home
 * grid, see PROJECT_OBJECTS), which is always the largest and always the
 * last one released, arriving after the others have mostly settled.
 */

/** How long the page sits still before the first object is let go, measured
 *  from the moment the loading overlay lifts (see `revealed` below) rather
 *  than from mount. 2400 -> 1600 with that change: the original figure was
 *  chosen back when mount and reveal were the same instant, and re-anchoring
 *  it to the reveal would otherwise stack a full 2.4s of empty header on top
 *  of however long the loader took. Still a clear beat of stillness first —
 *  Noah's original brief was "a few seconds after the page loads, several
 *  graphics will fall from above" — just not a dead stare. */
const DROP_DELAY_MS = 1600;
/** Gap between one object being released and the next. */
const DROP_STAGGER_MS = 130;

/* The hero icon's rendered width, relative to what the same object is drawn
 * at in a home-grid tile. 0.637 -> 0.72 (2026-08-23, per Noah: "have these
 * slightly larger than they currently are as well" — this is also the size
 * every other icon on the page is measured against, since it "should always
 * be the largest icon"). */
const ICON_SCALE = 0.72;
/* 2026-08-25, phones: "Double the size of all the icons respectively." One
 * multiplier on the scale every icon is already measured against, so the
 * hero icon stays the largest and the relative sizes are untouched. */
/* 2 -> 4, 2026-08-25: "Please increase all icon sizes by 2x respectively" —
 * a second doubling on top of the first. One multiplier on the scale every
 * icon is measured against, so the hero icon stays the largest and the
 * relative sizes are untouched. */
const PHONE_ICON_SCALE = 4;
/* ...and "Move the title down as to not conflict with the 'C' logo." The
 * mark is fixed near the top-left; the header's own inset is 40 units, which
 * on a 390px screen is 8px and puts the title straight under it. */
const PHONE_TITLE_TOP_UNITS = 300;

/** Where the project's own icon comes down. */
const ICON_X = 0.807;

/** Stable reference for the "no icon set" fallback — `?? []` would hand
 *  every hook keyed off `icons` a brand-new array each render otherwise. */
const NO_ICONS: HeaderIcon[] = [];

/* Per-kind size ceiling, as a fraction of the HERO'S OWN SIZE — not of the
 * arena. 2026-08-23, Noah, after the first pass ran every icon off one flat
 * arena-width tier list regardless of kind or aspect: "the clay icons can
 * get up to 75% the size of the hero icon. The paper icons can get up to
 * 50%... the pencil icons can get up to 30%."
 *
 * Applied to WIDTH AND HEIGHT INDEPENDENTLY (see buildSpecs): the fraction
 * caps how much of the hero's width an icon may span AND how much of its
 * height, which is the only reading under which "smaller than the hero"
 * holds for two shapes of different proportions. Sizing by a single
 * dimension is what the first two attempts did, and both let a
 * differently-proportioned icon out-measure the hero on the other axis —
 * first by rendered width (more-work's 146x581 exclamation mark, nearly
 * 1:4, filled the header's height off an ordinary width allowance), then by
 * larger-dimension footprint (a tall clay piece out-topping Valley Strong's
 * wide hero). */
const KIND_MAX_FRACTION_OF_HERO: Record<HeaderIcon["kind"], number> = {
  clay: 0.75,
  paper: 0.5,
  pencil: 0.3,
};

/* Three tiers per kind, each a fraction of THAT KIND'S OWN ceiling above —
 * "have them alternate in size" needs more than one value to alternate
 * between, and every tier still tops out at the kind's cap (the last tier is
 * exactly 1.0x the ceiling) rather than a fixed arena-width number that
 * could land above or below it depending on the hero's own footprint. */
const SIZE_TIERS_OF_KIND_MAX = [0.55, 0.75, 1.0];

/* Loosely spread starting x's across the arena, leaving the hero's own
 * corner (right of ICON_X) less crowded — these are DROP positions, not
 * final resting places, so they only need to be a reasonable starting
 * spread rather than a precise layout. `jitter` is 0 for the deterministic
 * SSR/first-paint pass (see buildSpecs) and Math.random()-driven once the
 * client re-rolls after mount. */
function spreadX(n: number, jitter: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const base = (i + 0.5) / n; // even slots across 0..1
    const j = (jitter() - 0.5) * (1 / n) * 0.8;
    out.push(Math.min(0.94, Math.max(0.02, base * 0.86 + j)));
  }
  return out;
}

/**
 * Builds the drop specs. `randomize=false` is deterministic (every icon at
 * the MIDDLE size tier, zero spread jitter) and must produce byte-identical
 * output on the server and on the client's first render — this is what
 * SSR's HTML and React's pre-hydration client render both use, so hydration
 * has nothing to diff. `randomize=true` is the real thing, called from a
 * `useEffect` (client-only, after hydration has already reconciled), which
 * is what actually satisfies "every time the site loads, the header icons
 * should be a different size."
 *
 * Getting this wrong doesn't crash anything — the physics still runs — but
 * it does print "A tree hydrated but some attributes of the server rendered
 * HTML didn't match" to the console on every single page load, because
 * calling Math.random() straight inside a useMemo (the first version of
 * this) runs during BOTH the server's render and the client's pre-hydration
 * render, and there is no reason those two calls return the same number.
 */
function buildSpecs(
  icons: HeaderIcon[],
  iconSrc: string | undefined,
  iconWidth: number,
  object: { width: number; height: number } | undefined,
  randomize: boolean
): DropSpec[] {
  const rand = randomize ? Math.random : () => 0.5;
  const xs = spreadX(icons.length, rand);
  const midTierIdx = Math.floor(SIZE_TIERS_OF_KIND_MAX.length / 2);

  /* The hero's own width and height, both in "fraction of the arena's WIDTH"
   * units so everything below compares like with like. `iconWidth` is
   * already a width-fraction; the height is that over the hero's aspect. */
  const heroAspect = object ? object.width / object.height : 1;
  const heroW = iconWidth;
  const heroH = iconWidth / (heroAspect || 1);

  const list: DropSpec[] = icons.map((icon, i) => {
    const aspect = icon.width / icon.height;
    const tier = randomize
      ? SIZE_TIERS_OF_KIND_MAX[Math.floor(rand() * SIZE_TIERS_OF_KIND_MAX.length)]
      : SIZE_TIERS_OF_KIND_MAX[midTierIdx];
    const kindMax = KIND_MAX_FRACTION_OF_HERO[icon.kind];

    /* CAPPED ON BOTH AXES, not on the larger dimension (2026-08-23, Noah:
     * "I still noticed that sometimes clay icons get as large or tall as the
     * hero icons. Please make sure this doesn't occur.")
     *
     * The previous version compared each icon's LARGER dimension against the
     * hero's larger dimension, and that is genuinely not the same as being
     * smaller than the hero. Valley Strong's hero is wide — 0.320 of the
     * arena across, but only 0.227 tall. A clay icon allowed 75% of the
     * hero's larger dimension gets a footprint of 0.240; if that icon is a
     * TALL one, 0.240 is its HEIGHT, which overtops the hero's own 0.227.
     * Exactly the "as tall as the hero" Noah saw, and only on the tall clay
     * pieces, which is why it looked intermittent.
     *
     * Capping width and height separately makes the rule mean what it says:
     * no icon exceeds `kindMax` of the hero in EITHER direction, whatever
     * the two aspect ratios happen to be. */
    const widthCap = Math.min(kindMax * heroW, kindMax * heroH * aspect);
    const width = widthCap * tier;
    return {
      x: xs[i],
      width,
      delay: i * DROP_STAGGER_MS,
      src: icon.src,
      aspect,
      invertOnDark: icon.kind === "pencil",
    };
  });
  if (iconSrc) {
    list.push({
      x: ICON_X,
      width: iconWidth,
      delay: icons.length * DROP_STAGGER_MS,
      src: iconSrc,
      aspect: object ? object.width / object.height : 1,
    });
  }
  return list;
}

export default function ProjectHeader({
  slug,
  title,
  credits,
}: {
  slug: string;
  title: string[];
  credits: Credit[];
}) {
  const phone = useIsPhone();
  const arenaRef = useRef<HTMLDivElement>(null);
  const object = PROJECT_OBJECTS[slug];
  const icons = HEADER_ICONS[slug] ?? NO_ICONS;

  /* The icon is the LAST body in the list so it is the last one released —
   * the project's own mark arriving after the anonymous shapes have settled.
   * Its frame is the largest in its sequence, standing still: "I don't want
   * these hero icons to animate as they do on the homepage." That is about
   * FRAME PLAYBACK only — this header never mounts ProjectFrameAnimation, so
   * there is no click-through sequence to hold back regardless. The icon
   * DOES tumble and lean like every other body here — "The objects will
   * drop with real physics and will be able to be moved around" names no
   * exception. */
  const iconSrc = object ? object.frames[object.heroFrame - 1] : undefined;
  const iconScale = phone ? ICON_SCALE * PHONE_ICON_SCALE : ICON_SCALE;
  const iconWidth = object
    ? iconScale * ((object.heightFraction * object.width) / object.height)
    : 0;

  /* RANDOMISED ONCE PER PAGE LOAD, per Noah: "Everytime the site loads, the
   * header icons should be a different size (excluding the hero icon, which
   * should always be the same size)... there might need to be a random seed
   * generated each time a project is loaded."
   *
   * useSyncExternalStore, not useState+useEffect — this project's own
   * ThemeProvider hit the identical shape of problem (a value that has to
   * differ between server and client) and settled on this same hook for it.
   * React calls `getServerSnapshot` for BOTH the server render and the
   * client's pre-hydration render, so those two agree and hydration has
   * nothing to diff; only once hydration has finished does it call
   * `getSnapshot` and swap to the real, random value — automatically, with
   * no setState of ours in the loop (which is what a plain
   * useEffect-calls-setState version needs, and which this codebase's own
   * lint config specifically flags: react-hooks/set-state-in-effect). The
   * random value is cached in a ref the first time getSnapshot runs, so
   * repeated calls before anything actually changes return the same
   * reference — required by useSyncExternalStore, and also what keeps this
   * from re-rolling on every unrelated re-render. `subscribe` never fires:
   * there is nothing to resubscribe to after the one hydration-time swap. */
  const randomizedRef = useRef<DropSpec[] | null>(null);
  // useMemo, not useCallback wrapping a fresh call: useSyncExternalStore
  // invokes getServerSnapshot on every render to check for a change, and a
  // function that computes a NEW array each time it runs looks like a
  // change on every single call — React warns "should be cached" and can
  // loop. Memoizing the ARRAY itself (not just the function) is what
  // actually caches it.
  const deterministicSpecs = useMemo(
    () => buildSpecs(icons, iconSrc, iconWidth, object, false),
    [icons, iconSrc, iconWidth, object]
  );
  const getServerSnapshot = useCallback(() => deterministicSpecs, [deterministicSpecs]);
  const getSnapshot = useCallback(() => {
    if (!randomizedRef.current) {
      randomizedRef.current = buildSpecs(icons, iconSrc, iconWidth, object, true);
    }
    return randomizedRef.current;
  }, [icons, iconSrc, iconWidth, object]);
  const subscribe = useCallback(() => () => {}, []);
  const liveSpecs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /* Reduced motion keeps the objects — they are part of the composition, not
   * decoration — but drops them from just above where they land, so there is
   * nothing to watch fall. */
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /* WAIT FOR THE CURTAIN (2026-08-23, Noah: "Please also make sure we see the
   * dropping down animation each time"). The field used to arm itself the
   * moment this component mounted, which on a project page is roughly eight
   * seconds before anyone can see it: PageLoader holds an opaque sheet over
   * the viewport until every full-resolution image has decoded. Measured on
   * /work/more-work — overlay lifted at 8443ms, first object visible at 4ms,
   * so the whole fall happened behind it and the reader only ever met the
   * settled pile. See lib/pageReady.ts. */
  const revealed = useSyncExternalStore(
    subscribePageReady,
    isPageReady,
    pageReadyServerSnapshot
  );

  const { register } = useDropField({
    arenaRef,
    specs: liveSpecs,
    armDelay: reduced ? 0 : DROP_DELAY_MS,
    dropFrom: reduced ? 0.02 : 0.45,
    enabled: revealed,
    /* 2026-08-25, phones: "Instead of being able to click and drag the icons,
     * the mobile version will have them react to the orientation of the
     * phone... similar to how the Wii motion control worked." */
    tilt: phone,
    draggable: !phone,
  });

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: HEADER_HEIGHT_CSS }}
    >
      {/* The objects' box. It ends at the rule, which is what makes them rest
          on it. `pointer-events-none` so the empty space above the pile never
          swallows a click; each object turns them back on for itself. */}
      <div
        ref={arenaRef}
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: HEADER_RULE_PCT }}
      >
        {liveSpecs.map((spec, i) => (
          <div
            key={i}
            ref={(el) => register(i, el)}
            className="absolute left-0 top-0 pointer-events-auto cursor-grab active:cursor-grabbing select-none"
            style={{
              width: `${spec.width * 100}%`,
              aspectRatio: `${spec.aspect ?? 1}`,
              // Nothing is visible until the physics has placed it; without
              // this every object paints for one frame at the arena's
              // top-left corner before the first step runs.
              visibility: "hidden",
            }}
            aria-hidden
          >
            {spec.src && (
              <Image
                src={spec.src}
                alt=""
                fill
                sizes="30vw"
                className={`object-contain pointer-events-none${
                  spec.invertOnDark ? " invert-on-dark" : ""
                }`}
                draggable={false}
                priority
              />
            )}
          </div>
        ))}
      </div>

      {/* The rule, full width of the artboard — which is the window's width at
          every size up to the 1920 cap the whole site shares. */}
      <div
        className="absolute inset-x-0 z-10"
        style={{
          top: HEADER_RULE_PCT,
          height: `calc(var(--u) * ${HEADER_RULE_UNITS})`,
          background: "var(--color-ink)",
        }}
      />

      {/* Title and credits, in the place they have always been. */}
      <div
        className="absolute z-20 pointer-events-none"
        style={{
          top: `calc(var(--u) * ${
            phone ? PHONE_TITLE_TOP_UNITS : HEADER_INSET_UNITS
          })`,
          left: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
          right: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
        }}
      >
        <ProjectIdBox title={title} credits={credits} bare />
      </div>
    </section>
  );
}
