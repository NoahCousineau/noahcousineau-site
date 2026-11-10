export const metadata = {
  /* "About", not "About Me": the root template appends " — Noah Cousineau",
     so the tab reads "About — Noah Cousineau" (2026-11-09). */
  title: "About",
  description:
    "Graphic Designer, Artist, All Of The Above. Being silly is serious work.",
  alternates: { canonical: "/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
