"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import { getAdjacent, projectSlugFromPath } from "@/lib/projects";

/**
 * The About page used to be excluded here because it carried its own
 * cut-down footer plus a contact-info block. Both were removed on
 * 2026-08-20 per Noah — "delete the contact info and have the normal site
 * footer on the about me page" — so every route now gets the shared footer.
 *
 * What this still decides is the FALLEN HAND and its "next project" link.
 * On project pages the pointing hand swings off its nail at the end of the
 * statement paragraph and drops out of view (see ProjectStatement), and the
 * footer is where it lands, pointing onward. That only makes sense where
 * the fall actually happened, so it's gated to /work/<slug> rather than
 * shown site-wide — the home page has its own pointing hand and would read
 * as having two.
 *
 * getAdjacent already wraps around, so the last project points back at the
 * first and the link is never a dead end.
 */
export default function ConditionalFooter() {
  const pathname = usePathname() ?? "";
  /* The gate is a single non-scrolling screen with a hand over it; there is
   * nothing below to put a footer under. */
  if (pathname === "/password") return null;
  /* Project pages are at the root now, so this asks the project list
     rather than matching a /work/ prefix — /about and /work are not
     projects and fall through to `undefined`, which is what they always did. */
  const slug = projectSlugFromPath(pathname);
  const next = slug ? getAdjacent(slug).next : undefined;

  return <Footer nextProjectHref={next ? `/${next.slug}` : undefined} />;
}
