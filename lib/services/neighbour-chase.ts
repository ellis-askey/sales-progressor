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
import { sanitizeChaseBodyHtml } from "@/lib/email/sanitize-signature";
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
  ccCandidates: { name: string; email: string }[];
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
  const ccCandidates = await resolveCcClients(transactionId, direction);
  return {
    ok: true,
    context: {
      neighbourName: target.neighbourAgentName,
      neighbourEmail: target.neighbourAgentEmail,
      neighbourAddress: target.neighbourAddress,
      stepName: stepName ?? target.nextStep?.name ?? null,
      lastChasedAt: target.lastChasedAt,
      ccCandidates,
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

// Call the Haiku drafting model with a prepared system + user prompt. Returns the
// cleaned (dash-stripped) body, or a reason when the key is absent / the call
// fails. Shared by the neighbour chase and the exchange-push link chase (#285).
async function runChaseModel(
  system: string,
  user: string,
): Promise<{ ok: true; body: string } | { ok: false; reason: "ai_unavailable" | "ai_failed" }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "ai_unavailable" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.error("[agent-chase] Claude API error:", await res.text());
      return { ok: false, reason: "ai_failed" };
    }
    const data = await res.json();
    return { ok: true, body: stripDashes(data.content?.[0]?.text ?? "").trim() };
  } catch (err) {
    console.error("[agent-chase] draft failed", err);
    return { ok: false, reason: "ai_failed" };
  }
}

async function agencyBrand(transactionId: string): Promise<string> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { agency: { select: { name: true } } },
  });
  return tx?.agency?.name ?? "Sales Progressor";
}

