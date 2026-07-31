import Link from "next/link";
import { projects } from "@/lib/projects";

/*
  HOME — placeholder.
  Deliberately plain. This is the page that gets fully rebuilt
  from Noah's Illustrator direction; no point styling it twice.
*/
export default function Home() {
  return (
    <main className="px-[--gutter] py-[18vh] max-w-[--maxw] mx-auto">
      <p
        className="uppercase tracking-widest text-[color:var(--color-muted)] mb-6"
        style={{ fontSize: "var(--text-caption)" }}
      >
        Scaffold · awaiting design direction
      </p>

      <h1
        className="uppercase font-bold leading-[0.85] tracking-tight"
        style={{ fontSize: "var(--text-display)" }}
      >
        Noah
        <br />
        Cousineau
      </h1>

      <p className="mt-10 max-w-[46ch] leading-relaxed">
        Graphic designer, artist, all of the above. Being silly is serious work.
      </p>

      <div className="mt-16 flex gap-8 uppercase tracking-widest"
           style={{ fontSize: "var(--text-caption)" }}>
        <Link href="/work" className="underline underline-offset-4">
          Work ({projects.length})
        </Link>
        <Link href="/about" className="underline underline-offset-4">
          About
        </Link>
      </div>
    </main>
  );
}
