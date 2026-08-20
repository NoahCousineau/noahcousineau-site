"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  // Don't render footer on the about page (it has its own custom footer)
  if (pathname === "/about") {
    return null;
  }
  return <Footer />;
}
