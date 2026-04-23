import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { listVerifiedEmailsForUser } from "@/lib/services/verified-emails";

export async function GET() {
  const session = await requireSession();
  const emails = await listVerifiedEmailsForUser(session.user.id);
  return NextResponse.json(emails);
}
