import { prisma } from "@/lib/prisma";
import { sendChainEmail, resolveSenderForTransaction } from "@/lib/email";
import { addWorkingDays } from "@/lib/emails/working-hours";
import { solicitorCodesForSide, solicitorStepLabel, type SolicitorSide } from "./codes";
import { signSolicitorToken } from "./token";
import { buildSolicitorDigestEmail, solicitorDigestSubject } from "./digest-email";

// ── The solicitor confirmation chase engine ──────────────────────────────────
// Mirrors the client chase (lib/services/client-chase-cron.ts) but keyed by
// side, sends directly via sendChainEmail (solicitors aren't Contacts, so the
// contact-scoped queue doesn't fit), and uses SolicitorChaseState for
// idempotency + cadence. Cadence (grace/repeat/cap) comes from the
// SolicitorChaseSettings singleton. See docs/active/solicitor-confirm/scope.md.

type Cadence = {
  enabledByDefault: boolean;
  graceWorkingDays: number;
  repeatDays: number;
  maxChases: number;
};

const CADENCE_DEFAULTS: Cadence = {
  enabledByDefault: true,
  graceWorkingDays: 5,
  repeatDays: 7,
  maxChases: 2,
};

export async function getSolicitorCadence(): Promise<Cadence> {
  const row = await prisma.solicitorChaseSettings.findUnique({ where: { id: "singleton" } });
  if (!row) return CADENCE_DEFAULTS;
  return {
    enabledByDefault: row.enabledByDefault,
    graceWorkingDays: row.graceWorkingDays,
    repeatDays: row.repeatDays,
    maxChases: row.maxChases,
  };
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
}

