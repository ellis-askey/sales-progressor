// GET /api/proposal/pdf — streams the original prospectus to authenticated
// readers only. The file lives OUTSIDE /public (private/proposal/…) so it is
// never served as a static asset or indexed; this route is the only way to it.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getProposalSession } from "@/lib/proposal/auth";
import { recordEvent } from "@/lib/proposal/access";
import { PROPOSAL_PDF_RELATIVE, PROPOSAL_PDF_DOWNLOAD_NAME } from "@/lib/proposal/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getProposalSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const filePath = path.join(process.cwd(), PROPOSAL_PDF_RELATIVE);
  let buf: Buffer;
  try {
    buf = await fs.readFile(filePath);
  } catch {
    return NextResponse.json(
      { error: "The original PDF hasn't been added yet." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  await recordEvent(session.sid, session.inviteId, "pdf_download");

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${PROPOSAL_PDF_DOWNLOAD_NAME}"`,
      "Content-Length": String(buf.length),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
