import Link from "next/link";
import { notFound } from "next/navigation";
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

/* Gap between the end of the statement paragraph and the first content
 * section. 300 -> 420 -> 780 (2026-08-20, per Noah: "add a lot more space
 * between the end of the paragraph and the start of the projects"). It also
 * gives the pointing hand room to finish its swing and fall clear of the
 * page before the first grid arrives. */
const FIRST_GROUP_TOP_GAP_UNITS = 780;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

// Next.js 16: params is a Promise.
export async function generateMetadata(
  props: PageProps<"/work/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) return { title: "Not found" };
  return {
    title: `${project.title} — Noah Cousineau`,
    description: project.intro.slice(0, 160),
  };
}

export default async function ProjectPage(props: PageProps<"/work/[slug]">) {
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
        <Link href={`/work/${prev.slug}`} className="hover:opacity-60 transition-opacity">
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
        <Link href={`/work/${next.slug}`} className="text-right hover:opacity-60 transition-opacity">
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
        className="artboard mx-auto w-full max-w-[1920px]"
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
            anything that should be visible: it is behind all of them. */}
        <div style={{ background: groups[0]?.bgColor || "var(--color-paper)" }}>
        {groups.map((group, i) => (
          <ProjectGroup
            key={group.descriptor}
            slug={project.slug}
            descriptor={group.descriptor}
            rows={group.rows}
            topGapUnits={i === 0 ? FIRST_GROUP_TOP_GAP_UNITS : undefined}
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
