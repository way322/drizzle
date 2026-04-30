import type { NextConfig } from "next";



const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: [
    "https://*.cloudpub.ru",
    "http://*.cloudpub.ru",
  ],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "shikimori.one",
      },
      {
        protocol: "https",
        hostname: "shikimori.io",
      },
      {
        protocol: "https",
        hostname: "shiki.one",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.yandex.net",
      },
      {
        protocol: "https",
        hostname: "avatars.mds.yandex.net",
      },
    ],
  },
};

export default nextConfig;