import { notFound } from "next/navigation";
import AwayOverlay from "@/components/AwayOverlay";

/*
 * THE CLOCK SCREEN, HELD OPEN (2026-08-25).
 *
 * Noah: "on the mobile bench, please also provide a way for me to see what
 * the clock screen will look like on mobile."
 *
 * The away screen is deliberately not a route — it appears after 30 seconds
 * idle or when you leave the tab, and any activity dismisses it. Both of
 * those are conditions a frame you are actively looking at will never be in,
 * and AwayOverlay refuses to raise itself inside an iframe at all (an embed's
 * window is blurred nearly always, so every phone on the bench would show
 * nothing but the clock). There was no way to see it at phone size short of
 * shrinking a real window and waiting.
 *
 * So this is a route whose only content is that screen, pinned open, which
 * the bench can then embed like any other. It is a viewing stand and nothing
 * else: `forceOpen` skips the idle poll and the leave listeners entirely, so
 * what you get is the layout, holding still, at whatever width the frame is.
 *
 * DEV ONLY, the same as /dev/mobile and for the same reason — it 404s in a
 * deployed build, which is also what keeps `forceOpen` from having any caller
 * in production.
 */
export default function DevClockPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AwayOverlay forceOpen />;
}
