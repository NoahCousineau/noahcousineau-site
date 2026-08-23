"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import { ProjectIdBox, type Credit } from "./ProjectIdBox";
import { PROJECT_OBJECTS } from "@/lib/projectObjects";
import { HEADER_ICONS, type HeaderIcon } from "@/lib/headerIcons";
import { useDropField, type DropSpec } from "@/lib/useDropField";
import {
  HEADER_HEIGHT_CSS,
  HEADER_RULE_PCT,
  HEADER_RULE_UNITS,
  HEADER_INSET_UNITS,
} from "./headerLayout";

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

/** How long the page sits still before the first object is let go. */
const DROP_DELAY_MS = 2400;
/** Gap between one object being released and the next. */
const DROP_STAGGER_MS = 130;

/* The hero icon's rendered width, relative to what the same object is drawn
 * at in a home-grid tile. 0.637 -> 0.72 (2026-08-23, per Noah: "have these
 * slightly larger than they currently are as well" — this is also the size
 * every other icon on the page is measured against, since it "should always
 * be the largest icon"). */
const ICON_SCALE = 0.72;

/** Where the project's own icon comes down. */
const ICON_X = 0.807;

/** Stable reference for the "no icon set" fallback — `?? []` would hand
 *  every hook keyed off `icons` a brand-new array each render otherwise. */
const NO_ICONS: HeaderIcon[] = [];

/* Per-kind size ceiling, as a fraction of the HERO'S OWN SIZE — not of the
 * arena. 2026-08-23, Noah, after the first pass ran every icon off one flat
 * arena-width tier list regardless of kind or aspect: "the clay icons can
 * get up to 75% the size of the hero icon. The paper icons can get up to
 * 50%... the pencil icons can get up to 30%." "Size" here means the icon's
 * own FOOTPRINT (its larger dimension, width or height, whichever the art
 * actually reaches further in) rather than its rendered width — a flat
 * width-fraction was what let more-work's clay-exclamationpoint (146x581,
 * nearly 1:4) render at nearly the full header's height: every icon got the
 * same WIDTH slice regardless of aspect, so an extremely tall, narrow image
 * turned that same slice into an enormous height. Sizing by footprint caps
 * what you actually SEE regardless of how the source art is proportioned. */
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

  /* The hero's own footprint (larger dimension) as a fraction of the arena's
   * width — everything else is sized as a fraction OF THIS, not of the
   * arena directly. `iconWidth` is already a width-fraction; when the hero
   * is taller than it is wide (heroAspect < 1) its footprint is its HEIGHT,
   * which is `iconWidth / heroAspect` in these same width-fraction units. */
  const heroAspect = object ? object.width / object.height : 1;
  const heroFootprint = iconWidth / Math.min(1, heroAspect || 1);

  const list: DropSpec[] = icons.map((icon, i) => {
    const aspect = icon.width / icon.height;
    const tier = randomize
      ? SIZE_TIERS_OF_KIND_MAX[Math.floor(rand() * SIZE_TIERS_OF_KIND_MAX.length)]
      : SIZE_TIERS_OF_KIND_MAX[midTierIdx];
    const footprint = heroFootprint * KIND_MAX_FRACTION_OF_HERO[icon.kind] * tier;
    // footprint is the icon's larger dimension; convert back to a WIDTH
    // fraction for DropSpec, same inverse as heroFootprint above.
    const width = aspect >= 1 ? footprint : footprint * aspect;
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
  const iconWidth = object
    ? ICON_SCALE * ((object.heightFraction * object.width) / object.height)
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

  const { register } = useDropField({
    arenaRef,
    specs: liveSpecs,
    armDelay: reduced ? 0 : DROP_DELAY_MS,
    dropFrom: reduced ? 0.02 : 0.45,
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
          top: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
          left: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
          right: `calc(var(--u) * ${HEADER_INSET_UNITS})`,
        }}
      >
        <ProjectIdBox title={title} credits={credits} bare />
      </div>
    </section>
  );
}
