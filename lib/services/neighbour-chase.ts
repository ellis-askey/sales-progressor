// Chase the neighbour agent above/below in a chain.
//
// The agent-initiated counterpart to the automatic outbound neighbour update
// (lib/services/chain-neighbour-updates.ts). Where that PUSHES our progress up
// the chain, this SOLICITS the neighbour's progress: a manual email to the stub
// agent above (onward) or below (related), asking them to confirm the next
// outstanding step on the far-side tracker we keep for their side.
//
// Reuses the same phrasing building blocks as the client/solicitor chase
// (lib/chase/guidance.ts) AND the same sender + signature resolvers, so it
// presents identically to any other chase (branded from the sending agent, with
// their signature) — but touches NONE of the ChaseTask / Contact machinery. The
// recipient is a ChainLink stub, not a Contact. Scope is guarded by the caller
// (app/actions/neighbour-chase.ts).
//
// Spec: docs/active/chain-agent-chase/00-spec.md Part C.

import { prisma } from "@/lib/prisma";
import { getOnwardTrackerView } from "@/lib/services/onward";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveSenderForTransaction } from "@/lib/email";
import { resolveEmailSignature } from "@/lib/email/signature";
import { sanitizeSignatureHtml } from "@/lib/email/sanitize-signature";
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

// A resend within this window is blocked unless the caller forces it — a soft
// guard against accidentally chasing the same cold agent twice in a row.
const RESEND_WINDOW_MS = 6 * 60 * 60 * 1000;

// Minimal session-user shape the sender + signature resolvers need.
export type ChaseSender = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  agencyId?: string | null;
};

export type NeighbourChaseTarget = {
  chainLinkId: string;
  chainId: string;
  neighbourAgentName: string | null;
  neighbourAgentEmail: string;
  neighbourAddress: string | null;
  farKind: "onward_purchase_seller" | "related_sale_buyer";
  // The next not-done, unlocked step on the far-side tracker, if set up. Null →
  // chase for a general update instead.
  nextStep: { code: string; name: string } | null;
  completeCount: number;
  applicableCount: number;
  // When this neighbour was last chased (for the "chased X ago" hint + dedup).
  lastChasedAt: Date | null;
};

export type NeighbourChaseReason = "no_chain" | "no_neighbour" | "no_email" | "claimed";

export type ResolveNeighbourResult =
  | { ok: true; target: NeighbourChaseTarget }
  | { ok: false; reason: NeighbourChaseReason };

type NeighbourStubLink = {
  id: string;
  chainId: string;
  transactionId: string | null;
  stubAgentName: string | null;
  stubAgentEmail: string | null;
  stubPropertyAddress: string | null;
  lastAgentChasedAt: Date | null;
};

type FindStubResult =
  | { ok: true; link: NeighbourStubLink }
  | { ok: false; reason: "no_chain" | "no_neighbour" | "claimed" };

// Find the unclaimed stub neighbour one up (onward) / one down (related) in our
// own ladder. Shared by the chase resolver (needs the email) and the "add the
// agent's details" setter (needs the link, email absent). Scope-agnostic.
async function findNeighbourStubLink(
  transactionId: string,
  direction: NeighbourChaseDirection,
): Promise<FindStubResult> {
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
      lastAgentChasedAt: true,
    },
  });
  if (!neighbour) return { ok: false, reason: "no_neighbour" };
  // Only stub (not-yet-joined) neighbours: a claimed link is another agency on
  // the platform getting their own reminders, not someone we cold-email.
  if (neighbour.transactionId !== null) return { ok: false, reason: "claimed" };
  return { ok: true, link: neighbour };
}

// Resolve the stub neighbour to chase for this file + direction, plus the next
// outstanding far-side step. Scope-agnostic — the caller guards access first.
export async function resolveNeighbourChaseTarget(
  transactionId: string,
  direction: NeighbourChaseDirection,
): Promise<ResolveNeighbourResult> {
  const found = await findNeighbourStubLink(transactionId, direction);
  if (!found.ok) return { ok: false, reason: found.reason };
  const neighbour = found.link;
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
      lastChasedAt: neighbour.lastAgentChasedAt,
    },
  };
}

export type SetNeighbourAgentResult =
  | { ok: true; neighbourAddress: string | null }
  | { ok: false; reason: "no_chain" | "no_neighbour" | "claimed" | "invalid_email" };

// Save the neighbour agent's name + email onto the chain stub above/below, so a
// chase can go out and the details are remembered next time. Used by the inline
// "add the agent's details" entry when we don't have their email yet.
export async function setNeighbourAgent(
  transactionId: string,
  direction: NeighbourChaseDirection,
  name: string,
  email: string,
): Promise<SetNeighbourAgentResult> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail.includes("@")) return { ok: false, reason: "invalid_email" };
  const found = await findNeighbourStubLink(transactionId, direction);
  if (!found.ok) return { ok: false, reason: found.reason };
  await prisma.chainLink.update({
    where: { id: found.link.id },
    data: { stubAgentName: name.trim() || found.link.stubAgentName, stubAgentEmail: cleanEmail },
  });
  return { ok: true, neighbourAddress: found.link.stubPropertyAddress };
}

