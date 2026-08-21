"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

/**
 * The About page used to be excluded here because it carried its own
 * cut-down footer plus a contact-info block. Both were removed on
 * 2026-08-20 per Noah — "delete the contact info and have the normal site
 * footer on the about me page" — so every route now gets the shared footer.
 *
 * What this still decides is the FALLEN HAND. On project pages the hand
 * swings off its nail at the end of the statement paragraph and drops out
 * of view (see ProjectStatement), and the footer is where it lands. That
 * only makes sense where the fall actually happened, so it's gated to
 * /work/* rather than shown site-wide — the home page has its own pointing
 * hand and would read as having two.
 */
export default function ConditionalFooter() {
  const pathname = usePathname();
  const isProjectPage = pathname?.startsWith("/work/") ?? false;
  return <Footer showFallenHand={isProjectPage} />;
}
