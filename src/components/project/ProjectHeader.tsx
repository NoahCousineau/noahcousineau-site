"use client";

import { useMemo, useRef } from "react";
import Image from "next/image";
import { ProjectIdBox, type Credit } from "./ProjectIdBox";
import { PROJECT_OBJECTS } from "@/lib/projectObjects";
import { useDropField, type DropSpec } from "@/lib/useDropField";
import {
  HEADER_HEIGHT_CSS,
  HEADER_RULE_PCT,
  HEADER_RULE_UNITS,
  HEADER_INSET_UNITS,
} from "./headerLayout";

/*
 * PROJECT PAGE HEADER (2026-08-22).
 *
 * Noah: "I want the background images at the top of the pages gone. These
 * will be empty space. There will then be a line that spans the entire width
 * of the browser. This will be located about 10% above the bottom height. The
 * header text will stay here it is (with the only exception being to make
 * sure that the team credit information is to the right). A few seconds after
 * the page loads, several graphics will fall from above... The objects will
 * drop with real physics and will be able to be moved around."
 *
 * The header this replaces — a full-bleed hero photograph with the white ID
 * card floating on it — is at commit a2bef06, in work/[slug]/page.tsx. He
 * asked for that to be recoverable: "Let's remember how the header was
 * previously in case we want to revert to it."
 *
 * The card itself is unchanged and still ProjectIdBox, at the same inset, so
 * the type has not moved a pixel; it is only `bare` now, because a white card
 * on a white page is a white card nobody can see.
 *
 * THE RULE IS THE FLOOR. The falling objects are confined to an arena that
 * ends exactly at the rule's top edge, rather than to the section with the
 * floor pushed up by some offset. That is why they come to rest ON the line
 * with nothing hanging through it: the physics has no idea the line exists,
 * it just has a box, and the box stops where the ink starts.
 *
 * THE CIRCLES ARE PLACEHOLDERS. "I've represented these for now as various
 * colored circles, I will send you the real images later." Their positions
 * and relative sizes are read off his mockup; the colours are the site's own
 * tokens rather than a guess at his sampled ones, since the artwork is going
 * to replace them anyway. Swapping one for a real object is a matter of
 * giving its spec a `src` — the physics already collides against a measured
 * silhouette, which is how the project's own icon rides in the same field.
 */

/** How long the page sits still before the first object is let go. */
const DROP_DELAY_MS = 2400;
/** Gap between one object being released and the next. */
const DROP_STAGGER_MS = 130;

/* The hero icon's rendered width, relative to what the same object is drawn
 * at in a home-grid tile. The grid's own sizing already makes every object
 * read as "about the size of the apple" whatever its aspect, so scaling that
 * one number keeps that property here instead of re-deriving it: at 0.637 the
 * apple lands at 23% of the header's width, which is where the green circle
 * standing for it sits in Noah's mockup. */
const ICON_SCALE = 0.637;

type Placeholder = { x: number; width: number; color: string };

/* Read off the mockup: x is the centre as a fraction of the frame's width,
 * width the diameter in the same terms. They are dropped in roughly the order
 * a handful of things would be tipped out, not left to right, so the pile
 * builds unevenly. */
const PLACEHOLDERS: Placeholder[] = [
  { x: 0.274, width: 0.188, color: "var(--color-red)" },
  { x: 0.09, width: 0.109, color: "var(--color-red)" },
  { x: 0.443, width: 0.135, color: "var(--color-blue)" },
  { x: 0.04, width: 0.079, color: "var(--color-blue)" },
  { x: 0.143, width: 0.079, color: "var(--color-yellow)" },
  { x: 0.604, width: 0.1, color: "var(--color-red)" },
  { x: 0.539, width: 0.061, color: "var(--color-yellow)" },
  { x: 0.524, width: 0.061, color: "var(--color-yellow)" },
  { x: 0.945, width: 0.079, color: "var(--color-red)" },
  { x: 0.686, width: 0.051, color: "var(--color-yellow)" },
  { x: 0.626, width: 0.042, color: "var(--color-blue)" },
];

/** Where the project's own icon comes down — the green circle's place. */
const ICON_X = 0.807;

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

  /* The icon is the LAST body in the list so it is the last one released —
   * the project's own mark arriving after the anonymous shapes have settled.
   * Its frame is the largest in its sequence, standing still: "I don't want
   * these hero icons to animate as they do on the homepage." That is about
   * FRAME PLAYBACK only — this header never mounts ProjectFrameAnimation, so
   * there is no click-through sequence to hold back regardless. The icon
   * DOES tumble and lean like every other body here: "The objects will
   * drop with real physics and will be able to be moved around" names no
   * exception, and it originally shipped with one (spin:false) on the
   * reasoning that "static" meant motionless — which, on a page where every
   * other object visibly spins, is also the one object a viewer could
   * actually SEE rotate, since the anonymous circles are rotationally
   * symmetric and show nothing regardless of what the physics does to them.
   * Noah: "I don't see the header objects being able to rotate still." */
  const iconSrc = object ? object.frames[object.heroFrame - 1] : undefined;
  const iconWidth = object
    ? ICON_SCALE * ((object.heightFraction * object.width) / object.height)
    : 0;

  const specs = useMemo<DropSpec[]>(() => {
    const list: DropSpec[] = PLACEHOLDERS.map((p, i) => ({
      x: p.x,
      width: p.width,
      delay: i * DROP_STAGGER_MS,
    }));
    if (iconSrc) {
      list.push({
        x: ICON_X,
        width: iconWidth,
        delay: PLACEHOLDERS.length * DROP_STAGGER_MS,
        src: iconSrc,
        aspect: object ? object.width / object.height : 1,
      });
    }
    return list;
  }, [iconSrc, iconWidth, object]);

  /* Reduced motion keeps the objects — they are part of the composition, not
   * decoration — but drops them from just above where they land, so there is
   * nothing to watch fall. */
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const { register } = useDropField({
    arenaRef,
    specs,
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
        {specs.map((spec, i) => (
          <div
            key={i}
            ref={(el) => register(i, el)}
            className="absolute left-0 top-0 pointer-events-auto cursor-grab active:cursor-grabbing select-none"
            style={{
              width: `${spec.width * 100}%`,
              aspectRatio: `${spec.aspect ?? 1}`,
              ...(spec.src
                ? {}
                : {
                    borderRadius: "50%",
                    background: PLACEHOLDERS[i].color,
                  }),
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
                className="object-contain pointer-events-none"
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
