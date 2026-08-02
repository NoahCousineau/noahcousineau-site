import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Footer from "@/components/Footer";

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
        <SmoothScroll>
          {children}
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
