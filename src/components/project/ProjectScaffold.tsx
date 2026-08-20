import Image from "next/image";
import { assetPath, type Project } from "@/lib/projects";

/*
  PROJECT SCAFFOLD
  ----------------
  Every project page is composed from these blocks, in this order:

    <ProjectHero>      title, disciplines, intro paragraph
    <ProjectSection>   heading + caption + a media block
      └ <MediaGrid>    1 / 2 / 3-up responsive image grid
      └ <MediaFull>    full-bleed single image
      └ <VideoEmbed>   video moment
    <ProjectNav>       prev / next

  Same skeleton for all 13 projects; content and per-project custom
  moments differ. Swap layout per section without touching the others.
*/

export function ProjectHero({ project }: { project: Project }) {
  return (
    <header className="px-(--gutter) pt-[18vh] pb-[10vh] max-w-(--maxw) mx-auto">
      <h1
        className="uppercase leading-[0.85] tracking-tight"
        style={{ fontSize: "var(--text-display)" }}
      >
        {project.title}
      </h1>

      {project.disciplines.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-6 uppercase tracking-widest text-[color:var(--color-muted)]"
            style={{ fontSize: "var(--text-caption)" }}>
          {project.disciplines.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}

      {project.intro && (
        <p className="mt-10 max-w-[46ch] leading-relaxed">{project.intro}</p>
      )}
    </header>
  );
}

export function ProjectSection({
  heading,
  caption,
  children,
}: {
  heading?: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-(--gutter) py-[8vh] max-w-(--maxw) mx-auto">
      {heading && (
        <h2
          className="uppercase tracking-tight mb-3"
          style={{ fontSize: "var(--text-heading)" }}
        >
          {heading}
        </h2>
      )}
      {caption && (
        <p className="max-w-[52ch] mb-10 text-[color:var(--color-muted)]">
          {caption}
        </p>
      )}
      {children}
    </section>
  );
}

/** Responsive image grid. cols is the DESKTOP count; always 1-up on mobile. */
export function MediaGrid({
  slug,
  images,
  cols = 2,
}: {
  slug: string;
  images: Project["images"];
  cols?: 1 | 2 | 3;
}) {
  const colClass =
    cols === 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : cols === 2
        ? "sm:grid-cols-2"
        : "";

  return (
    <div className={`grid grid-cols-1 ${colClass} gap-(--gutter)`}>
      {images.map((img) => (
        <figure key={img.file} className="m-0 overflow-hidden">
          <Image
            src={assetPath(slug, img.file)}
            alt={img.alt || ""}
            width={img.w ?? 1600}
            height={img.h ?? 1200}
            sizes={
              cols === 3
                ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                : cols === 2
                  ? "(max-width: 640px) 100vw, 50vw"
                  : "100vw"
            }
            className="w-full h-auto"
          />
        </figure>
      ))}
    </div>
  );
}

/** Edge-to-edge single image for hero / punctuation moments. */
export function MediaFull({
  slug,
  image,
}: {
  slug: string;
  image: Project["images"][number];
}) {
  return (
    <figure className="m-0 w-full overflow-hidden">
      <Image
        src={assetPath(slug, image.file)}
        alt={image.alt || ""}
        width={image.w ?? 2400}
        height={image.h ?? 1350}
        sizes="100vw"
        className="w-full h-auto"
        priority
      />
    </figure>
  );
}

/** Vimeo/YouTube embed. Replaced with self-hosted <video> once Noah supplies files. */
export function VideoEmbed({ url }: { url: string }) {
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  const src = vimeo
    ? `https://player.vimeo.com/video/${vimeo[1]}`
    : yt
      ? `https://www.youtube.com/embed/${yt[1]}`
      : url;

  return (
    <div className="relative w-full aspect-video overflow-hidden bg-black">
      <iframe
        src={src}
        title="Project video"
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}