function addDays(from: Date, n: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export type DueStep = { code: string; milestoneDefinitionId: string; label: string };
export type DueGroup = { transactionId: string; side: SolicitorSide; steps: DueStep[] };

// Pure read: which (file, side) digests are due right now.
export async function findDueSolicitorChases(now: Date, cadence: Cadence): Promise<DueGroup[]> {
  const txs = await prisma.propertyTransaction.findMany({
    where: {
      status: "active",
      OR: [
        { vendorSolicitorContactId: { not: null } },
        { purchaserSolicitorContactId: { not: null } },
      ],
    },
    select: {
      id: true,
      activeBuyerRoundId: true,
      lastActivityAt: true,
      createdAt: true,
      vendorSolicitorContactId: true,
      vendorSolicitorEmailsPaused: true,
      vendorSolicitorContact: { select: { email: true } },
      purchaserSolicitorContactId: true,
      purchaserSolicitorEmailsPaused: true,
      purchaserSolicitorContact: { select: { email: true } },
      milestoneCompletions: {
        select: {
          state: true,
          completedAt: true,
          expectedDate: true,
          buyerRoundId: true,
          milestoneDefinition: { select: { id: true, code: true, side: true, name: true } },
        },
      },
      solicitorChaseStates: {
        select: { side: true, milestoneCode: true, chaseCount: true, lastChasedAt: true, status: true },
      },
    },
  });

  const out: DueGroup[] = [];

  for (const tx of txs) {
    for (const side of ["vendor", "purchaser"] as SolicitorSide[]) {
      const contactId = side === "vendor" ? tx.vendorSolicitorContactId : tx.purchaserSolicitorContactId;
      const email = side === "vendor" ? tx.vendorSolicitorContact?.email : tx.purchaserSolicitorContact?.email;
      const paused = side === "vendor" ? tx.vendorSolicitorEmailsPaused : tx.purchaserSolicitorEmailsPaused;
      // No solicitor / no email / opted out → nothing sends.
      if (!contactId || !email || paused) continue;

      const codes = solicitorCodesForSide(side);
      // Scope: vendor rows are file-level (buyerRoundId null); purchaser rows
      // belong to the active round (or legacy file-level nulls).
      const inScope = (roundId: string | null) =>
        side === "purchaser" ? roundId === tx.activeBuyerRoundId || roundId === null : roundId === null;
      const sideCompletions = tx.milestoneCompletions.filter(
        (c) => c.milestoneDefinition.side === side && inScope(c.buyerRoundId),
      );

      // Anchor = when the file last moved forward on this side. Grace runs from
      // there, so a step that has just unlocked isn't chased for 5 working days.
      const completedTimes = sideCompletions
        .filter((c) => c.state === "complete" && c.completedAt)
        .map((c) => c.completedAt!.getTime());
      const anchor = completedTimes.length
        ? new Date(Math.max(...completedTimes))
        : tx.lastActivityAt ?? tx.createdAt;
      const firstDue = addWorkingDays(anchor, cadence.graceWorkingDays);

      const steps: DueStep[] = [];
      for (const c of sideCompletions) {
        if (c.state !== "available") continue;
        const code = c.milestoneDefinition.code;
        if (!codes.has(code)) continue;
        // Expected date given by the solicitor → snoozed until then.
        if (c.expectedDate && c.expectedDate > now) continue;

        const state = tx.solicitorChaseStates.find((s) => s.side === side && s.milestoneCode === code);
        if (!state) {
          if (now >= firstDue) {
            steps.push({ code, milestoneDefinitionId: c.milestoneDefinition.id, label: solicitorStepLabel(code, c.milestoneDefinition.name) });
          }
          continue;
        }
        if (state.status !== "active") continue;
        if (state.chaseCount >= cadence.maxChases) continue; // handled by escalation pass
        const nextDue = state.lastChasedAt ? addDays(state.lastChasedAt, cadence.repeatDays) : firstDue;
        if (now >= nextDue) {
          steps.push({ code, milestoneDefinitionId: c.milestoneDefinition.id, label: solicitorStepLabel(code, c.milestoneDefinition.name) });
        }
      }

      if (steps.length) out.push({ transactionId: tx.id, side, steps });
    }
  }

  return out;
}

async function sendDigestForGroup(group: DueGroup, now: Date): Promise<boolean> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: group.transactionId },
    select: {
      id: true,
      agencyId: true,
      propertyAddress: true,
      purchasePrice: true,
      agentUserId: true,
      assignedUserId: true,
      agency: { select: { name: true } },
      vendorSolicitorFirmId: true,
      vendorSolicitorFirm: { select: { name: true } },
      vendorSolicitorContact: { select: { id: true, email: true } },
      purchaserSolicitorFirmId: true,
      purchaserSolicitorFirm: { select: { name: true } },
      purchaserSolicitorContact: { select: { id: true, email: true } },
      contacts: { select: { name: true, roleType: true } },
    },
  });
  if (!tx) return false;

  const side = group.side;
  const email = side === "vendor" ? tx.vendorSolicitorContact?.email : tx.purchaserSolicitorContact?.email;
  if (!email) return false;

  const firmName = side === "vendor" ? tx.vendorSolicitorFirm?.name ?? null : tx.purchaserSolicitorFirm?.name ?? null;
  const sellerNames = joinNames(tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name));
  const buyerNames = joinNames(tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name));
  const ownClientNames = side === "vendor" ? sellerNames : buyerNames;
  const brand = tx.agency?.name ?? "Sales Progression";

  const token = signSolicitorToken(tx.id, side);
  const base = baseUrl();
  const { subject, html, text } = buildSolicitorDigestEmail({
    brand,
    address: tx.propertyAddress,
    pricePence: tx.purchasePrice,
    sellerNames,
    buyerNames,
    side,
    firmName,
    ownClientNames: ownClientNames || tx.propertyAddress,
    steps: group.steps.map((s) => ({ label: s.label })),
    confirmUrl: `${base}/s/${token}`,
    stopUrl: `${base}/s/${token}/stop`,
  });

  // Sender = the file's assigned agent's verified email (agency-branded),
  // falling back to the SP default inside resolveSenderForTransaction.
  const agentId = tx.assignedUserId ?? tx.agentUserId;
  let from: string | undefined;
  let replyTo: string | undefined;
  if (agentId) {
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, email: true, name: true, role: true, agencyId: true },
    });
    if (agent) {
      const sender = await resolveSenderForTransaction(tx.id, {
        id: agent.id,
        email: agent.email ?? undefined,
        name: agent.name ?? undefined,
        role: agent.role,
        agencyId: agent.agencyId,
      });
      from = sender.from;
      replyTo = sender.replyTo;
    }
  }

  await sendChainEmail({ to: email, subject, text, html, from, replyTo });

  // Bookkeeping: bump SolicitorChaseState per step + mirror an activity record.
  for (const step of group.steps) {
    await prisma.solicitorChaseState.upsert({
      where: {
        transactionId_side_milestoneCode: {
          transactionId: tx.id,
          side,
          milestoneCode: step.code,
        },
      },
      create: {
        transactionId: tx.id,
        side,
        milestoneCode: step.code,
        chaseCount: 1,
        firstChasedAt: now,
        lastChasedAt: now,
        status: "active",
      },
      update: {
        chaseCount: { increment: 1 },
        lastChasedAt: now,
        status: "active",
      },
    });
  }

  if (agentId) {
    await prisma.outboundMessage.create({
      data: {
        transactionId: tx.id,
        agencyId: tx.agencyId,
        type: "outbound",
        method: "email",
        channel: "email",
        purpose: "chase",
        status: "sent",
        isAutomated: true,
        recipientEmail: email,
        recipientName: firmName ?? undefined,
        subject,
        content: `Automated confirmation request sent to ${firmName ?? "the solicitor"} for: ${group.steps.map((s) => s.label).join(", ")}.`,
        contactIds: [],
        createdById: agentId,
        createdByRole: "director",
        sentAt: now,
      },
    });
  }

  return true;
}

