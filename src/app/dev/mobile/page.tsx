import { notFound } from "next/navigation";
import { projects } from "@/lib/projects";
import MobilePreview from "./MobilePreview";

/*
 * A BENCH FOR LOOKING AT THE SITE ON A PHONE (2026-08-23).
 *
 * Noah: "As we get closer to finishing the site, I'm also wondering what this
 * will look like in mobile. Can you create some way for us to view and make
 * edits in a mobile version of the site?"
 *
 * Every route in a phone-sized frame, side by side, live. Real iframes of the
 * real dev server rather than screenshots, so the animations run, the scroll
 * interactions fire and hot reload lands in every frame at once — which is
 * what makes this a place to EDIT from and not just look at. Change a
 * component and all the phones redraw together.
 *
 * WHY NOT JUST USE THE BROWSER'S DEVICE EMULATOR: it shows one page at a
 * time, and the thing worth seeing here is the whole site at once — the point
 * of a portfolio is the run of pages, and a layout rule that fixes the home
 * page usually breaks a project page. Seeing thirteen phones at once is the
 * feature.
 *
 * DEV ONLY. It is inside the app rather than a script so it can import the
 * project list and stay in step as projects are added, but it has no business
 * in a deployed build, so it 404s there.
 */

export default function DevMobilePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const routes = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/work", label: "Work index" },
    { href: "/password?from=%2Fwork", label: "Password gate" },
    ...projects.map((p) => ({ href: `/work/${p.slug}`, label: p.title })),
  ];

  return <MobilePreview routes={routes} />;
}
