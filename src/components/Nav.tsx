"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Me" },
  { href: "/work", label: "Projects" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const onWork = pathname?.startsWith("/work");

  return (
    <header className="fixed top-0 inset-x-0 z-50 mix-blend-difference text-white">
      <nav className="flex items-center justify-between px-[--gutter] py-5">
        <Link
          href="/"
          className="uppercase tracking-widest"
          style={{ fontSize: "var(--text-caption)" }}
        >
          Noah Cousineau
        </Link>

        {/* Desktop / tablet */}
        <ul className="hidden sm:flex gap-8 uppercase tracking-widest list-none m-0 p-0"
            style={{ fontSize: "var(--text-caption)" }}>
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-opacity hover:opacity-60"
                  style={{ opacity: active ? 1 : 0.6 }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Mobile */}
        <button
          className="sm:hidden uppercase tracking-widest"
          style={{ fontSize: "var(--text-caption)" }}
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </nav>

      {open && (
        <ul className="sm:hidden flex flex-col gap-4 px-[--gutter] pb-6 uppercase tracking-widest list-none bg-black/90 text-white"
            style={{ fontSize: "var(--text-caption)" }}>
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* On a project page, surface the prev/next affordance hint */}
      {onWork && (
        <div className="hidden md:block fixed bottom-6 right-[--gutter] uppercase tracking-widest opacity-60"
             style={{ fontSize: "var(--text-caption)" }}>
          ← → projects
        </div>
      )}
    </header>
  );
}
