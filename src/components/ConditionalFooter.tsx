"use client";

import Footer from "./Footer";

/**
 * The About page used to be excluded here because it carried its own
 * cut-down footer (logo only) plus a contact-info block. Both were removed
 * on 2026-08-20 per Noah — "delete the contact info and have the normal
 * site footer on the about me page" — so every route now gets the shared
 * footer and there is nothing left to branch on.
 *
 * Kept as a component rather than inlining <Footer /> into layout.tsx so
 * there's still one obvious place to reintroduce a per-route exception.
 */
export default function ConditionalFooter() {
  return <Footer />;
}
