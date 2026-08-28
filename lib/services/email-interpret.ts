import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";
import { VENDOR_SOLICITOR_CODES, PURCHASER_SOLICITOR_CODES, SOLICITOR_STEP_LABELS } from "@/lib/solicitor-confirm/codes";

// Tier 3 stage 2 — read each captured inbound email and, conservatively, turn
// the meaningful ones into a PROPOSAL a human approves. It never acts: it only
// writes MilestoneProposal rows. Emails are stamped aiInterpretedAt so they are
// read once. On approve, the confirm cascade runs (see app/actions/proposals).

const CONFIRMABLE = new Set<string>([...VENDOR_SOLICITOR_CODES, ...PURCHASER_SOLICITOR_CODES]);

const SYSTEM = `You assist a UK estate-agency sales progressor. You read ONE inbound email (from a solicitor, surveyor, or client) about a specific property sale and decide whether it reports that a conveyancing step has just been completed.

You are given the steps that can be confirmed on this file, each as "CODE — label". Choose exactly one outcome:
- "confirm": the email clearly reports that one of the listed steps has NOW happened. Return that step's CODE.
- "note": the email is relevant to the file but does not clearly complete a listed step (a question, a chase, partial progress, a quote).
- "none": the email is not about progressing the sale (auto-reply, out-of-office, spam, pure scheduling, unrelated).

Be conservative. Only "confirm" when the email genuinely reports the step is DONE, not merely mentions it. If unsure between confirm and note, choose note. Only use a CODE from the list.

Return STRICT JSON only, no other text:
{"actionType":"confirm|note|none","milestoneCode":"CODE or empty","summary":"one short sentence on why","confidence":"high|medium|low"}`;

type Interpretation = {
  actionType: "confirm" | "note" | "none";
  milestoneCode: string;
  summary: string;
  confidence: "high" | "medium" | "low";
};

async function interpretOne(m: {
  id: string;
  transactionId: string;
  agencyId: string | null;
  subject: string | null;
  content: string;
  from: string | null;
}): Promise<boolean> {
  // Which confirmable steps are still open on this file (don't propose done ones).
  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: m.transactionId, state: { in: ["complete", "not_required"] } },
    select: { milestoneDefinition: { select: { code: true } } },
  });
  const doneCodes = new Set(completions.map((c) => c.milestoneDefinition.code));
  const openCodes = [...CONFIRMABLE].filter((c) => !doneCodes.has(c));
  if (openCodes.length === 0) return false; // nothing left to confirm

  const stepList = openCodes.map((c) => `${c} — ${SOLICITOR_STEP_LABELS[c] ?? c}`).join("\n");
  const body = (m.content ?? "").slice(0, 1600);
  const userMessage = `Email from: ${m.from ?? "unknown"}
Subject: ${m.subject ?? "(none)"}
Body (may be truncated):
${body}

Steps that can be confirmed on this file (not already done):
${stepList}`;

  let parsed: Interpretation;
  try {
    const raw = await callClaude(SYSTEM, userMessage, 300);
    parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return false;
  }
  if (!parsed || (parsed.actionType !== "confirm" && parsed.actionType !== "note")) return false;

  const snippet = body.slice(0, 240);
  if (parsed.actionType === "confirm") {
    const code = (parsed.milestoneCode || "").trim();
    if (!CONFIRMABLE.has(code) || doneCodes.has(code)) return false; // guard tampered/invalid/done codes
    const def = await prisma.milestoneDefinition.findFirst({ where: { code }, select: { id: true } });
    if (!def) return false;
    await prisma.milestoneProposal.create({
      data: {
        transactionId: m.transactionId, agencyId: m.agencyId, sourceMessageId: m.id,
        actionType: "confirm", milestoneCode: code, milestoneDefinitionId: def.id,
        summary: parsed.summary?.slice(0, 300) ?? "", confidence: parsed.confidence ?? "low",
        emailFrom: m.from, emailSubject: m.subject, emailSnippet: snippet,
      },
    });
    return true;
  }

  // note
  await prisma.milestoneProposal.create({
    data: {
      transactionId: m.transactionId, agencyId: m.agencyId, sourceMessageId: m.id,
      actionType: "note", noteText: parsed.summary?.slice(0, 500) ?? "",
      summary: parsed.summary?.slice(0, 300) ?? "", confidence: parsed.confidence ?? "low",
      emailFrom: m.from, emailSubject: m.subject, emailSnippet: snippet,
    },
  });
  return true;
}

export async function interpretNewInboundEmails(limit = 30): Promise<{ interpreted: number; proposed: number }> {
  const msgs = await prisma.outboundMessage.findMany({
    where: {
      type: "inbound",
      aiInterpretedAt: null,
      transactionId: { not: null },
      providerWebhookData: { path: ["source"], equals: "outlook" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, transactionId: true, agencyId: true, subject: true, content: true, providerWebhookData: true },
  });

  let interpreted = 0;
  let proposed = 0;
  for (const m of msgs) {
    if (!m.transactionId) continue;
    const from = ((m.providerWebhookData as { from?: string } | null)?.from) ?? null;
    try {
      const made = await interpretOne({ id: m.id, transactionId: m.transactionId, agencyId: m.agencyId, subject: m.subject, content: m.content, from });
      if (made) proposed++;
    } catch {
      // interpretation failure never blocks the sweep
    }
    await prisma.outboundMessage.update({ where: { id: m.id }, data: { aiInterpretedAt: new Date() } }).catch(() => {});
    interpreted++;
  }
  return { interpreted, proposed };
}
