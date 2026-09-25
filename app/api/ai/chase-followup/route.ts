import { NextRequest, NextResponse, after } from "next/server";
import { requireSession } from "@/lib/session";
import { getUpdateVoiceProfile, maybeRefreshUpdateVoiceProfile } from "@/lib/chase/update-voice-profile";
import { getAccessScope, canReadTransaction } from "@/lib/security/access-scope";
import { checkAiLimit, rateLimitJson } from "@/lib/ratelimit";
import { callClaude } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { getMilestoneContext } from "@/lib/chase/milestone-glossary";
import { exchangeTalkAllowed } from "@/lib/chase/exchange-stage";

// After a chase is sent from the drawer, this writes the "keep the others in the
// loop" updates, grounded in the chase that just went out. It resolves who is now
// out of the loop (the same-side client, if they weren't the recipient and
// weren't CC'd) and the opposite-side client (always waiting), then drafts a warm
// client update for each side that has someone to tell. Unlike the free-form
// "Draft for everyone" route, this one IS tied to a milestone, so it may anchor to
// the step. The typed/sent chase is still the source of what happened.
//
// See docs/active/keep-other-side-posted/00-spec.md (steps 2 + 3, §11).

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You help a UK estate-agency sales progressor keep a client in the loop right after the progressor has chased someone on that client's transaction.

You are told who was chased, the step being chased, and the exact message that was just sent to them. From that, write a short, warm update for a client about their own side of the sale, reassuring them this is being handled.

Return STRICT JSON only, no other text, no markdown fences, containing ONLY the keys you are asked for:
{"sameSide": "...", "oppositeSide": "..."}

Each update:
- Do NOT open with a greeting or the person's name. Start straight into the update.
- Plain English, warm, no jargon, no property-industry codes. Two or three short sentences.
- Ground it in what was actually chased. Because this IS tied to that step, you may name the step. Do not invent any status, date or promise beyond "we have asked for this and will update you as soon as it is done".
- Where a party is referred to in general terms, use the real name given under "Known parties".
- Get who-does-what right: describe the real action holder correctly (for example the seller completes and returns their own property information forms, and their solicitor sends them on; a solicitor does not fill them in).
- Who we are: you write for the estate agent progressing the sale, not a solicitor or law firm. The legal work and the paperwork sit with the solicitors. Never say a document or form comes back "to us" or "lands with us"; the paperwork passes between the solicitors. We chase and coordinate, we do not receive the legal documents.
- Confidentiality: you may say we are chasing the other side for something, but never air the other side's private business, delays, internal frustration, prices, or anything not tied to this step.

sameSide: for the client on the SAME side we chased, reassuring them we are pushing their own side, or their own solicitor, on their behalf.
oppositeSide: for the client on the OTHER side, who is waiting on this, reassuring them the other side is being chased and they will hear as soon as it lands.

Only include the keys you are explicitly asked to write.

