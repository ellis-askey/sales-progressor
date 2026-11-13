import { NextRequest, NextResponse } from "next/server";
import { confirmInboxToken } from "@/lib/services/verified-emails";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const userId = req.nextUrl.searchParams.get("userId") ?? "";

  if (!token || !email || !userId) {
    return new NextResponse("Invalid verification link.", { status: 400 });
  }

  const result = await confirmInboxToken(userId, email, token);

  if ("error" in result) {
    return new NextResponse(`Verification failed: ${result.error}`, { status: 400 });
  }

  // Redirect to the Connections page with success flag — sending-address
  // management now lives there (consolidated onto Connections, 2026-11-13),
  // so the verify-success banner shows where the section actually is.
  return NextResponse.redirect(
    new URL("/agent/account/connections?verified=1", req.nextUrl.origin)
  );
}
