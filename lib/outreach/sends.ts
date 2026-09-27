// Read-only data for the AI Outreach "Sends" tab (the results lab): every
// outreach email, queued and sent, with what happened to it. Surfaces data that
// already exists (ProspectFlowStep for the schedule, ProspectEmail for delivery
// tracking) — no new storage. Server-only, no writes, no AI, no sends.

import { commandDb } from "@/lib/command/prisma";
import { warmupDailyCap } from "./send-limits";

export type OutreachSendStatus =
  | "scheduled" | "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "replied" | "skipped" | "failed";

export type OutreachSendRow = {
  key: string;
  kind: "campaign" | "manual";
  emailId: string | null; // ProspectEmail id (for the render popup) when it exists
  stepId: string | null; // flow step id (render a still-queued email from its frozen copy)
  prospectId: string;
  agencyName: string;
  contactName: string | null;
  toEmail: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  stepLabel: string | null;
  subject: string | null;
  status: OutreachSendStatus;
  when: Date | null;
  upcoming: boolean;
};

export type OutreachSendsScope = "all" | "campaign";
export type OutreachSendsFilter = { scope: OutreachSendsScope; status?: OutreachSendStatus | null; campaignId?: string | null };

type EmailFlags = { sentAt: Date | null; deliveredAt: Date | null; openedAt: Date | null; clickedAt: Date | null; bouncedAt: Date | null; repliedAt: Date | null };

function statusForSent(e: EmailFlags): OutreachSendStatus {
  if (e.repliedAt) return "replied";
  if (e.bouncedAt) return "bounced";
  if (e.clickedAt) return "clicked";
  if (e.openedAt) return "opened";
  if (e.deliveredAt) return "delivered";
  return "sent";
}

const CONTACT_PICK = { orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }], take: 1, select: { name: true } };

export async function listOutreachSends(filter: OutreachSendsFilter, limit = 400): Promise<OutreachSendRow[]> {
  const rows: OutreachSendRow[] = [];

  // ── Campaign emails: every experiment flow step (scheduled + sent) ──
  const steps = await commandDb.prospectFlowStep.findMany({
    where: { flow: { experimentId: { not: null } } },
    orderBy: [{ scheduledFor: "asc" }, { sentAt: "desc" }],
    take: limit,
    select: {
      id: true, stepIndex: true, status: true, scheduledFor: true, sentAt: true, subject: true, toEmail: true, prospectEmailId: true,
      flow: { select: { experimentId: true, prospectId: true, prospect: { select: { agencyName: true, contacts: CONTACT_PICK } } } },
    },
  });

  const experimentIds = [...new Set(steps.map((s) => s.flow.experimentId).filter((v): v is string => !!v))];
  const experiments = experimentIds.length
    ? await commandDb.outreachExperiment.findMany({ where: { id: { in: experimentIds } }, select: { id: true, title: true } })
    : [];
  const titleById = new Map(experiments.map((e) => [e.id, e.title]));

  const emailIds = [...new Set(steps.map((s) => s.prospectEmailId).filter((v): v is string => !!v))];
  const stepEmails = emailIds.length
    ? await commandDb.prospectEmail.findMany({ where: { id: { in: emailIds } }, select: { id: true, sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true, bouncedAt: true, repliedAt: true } })
    : [];
  const emailById = new Map(stepEmails.map((e) => [e.id, e]));

  for (const s of steps) {
    if (filter.campaignId && s.flow.experimentId !== filter.campaignId) continue;
    const email = s.prospectEmailId ? emailById.get(s.prospectEmailId) ?? null : null;
    let status: OutreachSendStatus;
    if (s.status === "scheduled") status = "scheduled";
    else if (s.status === "queued") status = "queued";
    else if (s.status === "skipped") status = "skipped";
    else if (s.status === "sent") status = email ? statusForSent(email) : "sent";
    else status = "failed";
    const upcoming = status === "scheduled" || status === "queued";
    rows.push({
      key: `step:${s.id}`,
      kind: "campaign",
      emailId: s.prospectEmailId ?? null,
      stepId: s.id,
      prospectId: s.flow.prospectId,
      agencyName: s.flow.prospect.agencyName,
      contactName: s.flow.prospect.contacts[0]?.name ?? null,
      toEmail: s.toEmail,
      campaignId: s.flow.experimentId,
      campaignTitle: s.flow.experimentId ? titleById.get(s.flow.experimentId) ?? null : null,
      stepLabel: `Email ${s.stepIndex + 1}`,
      subject: s.subject,
      status,
      when: upcoming ? s.scheduledFor : email?.sentAt ?? s.sentAt,
      upcoming,
    });
  }

  // ── Manual (non-experiment) prospect emails, only in the "all" scope ──
  if (filter.scope === "all") {
    const manual = await commandDb.prospectEmail.findMany({
      where: { experimentId: null },
      orderBy: { sentAt: "desc" },
      take: limit,
      select: {
        id: true, prospectId: true, toEmail: true, subject: true,
        sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true, bouncedAt: true, repliedAt: true,
        prospect: { select: { agencyName: true, contacts: CONTACT_PICK } },
      },
    });
    for (const e of manual) {
      rows.push({
        key: `email:${e.id}`,
        kind: "manual",
        emailId: e.id,
        stepId: null,
        prospectId: e.prospectId,
        agencyName: e.prospect.agencyName,
        contactName: e.prospect.contacts[0]?.name ?? null,
        toEmail: e.toEmail,
        campaignId: null,
        campaignTitle: null,
        stepLabel: null,
        subject: e.subject,
        status: statusForSent(e),
        when: e.sentAt,
        upcoming: false,
      });
    }
  }

  const filtered = filter.status ? rows.filter((r) => r.status === filter.status) : rows;
  // Upcoming first (soonest at the top), then history (most recent first).
  filtered.sort((a, b) => {
    if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1;
    const at = a.when?.getTime() ?? 0;
    const bt = b.when?.getTime() ?? 0;
    return a.upcoming ? at - bt : bt - at;
  });
  return filtered.slice(0, limit);
}