// Second pass: files where a solicitor step has been chased to the cap and a
// further repeat cycle has elapsed with no response → hand to the agent.
async function runEscalationPass(now: Date, cadence: Cadence): Promise<number> {
  const candidates = await prisma.solicitorChaseState.findMany({
    where: { status: "active", chaseCount: { gte: cadence.maxChases } },
    select: {
      id: true,
      transactionId: true,
      side: true,
      milestoneCode: true,
      lastChasedAt: true,
    },
  });

  let escalated = 0;
  for (const state of candidates) {
    if (!state.lastChasedAt || now < addDays(state.lastChasedAt, cadence.repeatDays)) continue;

    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: state.transactionId },
      select: {
        propertyAddress: true,
        agentUserId: true,
        assignedUserId: true,
        activeBuyerRoundId: true,
        vendorSolicitorFirm: { select: { name: true } },
        purchaserSolicitorFirm: { select: { name: true } },
      },
    });
    if (!tx) continue;

    // Still genuinely outstanding? (not confirmed, not snoozed)
    const def = await prisma.milestoneDefinition.findUnique({
      where: { code: state.milestoneCode },
      select: { id: true },
    });
    if (!def) continue;
    const completion = await prisma.milestoneCompletion.findFirst({
      where: {
        transactionId: state.transactionId,
        milestoneDefinitionId: def.id,
        buyerRoundId: state.side === "purchaser" ? tx.activeBuyerRoundId : null,
      },
      select: { state: true, expectedDate: true },
    });
    if (!completion || completion.state !== "available") {
      // Resolved in the meantime — close the chase quietly.
      await prisma.solicitorChaseState.update({
        where: { id: state.id },
        data: { status: "resolved", resolvedAt: now, statusReason: "no_longer_available" },
      });
      continue;
    }
    if (completion.expectedDate && completion.expectedDate > now) continue;

    const agentId = tx.assignedUserId ?? tx.agentUserId;
    const firmName =
      state.side === "vendor" ? tx.vendorSolicitorFirm?.name : tx.purchaserSolicitorFirm?.name;
    const label = solicitorStepLabel(state.milestoneCode, state.milestoneCode);

    // Atomic escalate: only the writer that flips status="active"→"escalated" wins.
    const flipped = await prisma.solicitorChaseState.updateMany({
      where: { id: state.id, status: "active" },
      data: { status: "escalated", statusReason: "no_response_after_cap" },
    });
    if (flipped.count === 0) continue;

    if (agentId) {
      await prisma.notification.create({
        data: {
          userId: agentId,
          type: "solicitor_unresponsive",
          transactionId: state.transactionId,
          payload: {
            address: tx.propertyAddress,
            side: state.side,
            firmName: firmName ?? null,
            step: label,
            message: `${firmName ?? "The solicitor"} hasn't responded on "${label}" after ${cadence.maxChases} reminders. Worth a direct chase.`,
          },
        },
      });
    }
    escalated++;
  }

  return escalated;
}

export async function runSolicitorChaseCron(now: Date): Promise<{
  groups: number;
  sent: number;
  escalated: number;
}> {
  const cadence = await getSolicitorCadence();
  const due = await findDueSolicitorChases(now, cadence);

  let sent = 0;
  for (const group of due) {
    try {
      if (await sendDigestForGroup(group, now)) sent++;
    } catch (err) {
      console.error(`[solicitor-chase] send failed for ${group.transactionId}/${group.side}:`, err);
    }
  }

  const escalated = await runEscalationPass(now, cadence);
  return { groups: due.length, sent, escalated };
}
