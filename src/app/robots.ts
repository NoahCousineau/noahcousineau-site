import type { MetadataRoute } from "next";

// The /work pages sit behind the password gate, so a crawler that follows
// them only ever indexes the gate page. Keeping them out of the index avoids
// a search result that promises a case study and delivers a password box.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dev/", "/password", "/work/"],
    },
  };
}
