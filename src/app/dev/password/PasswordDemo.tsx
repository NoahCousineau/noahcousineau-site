"use client";

import { useCallback, useState } from "react";
import Hero from "@/components/home/Hero";
import PasswordHand, { usePasswordArtboard } from "@/components/PasswordHand";

/*
 * The client half of the password demo — see page.tsx for what it is for.
 *
 * `resetKey` in PasswordHand's own React key is what replays the animation:
 * remounting it resets its internal phase state machine back to "enter"
 * (see PasswordHand.tsx), the same as a fresh page load would.
 */
export default function PasswordDemo() {
  const artboard = usePasswordArtboard();
  const [resetKey, setResetKey] = useState(0);
  const [finished, setFinished] = useState(false);

  const check = useCallback(async (pass: string): Promise<"ok" | "wrong" | "wait"> => {
    try {
      /* A static review build has no /api/unlock to ask — see the note in
       * next.config.ts. Only that build sets this, and only that build ships
       * the password to the browser. */
      if (process.env.NEXT_PUBLIC_REVIEW_BUILD === "1") {
        return pass === process.env.NEXT_PUBLIC_REVIEW_PASSWORD ? "ok" : "wrong";
      }
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass }),
      });
      if (res.ok) return "ok";
      // See the note in app/password/page.tsx: a rate-limit says nothing about
      // the password, so the value must stay retryable.
      return res.status === 429 ? "wait" : "wrong";
    } catch {
      return "wait";
    }
  }, []);

  const replay = () => {
    setFinished(false);
    setResetKey((k) => k + 1);
  };

  return (
    <>
      <main
        className="js-password-backdrop mx-auto w-full"
        aria-hidden
        style={{
          containerType: "inline-size",
          ["--u" as string]: "calc(100cqw / 1920)",
          pointerEvents: "none",
        }}
      >
        <Hero />
      </main>

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
          <div style={{ width: `calc(var(--u) * ${artboard.w})` }}>
            <PasswordHand
              key={resetKey}
              onSubmit={check}
              onFinished={() => setFinished(true)}
            />
          </div>
        </div>
      </div>

      <div
        className="fixed z-[70] flex items-center gap-3"
        style={{
          top: 16,
          left: 16,
          fontFamily: "var(--font-sans)",
          fontSize: 13,
        }}
      >
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: "color-mix(in srgb, var(--color-ink) 85%, transparent)",
            color: "var(--color-paper)",
          }}
        >
          Password demo — real /api/unlock check
        </span>
        {finished && (
          <button
            type="button"
            onClick={replay}
            style={{
              font: "inherit",
              padding: "4px 12px",
              borderRadius: 999,
              cursor: "pointer",
              background: "var(--color-ink)",
              color: "var(--color-paper)",
              border: 0,
            }}
          >
            ↺ Replay
          </button>
        )}
      </div>
    </>
  );
}
