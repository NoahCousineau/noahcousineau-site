import type { MetadataRoute } from "next";

// /work used to sit behind the password gate, so a crawler that followed it
// only ever indexed the gate page and the case studies were kept out of the
// index. The gate is off now (see GATE_ENABLED in lib/gate) and the work is
// the whole point of the site, so it is the first thing that should be
// findable. /password stays out: it is kept for future use, not for readers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dev/", "/password"],
    },
  };
}
