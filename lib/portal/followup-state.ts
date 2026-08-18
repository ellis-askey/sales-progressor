// Resolver for the "email your conveyancer" follow-up nudge.
//
// Given a file + which side's portal is viewing, works out whether the current
// live step is with the client's OWN solicitor, how urgent it is (calm →
// check-in → running behind), and renders the exact draft to hand to their mail
// app. Returns null when there's nothing to nudge (plain email button applies).
//
// See docs/active/client-solicitor-followup-sender-SPEC.md.

import { prisma } from "@/lib/prisma";
import { addWorkingDays } from "@/lib/emails/working-hours";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { extractFirstName } from "@/lib/contacts/displayName";
import { FOLLOWUP_STEPS, type FollowupSide } from "./step-responsibility";
import { buildFollowupDraft, buildRequestUpdateDraft, type FollowupTone } from "./followup-copy";

export type FollowupNudgeState = "calm" | "check_in" | "behind" | "other_side";

export type FollowupNudge = {
  state: FollowupNudgeState;
  stepCode: string; // milestone code, or "enquiries"
  subject: string; // ready for the mailto
  body: string; // ready for the mailto ("" for other_side, where they write their own)
  solicitorEmail: string;
  solicitorName: string | null;
  ccEmail: string | null;
  lastSent: string | null; // ISO date of their last filed email to this solicitor
};

const LEAD_WORKING_DAYS = 2;
const ENQUIRY_CHASE_WD = 9;
const ENQUIRY_ESCALATE_WD = 15;

function addCalendarDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// N working days before `d` (weekend-aware; bank holidays ignored, since a
// client lead being a day out over a bank holiday is immaterial).
function workingDaysBefore(d: Date, n: number): Date {
  const x = new Date(d);
  let left = n;
  while (left > 0) {
    x.setDate(x.getDate() - 1);
    const day = x.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return x;
}

async function lastSentToSolicitor(
  transactionId: string,
  clientEmail: string | null,
  solicitorEmail: string,
): Promise<Date | null> {
  if (!clientEmail) return null;
  const rows = await prisma.outboundMessage.findMany({
    where: { transactionId, type: "inbound", recipientEmail: { equals: clientEmail, mode: "insensitive" } },
    orderBy: { sentAt: "desc" },
    take: 6,
    select: { sentAt: true, providerWebhookData: true },
  });
  const solLower = solicitorEmail.toLowerCase();
  for (const r of rows) {
    const d = r.providerWebhookData as { to?: string[]; cc?: string[] } | null;
    const recips = [...(d?.to ?? []), ...(d?.cc ?? [])].map((x) => String(x).toLowerCase());
    if (recips.includes(solLower)) return r.sentAt ?? null;
  }
  return null;
}

export async function getFollowupNudge(args: {
  transactionId: string;
  side: FollowupSide;
  contactId: string;
  firstName: string;
  addressShort: string;
  activeBuyerRoundId: string | null;
}): Promise<FollowupNudge | null> {
  if (process.env.FOLLOWUP_SENDER_ENABLED === "false") return null;
  const { transactionId, side, contactId, firstName, addressShort, activeBuyerRoundId } = args;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      status: true,
      followupNudgesDisabled: true,
      vendorSolicitorContact: { select: { email: true, name: true } },
      purchaserSolicitorContact: { select: { email: true, name: true } },
    },
  });
  if (!tx || tx.followupNudgesDisabled || tx.status !== "active") return null;

  const sol = side === "vendor" ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;
  if (!sol?.email) return null; // no conveyancer email → team card shows the "add" prompt

  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { email: true } });
  const { from: ccEmail } = await resolveAgencySenderForTransaction(transactionId).catch(() => ({ from: null as string | null }));

  const mySolCourt = side === "vendor" ? "seller_solicitor" : "buyer_solicitor";
  const now = new Date();

  // ── Enquiries stretch takes precedence when active ────────────────────────
  const [tracker, raise] = await Promise.all([
    prisma.enquiryTracker.findUnique({
      where: { transactionId },
      select: { currentlyWith: true, closedAt: true, openedAt: true, lastMovementAt: true, escalatedAt: true, snoozedUntil: true },
    }),
    prisma.enquiryRaiseChase.findUnique({
      where: { transactionId },
      select: { closedAt: true, openedAt: true, lastNudgedAt: true, escalatedAt: true },
    }),
  ]);

  let enquiry: { withMe: boolean; anchor: Date; escalated: boolean; snoozed: boolean; raisePhase: boolean } | null = null;
  if (tracker && !tracker.closedAt) {
    enquiry = {
      withMe: tracker.currentlyWith === mySolCourt,
      anchor: tracker.lastMovementAt ?? tracker.openedAt,
      escalated: !!tracker.escalatedAt,
      // Snoozed = the solicitor gave an expected date. Keep the context but hold
      // the nudge at calm rather than dropping to a plain button.
      snoozed: !!(tracker.snoozedUntil && tracker.snoozedUntil > now),
      raisePhase: false,
    };
  } else if (raise && !raise.closedAt) {
    enquiry = {
      withMe: side === "purchaser", // buyer's solicitor must raise
      anchor: raise.lastNudgedAt ?? raise.openedAt,
      escalated: !!raise.escalatedAt,
      snoozed: false,
      raisePhase: true,
    };
  }

  const draftFor = async (opts: {
    state: FollowupNudgeState;
    stepCode: string;
    thing: string;
    subjectStem: string;
  }): Promise<FollowupNudge> => {
    const lastSentDate = await lastSentToSolicitor(transactionId, contact?.email ?? null, sol.email!);
    const tapCount = await prisma.followupTap.count({ where: { transactionId, contactId, stepCode: opts.stepCode } });
    const tone: FollowupTone = opts.state === "behind" ? "behind" : "calm";
    const draft = buildFollowupDraft({
      clientFirstName: firstName,
      solicitorFirstName: sol.name ? extractFirstName(sol.name) : "there",
      addressShort,
      thing: opts.thing,
      subject: opts.subjectStem,
      tone,
      lastSentDate,
      variant: tapCount,
    });
    return {
      state: opts.state,
      stepCode: opts.stepCode,
      subject: draft.subject,
      body: draft.body,
      solicitorEmail: sol.email!,
      solicitorName: sol.name ?? null,
      ccEmail,
      lastSent: lastSentDate ? lastSentDate.toISOString() : null,
    };
  };

  if (enquiry) {
    if (!enquiry.withMe) {
      // With the other side: let them request a general update from their OWN
      // solicitor (who can chase across), rather than a blank compose.
      const tapCount = await prisma.followupTap.count({ where: { transactionId, contactId, stepCode: "enquiries" } });
      const draft = buildRequestUpdateDraft({
        clientFirstName: firstName,
        solicitorFirstName: sol.name ? extractFirstName(sol.name) : "there",
        addressShort,
        variant: tapCount,
      });
      return {
        state: "other_side",
        stepCode: "enquiries",
        subject: draft.subject,
        body: draft.body,
        solicitorEmail: sol.email,
        solicitorName: sol.name ?? null,
        ccEmail,
        lastSent: null,
      };
    }
    // Time-based, so it never depends on the internal chase cron having run
    // (matches how the milestone steps escalate).
    const state: FollowupNudgeState = enquiry.snoozed
      ? "calm"
      : enquiry.escalated || now >= addWorkingDays(enquiry.anchor, ENQUIRY_ESCALATE_WD)
        ? "behind"
        : now >= workingDaysBefore(addWorkingDays(enquiry.anchor, ENQUIRY_CHASE_WD), LEAD_WORKING_DAYS)
          ? "check_in"
          : "calm";
    const thing = enquiry.raisePhase ? "the enquiries being raised" : "the enquiries";
    return draftFor({ state, stepCode: "enquiries", thing, subjectStem: "Enquiries" });
  }

  // ── Milestone frontier: first "with your solicitor" step that's open ──────
  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId, OR: [{ buyerRoundId: null }, { buyerRoundId: activeBuyerRoundId }] },
    select: { state: true, completedAt: true, milestoneDefinition: { select: { code: true } } },
  });
  const stateByCode = new Map<string, string>();
  const completedAtByCode = new Map<string, Date | null>();
  for (const c of completions) {
    stateByCode.set(c.milestoneDefinition.code, c.state);
    completedAtByCode.set(c.milestoneDefinition.code, c.completedAt);
  }

  const frontier = FOLLOWUP_STEPS.find((s) => s.side === side && stateByCode.get(s.code) === "available");
  if (!frontier) return null; // nothing with their solicitor right now → plain button

  const rule = await prisma.reminderRule.findFirst({
    where: { targetMilestoneCode: frontier.code, isActive: true },
    select: { graceDays: true, anchorMilestone: { select: { code: true } } },
  });
  const grace = rule?.graceDays ?? 7;
  const anchorCode = rule?.anchorMilestone?.code ?? null;
  const anchorDate = anchorCode ? completedAtByCode.get(anchorCode) ?? null : null;

  let state: FollowupNudgeState = "calm";
  if (anchorDate) {
    const fireAt = addCalendarDays(anchorDate, grace);
    if (now >= fireAt) state = "behind";
    else if (now >= workingDaysBefore(fireAt, LEAD_WORKING_DAYS)) state = "check_in";
  }

  return draftFor({ state, stepCode: frontier.code, thing: frontier.thing, subjectStem: frontier.subject });
}
