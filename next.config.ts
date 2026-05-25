import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "@react-pdf/renderer"],
  async redirects() {
    return [
      {
        source: "/agent/hub-preview",
        destination: "/agent/hub",
        permanent: true,
      },
      {
        source: "/agent/exchanges",
        destination: "/agent/dashboard?filter=active",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