export type NeighbourChaseContext = {
  neighbourName: string | null;
  neighbourEmail: string;
  neighbourAddress: string | null;
  stepName: string | null;
  lastChasedAt: Date | null;
  ccCandidate: { name: string; email: string } | null;
};

export type NeighbourContextResult =
  | { ok: true; context: NeighbourChaseContext }
  | { ok: false; reason: NeighbourChaseReason };

// Everything the drawer needs to SHOW (recipient, next step, cc option, last
// chased) WITHOUT calling the AI — so it loads on open and only writes the draft
// when the agent clicks Generate (matching the real chase drawer). stepName
// overrides the auto next-step for a per-step chase.
export async function getNeighbourChaseContext(
  transactionId: string,
  direction: NeighbourChaseDirection,
  stepName?: string | null,
): Promise<NeighbourContextResult> {
  const resolved = await resolveNeighbourChaseTarget(transactionId, direction);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;
  const ccCandidate = await resolveCcClient(transactionId, direction);
  return {
    ok: true,
    context: {
      neighbourName: target.neighbourAgentName,
      neighbourEmail: target.neighbourAgentEmail,
      neighbourAddress: target.neighbourAddress,
      stepName: stepName ?? target.nextStep?.name ?? null,
      lastChasedAt: target.lastChasedAt,
      ccCandidate,
    },
  };
}

// Strip em/en dashes so one never reaches a recipient (mirrors generate-chase).
function stripDashes(s: string): string {
  return s
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")
    .replace(/\s*[—–]+\s*/g, ", ")
    .replace(/,\s*,\s*/g, ", ");
}

async function agencyBrand(transactionId: string): Promise<string> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { agency: { select: { name: true } } },
  });
  return tx?.agency?.name ?? "Sales Progressor";
}

