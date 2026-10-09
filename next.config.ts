import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache local documentation and prefetch page shells for instant navigation.
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
