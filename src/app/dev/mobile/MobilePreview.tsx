"use client";

import { useState } from "react";

/*
 * The client half of the mobile bench — see page.tsx for what it is for.
 *
 * THE FRAMES ARE SCALED WITH A CSS TRANSFORM, not resized. An iframe sized to
 * 390px genuinely lays out at 390px, which is the whole point; shrinking it
 * with `zoom` or a smaller width would change the width the page inside
 * measures and quietly show a different layout from the one a phone gets.
 * transform: scale() leaves the layout viewport alone and only affects how big
 * the result is painted, so what is on screen is exactly what the phone
 * renders, just further away.
 *
 * CARDS DON'T LOAD UNTIL ASKED (2026-08-24). Noah: "keep the animations on
 * the mobile bench stationary unless I turn on a switch to see a page's
 * animation." Several of these pages run a continuous requestAnimationFrame
 * loop from mount with no idle/visibility gate — RotatingHead ticks every
 * frame whether or not anything is moving — so ten mounted at once is ten
 * rAF loops running forever in the background. Pausing that from OUTSIDE the
 * iframe isn't reliable: CSS `animation-play-state` has no effect on a rAF
 * loop or a GSAP timeline, since neither is a CSS animation, and patching
 * `requestAnimationFrame` before the iframe's own scripts run doesn't work
 * either — navigating the iframe hands it a brand-new window with its own
 * fresh globals, so anything patched pre-navigation is gone the moment the
 * real page loads. Not loading the iframe at all sidesteps the problem
 * instead of fighting it: a card is an inert placeholder — no fetch, no
 * script, no rAF — until its own switch flips, at which point it mounts and
 * runs exactly like visiting the page directly, animations included.
 */

const DEVICES = [
  { id: "iphone-se", label: 'iPhone SE — 375', w: 375, h: 667 },
  { id: "iphone-14", label: "iPhone 14 — 390", w: 390, h: 844 },
  { id: "iphone-max", label: "14 Pro Max — 430", w: 430, h: 932 },
  { id: "ipad-mini", label: "iPad mini — 768", w: 768, h: 1024 },
];

export default function MobilePreview({
  routes,
}: {
  routes: { href: string; label: string }[];
}) {
  const [device, setDevice] = useState(DEVICES[1]);
  const [scale, setScale] = useState(0.6);
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  const load = (href: string) =>
    setLoaded((prev) => (prev.has(href) ? prev : new Set(prev).add(href)));

  return (
    <main style={{ padding: "24px 28px 60px", fontFamily: "var(--font-sans)" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          gap: 20,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "14px 0 18px",
          background: "var(--color-paper)",
          borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 18%, transparent)",
        }}
      >
        <strong style={{ fontSize: 15, letterSpacing: "0.02em" }}>Mobile bench</strong>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          Device
          <select
            value={device.id}
            onChange={(e) =>
              setDevice(DEVICES.find((d) => d.id === e.target.value) ?? DEVICES[1])
            }
            style={{ font: "inherit", padding: "3px 6px" }}
          >
            {DEVICES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          Zoom
          <input
            type="range"
            min={30}
            max={100}
            step={5}
            value={scale * 100}
            onChange={(e) => setScale(Number(e.target.value) / 100)}
          />
          <span style={{ width: 38, opacity: 0.6 }}>{Math.round(scale * 100)}%</span>
        </label>

        {/* Remounts every iframe already loaded. Hot reload already reaches
            inside them, but a change to something that only runs on load —
            the page loader, the header's falling objects — needs the load to
            happen again. Cards not yet loaded are untouched by this. */}
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          style={{ font: "inherit", fontSize: 13, padding: "4px 12px", cursor: "pointer" }}
        >
          Reload all
        </button>

        <button
          type="button"
          onClick={() => setLoaded(new Set(routes.map((r) => r.href)))}
          style={{ font: "inherit", fontSize: 13, padding: "4px 12px", cursor: "pointer" }}
        >
          Load all
        </button>

        <span style={{ fontSize: 12, opacity: 0.55 }}>
          {loaded.size}/{routes.length} loaded at {device.w}×{device.h}
        </span>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 28,
          alignItems: "flex-start",
          paddingTop: 24,
        }}
      >
        {routes.map((r) => (
          <figure key={r.href} style={{ margin: 0 }}>
            <figcaption
              style={{
                fontSize: 12,
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                width: device.w * scale,
              }}
            >
              <span style={{ fontWeight: 600 }}>{r.label}</span>
              <a href={r.href} target="_blank" rel="noreferrer" style={{ opacity: 0.5 }}>
                open ↗
              </a>
            </figcaption>
            <div
              style={{
                width: device.w * scale,
                height: device.h * scale,
                overflow: "hidden",
                border: "1px solid color-mix(in srgb, var(--color-ink) 25%, transparent)",
                borderRadius: 14,
              }}
            >
              {loaded.has(r.href) ? (
                <iframe
                  key={`${r.href}-${device.id}-${nonce}`}
                  src={r.href}
                  title={r.label}
                  width={device.w}
                  height={device.h}
                  style={{
                    border: 0,
                    transform: `scale(${scale})`,
                    transformOrigin: "0 0",
                    display: "block",
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => load(r.href)}
                  aria-label={`Load ${r.label}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "color-mix(in srgb, var(--color-ink) 4%, transparent)",
                    border: 0,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      opacity: 0.45,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    ▶ load
                  </span>
                </button>
              )}
            </div>
          </figure>
        ))}
      </div>
    </main>
  );
}
