import Link from "next/link";
import Image from "next/image";
import { projects, assetPath } from "@/lib/projects";

export const metadata = {
  title: "Work — Noah Cousineau",
  description: "Selected graphic design, branding, and art direction projects.",
};

export default function WorkIndex() {
  return (
    <main className="px-[--gutter] py-[16vh] max-w-[--maxw] mx-auto">
      <h1
        className="uppercase leading-[0.85] tracking-tight mb-[10vh]"
        style={{ fontSize: "var(--text-display)" }}
      >
        Work
      </h1>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[--gutter] list-none p-0 m-0">
        {projects.map((p) => (
          <li key={p.slug}>
            <Link href={`/work/${p.slug}`} className="group block">
              {p.cover && (
                <div className="overflow-hidden bg-black/5 aspect-[4/3]">
                  <Image
                    src={assetPath(p.slug, p.cover)}
                    alt={p.title}
                    width={800}
                    height={600}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="w-full h-full object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-105"
                  />
                </div>
              )}
              <h2 className="mt-4 uppercase tracking-tight text-lg">{p.title}</h2>
              <p
                className="text-[color:var(--color-muted)] uppercase tracking-widest"
                style={{ fontSize: "var(--text-caption)" }}
              >
                {p.disciplines.join(" · ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