export type OutreachSendsSummary = {
  queued: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  replied: number;
  todayCap: number;
  todaySent: number;
};

function startOfLondonDay(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const londonWallAsUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offset = londonWallAsUTC - now.getTime();
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0) - offset);
}

export async function getOutreachSendsSummary(now: Date = new Date()): Promise<OutreachSendsSummary> {
  const [queued, sent, delivered, opened, clicked, bounced, replied, firstSend, todaySent] = await Promise.all([
    commandDb.prospectFlowStep.count({ where: { status: { in: ["scheduled", "queued"] }, flow: { status: "active", experimentId: { not: null } } } }),
    commandDb.prospectEmail.count({ where: { experimentId: { not: null }, sendState: "accepted" } }),
    commandDb.prospectEmail.count({ where: { experimentId: { not: null }, deliveredAt: { not: null } } }),
    commandDb.prospectEmail.count({ where: { experimentId: { not: null }, openedAt: { not: null } } }),
    commandDb.prospectEmail.count({ where: { experimentId: { not: null }, clickedAt: { not: null } } }),
    commandDb.prospectEmail.count({ where: { experimentId: { not: null }, bouncedAt: { not: null } } }),
    commandDb.prospectEmail.count({ where: { experimentId: { not: null }, repliedAt: { not: null } } }),
    commandDb.prospectEmail.findFirst({ where: { experimentId: { not: null }, acceptedAt: { not: null } }, orderBy: { acceptedAt: "asc" }, select: { acceptedAt: true } }),
    commandDb.prospectEmail.count({ where: { experimentId: { not: null }, sendState: "accepted", acceptedAt: { gte: startOfLondonDay(now) } } }),
  ]);
  const ageDays = firstSend?.acceptedAt ? Math.floor((now.getTime() - firstSend.acceptedAt.getTime()) / 86_400_000) : 0;
  return { queued, sent, delivered, opened, clicked, bounced, replied, todayCap: warmupDailyCap(ageDays), todaySent };
}

// Launched campaigns, for the Sends tab's "Campaign" filter dropdown.
export async function getCampaignFilterOptions(): Promise<{ id: string; title: string }[]> {
  const exps = await commandDb.outreachExperiment.findMany({
    where: { launchedAt: { not: null } },
    orderBy: { launchedAt: "desc" },
    select: { id: true, title: true },
  });
  return exps.map((e) => ({ id: e.id, title: e.title }));
}
