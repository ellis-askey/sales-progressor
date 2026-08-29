import { prisma } from "@/lib/prisma";
import { isExchangeDayActive } from "@/lib/services/exchange-day";
import { sendChainEmail, solicitorCc } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { getAvatarPublicUrl } from "@/lib/supabase-storage";
import { addWorkingDays } from "@/lib/emails/working-hours";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { solicitorCodesForSide, solicitorStepLabel, type SolicitorSide } from "./codes";
import { signSolicitorToken } from "./token";
import { buildSolicitorDigestEmail, solicitorDigestSubject } from "./digest-email";
import { logChaseSend } from "@/lib/enquiries/chase-log";

// ── The solicitor confirmation chase engine ──────────────────────────────────
// Mirrors the client chase (lib/services/client-chase-cron.ts) but keyed by
// side, sends directly via sendChainEmail (solicitors aren't Contacts, so the
// contact-scoped queue doesn't fit), and uses SolicitorChaseState for
// idempotency + cadence.
//
// 2026-08-10: cadence is now PER-CODE via SolicitorReminderRule. Grace +
// repeat both counted in WORKING days. Custom anchors (anchorMilestoneCode,
// useAnchorEventDate) let a step's chase clock start from a milestone other
// than its direct prerequisite. SolicitorChaseSettings singleton is used
// only as the master enable + global fallback for codes without a rule.
// See docs/active/solicitor-confirm/scope.md.

type GlobalCadence = {
  enabledByDefault: boolean;
  graceWorkingDays: number;
  repeatDays: number;
  maxChases: number;
};

type StepCadence = {
  graceWorkingDays: number;
  repeatWorkingDays: number;
  maxChases: number;
  active: boolean;
  anchorMilestoneCode: string | null;
  useAnchorEventDate: boolean;
};

// enabledByDefault defaults to FALSE here (safe): with no settings row the
// cron does not send. The feature only goes live when the admin explicitly
// turns it on via Settings → Automation (which writes a row with
// enabledByDefault=true).
const GLOBAL_DEFAULTS: GlobalCadence = {
  enabledByDefault: false,
  graceWorkingDays: 5,
  repeatDays: 7,
  maxChases: 2,
};

export async function getGlobalSolicitorCadence(): Promise<GlobalCadence> {
  const row = await prisma.solicitorChaseSettings.findUnique({ where: { id: "singleton" } });
  if (!row) return GLOBAL_DEFAULTS;
  return {
    enabledByDefault: row.enabledByDefault,
    graceWorkingDays: row.graceWorkingDays,
    repeatDays: row.repeatDays,
    maxChases: row.maxChases,
  };
}

// Back-compat re-export — older call sites may still reference this name.
export const getSolicitorCadence = getGlobalSolicitorCadence;

// Load per-code cadences keyed by milestoneCode. Falls back to global for
// any code without a row.
async function loadStepCadences(global: GlobalCadence): Promise<Map<string, StepCadence>> {
  const rows = await prisma.solicitorReminderRule.findMany();
  const map = new Map<string, StepCadence>();
  for (const r of rows) {
    map.set(r.milestoneCode, {
      graceWorkingDays: r.graceWorkingDays,
      repeatWorkingDays: r.repeatWorkingDays,
      maxChases: r.maxChases,
      active: r.active,
      anchorMilestoneCode: r.anchorMilestoneCode,
      useAnchorEventDate: r.useAnchorEventDate,
    });
  }
  // Return the map — callers resolve the fallback per-code so we don't
  // pre-seed entries for codes that don't need chasing on this file.
  void global; // param kept for API symmetry / future per-code fallback logic
  return map;
}

function stepCadenceFor(
  code: string,
  cadences: Map<string, StepCadence>,
  global: GlobalCadence,
): StepCadence {
  const row = cadences.get(code);
  if (row) return row;
  // Defensive fallback: a new code lands before its rule is seeded.
  return {
    graceWorkingDays: global.graceWorkingDays,
    repeatWorkingDays: global.repeatDays, // best-effort; global is calendar days
    maxChases: global.maxChases,
    active: true,
    anchorMilestoneCode: null,
    useAnchorEventDate: false,
  };
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
}

