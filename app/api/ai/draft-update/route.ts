import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAccessScope, canReadTransaction } from "@/lib/security/access-scope";
import { extractFirstName } from "@/lib/contacts/displayName";
import { checkAiLimit, rateLimitJson } from "@/lib/ratelimit";
import { callClaude } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

// "Draft for everyone": the progressor types ONE fact about a sale; Claude
// re-voices it into two versions — a blunt internal file note and a warm,
// client-safe message. It NEVER sends and NEVER invents status: the fact is the
// only source of truth. Same guard pattern as generate-chase (scope + rate
// limit). Confidentiality: the client version must never reference the other
// side's private business or anything not in the fact.

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You help a UK estate-agency sales progressor communicate a single fact about a residential property sale.

You are given ONE fact the progressor typed, plus the property address and the client's first name. Produce TWO re-voiced versions of that same fact. You must NOT add any status, date, promise or detail that is not in the fact — you only re-word what you are given. If the fact is vague, keep the versions vague; never invent progress.

Return STRICT JSON only, no other text, no markdown fences:
{"internalNote": "...", "clientMessage": "..."}

internalNote: a short, blunt, factual line for the internal team record. Shorthand and abbreviations are fine. One or two sentences.

clientMessage: a warm, plain-English message addressed to the client by first name. Reassuring and clear, no jargon, no property-industry codes. It must ONLY convey the fact given — never mention the other side of the chain's private business, internal frustrations, solicitor names, prices, or anything not in the fact. If nothing is needed from the client, say so briefly.

Voice rules (must follow): no dashes as punctuation anywhere (no em dashes, and no spaced hyphens used as dashes; use commas or full stops instead); no exclamation marks; never say "the system", "the platform" or "automatically" (say "we"); no titles (Mr/Mrs/Dr); do not use the word "delete" (use "remove").`;

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const rateLimit = await checkAiLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 30 }));
  if (!rateLimit.success) return NextResponse.json(rateLimitJson(rateLimit), { status: 429 });

  const body = await req.json().catch(() => null);
  const transactionId: string | undefined = body?.transactionId;
  const fact: string = (body?.fact ?? "").toString().trim();
  if (!transactionId || !fact) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (fact.length > 1200) return NextResponse.json({ error: "That update is too long." }, { status: 400 });

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true, agencyId: true, assignedUserId: true, agentUserId: true, serviceType: true,
      propertyAddress: true,
      contacts: { select: { name: true, roleType: true, isPrincipal: true } },
    },
  });
  if (!tx) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!canReadTransaction(scope, tx)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Street only (drop town/postcode); client first name for a natural greeting.
  const shortAddress = tx.propertyAddress.split(",")[0] ?? tx.propertyAddress;
  const buyers = tx.contacts.filter((c) => c.roleType === "purchaser");
  const sellers = tx.contacts.filter((c) => c.roleType === "vendor");
  const principal = [...buyers, ...sellers].find((c) => c.isPrincipal) ?? buyers[0] ?? sellers[0] ?? null;
  const clientFirstName = principal && principal.name.trim() ? extractFirstName(principal.name) : "there";

  const userMessage = `Property (street only): ${shortAddress}
Client first name: ${clientFirstName}

The fact to re-voice:
${fact}`;

  let generated: { internalNote: string; clientMessage: string };
  try {
    const raw = await callClaude(SYSTEM_PROMPT, userMessage, 700);
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText);
    if (typeof parsed?.internalNote !== "string" || typeof parsed?.clientMessage !== "string") {
      throw new Error("bad shape");
    }
    generated = { internalNote: parsed.internalNote.trim(), clientMessage: parsed.clientMessage.trim() };
  } catch {
    return NextResponse.json({ error: "Couldn't draft that. Try rephrasing the update." }, { status: 502 });
  }

  return NextResponse.json({ generated });
}
