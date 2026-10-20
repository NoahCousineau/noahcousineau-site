"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PROJECT_OBJECTS } from "@/lib/projectObjects";
import { DESCRIPTOR_SIZE_CSS, IMAGE_QUALITY } from "./ProjectGroup";

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
 * AND IT FADES IN WHEN THE SECTIONS ARRIVE (same day). Noah: "I don't like
 * how the page title, icon, and section title are visible at this point. I
 * want these to only appear when we reach the section... Have these bits of
 * text and the icon fade in as we reach the very top of the project
 * content. This is only relevant to the very first/top project."
 *
 * Sticky means this strip is laid out in the flow until the page scrolls
 * far enough to pin it, so on the way down it rode up the page as ordinary
 * content, over the statement block, with no bar behind it. The sentinel
 * below sits at the same place in the flow: once it has gone past the top
 * of the window, the strip is pinned and worth seeing. The first section's
 * own name is faded by the same signal — see `proj-bar-fade` — which is why
 * it is published on the document rather than kept in this component.
 */
export function ProjectBarHead({ slug, title }: { slug: string; title: string }) {
  /* The hand-shot object that stands for this project everywhere else on
     the site — the clay heart for Corita, the green apple for Sprouts.
     `heroFrame` is the frame where the object is finished rather than
     mid-draw, which is where the home grid and the project header both come
     to rest. */
  const object = PROJECT_OBJECTS[slug];
  const symbol = object ? object.frames[Math.max(0, (object.heroFrame ?? 1) - 1)] : null;
  const sentinel = useRef<HTMLDivElement>(null);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const mark = sentinel.current;
    if (!mark) return;
    const io = new IntersectionObserver(
      ([e]) => {
        /* Not-intersecting means one of two very different things: the
           sections are still below the fold, or they have gone past the
           top. Only the second is an arrival, hence the check on which
           side of the window it left by. */
        setArrived(!e.isIntersecting && e.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    io.observe(mark);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (arrived) root.dataset.projBar = "ready";
    else delete root.dataset.projBar;
    return () => {
      delete root.dataset.projBar;
    };
  }, [arrived]);

  return (
    <>
      <div ref={sentinel} aria-hidden style={{ height: 0 }} />
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
        {/* THE SECTION TITLE'S SIZE AND FACE, BOLD (2026-10-19). Noah: "make
            sure on desktop that the page title is the same type size and
            same font as the section title. The only difference should be
            that it's bold." It had no size of its own and was inheriting
            the body's.

            Chrome, not content: the page's heading already names the
            project to a screen reader, so this strip is hidden from one. */}
        <p
          className="proj-bar-title leading-none"
          style={{ fontSize: DESCRIPTOR_SIZE_CSS, fontFamily: "var(--font-sans)" }}
        >
          {title}
        </p>
      </div>
    </>
  );
}
