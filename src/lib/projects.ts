import projectsData from "@/content/projects.json";

export type ProjectImage = {
  file: string;
  w: number | null;
  h: number | null;
  alt: string;
  dims: string;
};

export type ProjectSection = {
  heading: string;
  caption: string;
};

export type Project = {
  slug: string;
  title: string;
  disciplines: string[];
  intro: string;
  protected: boolean;
  sections: ProjectSection[];
  videos: string[];
  cover: string | null;
  images: ProjectImage[];
};

export const projects = projectsData as Project[];

/** Path to an asset inside /public for a given project. */
export function assetPath(slug: string, file: string) {
  return `/assets/${slug}/${file}`;
}

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return projects.map((p) => p.slug);
}

/** Previous / next for in-page project navigation, wrapping around. */
export function getAdjacent(slug: string) {
  const i = projects.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: undefined, next: undefined };
  return {
    prev: projects[(i - 1 + projects.length) % projects.length],
    next: projects[(i + 1) % projects.length],
  };
}
