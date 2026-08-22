import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import ConditionalFooter from "@/components/ConditionalFooter";
import PageLoader from "@/components/PageLoader";
import AwayOverlay from "@/components/AwayOverlay";
import ThemeProvider, { THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";

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
    // suppressHydrationWarning: the pre-paint script below stamps
    // data-theme on <html> before React hydrates, so the server's markup
    // (which has no attribute) and the client's will always differ here.
    // That difference is the point, not a bug.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Typekit — Akzidenz-Grotesk Next Pro (Regular) + Quinn Text (Italic).
            Only these two faces are used site-wide; see globals.css tokens. */}
        <link rel="stylesheet" href="https://use.typekit.net/dch7hsa.css" />
        {/* Applies the saved (or OS) theme BEFORE first paint. As a React
            effect this would run after paint, which is exactly the flash of
            the wrong theme it exists to prevent. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
        <PageLoader />
        <ThemeToggle />
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
        </ThemeProvider>
      </body>
    </html>
  );
}
