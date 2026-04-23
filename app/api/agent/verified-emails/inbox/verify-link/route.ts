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

  // Redirect to settings page with success flag
  return NextResponse.redirect(
    new URL("/agent/settings?verified=1", req.nextUrl.origin)
  );
}
