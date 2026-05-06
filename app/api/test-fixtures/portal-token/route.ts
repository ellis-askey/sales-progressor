// Dev-only endpoint — returns a real portal token for Playwright smoke tests.
// Blocked in production.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 })
  }

  const contact = await prisma.contact.findFirst({
    where: { portalToken: { not: null } },
    select: { portalToken: true },
  })

  if (!contact?.portalToken) {
    return NextResponse.json({ error: "No portal token found in DB" }, { status: 404 })
  }

  return NextResponse.json({ token: contact.portalToken })
}
