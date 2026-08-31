// POST /api/agent/email-templates/save  { templateKey, variant, content }
//
// Saves this agency's own Tier-2 email copy + writes the audit row. Director
// only; agencyId from the session (Law 7). Completion pack for now.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveCompletionPack, type CompletionPackContent, type CompletionPackSide } from "@/lib/agency-email/templates";

function validCompletionPack(raw: unknown): CompletionPackContent | null {
  const c = (raw ?? {}) as Record<string, unknown>;
  const subject = typeof c.subject === "string" ? c.subject.trim() : "";
  const opening = typeof c.opening === "string" ? c.opening.trim() : "";
  const bullets = Array.isArray(c.bullets)
    ? c.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim())
    : [];
  if (!subject || !opening || bullets.length === 0) return null;
  return { subject, opening, bullets };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "director" || !session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const editor = { id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "" };

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const templateKey = String(b.templateKey ?? "");
  const variant = String(b.variant ?? "");

  if (templateKey === "completion_pack" && (variant === "vendor" || variant === "purchaser")) {
    const content = validCompletionPack(b.content);
    if (!content) {
      return NextResponse.json({ error: "Subject, opening and at least one point are required" }, { status: 400 });
    }
    await saveCompletionPack({ agencyId: session.user.agencyId, side: variant as CompletionPackSide, content, editor });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
