// Chase the neighbour agent above/below in a chain.
//
// The agent-initiated counterpart to the automatic outbound neighbour update
// (lib/services/chain-neighbour-updates.ts). Where that PUSHES our progress up
// the chain, this SOLICITS the neighbour's progress: a manual email to the stub
// agent above (onward) or below (related), asking them to confirm the next
// outstanding step on the far-side tracker we keep for their side.
//
// Reuses the same agency-branded sender as the outbound pipeline
// (resolveChainInviteSender) and the same phrasing building blocks as the
// client/solicitor chase (lib/chase/guidance.ts) — but touches NONE of the
// ChaseTask / Contact / client-solicitor machinery. Recipient is a ChainLink
// stub, not a Contact. Scope is guarded by the caller (app/actions/neighbour-chase.ts).
//
// Spec: docs/active/chain-agent-chase/00-spec.md Part C.

import { prisma } from "@/lib/prisma";
import { getOnwardTrackerView } from "@/lib/services/onward";
import { resolveChainInviteSender } from "@/lib/chain/invite";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { greetingName } from "@/lib/contacts/displayName";
import {
  TONE_KEY_MAP,
  CHANNEL_GUIDANCE,
  TONE_GUIDANCE,
  AGENT_RECIPIENT_GUIDANCE,
} from "@/lib/chase/guidance";

// "onward" = chase the agent ABOVE (the onward property's agent; far side =
// onward_purchase_seller / VM steps). "related" = chase the agent BELOW (the
// related sale's agent; far side = related_sale_buyer / PM steps).
export type NeighbourChaseDirection = "onward" | "related";

const FAR_KIND: Record<NeighbourChaseDirection, "onward_purchase_seller" | "related_sale_buyer"> = {
  onward: "onward_purchase_seller",
  related: "related_sale_buyer",
};

export type NeighbourChaseTarget = {
  chainLinkId: string;
  chainId: string;
  neighbourAgentName: string | null;
  neighbourAgentEmail: string;
  neighbourAddress: string | null;
  farKind: "onward_purchase_seller" | "related_sale_buyer";
  // The next not-done, unlocked step on the far-side tracker, if the tracker is
  // set up. Null → chase for a general update instead.
  nextStep: { code: string; name: string } | null;
  completeCount: number;
  applicableCount: number;
};

export type ResolveNeighbourResult =
  | { ok: true; target: NeighbourChaseTarget }
  | { ok: false; reason: "no_chain" | "no_neighbour" | "no_email" | "claimed" };

// Resolve the stub neighbour to chase for this file + direction, plus the next
// outstanding far-side step. Scope-agnostic — the caller guards access first.
export async function resolveNeighbourChaseTarget(
  transactionId: string,
  direction: NeighbourChaseDirection,
): Promise<ResolveNeighbourResult> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { chainLinkId: true },
  });
  if (!tx?.chainLinkId) return { ok: false, reason: "no_chain" };

  const ownLink = await prisma.chainLink.findUnique({
    where: { id: tx.chainLinkId },
    select: { chainId: true, position: true, branchKey: true },
  });
  if (!ownLink) return { ok: false, reason: "no_chain" };

  // The neighbour in our OWN ladder: one up (onward) or one down (related).
  const neighbourPos = direction === "onward" ? ownLink.position - 1 : ownLink.position + 1;
  const neighbour = await prisma.chainLink.findFirst({
    where: { chainId: ownLink.chainId, branchKey: ownLink.branchKey ?? "", position: neighbourPos },
    select: {
      id: true,
      chainId: true,
      transactionId: true,
      stubAgentName: true,
      stubAgentEmail: true,
      stubPropertyAddress: true,
    },
  });
  if (!neighbour) return { ok: false, reason: "no_neighbour" };
  // Only stub (not-yet-joined) neighbours: a claimed link is another agency on
  // the platform getting their own reminders, not someone we cold-email.
  if (neighbour.transactionId !== null) return { ok: false, reason: "claimed" };
  if (!neighbour.stubAgentEmail) return { ok: false, reason: "no_email" };

  const view = await getOnwardTrackerView(transactionId, FAR_KIND[direction]);
  const nextStep = view.steps.find((s) => s.isAvailable && !s.isComplete) ?? null;

  return {
    ok: true,
    target: {
      chainLinkId: neighbour.id,
      chainId: neighbour.chainId,
      neighbourAgentName: neighbour.stubAgentName,
      neighbourAgentEmail: neighbour.stubAgentEmail,
      neighbourAddress: neighbour.stubPropertyAddress,
      farKind: FAR_KIND[direction],
      nextStep: nextStep ? { code: nextStep.code, name: nextStep.name } : null,
      completeCount: view.completeCount,
      applicableCount: view.applicableCount,
    },
  };
}

// Agency-branded sender for this file (never "Sales Progressor"), mirroring the
// outbound neighbour-update pipeline.
async function resolveSender(transactionId: string) {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { agencyId: true, agency: { select: { name: true } } },
  });
  const agencyName = tx?.agency?.name ?? "Sales Progressor";
  const sender = await resolveChainInviteSender(transactionId, {
    name: agencyName,
    agencyId: tx?.agencyId ?? null,
    agencyName,
  });
  return { sender, agencyId: tx?.agencyId ?? null };
}

