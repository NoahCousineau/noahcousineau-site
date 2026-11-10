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
import { TILT_INIT_SCRIPT } from "@/lib/tiltInit";

export const metadata: Metadata = {
  /* THE APEX, NOT www (2026-11-09). www already answers 308 to
     noahcousineau.com, so the site had one home and advertised another:
     every share card pointed its image and URL at www.noahcousineau.com and
     took the reader through a redirect to get there. One domain, named once,
     and `alternates.canonical` on each page below says so to crawlers. */
  metadataBase: new URL("https://noahcousineau.com"),
  /* Tab names. Noah set these on 2026-08-30 as a bare "%s" passthrough; the
     template adds the site name now (2026-11-09, his ask: "Use 'Sprouts
     Farmers Market — Noah Cousineau' instead of 'Sprouts Farmers Market'").
     Pages carry only their own name, and the home page's `default` is used
     as-is — Next does not apply the template to it. */
  title: {
    default: "Noah Cousineau",
    template: "%s — Noah Cousineau",
  },
  alternates: { canonical: "/" },
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
        {/* Asks for motion before anything else, and makes the reader's first
            touch bring up Apple's sheet from the moment the page starts
            loading — see lib/tiltInit. Inline, so it does not wait for the
            site's JavaScript to arrive. */}
        <script dangerouslySetInnerHTML={{ __html: TILT_INIT_SCRIPT }} />
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
