import Image from "next/image";
import { PROJECT_OBJECTS } from "@/lib/projectObjects";
import { IMAGE_QUALITY } from "./ProjectGroup";

/**
 * The part of the project page's header bar that does not change: the
 * page's own symbol and its title.
 *
 * 2026-10-19, Noah: "when we scroll on project pages now, there's a repeat
 * of the page title and the icon, as well as there being a new section
 * name. Let's not have this. Instead, keep the header the same. The only
 * change is that when we scroll into a new section, the section name will
 * change."
 *
 * It used to live inside every section's sticky bar, so an arriving section
 * carried a second symbol and a second title up the screen behind the
 * pinned one. Rendered once here instead, in a sticky strip of zero height
 * that spans the whole run of sections and paints above all of them. The
 * section bars still supply the band's background, its rule and the section
 * name — the only thing that should change on the way down the page.
 *
 * It is placed AFTER the gap above the first section, so it starts sticking
 * exactly where the sections do rather than floating over the statement
 * block on the way in.
 */
export function ProjectBarHead({ slug, title }: { slug: string; title: string }) {
  /* The hand-shot object that stands for this project everywhere else on
     the site — the clay heart for Corita, the green apple for Sprouts.
     `heroFrame` is the frame where the object is finished rather than
     mid-draw, which is where the home grid and the project header both come
     to rest. */
  const object = PROJECT_OBJECTS[slug];
  const symbol = object ? object.frames[Math.max(0, (object.heroFrame ?? 1) - 1)] : null;
  return (
    <div className="proj-bar-head" aria-hidden>
      {symbol && (
        <Image
          className="proj-bar-symbol"
          src={symbol}
          alt=""
          width={object!.width}
          height={object!.height}
          quality={IMAGE_QUALITY}
        />
      )}
      {/* Chrome, not content: the page's heading already names the project
          to a screen reader, so this strip is hidden from one entirely. */}
      <p className="proj-bar-title leading-none" style={{ fontFamily: "var(--font-sans)" }}>
        {title}
      </p>
    </div>
  );
}
