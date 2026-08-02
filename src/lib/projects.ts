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

/**
 * Hover-reel video for the homepage project grid.
 * File lives in /public/videos (self-hosted, gitignored — copy from
 * ~/Desktop/portfolio/"newly uploaded assets"/videos).
 * `null` = no video yet; those projects fall back to an image + CSS motion.
 */
export const HOVER_VIDEO: Record<string, string | null> = {
  "sprouts-farmers-market": "/videos/Sprouts_013026_Video.mp4",
  "corita-art-center": "/videos/Corita Kent Evergreen Gif_1.mp4",
  "socal-earth": "/videos/SoCal Earth Looping Animation - Long - No Sound.mp4",
  "valley-strong-credit-union": null,
  "walt-disney-company": "/videos/Image_FB_Cousineau_Noah_ArtCenter College of Design.mp4",
  "cultural-olympiad-poster": "/videos/Final Thesis Video.mp4",
  "forced-perspective": "/videos/Final Thesis Video.mp4",
  "california-state-parks": null,
  "the-trade-show": null,
  "kdi": null,
  "10-by-ten-entertainment": null,
  "big-tech-art": null,
  "nobody-cares": null,
};

/** Static fallback image for projects without a hover video. */
export const HOVER_FALLBACK: Record<string, string> = {
  "valley-strong-credit-union": "/assets/valley-strong-credit-union/valley-strong-credit-union_02_vscuhl-logo.webp",
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
