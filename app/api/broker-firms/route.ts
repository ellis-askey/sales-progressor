export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/broker-firms?q=smith  — typeahead search
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    const firms = await prisma.brokerFirm.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      orderBy: { name: "asc" },
      take: 10,
      select: { id: true, name: true },
    });
    return NextResponse.json(firms);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/broker-firms  — find-or-create firm + optional first handler
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { name, handler } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Firm name required" }, { status: 400 });

  try {
    const existing = await prisma.brokerFirm.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
      include: { handlers: true },
    });

    if (existing) {
      if (handler?.name?.trim()) {
        const existingHandler = existing.handlers.find(
          (h) => h.name.toLowerCase().trim() === handler.name.toLowerCase().trim()
        );
        if (!existingHandler) {
          const newHandler = await prisma.brokerContact.create({
            data: {
              firmId: existing.id,
              name: handler.name.trim(),
              phone: handler.phone?.trim() || null,
              email: handler.email?.trim() || null,
            },
          });
          return NextResponse.json({ ...existing, handlers: [...existing.handlers, newHandler] });
        }
      }
      return NextResponse.json(existing);
    }

    const firm = await prisma.brokerFirm.create({
      data: {
        name: name.trim(),
        ...(handler?.name?.trim()
          ? {
              handlers: {
                create: {
                  name: handler.name.trim(),
                  phone: handler.phone?.trim() || null,
                  email: handler.email?.trim() || null,
                },
              },
            }
          : {}),
      },
      include: { handlers: true },
    });
    return NextResponse.json(firm, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create";
    console.error("[broker-firms POST]", message, { name, handler });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
