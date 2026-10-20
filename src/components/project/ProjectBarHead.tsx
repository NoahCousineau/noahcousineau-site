"use client";

import { useEffect, useState } from "react";
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
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    /* WAIT FOR THE FIRST SECTION'S OWN BAR, not for the section's top edge
       (2026-10-20). Noah: "when we scroll close to the first section, the
       page comes up a little too early. Please look into making it so the
       top project information only comes up when the viewport has the
       whole project in."

       It came up early because the sentinel this used to watch sat at this
       strip's place in the flow, which is where the SECTION starts — and
       every section carries 150 units of its own above its header. So the
       symbol and the title arrived at the top of the window with the
       section's bar still a sixth of a screen below them, climbing, and
       the band they belong to not yet there. Watching the bar itself ties
       them to the moment it actually pins.

       `proj-bar-fade` is on the first section's name, and the bar is its
       sticky ancestor; the same element the fade is for. */
    const first = document
      .querySelector<HTMLElement>(".proj-bar-fade")
      ?.closest<HTMLElement>(".sticky");
    if (!first) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      setArrived(first.getBoundingClientRect().top <= 0.5);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
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
