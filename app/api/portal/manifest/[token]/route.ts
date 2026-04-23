import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;

  const manifest = {
    name: "My Property Portal",
    short_name: "My Property",
    description: "Track your property transaction progress",
    start_url: `/portal/${token}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#F8F9FB",
    theme_color: "#FF6B4A",
    icons: [
      {
        src: `${base}/portal-icon`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