// Strip em/en dashes so one never reaches a recipient (mirrors generate-chase).
function stripDashes(s: string): string {
  return s
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")
    .replace(/\s*[—–]+\s*/g, ", ")
    .replace(/,\s*,\s*/g, ", ");
}

export type NeighbourDraft = {
  subject: string;
  body: string;
  neighbourName: string | null;
  neighbourEmail: string;
  stepName: string | null;
};

export type NeighbourChaseReason = "no_chain" | "no_neighbour" | "no_email" | "claimed";

export type DraftNeighbourResult =
  | { ok: true; draft: NeighbourDraft }
  | { ok: false; reason: NeighbourChaseReason | "ai_unavailable" | "ai_failed" };

// Draft the chase with the AI phrasing engine — agent-to-agent voice, reusing
// the shared tone + channel guidance (email only).
export async function draftNeighbourChase(
  transactionId: string,
  direction: NeighbourChaseDirection,
  tone: string,
): Promise<DraftNeighbourResult> {
  const resolved = await resolveNeighbourChaseTarget(transactionId, direction);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;

  const { sender } = await resolveSender(transactionId);
  const senderFirstName = sender.displayFirstName || "the team";
  const displayAgency = sender.displayAgency;

  const toneKey = TONE_KEY_MAP[tone] ?? "professional";
  const channelGuidance = CHANNEL_GUIDANCE.email.replace(/\{senderFirstName\}/g, senderFirstName);
  const toneGuidance = (TONE_GUIDANCE[toneKey] ?? TONE_GUIDANCE.professional).replace(
    /\{expectedExchangeDate\}/g,
    "the chain's target timeline",
  );

  const whichNeighbour = direction === "onward" ? "above" : "below";
  const recipientName = target.neighbourAgentName ? greetingName(target.neighbourAgentName) : "there";

  const systemPrompt = [
    `You are ${senderFirstName}, an estate agent at ${displayAgency}, writing a short email to a fellow estate agent ${whichNeighbour} you in a residential property chain.`,
    AGENT_RECIPIENT_GUIDANCE,
    channelGuidance,
    toneGuidance,
    `Rules: British English. Never use em dashes or en dashes. No exclamation marks. Do not invent facts about their sale. Sign off as ${senderFirstName} at ${displayAgency}. Output ONLY the email body — no subject line, no preamble, no "Here is the email".`,
  ].join("\n\n");

  const askLine = target.nextStep
    ? `Ask them to confirm whether this step has happened yet on their side: "${target.nextStep.name}".`
    : `Ask them for a general update on where their side of the chain is up to.`;

  const userMessage = [
    `Write the email.`,
    `Recipient: ${recipientName}${target.neighbourAddress ? `, the agent handling ${target.neighbourAddress}` : ""}.`,
    askLine,
    `Keep it brief and collegiate. You are both trying to keep the chain moving.`,
  ].join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "ai_unavailable" };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) {
      console.error("[neighbour-chase] Claude API error:", await res.text());
      return { ok: false, reason: "ai_failed" };
    }
    const data = await res.json();
    const body = stripDashes(data.content?.[0]?.text ?? "").trim();
    const subject = `Quick chain update: ${target.neighbourAddress ?? "your side of the chain"}`;
    return {
      ok: true,
      draft: {
        subject,
        body,
        neighbourName: target.neighbourAgentName,
        neighbourEmail: target.neighbourAgentEmail,
        stepName: target.nextStep?.name ?? null,
      },
    };
  } catch (err) {
    console.error("[neighbour-chase] draft failed", err);
    return { ok: false, reason: "ai_failed" };
  }
}

function bodyToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${paras}</div>`;
}

export type SendNeighbourResult =
  | { ok: true; toEmail: string }
  | { ok: false; reason: "no_chain" | "no_neighbour" | "no_email" | "claimed" | "empty_body" };

// Send the (agent-edited) chase to the neighbour stub agent, agency-branded.
// Logged via AgentEmailLog (kind chain_neighbour_chase, meta.chainLinkId) for the
// audit trail — no ChaseTask, no Contact.
export async function sendNeighbourChase(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  subject: string;
  body: string;
  userId: string;
}): Promise<SendNeighbourResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "empty_body" };

  const resolved = await resolveNeighbourChaseTarget(input.transactionId, input.direction);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;

  const { sender, agencyId } = await resolveSender(input.transactionId);
  const subject = input.subject.trim() || `Quick chain update: ${target.neighbourAddress ?? "the chain"}`;

  await sendAgentEmail({
    to: target.neighbourAgentEmail,
    subject,
    text: body,
    html: bodyToHtml(body),
    from: sender.from,
    replyTo: sender.replyTo,
    kind: "chain_neighbour_chase",
    userId: input.userId,
    agencyId,
    transactionId: input.transactionId,
    meta: {
      chainLinkId: target.chainLinkId,
      direction: input.direction,
      originatorAgency: sender.displayAgency,
    },
  });

  return { ok: true, toEmail: target.neighbourAgentEmail };
}
