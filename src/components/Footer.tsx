"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Global footer — appears on every page.
 * Left: a live clock reflecting the visitor's local time (a Mickey-style
 * watch face is planned; for now a clean digital readout in the reserved slot).
 * Center/right: contact info + logo.
 */
export default function Footer() {
  const [time, setTime] = useState<string>("--:--:--");

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)] px-[--gutter] py-[8vh]">
      <div className="max-w-[--maxw] mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-10">
        {/* Clock slot — Mickey watch goes here later */}
        <div className="flex flex-col items-start">
          <span
            className="uppercase tracking-widest opacity-60"
            style={{ fontSize: "var(--text-caption)" }}
          >
            Local time
          </span>
          <span
            className="font-bold tabular-nums mt-2"
            style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontFamily: "var(--font-sans)" }}
            aria-label="Current local time"
          >
            {time}
          </span>
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-2" style={{ fontSize: "var(--text-caption)" }}>
          <a
            href="mailto:noah@noahcousineau.com"
            className="uppercase tracking-widest hover:opacity-60 transition-opacity"
          >
            noah@noahcousineau.com
          </a>
          <a
            href="tel:+18625208040"
            className="uppercase tracking-widest hover:opacity-60 transition-opacity"
          >
            (862) 520-8040
          </a>
          <div className="flex gap-6 uppercase tracking-widest mt-1">
            <a
              href="https://www.instagram.com/cousineau_art_and_design/?hl=en"
              target="_blank"
              rel="noreferrer"
              className="hover:opacity-60 transition-opacity"
            >
              Instagram
            </a>
            <a
              href="https://www.linkedin.com/in/noah-cousineau/"
              target="_blank"
              rel="noreferrer"
              className="hover:opacity-60 transition-opacity"
            >
              LinkedIn
            </a>
            <a
              href="https://www.behance.net/noahcousineau"
              target="_blank"
              rel="noreferrer"
              className="hover:opacity-60 transition-opacity"
            >
              Behance
            </a>
          </div>
        </div>

        {/* Logo */}
        <Link
          href="/"
          className="uppercase font-bold tracking-tight leading-none self-start md:self-end"
          style={{ fontSize: "clamp(1.5rem,3vw,2.5rem)" }}
        >
          NC
        </Link>
      </div>
    </footer>
  );
}
