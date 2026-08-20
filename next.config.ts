import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 150 = high quality for 150 PPI minimum across site
    // (Next.js caps at 100, so this becomes 100; registered here for clarity)
    qualities: [75, 100],
  },
};

export default nextConfig;
