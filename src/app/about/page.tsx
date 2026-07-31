export const metadata = {
  title: "About — Noah Cousineau",
  description:
    "Graphic Designer, Artist, All Of The Above. Being silly is serious work.",
};

const LINKS = [
  { label: "noah@noahcousineau.com", href: "mailto:noah@noahcousineau.com" },
  { label: "Instagram", href: "https://www.instagram.com/cousineau_art_and_design/?hl=en" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/noah-cousineau/" },
  { label: "Behance", href: "https://www.behance.net/noahcousineau" },
  { label: "Etsy Store", href: "https://www.etsy.com/shop/CousineauDesign" },
  { label: "Download Résumé", href: "/assets/_documents/noah-cousineau-resume.pdf" },
];

export default function About() {
  return (
    <main className="px-[--gutter] py-[16vh] max-w-[--maxw] mx-auto">
      <h1
        className="uppercase font-bold leading-[0.85] tracking-tight"
        style={{ fontSize: "var(--text-display)" }}
      >
        About Me
      </h1>

      <h2
        className="mt-6 uppercase tracking-widest text-[color:var(--color-muted)]"
        style={{ fontSize: "var(--text-caption)" }}
      >
        Graphic Designer | Artist | All Of The Above
      </h2>

      <p className="mt-12 max-w-[62ch] leading-relaxed">
        Being silly is serious work. This is not only a strong personal belief,
        but a reason why I switched careers from engineering to graphic design.
        As an engineer, I worked on serious projects where miscalculation could
        cost hundreds of thousands of dollars, or worse, an accident or injury.
        When I attended my masters program at ArtCenter College of Design, I was
        confused to see designers uphold themselves to similar levels of
        severity. In a discipline where we need to connect to audiences, why be
        so incredibly grave and stark with our work? Why not be a little more
        human and have some fun with it? I create work with humor, levity, and
        joy not only because I enjoy doing so, but because it resonates with
        audiences. In a somber and increasingly less human design landscape,
        there&rsquo;s nothing more serious than having some fun.
      </p>

      <ul className="mt-16 flex flex-col gap-3 list-none p-0">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="uppercase tracking-widest underline underline-offset-4 hover:opacity-60 transition-opacity"
              style={{ fontSize: "var(--text-caption)" }}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
