import Link from "next/link";
import { notFound } from "next/navigation";

import { introPlainText } from "@/lib/introText";
import type { Metadata } from "next";
import {
  getProject,
  getAllSlugs,
  getAdjacent,
} from "@/lib/projects";
import {
  ProjectHero,
  ProjectSection,
  MediaGrid,
  MediaFull,
  VideoEmbed,
} from "@/components/project/ProjectScaffold";
import ProjectHeader from "@/components/project/ProjectHeader";
import { ProjectStatement } from "@/components/project/ProjectStatement";
import { ProjectGroup } from "@/components/project/ProjectGroup";
import { ProjectBarHead } from "@/components/project/ProjectBarHead";
import { Stage } from "@/components/Stage";

/* Gap between the end of the statement paragraph and the first content
 * section. 300 -> 420 -> 780 (2026-08-20, per Noah: "add a lot more space
 * between the end of the paragraph and the start of the projects"). It also
 * gives the pointing hand room to finish its swing and fall clear of the
 * page before the first grid arrives. */
const FIRST_GROUP_TOP_GAP_UNITS = 780;

/* TAB NAMES, given by Noah on 2026-08-30. Kept as their own map rather than
 * derived from `project.title`, because that field is the DISPLAY title —
 * set in caps for the page's own lockup ("SPROUTS FARMERS MARKET") — while
 * these are title case for a browser tab. Two different jobs, two different
 * strings.
 *
 * 2026-11-10: the Cultural Olympiad entry used to drop "Poster" here, which
 * was Noah's 2026-08-30 preference. He has since asked for "cultural
 * olympiad poster" at every touchpoint, so it carries the full name now —
 * don't trim it back. */
const TAB_TITLES: Record<string, string> = {
  "sprouts-farmers-market": "Sprouts Farmers Market",
  "corita-art-center": "Corita Art Center",
  "socal-earth": "SoCal Earth",
  "cultural-olympiad-poster": "Cultural Olympiad Poster",
  "valley-strong-credit-union": "Valley Strong Credit Union",
  "more-work": "More Work",
};

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

// Next.js 16: params is a Promise.
export async function generateMetadata(
  props: PageProps<"/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) return { title: "Not found" };
  const title = TAB_TITLES[slug] ?? project.title;
  /* A WRITTEN DESCRIPTION, NOT THE FIRST 160 CHARACTERS (2026-11-09). The
     slice cut mid-word — Sprouts shared itself as "...and not be just ano"
     — so each project carries its own `metaDescription`. The fallback still
     trims the intro for any project that has not been given one, but at a
     word boundary. */
  const description = project.metaDescription ?? trimToWord(introPlainText(project.intro), 160);
  /* ITS OWN PREVIEW IMAGE (2026-11-09). Every page shared the same site-wide
     card; a project's cover is the picture of that project the site already
     uses on the work index, so a shared link looks like the thing it points
     at. `metadataBase` makes the relative path absolute. */
  const card = project.ogImage ?? project.cover;
  // SVG is not a share image anywhere that matters; such a project falls
  // back to the site-wide card rather than to a picture nothing will draw.
  /* Named even when it is the site-wide one: declaring `openGraph` at all
     stops the root's file-based opengraph-image from being inherited, and
     More Work — which has no cover — ended up sharing with no picture at
     all. */
  const cover = card && !card.endsWith(".svg")
    ? `/assets/${slug}/${card}`
    : "/opengraph-image.png";
  return {
    title,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title: `${title} — Noah Cousineau`,
      description,
      url: `/${slug}`,
      images: [{ url: cover }],
    },
  };
}

