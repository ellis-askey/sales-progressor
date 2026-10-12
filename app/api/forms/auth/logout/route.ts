import { NextResponse } from "next/server";
import { clearFormsSessionCookie } from "@/lib/forms/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearFormsSessionCookie();
  return NextResponse.json({ ok: true });
}
