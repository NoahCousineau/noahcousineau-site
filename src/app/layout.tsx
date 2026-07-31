import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

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
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