/** Cut to at most `max` characters without splitting a word. */
function trimToWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—-]+$/, "")}…`;
}

export default async function ProjectPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) notFound();

  const { prev, next } = getAdjacent(slug);

  const NavRow = (
    <nav
      className="px-(--gutter) py-[12vh] max-w-(--maxw) mx-auto flex justify-between gap-8 uppercase tracking-widest"
      style={{ fontSize: "var(--text-caption)" }}
    >
      {prev ? (
        <Link href={`/${prev.slug}`} className="hover:opacity-60 transition-opacity">
          ← {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {/* Hidden on phones: the work index is gone there (2026-08-25, "Remove
          the 'work index' page from mobile"). `max-md` is the same 767px
          line useIsPhone draws — see that file. */}
      <Link href="/work" className="max-md:hidden hover:opacity-60 transition-opacity">
        All work
      </Link>
      {next ? (
        <Link href={`/${next.slug}`} className="text-right hover:opacity-60 transition-opacity">
          {next.title} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );

  // TEMPLATE PROJECT PAGE — used whenever a project has pageData (Sprouts
  // is the reference build; see illustrator-artboard-build skill / the
  // "Project Page - Sprouts" artboard). Same skeleton is meant to be
  // reused for every future project: ID box -> hero -> statement -> N
  // repeating content groups -> nav -> shared global footer (rendered
  // once in layout.tsx, identical on every page, untouched here).
  if (project.pageData) {
    const { credits, statement, paragraph, groups } = project.pageData;
    const titleLines = project.title.toLowerCase().split(" ");
    // Sprouts: ["sprouts", "farmers", "market"] -> ["sprouts", "farmers market"]
    const title =
      titleLines.length > 1 ? [titleLines[0], titleLines.slice(1).join(" ")] : titleLines;

    return (
      <main
        className="artboard mx-auto w-full"
        style={{ containerType: "inline-size", ["--u" as string]: "calc(100cqw / 1920)" }}
      >
        {/* HEADER (2026-08-22). The hero photograph that used to fill this
            space is gone — Noah: "I want the background images at the top of
            the pages gone. These will be empty space." What replaces it is
            empty page, a full-width rule near the foot of it, and a handful
            of objects that fall in and settle on that rule a few seconds
            after the page loads. The previous hero-image header is at commit
            a2bef06, per "Let's remember how the header was previously in case
            we want to revert to it."

            `heroImage` is still in projects.json and still on disk — nothing
            was deleted — so reverting is a matter of putting this block back
            rather than re-entering data. */}
        <ProjectHeader slug={project.slug} title={title} credits={credits} />

        <ProjectStatement
          lead={statement.lead}
          emphasis={statement.emphasis}
          tail={statement.tail}
          paragraph={paragraph}
        />

        {/* `stackIndex` drives the stacking-scroll z-order: each group must
            paint over the one before it so a section scrolls up and covers
            its predecessor. See the STACKING SCROLL note in ProjectGroup.

            THE GROUPS SIT ON THEIR OWN SURFACE (2026-08-29). Noah: "there's
            also a bit of an unintended reveal when scrolling on the mobile."

            The sections are sticky and recede behind one another, and at the
            seam between two of them they do not abut to the pixel — so for a
            few rows of scrolling the section TWO below shows through. Traced
            with elementsFromPoint just above the "Accolades" header: the
            topmost element was the Poster section's photograph, two sections
            earlier, painting through the gap.

            `bgColor` is per GROUP, so in principle two sections on a page
            could differ — in practice every group in projects.json leaves it
            unset, and the first group's value is therefore the page's. Laying
            that same colour under the whole stack means a seam reveals the
            page's own background instead of a stale image. It cannot mask
            anything that should be visible: it is behind all of them.

            AND IT CLIPS THE SKIRTS (2026-08-30). Noah: "the footer isn't
            showing on some pages." This is that bug, and it was mine.

            Each section hangs a viewport-tall skirt of its own surface below
            itself to cover the seam with the next one (see StackedSection).
            Those skirts are absolutely positioned and nothing was clipping
            them, so they kept painting past the end of the stack — and what
            lies past the end of the stack is the footer, which is a fixed
            panel the page slides up to uncover rather than a block at the
            bottom of the document. Measured on /work/socal-earth at full
            scroll: five white divs, each 900px tall, spanning y=-147..753 of
            a 900px viewport, with the curtain itself already cleared at
            -135. All of them, on every project page, at every width — the
            sections are all pinned in the same place once you reach the end,
            so their skirts land on top of one another over the footer.

            `clip` and not `hidden`: hidden would make this a scroll
            container, and the sections inside it are `position: sticky` —
            they would start sticking to a box that never scrolls instead of
            to the page, which breaks the stacking scroll outright. `clip`
            clips without creating a scrollport, so sticky still resolves
            against the document and only the overhang is cut. */}
        <div
          style={{
            background: groups[0]?.bgColor || "var(--color-paper)",
            overflow: "clip",
          }}
        >
        {/* The gap above the first section is rendered HERE rather than
            inside that section, so the header strip below it starts
            sticking exactly where the sections begin — put before the gap,
            it would ride down over the statement block on the way in. */}
        <Stage heightUnits={FIRST_GROUP_TOP_GAP_UNITS} />
        <ProjectBarHead slug={project.slug} title={project.titleCase ?? project.title} />
        {groups.map((group, i) => (
          <ProjectGroup
            key={group.descriptor}
            slug={project.slug}
            descriptor={group.descriptor}
            imageAlt={group.imageAlt}
            rows={group.rows}
            bgColor={group.bgColor}
            stackIndex={i}
          />
        ))}
        </div>
      </main>
    );
  }

  // LEGACY PLACEHOLDER LAYOUT — projects without pageData yet fall back to
  // the original generic scaffold until their own artboards land.
  const [cover, ...rest] = project.images;

  return (
    <main>
      <ProjectHero project={project} />

      {cover && (
        <div className="px-(--gutter) max-w-(--maxw) mx-auto">
          <MediaFull slug={project.slug} image={cover} />
        </div>
      )}

      {project.videos.map((url) => (
        <ProjectSection key={url}>
          <VideoEmbed url={url} />
        </ProjectSection>
      ))}

      {/*
        PLACEHOLDER LAYOUT — one grid of everything.
        Once Noah's designs land, each project's sections get their own
        rhythm here (full-bleed, 2-up, 3-up, pinned, WebGL moments).
      */}
      {rest.length > 0 && (
        <ProjectSection heading={project.sections[0]?.heading}>
          <MediaGrid slug={project.slug} images={rest} cols={2} />
        </ProjectSection>
      )}

      {NavRow}
    </main>
  );
}
