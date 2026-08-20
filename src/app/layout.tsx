import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import ConditionalFooter from "@/components/ConditionalFooter";
import PageLoader from "@/components/PageLoader";
import AwayOverlay from "@/components/AwayOverlay";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.noahcousineau.com"),
  title: {
    default: "Noah Cousineau — Graphic Designer",
    template: "%s",
  },
  description:
    "Portfolio of Noah Cousineau, graphic designer and artist based in Los Angeles.",
  openGraph: {
    type: "website",
    siteName: "Noah Cousineau",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Typekit — Akzidenz-Grotesk Next Pro (Regular) + Quinn Text (Italic).
            Only these two faces are used site-wide; see globals.css tokens. */}
        <link rel="stylesheet" href="https://use.typekit.net/dch7hsa.css" />
      </head>
      <body>
        <PageLoader />
        <SmoothScroll>
          {/* .site-content is the opaque curtain that slides up to uncover
              the fixed full-viewport footer beneath it — see the FULL-PAGE
              FOOTER REVEAL note in Footer.tsx. It must stay opaque and
              above the footer in z-order for the effect to read. */}
          <div className="site-content">{children}</div>
          <ConditionalFooter />
        </SmoothScroll>
        {/* Black "away" screen with the clock lockup, shown whenever the
            viewer leaves the site (tab hidden or window unfocused). Sits
            outside SmoothScroll because it's viewport-fixed and must not
            participate in scrolling at all. */}
        <AwayOverlay />
      </body>
    </html>
  );
}
