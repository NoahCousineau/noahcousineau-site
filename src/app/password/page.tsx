"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Hero from "@/components/home/Hero";
import PasswordHand, { usePasswordArtboard } from "@/components/PasswordHand";

/*
 * THE GATE (rebuilt 2026-08-23 around Noah's hand animation).
 *
 * "The password page is to appear whenever a new user first visits the site
 * and selects a project... The homepage will be visible behind it."
 *
 * That last clause is why this route renders the Hero rather than a page of
 * its own: the reader clicked a project from the home page, so as far as they
 * are concerned nothing navigated — a hand simply came up and stopped them.
 * src/proxy.ts sends them here with ?from=<where they were going>, and the
 * thumbs up sends them on.
 *
 * ONLY THE HERO, not the whole home page. It is the only part a reader can
 * see behind a full-viewport overlay they cannot scroll, and pulling in the
 * project grid would mean loading every tile's artwork for a screen nobody
 * looks past. The Hero also carries the rotating head, which is the part
 * worth seeing behind the hand anyway.
 *
 * The loading screen is suppressed here (see PageLoader) because it belongs
 * at the END of this sequence, not the start: the thumbs up fades into it.
 */

function Gate() {
  const artboard = usePasswordArtboard();
  const router = useRouter();
  const params = useSearchParams();

  const check = useCallback(async (pass: string) => {
    try {
      /* A static review build has no /api/unlock to ask — see the note in
       * next.config.ts. Only that build sets this, and only that build ships
       * the password to the browser. */
      if (process.env.NEXT_PUBLIC_REVIEW_BUILD === "1") {
        return pass === process.env.NEXT_PUBLIC_REVIEW_PASSWORD;
      }
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const enter = useCallback(() => {
    const from = params.get("from");
    router.replace(from && from.startsWith("/work") ? from : "/work");
    router.refresh();
  }, [params, router]);

  return (
    <>
      {/* The home page, carrying on behind. Inert: the reader's only move
          here is to type. */}
      <main
        className="artboard js-password-backdrop mx-auto w-full max-w-[1920px]"
        aria-hidden
        style={{
          containerType: "inline-size",
          ["--u" as string]: "calc(100cqw / 1920)",
          pointerEvents: "none",
        }}
      >
        <Hero />
      </main>

      {/* z-50 and not higher so the home mark and the theme toggle (both
          z-60) stay reachable — the hand never reaches those corners. */}
      <div className="fixed inset-0 z-50" style={{ containerType: "inline-size" }}>
        <div
          className="w-full h-full flex items-center justify-center"
          /* The artboard narrows on a phone so the hand fills the screen —
             see PHONE_ARTBOARD in PasswordHand. The height term still caps
             it on a window too short for the composition. */
          style={{
            ["--u" as string]: `min(100cqw / ${artboard.w}, 100dvh / ${artboard.h})`,
          }}
        >
          {/* Pinned to the artboard's own width so the hand stays centred on
              a viewport too tall for 16:9, where --u is height-derived and
              the flex parent is wider than 1920 units. */}
          <div style={{ width: `calc(var(--u) * ${artboard.w})` }}>
            <PasswordHand onSubmit={check} onFinished={enter} />
          </div>
        </div>
      </div>
    </>
  );
}

export default function PasswordPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}
