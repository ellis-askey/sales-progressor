import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  async redirects() {
    return [
      {
        source: "/agent/hub-preview",
        destination: "/agent/hub",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
