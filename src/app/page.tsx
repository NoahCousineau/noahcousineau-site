import Image from "next/image";

/*
  HOMEPAGE — built from Noah's rough Illustrator sketch (01-homepage/Homepage - Rough.ai).
  Composition (top → bottom): portrait · "portfolio" label · name + role ·
  body paragraph · black block at the foot.

  This is the STATIC skeleton. Motion (loading animation, scroll reveals) is a
  later pass — Noah is leaving artboard notes for that. Layout first, react in
  browser, layer animation on after. Colors come from the sketch's vectors.

  DESIGN INTENT (tracked): the portrait head area is a RESERVED ROTATION ZONE.
  Plan is a Bill-Nye-style turntable — a sequence of head photos shot at even
  angular steps, played back as a 3D spin (auto / scroll / cursor-driven TBD).
  When built, swap the <Image> below for a turntable component that takes a
  frame folder. Surrounding layout stays unchanged. Capture spec to follow
  when Noah is ready to shoot. Nothing to build yet.
*/

const COPY = {
  label: "portfolio",
  name: "Noah Cousineau",
  role: "is a Los Angeles-based graphic designer.",
  body: [
    "He uses wit, play, and humor, to create visual",
    "identities, art direct, and solve your visual problems.",
  ],
};

export default function Home() {
  return (
    <main className="px-[--gutter] max-w-[60rem] mx-auto flex flex-col items-center text-center">
      {/* PORTRAIT — RESERVED ROTATION ZONE (turntable, later phase).
          Swap this <Image> for a HeadTurntable component when frames exist. */}
      <div className="mt-[14vh] mb-[8vh] w-[clamp(180px,42vw,360px)]">
        <Image
          src="/assets/home/portrait.webp"
          alt="Noah Cousineau portrait"
          width={538}
          height={678}
          sizes="(max-width: 768px) 42vw, 360px"
          className="w-full h-auto"
          priority
        />
      </div>

      {/* "portfolio" label */}
      <p
        className="uppercase tracking-[0.35em] mb-[6vh]"
        style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)" }}
      >
        {COPY.label}
      </p>

      {/* Name + role */}
      <h1
        className="leading-[0.92] tracking-tight max-w-[16ch]"
        style={{ fontSize: "var(--text-title)" }}
      >
        <span className="block font-bold uppercase">{COPY.name}</span>
        <span className="block font-normal normal-case mt-3">{COPY.role}</span>
      </h1>

      {/* Body paragraph */}
      <p className="mt-[6vh] max-w-[34ch] leading-relaxed" style={{ color: "var(--color-ink)" }}>
        {COPY.body.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </p>

      {/* Black block at the foot — placeholder for CTA / next section */}
      <div
        className="mt-[14vh] w-[clamp(180px,42vw,320px)] aspect-square bg-[color:var(--color-ink)]"
        aria-hidden
      />
    </main>
  );
}
