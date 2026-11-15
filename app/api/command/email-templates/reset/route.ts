// POST /api/command/email-templates/reset  { templateKey, variant }
//
// Removes our edited default so the email reverts to the built-in code default.
// Superadmin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { resetPlatformTemplate } from "@/lib/agency-email/templates";
import { recordAdminActionSafe } from "@/lib/command/audit/write";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const templateKey = String(b.templateKey ?? "");
  const variant = String(b.variant ?? "");
  const r = await resetPlatformTemplate(templateKey, variant);
  if (!r.ok) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await recordAdminActionSafe({
    adminUserId: session.user.id,
    action: "command.email_template.reset",
    targetType: "email_template",
    targetId: templateKey,
    afterValue: { templateKey, variant },
  });
  return NextResponse.json({ ok: true });
}
