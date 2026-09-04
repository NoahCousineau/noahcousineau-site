"use client";

import { useEffect } from "react";
import { primeTilt } from "@/lib/deviceTilt";

/**
 * Asks for motion access on every page, once per load.
 *
 * Noah: "make sure it asks the mobile user once each time they load any part
 * of the overall website." Before this the ask rode along with whichever
 * component happened to want the readings, so it depended on the page. This
 * is mounted in the root layout, so it does not.
 *
 * It renders nothing and reads nothing. All it does is start the gesture
 * listeners in lib/deviceTilt, which wait for the reader's first tap — an
 * iOS rule, not a choice — and then keep offering until the browser gives a
 * real answer. Everything that actually USES the tilt still subscribes
 * normally; this only makes sure the question gets asked.
 */
export default function TiltPrimer() {
  useEffect(() => {
    primeTilt();
  }, []);
  return null;
}
