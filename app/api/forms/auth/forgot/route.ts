import { NextResponse } from "next/server";
import { issueResetToken } from "@/lib/forms/auth";
import { clientIp, formsBaseUrl } from "@/lib/forms/api";
import { checkFormsAuthLimit, rateLimitJson } from "@/lib/ratelimit";
import { sendFormsPasswordReset } from "@/lib/forms/notify";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limit = await checkFormsAuthLimit(clientIp(req));
  if (!limit.success) return NextResponse.json(rateLimitJson(limit), { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { tenant?: string; email?: string };
  const tenantSlug = typeof body.tenant === "string" ? body.tenant : "";
  const email = typeof body.email === "string" ? body.email : "";
  // Always report success — no account enumeration.
  if (!tenantSlug || !email) return NextResponse.json({ ok: true });

  const issued = await issueResetToken(tenantSlug, email);
  if (issued) {
    const tenant = await prisma.formTenant.findUnique({ where: { slug: tenantSlug } });
    if (tenant) {
      try {
        await sendFormsPasswordReset({
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          to: issued.user.email,
          name: issued.user.name,
          token: issued.token,
          baseUrl: formsBaseUrl(),
        });
      } catch (err) {
        console.error("[forms] reset email failed", err);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
