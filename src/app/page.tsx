import Hero from "@/components/home/Hero";
import Description from "@/components/home/Description";
import Projects from "@/components/home/Projects";

/*
  HOMEPAGE — faithful reproduction of Noah's multi-artboard Illustrator sketch.
  Every element is positioned from the 1920-wide master artboard via <Stage>/<Place>
  (src/components/home/Stage.tsx). Horizontal placement, alignment and type scale
  follow the artboard at all widths.

  Four areas:
    1. HERO        — head (rotation zone) left, yellow paper behind, name labels right
    2. DESCRIPTION — 3 left-aligned lines + scroll-rotating pointing hand
    3. PROJECTS    — 2-col grid, the six tiles from the sketch (others → /work)
    4. (Footer)    — global: live clock + contact + logo

  DESIGN INTENT (tracked): head = RESERVED ROTATION ZONE (Bill-Nye turntable).
  Yellow paper = morphing placeholder for the real shape system.
*/

export default function Home() {
  return (
    <main
      className="artboard mx-auto w-full"
      style={{ containerType: "inline-size", ["--u" as string]: "calc(100cqw / 1920)" }}
    >
      <Hero />
      <Description />
      <Projects />
    </main>
  );
}
