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

  // Redirect to the Account/Profile page with success flag — the new home
  // for sending-address management (migrated from /agent/settings during
  // the Account-area arc). The old /agent/settings page no longer receives
  // verify-success callbacks; users who started the flow there land in the
  // new Profile tab on completion, which is the intentional migration nudge.
  return NextResponse.redirect(
    new URL("/agent/account/profile?verified=1", req.nextUrl.origin)
  );
}
