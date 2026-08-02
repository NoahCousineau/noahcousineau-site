"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Global footer (on every page). Comp: black bar.
 * LEFT = hand-drawn analog clock (larger, per feedback) with live hands
 * matching the visitor's local time (Mickey-style self-insert planned for
 * the center later). Contact info sits immediately right of the clock,
 * LEFT-ALIGNED to it (not centered in its own column — per feedback).
 * RIGHT = the real white "Cousineau" logo SVG Noah supplied.
 */
function AnalogClock() {
  const hourRef = useRef<SVGLineElement>(null);
  const minRef = useRef<SVGLineElement>(null);
  const secRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const s = now.getSeconds();
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      secRef.current?.setAttribute("transform", `rotate(${s * 6} 50 50)`);
      minRef.current?.setAttribute("transform", `rotate(${m * 6} 50 50)`);
      hourRef.current?.setAttribute("transform", `rotate(${h * 30} 50 50)`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const nums = Array.from({ length: 12 }, (_, i) => {
    const n = i === 0 ? 12 : i;
    const ang = (i * 30 - 90) * (Math.PI / 180);
    const r = 39;
    return { n, x: 50 + r * Math.cos(ang), y: 50 + r * Math.sin(ang) + 3 };
  });

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-label="Local time">
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-paper)" strokeWidth="1.4" strokeLinecap="round" />
      {nums.map((p) => (
        <text
          key={p.n}
          x={p.x}
          y={p.y}
          textAnchor="middle"
          fill="var(--color-paper)"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "7px" }}
        >
          {p.n}
        </text>
      ))}
      <line ref={hourRef} x1="50" y1="50" x2="50" y2="28" stroke="var(--color-paper)" strokeWidth="2" strokeLinecap="round" />
      <line ref={minRef} x1="50" y1="50" x2="50" y2="18" stroke="var(--color-paper)" strokeWidth="1.4" strokeLinecap="round" />
      <line ref={secRef} x1="50" y1="54" x2="50" y2="14" stroke="var(--color-red)" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="50" cy="50" r="1.6" fill="var(--color-paper)" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)] w-full">
      <div className="mx-auto max-w-[1920px] px-[--gutter] py-[6vh] flex flex-col md:flex-row md:items-center md:justify-between gap-10">
        {/* LEFT GROUP — clock (larger) + contact, left-aligned to the clock.
            Stacks vertically below ~480px so the clock+contact row can't
            force horizontal scroll on small phones. */}
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 min-w-0">
          <div className="w-[clamp(120px,20vw,280px)] aspect-square shrink-0">
            <AnalogClock />
          </div>
          <div className="flex flex-col items-center sm:items-start gap-2 min-w-0" style={{ fontSize: "var(--text-caption)" }}>
            <a href="mailto:noah@noahcousineau.com" className="hover:opacity-60 transition-opacity">
              noah@noahcousineau.com
            </a>
            <a href="tel:+18625208040" className="hover:opacity-60 transition-opacity">
              (862) 520-8040
            </a>
            <div className="flex gap-5 uppercase tracking-widest mt-1">
              <a href="https://www.instagram.com/cousineau_art_and_design/?hl=en" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">Instagram</a>
              <a href="https://www.linkedin.com/in/noah-cousineau/" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">LinkedIn</a>
              <a href="https://www.behance.net/noahcousineau" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">Behance</a>
            </div>
          </div>
        </div>

        {/* RIGHT — the real white Cousineau logo SVG */}
        <Link href="/" className="w-[clamp(160px,22vw,320px)] shrink-0">
          <Image
            src="/assets/home/cousineau-logo-white.svg"
            alt="Cousineau"
            width={711}
            height={119}
            className="w-full h-auto"
          />
        </Link>
      </div>
    </footer>
  );
}