Voice rules (must follow): no dashes as punctuation anywhere (use commas or full stops); no exclamation marks; never say "the system", "the platform" or "automatically" (say "we"); no titles (Mr/Mrs/Dr); do not use the word "delete" (use "remove").`;

type Target = { id: string; name: string };

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const rate = await checkAiLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 30 }));
  if (!rate.success) return NextResponse.json(rateLimitJson(rate), { status: 429 });

  const body = await req.json().catch(() => null);
  const chaseTaskIds: string[] = Array.isArray(body?.chaseTaskIds)
    ? body.chaseTaskIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const sentText: string = (body?.sentText ?? "").toString().trim();
  const chasedRole: string = (body?.chasedRole ?? "").toString();
  const chasedSide: "vendor" | "purchaser" = body?.chasedSide === "purchaser" ? "purchaser" : "vendor";
  const recipientContactId: string | null = typeof body?.recipientContactId === "string" ? body.recipientContactId : null;
  const sameSideCcd: boolean = body?.sameSideCcd === true;

  if (!chaseTaskIds.length || !sentText) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (sentText.length > 4000) return NextResponse.json({ error: "That message is too long." }, { status: 400 });

  const tasks = await prisma.chaseTask.findMany({
    where: { id: { in: chaseTaskIds } },
    select: {
      transactionId: true,
      reminderLog: {
        select: {
          reminderRule: {
            select: {
              name: true,
              targetMilestoneCode: true,
              anchorMilestone: { select: { code: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!tasks.length) return NextResponse.json({ error: "Chase not found" }, { status: 404 });
  const transactionId = tasks[0].transactionId;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true, agencyId: true, assignedUserId: true, agentUserId: true, serviceType: true,
      propertyAddress: true, tenure: true, purchaseType: true, bookedSurveyorName: true,
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      brokerFirm: { select: { name: true } },
      contacts: { select: { id: true, name: true, roleType: true, email: true, phone: true } },
    },
  });
  if (!tx) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!canReadTransaction(scope, tx)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Resolve who is now out of the loop, from the file's real contacts (not the
  // drawer's side-scoped list, which may not hold the opposite side).
  const oppositeSide = chasedSide === "vendor" ? "purchaser" : "vendor";
  const clientRoleFor = (s: "vendor" | "purchaser") => (s === "vendor" ? "vendor" : "purchaser");
  const reachable = (c: { email: string | null; phone: string | null }) => !!(c.email || c.phone);

  const sameSideClients = tx.contacts.filter((c) => c.roleType === clientRoleFor(chasedSide) && reachable(c));
  const oppositeClients = tx.contacts.filter((c) => c.roleType === clientRoleFor(oppositeSide) && reachable(c));

  const sameSideTargets: Target[] = sameSideCcd
    ? []
    : sameSideClients.filter((c) => c.id !== recipientContactId).map((c) => ({ id: c.id, name: c.name }));
  const oppositeTargets: Target[] = oppositeClients.map((c) => ({ id: c.id, name: c.name }));

  const wantSameSide = sameSideTargets.length > 0;
  const wantOpposite = oppositeTargets.length > 0;
  if (!wantSameSide && !wantOpposite) {
    return NextResponse.json({ sameSide: null, opposite: null });
  }

  // Step names + glossary background, so the update names the step accurately.
  const codes = Array.from(
    new Set(
      tasks
        .map((t) => t.reminderLog.reminderRule.targetMilestoneCode ?? t.reminderLog.reminderRule.anchorMilestone?.code)
        .filter((c): c is string => !!c),
    ),
  );
  const defs = codes.length
    ? await prisma.milestoneDefinition.findMany({ where: { code: { in: codes } }, select: { code: true, name: true } })
    : [];
  const exchangeAllowed = exchangeTalkAllowed(codes);
  // Exchange-readiness (critique #24): even when exchange talk is allowed, never
  // imply we are ready to exchange until BOTH sides have confirmed readiness
  // (VM18 seller gate + PM25 buyer gate).
  const exGates = await prisma.milestoneCompletion.findMany({
    where: { transactionId, milestoneDefinition: { code: { in: ["VM18", "PM25"] } } },
    select: { state: true, milestoneDefinition: { select: { code: true } } },
  });
  const bothReadyToExchange = ["VM18", "PM25"].every((c) =>
    exGates.some((g) => g.milestoneDefinition?.code === c && g.state === "complete"),
  );
  const nameByCode = new Map(defs.map((d) => [d.code, d.name]));
  const steps = Array.from(
    new Set(
      tasks.map((t) => {
        const rule = t.reminderLog.reminderRule;
        const code = rule.targetMilestoneCode ?? rule.anchorMilestone?.code ?? null;
        const name = (code ? nameByCode.get(code) : null) ?? rule.anchorMilestone?.name ?? rule.name;
        const ctx = code ? getMilestoneContext(code) : null;
        return `- ${name}${ctx ? `: ${ctx.tracks}` : ""}${ctx?.howToRefer ? ` (refer to it as: ${ctx.howToRefer})` : ""}`;
      }),
    ),
  );

  const sideWord = chasedSide === "vendor" ? "seller" : "buyer";
  const oppWord = chasedSide === "vendor" ? "buyer" : "seller";
  let recipientLabel: string;
  if (chasedRole === "solicitor") {
    const firm = chasedSide === "vendor" ? tx.vendorSolicitorFirm?.name : tx.purchaserSolicitorFirm?.name;
    recipientLabel = `the ${sideWord}'s solicitor${firm ? ` (${firm})` : ""}`;
  } else if (chasedRole === "broker") {
    recipientLabel = `the mortgage broker${tx.brokerFirm?.name ? ` (${tx.brokerFirm.name})` : ""}`;
  } else {
    recipientLabel = `the ${sideWord}`;
  }

  const knownParties = [
    tx.vendorSolicitorFirm?.name ? `- Seller's solicitor firm: ${tx.vendorSolicitorFirm.name}` : null,
    tx.purchaserSolicitorFirm?.name ? `- Buyer's solicitor firm: ${tx.purchaserSolicitorFirm.name}` : null,
    tx.brokerFirm?.name ? `- Mortgage broker: ${tx.brokerFirm.name}` : null,
    tx.bookedSurveyorName ? `- Surveyor: ${tx.bookedSurveyorName}` : null,
  ].filter((x): x is string => !!x);

  const wanted = [wantSameSide ? "sameSide" : null, wantOpposite ? "oppositeSide" : null].filter((x): x is string => !!x);
  const shortAddress = tx.propertyAddress.split(",")[0] ?? tx.propertyAddress;
  const attrs = [
    tx.tenure ? `Tenure: ${tx.tenure}` : null,
    tx.purchaseType ? `Purchase type: ${tx.purchaseType}` : null,
  ].filter((x): x is string => !!x);

  const userMessage = [
    `Property (street only): ${shortAddress}`,
    ...(attrs.length ? [attrs.join("\n")] : []),
    `Who we just chased: ${recipientLabel}`,
    ``,
    `The step(s) we chased them about:`,
    steps.join("\n"),
    ...(knownParties.length
      ? [``, `Known parties on this sale (use the real name where the update refers to them):`, knownParties.join("\n")]
      : []),
    ``,
    `The exact message we just sent them:`,
    `"""`,
    sentText,
    `"""`,
    ``,
    ...(exchangeAllowed
      ? (bothReadyToExchange
          ? []
          : [`The sale is NOT ready to exchange, and exchange is still several steps away even once enquiries are satisfied (the buyer's solicitor's final report, contracts issued, signed and returned, the deposit transferred, and a completion date agreed all come first). Never state or imply we are ready to exchange, in a position to exchange or to "move toward exchange", that exchange is imminent, or that it is the next step. If you mention exchange at all, frame it honestly as a later goal the solicitors are still working toward, with more to do first.`, ``])
      : [`This is an early step. Do NOT mention exchange, completion, or moving toward exchange anywhere in the updates. Keep strictly to this step.`, ``]),
    `Write exactly these versions and no others: ${wanted.join(", ")}`,
    `- sameSide is for the ${sideWord}, the side we chased.`,
    `- oppositeSide is for the ${oppWord}, the side waiting on this.`,
  ].join("\n");

  // Learned personal style for this progressor's client updates (shared with
  // the free-form "Draft for everyone" path). Null until they've edited enough.
  const voiceProfile = await getUpdateVoiceProfile(session.user.id).catch(() => null);
  const system = voiceProfile
    ? `${SYSTEM_PROMPT}\n\n# The progressor's own style\n\nThis progressor has an established personal style for client updates, learned from updates they have edited and sent. Match it, as long as it does not conflict with the rules above:\n${voiceProfile}\n`
    : SYSTEM_PROMPT;

  let parsed: { sameSide?: string; oppositeSide?: string };
  try {
    const raw = await callClaude(system, userMessage, 800);
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(jsonText);
  } catch {
    return NextResponse.json({ error: "Couldn't draft the updates. Try again." }, { status: 502 });
  }

  after(() => maybeRefreshUpdateVoiceProfile(session.user.id).catch(() => {}));

  return NextResponse.json({
    sameSide: wantSameSide ? { text: (parsed.sameSide ?? "").toString().trim(), targets: sameSideTargets } : null,
    opposite: wantOpposite ? { text: (parsed.oppositeSide ?? "").toString().trim(), targets: oppositeTargets } : null,
  });
}