// Belt-and-braces day-of-week guard. Cron schedule is already 0 9 * * 1-5
// so this should never fire, but ad-hoc / manual triggers of the run
// function shouldn't leak weekend sends either. Uses London weekday.
function isWeekdayLondon(d: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
  }).format(d);
  return weekday !== "Saturday" && weekday !== "Sunday";
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export type DueStep = { code: string; milestoneDefinitionId: string; label: string };
export type DueGroup = { transactionId: string; side: SolicitorSide; steps: DueStep[] };

// Resolve the chase-clock anchor for a specific step. Returns null when
// the anchor milestone isn't complete yet on this file — meaning the step
// shouldn't be chased (its trigger event hasn't happened).
//
// Logic:
//   1. If rule.anchorMilestoneCode is set → use that code.
//   2. Else use the step's own direct prerequisite (DIRECT_PREREQUISITES).
//   3. If neither exists (VM8, VM18, PM25 — the "no prereq" cases), fall
//      back to the max completedAt across the SIDE, or tx.createdAt if
//      nothing on the side is done yet.
//   4. If useAnchorEventDate is true, prefer the anchor milestone's
//      eventDate over completedAt. Falls back to completedAt when
//      eventDate is null (e.g. PM6 desktop valuations have no visit
//      date, so "5wd after the visit" reads as "5wd after we confirmed
//      the desktop valuation").
function resolveAnchorDate(args: {
  stepCode: string;
  rule: StepCadence;
  allCompletions: Array<{
    state: string;
    completedAt: Date | null;
    eventDate: Date | null;
    milestoneCode: string;
    milestoneSide: string;
    buyerRoundId: string | null;
  }>;
  side: SolicitorSide;
  activeBuyerRoundId: string | null;
  txCreatedAt: Date;
}): Date | null {
  const { stepCode, rule, allCompletions, side, activeBuyerRoundId, txCreatedAt } = args;

  const explicitAnchor = rule.anchorMilestoneCode;
  const directPrereq = DIRECT_PREREQUISITES[stepCode]?.[0] ?? null;
  const anchorCode = explicitAnchor ?? directPrereq;

  if (anchorCode) {
    // Look up the anchor's completion. Cross-side anchors work naturally
    // because we search allCompletions unrestricted by side.
    const anchor = allCompletions.find(
      (c) => c.milestoneCode === anchorCode && c.state === "complete",
    );
    if (!anchor) return null; // anchor not complete → don't chase yet
    if (rule.useAnchorEventDate && anchor.eventDate) {
      return anchor.eventDate;
    }
    return anchor.completedAt ?? null;
  }

  // No anchor + no direct prereq (VM8, VM18, PM25). Fall back to max
  // completedAt on the same side, or tx.createdAt if nothing done.
  const sideCompleted = allCompletions
    .filter((c) => c.milestoneSide === side && c.state === "complete")
    .filter((c) =>
      side === "purchaser"
        ? c.buyerRoundId === activeBuyerRoundId || c.buyerRoundId === null
        : c.buyerRoundId === null,
    );
  const completedTimes = sideCompleted
    .map((c) => c.completedAt?.getTime())
    .filter((t): t is number => t !== undefined);
  return completedTimes.length ? new Date(Math.max(...completedTimes)) : txCreatedAt;
}

