"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PasswordHand, { usePasswordArtboard } from "./PasswordHand";
import { GATE_ENABLED, UI_HINT } from "@/lib/gate";

/**
 * THE HAND COMES UP WHERE YOU ARE (2026-08-30).
 *
 * Noah: "I don't want it to reload the page. What I want is the hand
 * animation to appear over wherever the user currently is on the page."
 *
 * Until now, clicking a project while locked was a navigation: the proxy saw
 * an ungated request for /work/... and redirected to /password, which threw
 * away the page you were looking at, scrolled you to the top of a rebuilt
 * home page, and only then raised the hand. The hand is meant to read as
 * someone stopping you — and being teleported somewhere else first is the
 * opposite of that.
 *
 * So the click is caught before the browser acts on it, and the hand is drawn
 * over the page exactly as it stands. Nothing navigates. On a thumbs up, the
 * cookie is already set, and only then does the reader go where they were
 * going.
 *
 * THE SERVER GATE IS UNTOUCHED. src/proxy.ts still refuses an ungated
 * /work/... request and still redirects to /password. That path is what
 * protects a link pasted into a browser, a search engine, or anyone with
 * script disabled — and it stays exactly as it was. This is an interface
 * layer over the top of it, not a replacement for it: the worst a broken
 * intercept can do is let a click through to a redirect that already works.
 */

/** Cheap enough to read on every click; no need to watch it. */
function unlocked(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie.split("; ").some((c) => c.startsWith(`${UI_HINT}=`));
}

export default function GateOverlay() {
  const artboard = usePasswordArtboard();
  const [target, setTarget] = useState<string | null>(null);
  /* The scroll position at the moment the hand came up, so leaving the
   * overlay can put the page back exactly where it was. */
  const scrollY = useRef(0);

  useEffect(() => {
    if (!GATE_ENABLED) return;
    const onClick = (e: MouseEvent) => {
      // Let the browser have modified clicks — cmd-click to a new tab should
      // open a new tab, where the server gate will meet them properly.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const el = (e.target as HTMLElement | null)?.closest?.("a");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || !href.startsWith("/work")) return;
      if (el.getAttribute("target") === "_blank") return;
      if (unlocked()) return;

      e.preventDefault();
      scrollY.current = window.scrollY;
      setTarget(href);
    };
    // Capture phase, so this runs before Next's own Link handler.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  /* While the hand is up the page behind must not move — it is a full-screen
   * interruption, and a page scrolling underneath it reads as a bug. Restored
   * on the way out, including the exact position, because the reader is
   * meant to come back to where they were standing. */
  /* THE TAB WHILE THE HAND IS UP (2026-08-30). Noah: "only have 'Woah,
   * Partner!' when the password hand appears." The loading worm says
   * "Loading" instead — see PageLoader. */
  useEffect(() => {
    if (!target) return;
    const before = document.title;
    document.title = "Woah, Partner!";
    return () => {
      if (document.title === "Woah, Partner!") document.title = before;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const y = scrollY.current;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, y);
    };
  }, [target]);

  const check = useCallback(async (pass: string): Promise<"ok" | "wrong" | "wait"> => {
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass }),
      });
      if (res.ok) return "ok";
      // See the note in app/password/page.tsx — a rate limit is not a wrong
      // password, and treating it as one poisons the correct one.
      return res.status === 429 ? "wait" : "wrong";
    } catch {
      return "wait";
    }
  }, []);

  const enter = useCallback(() => {
    const to = target;
    setTarget(null);
    if (!to) return;
    /* A FULL NAVIGATION, DELIBERATELY.
     *
     * router.push looked right and landed on /password. Next prefetches the
     * links it can see, and these links were prefetched WHILE LOCKED — so
     * what sat in the router cache for /work/... was the proxy's redirect to
     * the password screen. Pushing then replayed that cached redirect and
     * sent the reader to the very screen they had just satisfied.
     *
     * router.refresh() clears that, but only for the current route, and
     * ordering it against a push is a race worth not having. Going through
     * the browser throws the whole client cache away and asks the server
     * again, now carrying the cookie. It costs a page load — which is what
     * clicking a project was always going to do anyway. The thing Noah asked
     * for was that the HAND not reload the page, and it does not. */
    window.location.assign(to);
  }, [target]);

  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-[9998]"
      style={{
        containerType: "inline-size",
        /* YOU HAVE TO BE ABLE TO SEE THE PAGE (2026-08-30). Noah: "it's
           popping up in what looks to be a new window."
           
           This was a solid --color-paper, which covered the page completely —
           so although nothing navigated, it was indistinguishable from having
           navigated, and the whole point of raising the hand where you stand
           was lost. A veil instead of a wall: enough to hold the hand's own
           copy legible, little enough that you can still see what you were
           looking at underneath and understand you have been interrupted
           rather than moved. color-mix keeps it theme-aware, so it is a pale
           veil in light mode and a dark one in dark. */
        background: "color-mix(in srgb, var(--color-paper) 82%, transparent)",
      }}
    >
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ ["--u" as string]: `min(100cqw / ${artboard.w}, 100dvh / ${artboard.h})` }}
      >
        <div style={{ width: `calc(var(--u) * ${artboard.w})` }}>
          <PasswordHand onSubmit={check} onFinished={enter} />
        </div>
      </div>
    </div>
  );
}
