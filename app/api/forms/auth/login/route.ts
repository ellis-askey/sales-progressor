import { NextResponse } from "next/server";
import { setFormsSessionCookie, validateLogin } from "@/lib/forms/auth";
import { clientIp } from "@/lib/forms/api";
import { checkFormsAuthLimit, rateLimitJson } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limit = await checkFormsAuthLimit(clientIp(req));
  if (!limit.success) {
    return NextResponse.json(rateLimitJson(limit), { status: 429 });
  }

  let body: { tenant?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const tenant = typeof body.tenant === "string" ? body.tenant : "";
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!tenant || !email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const user = await validateLogin(tenant, email, password);
  if (!user) {
    return NextResponse.json({ error: "That email and password don't match." }, { status: 401 });
  }

  await setFormsSessionCookie(user);
  await prisma.formTenantUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword });
}
