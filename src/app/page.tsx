import Hero from "@/components/home/Hero";
import Description from "@/components/home/Description";
import Projects from "@/components/home/Projects";

/*
  HOMEPAGE — built from Noah's multi-artboard Illustrator sketch.
  Four areas, top → bottom:
    1. HERO            — rotating-head zone (placeholder) + morphing yellow paper
    2. DESCRIPTION     — copy + scroll-driven pointing-hand rotation
    3. PROJECTS        — hover-to-play video grid, white title boxes
    4. (Footer)        — global, on every page: live clock + contact + logo

  DESIGN INTENT (tracked): the portrait head area is a RESERVED ROTATION ZONE.
  Plan is a Bill-Nye-style turntable — a sequence of head photos shot at even
  angular steps, played back as a 3D spin (auto / scroll / cursor-driven TBD).
  Swap Hero's <Image> for a HeadTurntable component when frames exist. The
  yellow paper is a morphing placeholder standing in for the real shape system.
*/

export default function Home() {
  return (
    <main>
      <Hero />
      <Description />
      <Projects />
    </main>
  );
}