// Our own clients on this file who have a stake in this far-side chase — the
// seller(s) (onward) or buyer(s) (related). Offered as an optional CC so the
// agent can keep their own clients in the loop. Returns ALL principal contacts
// on that side that have an email (e.g. joint sellers or a buyer couple), so the
// agent can copy everyone in one go — never a helper.
async function resolveCcClients(
  transactionId: string,
  direction: NeighbourChaseDirection,
): Promise<{ name: string; email: string }[]> {
  const roleType = direction === "onward" ? "vendor" : "purchaser";
  const contacts = await prisma.contact.findMany({
    where: { propertyTransactionId: transactionId, roleType, isPrincipal: { not: false }, email: { not: null } },
    select: { name: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  return contacts.flatMap((c) => (c.email ? [{ name: c.name, email: c.email }] : []));
}

export type NeighbourDraft = {
  subject: string;
  body: string;
  neighbourName: string | null;
  neighbourEmail: string;
  stepName: string | null;
  lastChasedAt: Date | null;
  // The clients we could CC (seller(s)/buyer(s) on this file) that have an email.
  // The drawer shows a default-off "CC {names}" toggle when the list is non-empty.
  ccCandidates: { name: string; email: string }[];
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

  const ccCandidates = await resolveCcClients(transactionId, direction);
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

  const result = await runChaseModel(systemPrompt, userMessage);
  if (!result.ok) return { ok: false, reason: result.reason };
  const subject = `Quick update on ${target.neighbourAddress ?? "your side of the chain"}?`;
  return {
    ok: true,
    draft: {
      subject,
      body: result.body,
      neighbourName: target.neighbourAgentName,
      neighbourEmail: target.neighbourAgentEmail,
      stepName: askStepName,
      lastChasedAt: target.lastChasedAt,
      ccCandidates,
    },
  };
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

  const ccClients = input.includeCc ? await resolveCcClients(input.transactionId, input.direction) : [];

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
    ? sanitizeChaseBodyHtml(input.bodyHtml)
    : escapeHtml(bodyText).replace(/\r?\n/g, "<br>");
  // The AI no longer writes a sign-off (shared chase guidance), so the app adds
  // one for BASIC-family signatures — the neighbour drawer has no phrase editor,
  // so it uses the default. Image/custom signatures carry their own valediction.
  const signOffHtml = sig.mode === "BASIC"
    ? `<p style="margin:22px 0 0;font-size:14px;color:#111827;line-height:1.6;">Kind regards,</p>`
    : "";
  const signOffText = sig.mode === "BASIC" ? `\n\nKind regards,` : "";
  const html = wrapEmailHtml(renderedBody + signOffHtml, sig.html);
  const subject = input.subject.trim() || `Quick update on ${target.neighbourAddress ?? "the chain"}?`;

  await sendAgentEmail({
    to: target.neighbourAgentEmail,
    subject,
    text: bodyText + signOffText + sig.text,
    html,
    from,
    replyTo,
    cc: ccClients.length ? ccClients.map((c) => c.email) : undefined,
    kind: "chain_neighbour_chase",
    userId: input.user.id,
    agencyId: tx?.agencyId ?? null,
    transactionId: input.transactionId,
    meta: { chainLinkId: target.chainLinkId, direction: input.direction, ccCount: ccClients.length || undefined },
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

// ─── Exchange-push link chase (critique #285) ─────────────────────────────────
//
// The "Push to exchange" checklist chases a SPECIFIC chain link — any position in
// the chain, CLAIMED (another agency's live file) or an unclaimed stub — to
// confirm that sale is ready to exchange. A different target model to the
// immediate-neighbour chase above (which only cold-emails unclaimed neighbours),
// but the same voice, sender branding, signature and send plumbing. The ask is
// fixed ("are you ready to exchange?"); the subject names both sales.

export type LinkChaseTarget = {
  chainLinkId: string;
  recipientName: string | null;
  recipientEmail: string | null; // claimed → claiming agent's login email; stub → saved stub email
  recipientAddress: string | null;
  isClaimed: boolean;
  // Position sign vs our own link — drives the CC side + the above/below wording.
  direction: NeighbourChaseDirection;
  lastChasedAt: Date | null;
  ourAddress: string | null;
};

export type LinkChaseReason = "no_chain" | "not_in_chain" | "is_self" | "no_email";

export type ResolveLinkResult =
  | { ok: true; target: LinkChaseTarget }
  | { ok: false; reason: LinkChaseReason };

// Resolve the chase target for a specific chain link, from the context of the
// file the push checklist is open on. The link must be in the SAME chain as the
// open file (the caller has already scope-guarded the file). Claimed links resolve
// to the claiming agent's account; stubs to the saved stub agent details.
export async function resolveLinkChaseTarget(
  fileTransactionId: string,
  chainLinkId: string,
): Promise<ResolveLinkResult> {
  const own = await prisma.propertyTransaction.findUnique({
    where: { id: fileTransactionId },
    select: { chainLinkId: true, propertyAddress: true },
  });
  if (!own?.chainLinkId) return { ok: false, reason: "no_chain" };
  const ownLink = await prisma.chainLink.findUnique({
    where: { id: own.chainLinkId },
    select: { chainId: true, position: true },
  });
  if (!ownLink) return { ok: false, reason: "no_chain" };
  if (chainLinkId === own.chainLinkId) return { ok: false, reason: "is_self" };

  const link = await prisma.chainLink.findUnique({
    where: { id: chainLinkId },
    select: {
      id: true,
      chainId: true,
      position: true,
      transactionId: true,
      stubAgentName: true,
      stubAgentEmail: true,
      stubPropertyAddress: true,
      lastAgentChasedAt: true,
      claimedBy: { select: { name: true, email: true } },
      transaction: { select: { propertyAddress: true } },
    },
  });
  if (!link || link.chainId !== ownLink.chainId) return { ok: false, reason: "not_in_chain" };

  const isClaimed = link.transactionId !== null;
  return {
    ok: true,
    target: {
      chainLinkId: link.id,
      recipientName: isClaimed ? (link.claimedBy?.name ?? null) : (link.stubAgentName ?? null),
      recipientEmail: isClaimed ? (link.claimedBy?.email ?? null) : (link.stubAgentEmail ?? null),
      recipientAddress: isClaimed ? (link.transaction?.propertyAddress ?? null) : (link.stubPropertyAddress ?? null),
      isClaimed,
      direction: link.position < ownLink.position ? "onward" : "related",
      lastChasedAt: link.lastAgentChasedAt,
      ourAddress: own.propertyAddress ?? null,
    },
  };
}

// First comma-segment of an address — keeps the two-sided subject readable.
function shortAddr(a: string | null): string | null {
  if (!a) return null;
  const i = a.indexOf(",");
  return (i >= 0 ? a.slice(0, i) : a).trim();
}

function exchangeSubject(ourAddress: string | null, theirAddress: string | null): string {
  const ours = shortAddr(ourAddress);
  const theirs = shortAddr(theirAddress) ?? "your sale";
  return ours ? `${ours} chain: ready to exchange on ${theirs}?` : `Ready to exchange on ${theirs}?`;
}

export type LinkChaseContext = {
  recipientName: string | null;
  recipientEmail: string | null;
  recipientAddress: string | null;
  isClaimed: boolean;
  lastChasedAt: Date | null;
  ccCandidates: { name: string; email: string }[];
};

export type LinkContextResult =
  | { ok: true; context: LinkChaseContext }
  | { ok: false; reason: LinkChaseReason };

// Everything the drawer needs to SHOW on open (recipient, cc option, last chased)
// without calling the AI — matching the neighbour-chase context loader.
export async function getLinkChaseContext(
  fileTransactionId: string,
  chainLinkId: string,
): Promise<LinkContextResult> {
  const resolved = await resolveLinkChaseTarget(fileTransactionId, chainLinkId);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;
  const ccCandidates = await resolveCcClients(fileTransactionId, target.direction);
  return {
    ok: true,
    context: {
      recipientName: target.recipientName,
      recipientEmail: target.recipientEmail,
      recipientAddress: target.recipientAddress,
      isClaimed: target.isClaimed,
      lastChasedAt: target.lastChasedAt,
      ccCandidates,
    },
  };
}

export type LinkDraft = {
  subject: string;
  body: string;
  recipientName: string | null;
  recipientEmail: string | null;
  lastChasedAt: Date | null;
  ccCandidates: { name: string; email: string }[];
};

export type DraftLinkResult =
  | { ok: true; draft: LinkDraft }
  | { ok: false; reason: LinkChaseReason | "ai_unavailable" | "ai_failed" };

// Draft the "are you ready to exchange?" chase for a specific chain link — agent-
// to-agent voice, reusing the shared tone + channel guidance, signed off as the
// sending agent. Our own sale is mentioned as the reason we're coordinating.
export async function draftLinkChase(
  fileTransactionId: string,
  chainLinkId: string,
  tone: string,
  senderFirstName: string,
): Promise<DraftLinkResult> {
  const resolved = await resolveLinkChaseTarget(fileTransactionId, chainLinkId);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;

  const ccCandidates = await resolveCcClients(fileTransactionId, target.direction);
  const displayAgency = await agencyBrand(fileTransactionId);

  const toneKey = TONE_KEY_MAP[tone] ?? "professional";
  const channelGuidance = CHANNEL_GUIDANCE.email.replace(/\{senderFirstName\}/g, senderFirstName);
  const toneGuidance = (TONE_GUIDANCE[toneKey] ?? TONE_GUIDANCE.professional).replace(
    /\{expectedExchangeDate\}/g,
    "the chain's target timeline",
  );

  const whichNeighbour = target.direction === "onward" ? "above" : "below";
  const recipientName = target.recipientName ? greetingName(target.recipientName) : "there";

  const systemPrompt = [
    `You are ${senderFirstName}, an estate agent at ${displayAgency}, writing a short email to a fellow estate agent ${whichNeighbour} you in a residential property chain.`,
    AGENT_RECIPIENT_GUIDANCE,
    channelGuidance,
    toneGuidance,
    `Rules: British English. Never use em dashes or en dashes. No exclamation marks. Do not invent facts about their sale. Sign off simply as ${senderFirstName} (a full signature is added after your sign-off, so do not add contact details). Output ONLY the email body, with no subject line, no preamble, and no "Here is the email".`,
  ].join("\n\n");

  const userMessage = [
    `Write the email.`,
    `Recipient: ${recipientName}${target.recipientAddress ? `, the agent handling ${target.recipientAddress}` : ""}.`,
    `Our sale${target.ourAddress ? ` (${target.ourAddress})` : ""} is ready to exchange, and we're working to get the whole chain to exchange together.`,
    `Ask them to confirm whether their sale is ready to exchange yet: contracts signed, enquiries resolved, and finances or deposit in place. If it isn't, ask what's still outstanding and the likely timescale.`,
    `Keep it brief and collegiate. You are both trying to get the chain to exchange.`,
  ].join("\n");

  const result = await runChaseModel(systemPrompt, userMessage);
  if (!result.ok) return { ok: false, reason: result.reason };
  return {
    ok: true,
    draft: {
      subject: exchangeSubject(target.ourAddress, target.recipientAddress),
      body: result.body,
      recipientName: target.recipientName,
      recipientEmail: target.recipientEmail,
      lastChasedAt: target.lastChasedAt,
      ccCandidates,
    },
  };
}

export type SendLinkResult =
  | { ok: true; toEmail: string }
  | { ok: false; reason: LinkChaseReason | "empty_body" | "recently_chased"; lastChasedAt?: Date | null };

// Send the (agent-edited) exchange-readiness chase to the link's agent. Branded
// from the sending agent with their signature (same plumbing as any chase).
// Logged via AgentEmailLog (kind chain_neighbour_chase, meta.exchangePush) and
// stamps lastAgentChasedAt. A resend inside RESEND_WINDOW_MS needs force = true.
export async function sendLinkChase(input: {
  fileTransactionId: string;
  chainLinkId: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  user: ChaseSender;
  force?: boolean;
  includeCc?: boolean;
}): Promise<SendLinkResult> {
  const bodyText = input.bodyText.trim();
  if (!bodyText) return { ok: false, reason: "empty_body" };

  const resolved = await resolveLinkChaseTarget(input.fileTransactionId, input.chainLinkId);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;
  if (!target.recipientEmail) return { ok: false, reason: "no_email" };

  const ccClients = input.includeCc ? await resolveCcClients(input.fileTransactionId, target.direction) : [];

  if (
    !input.force &&
    target.lastChasedAt &&
    Date.now() - new Date(target.lastChasedAt).getTime() < RESEND_WINDOW_MS
  ) {
    return { ok: false, reason: "recently_chased", lastChasedAt: target.lastChasedAt };
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.fileTransactionId },
    select: {
      agencyId: true,
      agency: { select: { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } },
    },
  });

  const { from, replyTo } = await resolveSenderForTransaction(input.fileTransactionId, {
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
    ? sanitizeChaseBodyHtml(input.bodyHtml)
    : escapeHtml(bodyText).replace(/\r?\n/g, "<br>");
  const signOffHtml = sig.mode === "BASIC"
    ? `<p style="margin:22px 0 0;font-size:14px;color:#111827;line-height:1.6;">Kind regards,</p>`
    : "";
  const signOffText = sig.mode === "BASIC" ? `\n\nKind regards,` : "";
  const html = wrapEmailHtml(renderedBody + signOffHtml, sig.html);
  const subject = input.subject.trim() || exchangeSubject(target.ourAddress, target.recipientAddress);

  await sendAgentEmail({
    to: target.recipientEmail,
    subject,
    text: bodyText + signOffText + sig.text,
    html,
    from,
    replyTo,
    cc: ccClients.length ? ccClients.map((c) => c.email) : undefined,
    kind: "chain_neighbour_chase",
    userId: input.user.id,
    agencyId: tx?.agencyId ?? null,
    transactionId: input.fileTransactionId,
    meta: { chainLinkId: target.chainLinkId, exchangePush: true, claimed: target.isClaimed, ccCount: ccClients.length || undefined },
  });

  await prisma.chainLink
    .update({ where: { id: target.chainLinkId }, data: { lastAgentChasedAt: new Date() } })
    .catch(() => {});

  return { ok: true, toEmail: target.recipientEmail };
}

// "Open in my email" handoff for the link chase — record it as chased (logged,
// not app-sent) and hand the recipient/subject/body back for the mailto.
export async function logLinkChaseHandoff(input: {
  fileTransactionId: string;
  chainLinkId: string;
  subject: string;
  bodyText: string;
  user: ChaseSender;
  force?: boolean;
}): Promise<SendLinkResult> {
  const bodyText = input.bodyText.trim();
  if (!bodyText) return { ok: false, reason: "empty_body" };

  const resolved = await resolveLinkChaseTarget(input.fileTransactionId, input.chainLinkId);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { target } = resolved;
  if (!target.recipientEmail) return { ok: false, reason: "no_email" };

  if (
    !input.force &&
    target.lastChasedAt &&
    Date.now() - new Date(target.lastChasedAt).getTime() < RESEND_WINDOW_MS
  ) {
    return { ok: false, reason: "recently_chased", lastChasedAt: target.lastChasedAt };
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.fileTransactionId },
    select: { agencyId: true },
  });
  const subject = input.subject.trim() || exchangeSubject(target.ourAddress, target.recipientAddress);

  await prisma.agentEmailLog
    .create({
      data: {
        toEmail: target.recipientEmail,
        userId: input.user.id,
        agencyId: tx?.agencyId ?? null,
        transactionId: input.fileTransactionId,
        kind: "chain_neighbour_chase",
        subject,
        text: bodyText,
        html: null,
        meta: { chainLinkId: target.chainLinkId, exchangePush: true, claimed: target.isClaimed, viaOwnEmail: true },
      },
    })
    .catch(() => {});

  await prisma.chainLink
    .update({ where: { id: target.chainLinkId }, data: { lastAgentChasedAt: new Date() } })
    .catch(() => {});

  return { ok: true, toEmail: target.recipientEmail };
}