// Pure read: which (file, side) digests are due right now.
export async function findDueSolicitorChases(now: Date, global: GlobalCadence): Promise<DueGroup[]> {
  const cadences = await loadStepCadences(global);

  const txs = await prisma.propertyTransaction.findMany({
    where: {
      status: "active",
      // Per-agency gate: only chase files whose owning agency has solicitor
      // chasing switched on (Command Centre). The global master switch above
      // still applies on top.
      agency: { is: { solicitorChaseEnabled: true } },
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
      // Exchange-day suppression (see docs/active/exchange-day-SPEC.md).
      exchangeDayStartedAt: true,
      exchangeDayCancelledAt: true,
      exchangedAt: true,
      vendorSolicitorContactId: true,
      vendorSolicitorEmailsPaused: true,
      vendorSolicitorEmailsPausedUntil: true,
      vendorSolicitorContact: { select: { email: true } },
      purchaserSolicitorContactId: true,
      purchaserSolicitorEmailsPaused: true,
      purchaserSolicitorEmailsPausedUntil: true,
      purchaserSolicitorContact: { select: { email: true } },
      milestoneCompletions: {
        select: {
          state: true,
          completedAt: true,
          expectedDate: true,
          eventDate: true,
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
    // Exchange-day: don't chase solicitors on a file that's aiming to exchange
    // today — the exchange-day sequence handles them instead.
    if (isExchangeDayActive(tx)) continue;
    // Flatten all completions for anchor lookup — cross-side anchors need
    // to see the other side's completions too.
    const allCompletionsFlat = tx.milestoneCompletions.map((c) => ({
      state: c.state,
      completedAt: c.completedAt,
      eventDate: c.eventDate,
      milestoneCode: c.milestoneDefinition.code,
      milestoneSide: c.milestoneDefinition.side,
      buyerRoundId: c.buyerRoundId,
    }));

    for (const side of ["vendor", "purchaser"] as SolicitorSide[]) {
      const contactId = side === "vendor" ? tx.vendorSolicitorContactId : tx.purchaserSolicitorContactId;
      const email = side === "vendor" ? tx.vendorSolicitorContact?.email : tx.purchaserSolicitorContact?.email;
      const pausedFlag = side === "vendor" ? tx.vendorSolicitorEmailsPaused : tx.purchaserSolicitorEmailsPaused;
      const pausedUntil = side === "vendor" ? tx.vendorSolicitorEmailsPausedUntil : tx.purchaserSolicitorEmailsPausedUntil;
      const paused = pausedFlag || (pausedUntil != null && pausedUntil > new Date());
      // No solicitor / no email / opted out / paused → nothing sends.
      if (!contactId || !email || paused) continue;

      const codes = solicitorCodesForSide(side);
      // Scope: vendor rows are file-level (buyerRoundId null); purchaser rows
      // belong to the active round (or legacy file-level nulls).
      const inScope = (roundId: string | null) =>
        side === "purchaser" ? roundId === tx.activeBuyerRoundId || roundId === null : roundId === null;
      const sideCompletions = tx.milestoneCompletions.filter(
        (c) => c.milestoneDefinition.side === side && inScope(c.buyerRoundId),
      );

      const steps: DueStep[] = [];
      for (const c of sideCompletions) {
        if (c.state !== "available") continue;
        const code = c.milestoneDefinition.code;
        if (!codes.has(code)) continue;
        // Expected date given by the solicitor → snoozed until then.
        if (c.expectedDate && c.expectedDate > now) continue;

        const rule = stepCadenceFor(code, cadences, global);
        if (!rule.active) continue; // per-code off switch

        const anchor = resolveAnchorDate({
          stepCode: code,
          rule,
          allCompletions: allCompletionsFlat,
          side,
          activeBuyerRoundId: tx.activeBuyerRoundId,
          txCreatedAt: tx.createdAt,
        });
        if (!anchor) continue; // anchor milestone not complete → not chase-eligible

        const firstDue = addWorkingDays(anchor, rule.graceWorkingDays);

        const state = tx.solicitorChaseStates.find((s) => s.side === side && s.milestoneCode === code);
        if (!state) {
          if (now >= firstDue) {
            steps.push({ code, milestoneDefinitionId: c.milestoneDefinition.id, label: solicitorStepLabel(code, c.milestoneDefinition.name) });
          }
          continue;
        }
        if (state.status !== "active") continue;
        if (state.chaseCount >= rule.maxChases) continue; // handled by escalation pass
        // Repeat now in WORKING days (was calendar). Sat/Sun/bank-holidays
        // between chases don't count toward the interval.
        const nextDue = state.lastChasedAt
          ? addWorkingDays(state.lastChasedAt, rule.repeatWorkingDays)
          : firstDue;
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
      agentUser: { select: { name: true, phone: true, image: true } },
      assignedUser: { select: { name: true, phone: true, image: true } },
      agency: { select: { name: true } },
      vendorSolicitorFirmId: true,
      vendorSolicitorFirm: { select: { name: true } },
      vendorSolicitorContact: { select: { id: true, email: true, secondaryEmail: true } },
      purchaserSolicitorFirmId: true,
      purchaserSolicitorFirm: { select: { name: true } },
      purchaserSolicitorContact: { select: { id: true, email: true, secondaryEmail: true } },
      contacts: { select: { name: true, roleType: true } },
    },
  });
  if (!tx) return false;

  const side = group.side;
  const solicitorContact = side === "vendor" ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;
  const email = solicitorContact?.email;
  if (!email) return false;

  const firmName = side === "vendor" ? tx.vendorSolicitorFirm?.name ?? null : tx.purchaserSolicitorFirm?.name ?? null;
  const sellerNames = joinNames(tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name));
  const buyerNames = joinNames(tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name));
  const ownClientNames = side === "vendor" ? sellerNames : buyerNames;
  const brand = tx.agency?.name ?? "Sales Progression";

  const token = signSolicitorToken(tx.id, side);
  const base = baseUrl();
  // Signature = the person looking after the file: the assigned progressor on
  // an outsourced file, otherwise the agency's own agent. Name + phone + avatar
  // sign the email off personally.
  const person = tx.assignedUser ?? tx.agentUser;
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
    qrUrl: `${base}/s/${token}/qr`,
    personName: person?.name ?? brand,
    personPhone: person?.phone ?? null,
    avatarUrl: getAvatarPublicUrl(person?.image),
  });

  // Sender = the agency's authenticated sending address (Agency.quoteSenderEmail),
  // Reply-To matching, falling back to the SP default when the agency has no
  // authenticated address. (agentId is still needed for the activity record below.)
  const agentId = tx.assignedUserId ?? tx.agentUserId;
  const { from, replyTo } = await resolveAgencySenderForTransaction(tx.id);

  await sendChainEmail({ to: email, cc: solicitorCc(solicitorContact), subject, text, html, from, replyTo });

  // Effectiveness log for the Chasing hub — one ChaseSend per digest send,
  // stamped opened/responded when the solicitor uses their /s/ link (opens via
  // the /s/ page load, responded via solicitorConfirmStepAction). Fire-and-forget.
  void logChaseSend({
    transactionId: tx.id,
    kind: "milestone",
    recipient: side === "vendor" ? "seller_solicitor" : "buyer_solicitor",
    recipientName: firmName,
  }).catch(() => {});

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
async function runEscalationPass(now: Date, global: GlobalCadence): Promise<number> {
  const cadences = await loadStepCadences(global);

  const candidates = await prisma.solicitorChaseState.findMany({
    where: { status: "active" },
    select: {
      id: true,
      transactionId: true,
      side: true,
      milestoneCode: true,
      chaseCount: true,
      lastChasedAt: true,
    },
  });

  let escalated = 0;
  for (const state of candidates) {
    const rule = stepCadenceFor(state.milestoneCode, cadences, global);
    // Only escalate rows that have hit THEIR OWN per-code cap.
    if (state.chaseCount < rule.maxChases) continue;
    // And only after another full repeat window (working days) has passed
    // — so the escalation lands one repeat-cycle after the last chase.
    if (!state.lastChasedAt || now < addWorkingDays(state.lastChasedAt, rule.repeatWorkingDays)) continue;

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
            message: `${firmName ?? "The solicitor"} hasn't responded on "${label}" after ${rule.maxChases} reminders. Worth a direct chase.`,
          },
        },
      });
    }
    escalated++;
  }

  return escalated;
}

