import { NextRequest, NextResponse, after } from "next/server";
import { requireSession } from "@/lib/session";
import { getUpdateVoiceProfile, maybeRefreshUpdateVoiceProfile } from "@/lib/chase/update-voice-profile";
import { getAccessScope, canReadTransaction } from "@/lib/security/access-scope";
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

const SYSTEM_PROMPT = `You help a UK estate-agency sales progressor turn one fact about a residential property sale into short updates for the people on the sale.

You are given ONE fact the progressor typed, the property address, which client sides are on this sale (seller side, buyer side, or both), and the names of the professional parties on the sale. Produce the versions you are asked for of that same fact. The typed fact is the ONLY source of what happened. You must NOT add any status, step, subject, date or promise that is not in it. If the fact is vague, keep the versions vague, and never invent progress. The single exception: where the fact already refers to a party in general terms (for example "the seller's solicitor", "the surveyor", "the broker"), you MAY name them using the "Known parties" list. Never introduce a party the fact did not mention, and never use the known parties to guess what the update is about.

Return STRICT JSON only, no other text, no markdown fences, containing ONLY the keys you are asked to write:
{"internalNote": "...", "sellerMessage": "...", "buyerMessage": "..."}

internalNote: a short, blunt, factual line for the internal team record. Shorthand and abbreviations are fine. One or two sentences.

sellerMessage: a warm, plain-English update about the same fact, written for the seller about their sale.
buyerMessage: a warm, plain-English update about the same fact, written for the buyer about their purchase.

For every client message (sellerMessage / buyerMessage):
- Do NOT open with a greeting or the person's name. Start straight into the update.
- Reassuring and clear, no jargon, no property-industry codes.
- Write it from that side's point of view. You MAY state factual progress on the other side of the transaction where it is relevant and reassuring (for example telling the seller that the buyer's solicitor has what they need). Never mention the other side's private business, internal frustrations, solicitor names, prices, or anything not in the fact.
- Who we are: you write for the estate agent progressing the sale, not a solicitor or law firm. The legal paperwork sits with the solicitors. Never say a document or form comes back "to us" or "lands with us"; it passes between the solicitors.
- Do not mention exchange or completion unless the fact itself mentions them.
- If nothing is needed from that client, say so briefly.

Only include the message keys you are explicitly asked to write. If a side is not on the sale, omit its key entirely.

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
      tenure: true,
      purchaseType: true,
      bookedSurveyorName: true,
      contacts: { select: { roleType: true } },
      // Named professional parties, so a generic reference in the typed fact
      // ("the seller's solicitor", "the surveyor") can resolve to the real name.
      // Names only; no status is read from these.
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      brokerFirm: { select: { name: true } },
    },
  });
  if (!tx) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!canReadTransaction(scope, tx)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Street only (drop town/postcode). No client first name is sent any more:
  // the client updates are written without a greeting (they open straight into
  // the update), so the model never needs a name.
  const shortAddress = tx.propertyAddress.split(",")[0] ?? tx.propertyAddress;
  const hasSeller = tx.contacts.some((c) => c.roleType === "vendor");
  const hasBuyer = tx.contacts.some((c) => c.roleType === "purchaser");

  // Which client versions to ask for. Always the internal note; a side's message
  // only when that side actually has a client on the file.
  const wanted = [
    "internalNote",
    ...(hasSeller ? ["sellerMessage"] : []),
    ...(hasBuyer ? ["buyerMessage"] : []),
  ];

  const sidesLine = [hasSeller ? "seller" : null, hasBuyer ? "buyer" : null]
    .filter(Boolean)
    .join(" and ") || "none";

  // Light framing attributes — help the wording sound natural. No dates, no
  // price, no stage/milestone (kept out on purpose so the model can't tie the
  // update to a step the progressor didn't mention).
  const attrs = [
    tx.tenure ? `Tenure: ${tx.tenure}` : null,
    tx.purchaseType ? `Purchase type: ${tx.purchaseType}` : null,
  ].filter((x): x is string => !!x);

  // Real names to resolve a generic reference in the fact against.
  const knownParties = [
    tx.vendorSolicitorFirm?.name ? `- Seller's solicitor firm: ${tx.vendorSolicitorFirm.name}` : null,
    tx.purchaserSolicitorFirm?.name ? `- Buyer's solicitor firm: ${tx.purchaserSolicitorFirm.name}` : null,
    tx.brokerFirm?.name ? `- Mortgage broker: ${tx.brokerFirm.name}` : null,
    tx.bookedSurveyorName ? `- Surveyor: ${tx.bookedSurveyorName}` : null,
  ].filter((x): x is string => !!x);

  const userMessage = [
    `Property (street only): ${shortAddress}`,
    `Sides on this sale: ${sidesLine}`,
    ...(attrs.length ? [attrs.join("\n")] : []),
    ...(knownParties.length
      ? [
          ``,
          `Known parties on this sale (use the real name only when the fact already refers to that party; never introduce one the fact did not mention):`,
          knownParties.join("\n"),
        ]
      : []),
    ``,
    `Write exactly these versions and no others: ${wanted.join(", ")}`,
    ``,
    `The fact to re-voice:`,
    fact,
  ].join("\n");

  // Learned personal style for this progressor's client updates (null until
  // they've edited enough). Injected so drafts already sound like them.
  const voiceProfile = await getUpdateVoiceProfile(session.user.id).catch(() => null);
  const system = voiceProfile
    ? `${SYSTEM_PROMPT}\n\n# The progressor's own style\n\nThis progressor has an established personal style for client updates, learned from updates they have edited and sent. Match it, as long as it does not conflict with the rules above:\n${voiceProfile}\n`
    : SYSTEM_PROMPT;

  let generated: { internalNote: string; sellerMessage: string; buyerMessage: string };
  try {
    const raw = await callClaude(system, userMessage, 800);
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText);
    if (typeof parsed?.internalNote !== "string") throw new Error("bad shape");
    // A requested side's message must come back as a string; unrequested sides
    // are simply empty and the UI won't render a card for them.
    if (hasSeller && typeof parsed?.sellerMessage !== "string") throw new Error("bad shape");
    if (hasBuyer && typeof parsed?.buyerMessage !== "string") throw new Error("bad shape");
    generated = {
      internalNote: parsed.internalNote.trim(),
      sellerMessage: hasSeller ? String(parsed.sellerMessage).trim() : "",
      buyerMessage: hasBuyer ? String(parsed.buyerMessage).trim() : "",
    };
  } catch {
    return NextResponse.json({ error: "Couldn't draft that. Try rephrasing the update." }, { status: 502 });
  }

  // Out-of-band: refresh this progressor's learned update style if they've
  // edited enough new sends. Runs after the response, never slows the draft.
  after(() => maybeRefreshUpdateVoiceProfile(session.user.id).catch(() => {}));

  return NextResponse.json({ generated });
}
