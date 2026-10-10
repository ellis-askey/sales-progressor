import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, canReadTransaction } from "@/lib/security/access-scope";
import { checkAiLimit, rateLimitJson } from "@/lib/ratelimit";
import { callClaude } from "@/lib/anthropic";
import { getUpdateVoiceProfile, maybeRefreshUpdateVoiceProfile } from "@/lib/chase/update-voice-profile";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { getEnquiryTrackerView } from "@/lib/enquiries/tracker";
import { buildMilestonePlan, type MilestoneRowLite, type VoicePlan } from "@/lib/voice-update/plan";

export const dynamic = "force-dynamic";

// Turns an agent's voice/typed note into a reviewable plan: which steps it
// implies are done (expanded to their incomplete prerequisites), any enquiry
// hand-over, any to-dos, and per-side client drafts. Nothing is applied here —
// the agent approves on the review screen (applyVoiceUpdateAction).

const SYSTEM = `You help a UK estate agent turn a quick spoken note about a property sale into structured updates. You are given the note, the steps still outstanding on this file (with codes), who the seller and buyer are, and which solicitor currently holds the enquiries.

Return ONLY strict JSON, no prose, with this exact shape:
{
  "milestones": string[],   // codes from the provided list that the note says have now HAPPENED/are done. [] if none.
  "enquiry": "to_seller" | "to_buyer" | null,  // set if the note says enquiries were sent to a side. to_seller = questions raised to the seller's solicitor; to_buyer = replies sent back to the buyer's solicitor. null otherwise.
  "todos": [{ "title": string, "dueDate": string | null }],  // follow-ups the agent should be reminded of. dueDate as YYYY-MM-DD using the provided today's date, or null. [] if none.
  "sellerMessage": string,  // a short portal update for the seller, in the agent's voice. "" if there is a seller and nothing to say, or if there is no seller.
  "buyerMessage": string,   // same for the buyer. "" if nothing to say / no buyer.
  "internalNote": string    // one blunt factual line for the file. "" if nothing.
}

Rules for the client messages: do not open with a greeting or a name; no exclamation marks; no em-dashes; say "we'll" not "the system"; never reveal the other side's private business; only state what the note supports. Only use milestone codes from the list given. Never invent a step that isn't listed.`;

function strip(raw: string): string {
  return raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

export async function POST(req: Request) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const rateLimit = await checkAiLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 30 }));
  if (!rateLimit.success) return NextResponse.json(rateLimitJson(rateLimit), { status: 429 });

  let body: { transactionId?: string; transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";
  const transcript = (typeof body.transcript === "string" ? body.transcript : "").trim().slice(0, 4000);
  if (!transactionId || !transcript) return NextResponse.json({ error: "Nothing to work with." }, { status: 400 });

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      agencyId: true,
      assignedUserId: true,
      agentUserId: true,
      progressionBusinessId: true,
      contacts: { select: { name: true, roleType: true } },
    },
  });
  if (!tx) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!canReadTransaction(scope, tx)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // File state for the plan.
  const [milestones, enquiry] = await Promise.all([
    getMilestonesForTransaction(transactionId, null),
    getEnquiryTrackerView(transactionId).catch(() => null),
  ]);
  const rows: MilestoneRowLite[] = [...milestones.vendor, ...milestones.purchaser].map((d) => ({
    code: d.code,
    name: d.name,
    side: d.side as MilestoneRowLite["side"],
    orderIndex: d.orderIndex,
    eventDateRequired: d.eventDateRequired,
    isComplete: d.isComplete,
    isNotRequired: d.isNotRequired,
  }));
  const outstanding = rows.filter((r) => !r.isComplete && !r.isNotRequired);
  const sellerNames = tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name);
  const buyerNames = tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name);

  const today = new Date();
  const todayStr = `${today.toISOString().slice(0, 10)} (${today.toLocaleDateString("en-GB", { weekday: "long" })})`;

  const userMessage = [
    `Today's date: ${todayStr}`,
    `Seller(s): ${sellerNames.join(", ") || "none on file"}`,
    `Buyer(s): ${buyerNames.join(", ") || "none on file"}`,
    `Enquiries currently with: ${enquiry ? enquiry.currentlyWith : "no enquiries open"}`,
    `Outstanding steps (code: name):`,
    ...outstanding.map((r) => `  ${r.code}: ${r.name}`),
    ``,
    `The agent's note:`,
    transcript,
  ].join("\n");

  const voiceProfile = await getUpdateVoiceProfile(session.user.id).catch(() => null);
  const system = voiceProfile ? `${SYSTEM}\n\n# The agent's own style\n${voiceProfile}\n` : SYSTEM;

  let parsed: {
    milestones?: unknown;
    enquiry?: unknown;
    todos?: unknown;
    sellerMessage?: unknown;
    buyerMessage?: unknown;
    internalNote?: unknown;
  };
  try {
    const raw = await callClaude(system, userMessage, 900);
    parsed = JSON.parse(strip(raw));
  } catch {
    return NextResponse.json({ error: "Couldn't make sense of that. Try again." }, { status: 502 });
  }

  const detected = Array.isArray(parsed.milestones) ? parsed.milestones.filter((x): x is string => typeof x === "string") : [];
  const planMilestones = buildMilestonePlan(detected, rows);

  const enquiryOut: VoicePlan["enquiry"] =
    parsed.enquiry === "to_seller"
      ? { flipsCourtTo: "seller_solicitor", label: "Move enquiries to the seller's solicitor" }
      : parsed.enquiry === "to_buyer"
        ? { flipsCourtTo: "buyer_solicitor", label: "Move enquiries to the buyer's solicitor" }
        : null;

  const todos = Array.isArray(parsed.todos)
    ? parsed.todos
        .filter((t): t is { title: string; dueDate?: unknown } => !!t && typeof (t as { title?: unknown }).title === "string")
        .map((t) => ({ title: String(t.title).slice(0, 160), dueDate: typeof t.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : null }))
        .slice(0, 5)
    : [];

  const plan: VoicePlan = {
    milestones: planMilestones,
    enquiry: enquiryOut,
    todos,
    drafts: {
      sellerMessage: sellerNames.length && typeof parsed.sellerMessage === "string" ? parsed.sellerMessage.trim() : "",
      buyerMessage: buyerNames.length && typeof parsed.buyerMessage === "string" ? parsed.buyerMessage.trim() : "",
      internalNote: typeof parsed.internalNote === "string" ? parsed.internalNote.trim() : "",
    },
    transcript,
  };

  after(() => maybeRefreshUpdateVoiceProfile(session.user.id).catch(() => {}));
  return NextResponse.json({ plan });
}