export async function runSolicitorChaseCron(now: Date): Promise<{
  enabled: boolean;
  groups: number;
  sent: number;
  escalated: number;
  skippedWeekend?: boolean;
}> {
  const global = await getGlobalSolicitorCadence();
  // Master on/off switch — off until the admin turns it on from Settings →
  // Automation. Off = the cron is a no-op (no sends, no state changes).
  if (!global.enabledByDefault) {
    return { enabled: false, groups: 0, sent: 0, escalated: 0 };
  }

  // Belt-and-braces day-of-week guard. Vercel cron is already 0 9 * * 1-5
  // but this covers manual / ad-hoc invocations too. Weekend sends to
  // solicitors would look sloppy — solicitors don't work Sat/Sun.
  if (!isWeekdayLondon(now)) {
    return { enabled: true, groups: 0, sent: 0, escalated: 0, skippedWeekend: true };
  }

  const due = await findDueSolicitorChases(now, global);

  let sent = 0;
  for (const group of due) {
    try {
      if (await sendDigestForGroup(group, now)) sent++;
    } catch (err) {
      console.error(`[solicitor-chase] send failed for ${group.transactionId}/${group.side}:`, err);
    }
  }

  const escalated = await runEscalationPass(now, global);
  return { enabled: true, groups: due.length, sent, escalated };
}
