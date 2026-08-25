import { notFound } from "next/navigation";
import PasswordDemo from "./PasswordDemo";

/*
 * A DEMO PAGE FOR THE PASSWORD HAND (2026-08-24).
 *
 * Noah: "please provide a demo page where I can view the password
 * interaction."
 *
 * The real gate (src/app/password/page.tsx) is a one-shot: get the password
 * right and it navigates you to /work and is gone, which makes it a poor
 * place to sit and watch the hand's fly-in, turn, hold and fade play out
 * more than once. This is the same Gate — same Hero backdrop, same
 * PasswordHand, same real /api/unlock check against SITE_PASSWORD, nothing
 * faked — just with the navigation on success swapped for a "Replay" button
 * that remounts PasswordHand fresh, so the whole sequence can be watched on
 * a loop instead of spending the site's actual real password each time.
 *
 * DEV ONLY, matching /dev/mobile — 404s in production.
 */

export default function DevPasswordPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PasswordDemo />;
}
