"use client";

import { useEffect } from "react";
import { suppressAwayScreen } from "@/lib/awayScreen";

/**
 * Keeps the away screen down for as long as this is mounted — see
 * lib/awayScreen. Rendered by the 404 page, which is the clock already.
 *
 * Renders nothing, and releases on unmount, so navigating away from the 404
 * restores the screen's normal behaviour with no further bookkeeping.
 */
export default function SuppressAwayScreen() {
  useEffect(() => suppressAwayScreen(), []);
  return null;
}
