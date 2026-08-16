import { NextRequest, NextResponse } from "next/server";
import { getPortalVCardData, type PortalVCard } from "@/lib/services/portal";

// Escape a value for a vCard field (RFC 6350 §3.4): backslash, comma,
// semicolon and newlines.
function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildVCard(card: PortalVCard) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(card.fn)};;;;`, `FN:${esc(card.fn)}`];
  if (card.org) lines.push(`ORG:${esc(card.org)}`);
  if (card.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(card.email)}`);
  if (card.tel) lines.push(`TEL;TYPE=CELL,VOICE:${esc(card.tel)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const who = req.nextUrl.searchParams.get("who") === "solicitor" ? "solicitor" : "progressor";

  const data = await getPortalVCardData(token);
  const card = who === "solicitor" ? data.solicitor : data.progressor;
  if (!card) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(buildVCard(card), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${who}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
