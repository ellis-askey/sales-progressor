import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { uploadToStorage } from "@/lib/supabase-storage";
import { randomUUID } from "crypto";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are reading a UK property memo of sale. Extract every detail you can find.
Return ONLY a valid JSON object — no markdown fences, no explanation, nothing else.
Use null for any field you cannot find or are not confident about.

{
  "streetAddress": string | null,
  "city": string | null,
  "postcode": string | null,
  "purchasePricePence": number | null,
  "tenure": "freehold" | "leasehold" | null,
  "vendors": [{ "name": string, "phone": string | null, "email": string | null }],
  "purchasers": [{ "name": string, "phone": string | null, "email": string | null }],
  "vendorSolicitor": { "firm": string | null, "name": string | null, "phone": string | null, "email": string | null } | null,
  "purchaserSolicitor": { "firm": string | null, "name": string | null, "phone": string | null, "email": string | null } | null
}

Notes:
- purchasePricePence: convert the sale price to pence. £325,000 → 32500000
- postcode: always include the space (e.g. "BS6 7TH")
- vendors/purchasers: include up to 2 of each if present
- If a field contains only a role label (e.g. "Vendor") with no actual name, use null
- For solicitors: extract the firm name, the individual solicitor's name, their direct phone, and email if present`;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Please upload a PDF or image (JPG, PNG, WEBP)" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large — please use a file under 10 MB" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const isPDF = file.type === "application/pdf";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileBlock: any = isPDF
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image",    source: { type: "base64", media_type: file.type, data: base64 } };

  try {
    const msg = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: PROMPT }] }],
      },
      isPDF ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : undefined,
    );

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Couldn't extract data from this document — try a clearer scan" }, { status: 422 });
    }

    const data = JSON.parse(match[0]);

    // Store the original file in Supabase so it can be linked to the transaction after creation
    let mosStoragePath: string | null = null;
    try {
      const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] ?? "bin";
      const path = `mos/${session.user.agencyId}/${randomUUID()}.${ext}`;
      mosStoragePath = await uploadToStorage(path, Buffer.from(bytes), file.type);
    } catch {
      // Storage upload is optional — continue without it
    }

    return NextResponse.json({ ...data, mosStoragePath, mosFileSize: file.size, mosMimeType: file.type, mosFilename: file.name });
  } catch (e) {
    console.error("memo-parse error:", e);
    return NextResponse.json({ error: "Something went wrong reading the document" }, { status: 500 });
  }
}
