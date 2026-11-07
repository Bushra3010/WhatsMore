import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // the dev badge sits over the phone tab bar
  devIndicators: false,
};

export default nextConfig;