// Our own client on this file who has a stake in this far-side chase — the
// seller (onward) or buyer (related). Offered as an optional CC so the agent can
// keep their own client in the loop. Principal contacts only (never a helper),
// and only when we have an email for them.
async function resolveCcClient(
  transactionId: string,
  direction: NeighbourChaseDirection,
): Promise<{ name: string; email: string } | null> {
  const roleType = direction === "onward" ? "vendor" : "purchaser";
  const contact = await prisma.contact.findFirst({
    where: { propertyTransactionId: transactionId, roleType, isPrincipal: { not: false }, email: { not: null } },
    select: { name: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!contact?.email) return null;
  return { name: contact.name, email: contact.email };
}

export type NeighbourDraft = {
  subject: string;
  body: string;
  neighbourName: string | null;
  neighbourEmail: string;
  stepName: string | null;
  lastChasedAt: Date | null;
  // The client we could CC (seller/buyer on this file), or null if none has an
  // email. The drawer shows a default-off "CC {name}" toggle when present.
  ccCandidate: { name: string; email: string } | null;
};

export type DraftNeighbourResult =
  | { ok: true; draft: NeighbourDraft }
  | { ok: false; reason: NeighbourChaseReason | "ai_unavailable" | "ai_failed" };

// Draft the chase with the AI phrasing engine — agent-to-agent voice, reusing the
// shared tone + channel guidance (email only). Signs off as the sending agent so
// it matches the appended signature.
export async function draftNeighbourChase(
  transactionId: string,
  direction: NeighbourChaseDirection,
  tone: string,
  senderFirstName: string,
  // Optional: chase about a SPECIFIC far-side step (per-step chase). Falls back
  // to the tracker's next outstanding step when omitted.
  stepName?: string | null,
): Promise<DraftNeighbourResult> {
  const resolved = await resolveNeighbourChaseTarget(transactionId, direction);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;

  const ccCandidate = await resolveCcClient(transactionId, direction);
  const displayAgency = await agencyBrand(transactionId);

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
    `Rules: British English. Never use em dashes or en dashes. No exclamation marks. Do not invent facts about their sale. Sign off simply as ${senderFirstName} (a full signature is added after your sign-off, so do not add contact details). Output ONLY the email body, with no subject line, no preamble, and no "Here is the email".`,
  ].join("\n\n");

  const askStepName = stepName ?? target.nextStep?.name ?? null;
  const askLine = askStepName
    ? `Ask them to confirm whether this step has happened yet on their side: "${askStepName}".`
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
    const subject = `Quick update on ${target.neighbourAddress ?? "your side of the chain"}?`;
    return {
      ok: true,
      draft: {
        subject,
        body,
        neighbourName: target.neighbourAgentName,
        neighbourEmail: target.neighbourAgentEmail,
        stepName: askStepName,
        lastChasedAt: target.lastChasedAt,
        ccCandidate,
      },
    };
  } catch (err) {
    console.error("[neighbour-chase] draft failed", err);
    return { ok: false, reason: "ai_failed" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Wrap the (rich) body + resolved signature in the same shell the client/solicitor
// chase uses, so a neighbour chase looks identical to any other chase.
function wrapEmailHtml(bodyHtml: string, signatureHtml: string): string {
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6;">${bodyHtml}${signatureHtml}</div>`;
}

export type SendNeighbourResult =
  | { ok: true; toEmail: string }
  | { ok: false; reason: NeighbourChaseReason | "empty_body" | "recently_chased"; lastChasedAt?: Date | null };

// Send the (agent-edited) chase to the neighbour stub agent. Branded from the
// sending agent with their signature (resolveSenderForTransaction +
// resolveEmailSignature — same as any chase). Logged via AgentEmailLog (kind
// chain_neighbour_chase, meta.chainLinkId) and stamps lastAgentChasedAt for the
// hint + dedup. A resend inside RESEND_WINDOW_MS needs force = true.
export async function sendNeighbourChase(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  user: ChaseSender;
  force?: boolean;
  // Opt-in: also CC our own client (seller/buyer). Resolved server-side, never
  // trusted from the client, so the agent can't CC an arbitrary address.
  includeCc?: boolean;
}): Promise<SendNeighbourResult> {
  const bodyText = input.bodyText.trim();
  if (!bodyText) return { ok: false, reason: "empty_body" };

  const resolved = await resolveNeighbourChaseTarget(input.transactionId, input.direction);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;

  const ccClient = input.includeCc ? await resolveCcClient(input.transactionId, input.direction) : null;

  // Dedup guard: block a repeat within the window unless explicitly forced.
  if (
    !input.force &&
    target.lastChasedAt &&
    Date.now() - new Date(target.lastChasedAt).getTime() < RESEND_WINDOW_MS
  ) {
    return { ok: false, reason: "recently_chased", lastChasedAt: target.lastChasedAt };
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: {
      agencyId: true,
      agency: { select: { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } },
    },
  });

  const { from, replyTo } = await resolveSenderForTransaction(input.transactionId, {
    id: input.user.id,
    email: input.user.email,
    name: input.user.name,
    role: input.user.role ?? "",
    agencyId: input.user.agencyId,
  });

  const sig = await resolveEmailSignature({
    userId: input.user.id,
    agency: tx?.agency ?? null,
    fallbackName: input.user.name,
  });

  const renderedBody = input.bodyHtml.trim()
    ? sanitizeSignatureHtml(input.bodyHtml)
    : escapeHtml(bodyText).replace(/\r?\n/g, "<br>");
  const html = wrapEmailHtml(renderedBody, sig.html);
  const subject = input.subject.trim() || `Quick update on ${target.neighbourAddress ?? "the chain"}?`;

  await sendAgentEmail({
    to: target.neighbourAgentEmail,
    subject,
    text: bodyText + sig.text,
    html,
    from,
    replyTo,
    cc: ccClient ? [ccClient.email] : undefined,
    kind: "chain_neighbour_chase",
    userId: input.user.id,
    agencyId: tx?.agencyId ?? null,
    transactionId: input.transactionId,
    meta: { chainLinkId: target.chainLinkId, direction: input.direction, ccClient: ccClient ? true : undefined },
  });

  await prisma.chainLink
    .update({ where: { id: target.chainLinkId }, data: { lastAgentChasedAt: new Date() } })
    .catch(() => {}); // stamp is best-effort; the send already succeeded

  return { ok: true, toEmail: target.neighbourAgentEmail };
}

// "Open in my email" handoff: the agent will send from their own mail client, so
// we DON'T send — we just record it as chased (AgentEmailLog + stamp
// lastAgentChasedAt) and hand the recipient/subject/body back for the mailto. Same
// dedup guard as the real send. Mirrors the ChaseDrawer "Open in my email" path,
// which logs on faith and opens the agent's inbox.
export async function logNeighbourChaseHandoff(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  subject: string;
  bodyText: string;
  user: ChaseSender;
  force?: boolean;
}): Promise<SendNeighbourResult> {
  const bodyText = input.bodyText.trim();
  if (!bodyText) return { ok: false, reason: "empty_body" };

  const resolved = await resolveNeighbourChaseTarget(input.transactionId, input.direction);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;

  if (
    !input.force &&
    target.lastChasedAt &&
    Date.now() - new Date(target.lastChasedAt).getTime() < RESEND_WINDOW_MS
  ) {
    return { ok: false, reason: "recently_chased", lastChasedAt: target.lastChasedAt };
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { agencyId: true },
  });
  const subject = input.subject.trim() || `Quick update on ${target.neighbourAddress ?? "the chain"}?`;

  // Log it as chased (handed to the agent's own email), without app-sending.
  await prisma.agentEmailLog
    .create({
      data: {
        toEmail: target.neighbourAgentEmail,
        userId: input.user.id,
        agencyId: tx?.agencyId ?? null,
        transactionId: input.transactionId,
        kind: "chain_neighbour_chase",
        subject,
        text: bodyText,
        html: null,
        meta: { chainLinkId: target.chainLinkId, direction: input.direction, viaOwnEmail: true },
      },
    })
    .catch(() => {}); // logging is best-effort; the stamp below is what gates dedup

  await prisma.chainLink
    .update({ where: { id: target.chainLinkId }, data: { lastAgentChasedAt: new Date() } })
    .catch(() => {});

  return { ok: true, toEmail: target.neighbourAgentEmail };
}
