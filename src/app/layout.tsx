import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import ConditionalFooter from "@/components/ConditionalFooter";
import PageLoader from "@/components/PageLoader";
import AwayOverlay from "@/components/AwayOverlay";
import ThemeProvider, { THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";
import HomeLink from "@/components/HomeLink";
import GateOverlay from "@/components/GateOverlay";
import TiltPrimer from "@/components/TiltPrimer";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.noahcousineau.com"),
  /* Tab names, set by Noah on 2026-08-30. The template is "%s" — a bare
     passthrough — so a page's own title is the whole tab name with nothing
     appended. Anything without its own title falls back to the default. */
  title: {
    default: "Noah Cousineau",
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
        <HomeLink />
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
        {/* Raises the password hand over the page you are on, instead of
            navigating away to a password screen. The server gate in
            src/proxy.ts is unchanged and still protects a URL typed
            directly — see the note in GateOverlay. */}
        <GateOverlay />
        {/* Asks for motion access on every page — see TiltPrimer. */}
        <TiltPrimer />
        </ThemeProvider>
      </body>
    </html>
  );
}
