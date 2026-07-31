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
  const [cover, ...rest] = project.images;

  return (
    <main>
      <ProjectHero project={project} />

      {cover && (
        <div className="px-[--gutter] max-w-[--maxw] mx-auto">
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

      <nav className="px-[--gutter] py-[12vh] max-w-[--maxw] mx-auto flex justify-between gap-8 uppercase tracking-widest"
           style={{ fontSize: "var(--text-caption)" }}>
        {prev ? (
          <Link href={`/work/${prev.slug}`} className="hover:opacity-60 transition-opacity">
            ← {prev.title}
          </Link>
        ) : <span />}
        <Link href="/work" className="hover:opacity-60 transition-opacity">
          All work
        </Link>
        {next ? (
          <Link href={`/work/${next.slug}`} className="text-right hover:opacity-60 transition-opacity">
            {next.title} →
          </Link>
        ) : <span />}
      </nav>
    </main>
  );
}
