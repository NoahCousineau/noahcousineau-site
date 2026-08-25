"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsPhone } from "@/lib/useIsPhone";

/**
 * Sends phones away from the work index (2026-08-25).
 *
 * Noah: "Remove the 'work index' page from mobile, we're no longer using
 * this."
 *
 * A client-side redirect rather than a 404 or a proxy rule, because the
 * thing being keyed off is the VIEWPORT, which the server never sees. A
 * user-agent sniff on the proxy would be the server-side alternative and is
 * worse in the way user-agent sniffing is always worse — it would send a
 * narrow desktop window the desktop page and a wide phone the phone one,
 * which is the opposite of what the rest of this site's breakpoint does.
 *
 * `replace`, not `push`: this page should not be a step in the back-button
 * history, or leaving it would bounce straight back into it.
 */
export default function WorkIndexPhoneGuard() {
  const phone = useIsPhone();
  const router = useRouter();

  useEffect(() => {
    if (phone) router.replace("/");
  }, [phone, router]);

  return null;
}
