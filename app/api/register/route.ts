import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkSignupLimit, rateLimitJson } from "@/lib/ratelimit";

function toTitleCase(str: string): string {
  return str.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const rl = await checkSignupLimit(ip).catch(() => ({ success: true, reset: 0, remaining: 999 }));
    if (!rl.success) {
      return NextResponse.json(rateLimitJson(rl), { status: 429 });
    }

    const { name, email, password, firmName, role } = await req.json();

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const agency = await prisma.agency.findFirst();
    if (!agency) {
      return NextResponse.json({ error: "System not configured — please contact support" }, { status: 500 });
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: toTitleCase(name),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role === "director" ? "director" : "negotiator",
        agencyId: agency.id,
        firmName: firmName?.trim() ? toTitleCase(firmName) : null,
      },
    });

    console.log(`[AUDIT] user_created createdUserId=${user.id} role=${user.role} agencyId=${user.agencyId}`);
    return NextResponse.json({ ok: true, id: user.id }, { status: 201 });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
