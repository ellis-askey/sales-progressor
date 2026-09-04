// Autopilot resolver for the Reminders page.
//
// Splits each reminder into "the system is chasing this" (auto, with a next-send
// time) vs "only the agent can move this" (manual, with a reason). Mirrors the
// two send crons' eligibility so the split + countdown are truthful:
//   client cron    09:30 UTC Mon–Sat   (CLIENT_CHASE_ENABLED)
//   solicitor cron 09:00 UTC Mon–Fri   (SolicitorChaseSettings.enabledByDefault)
// Both sweep everything due/overdue on their next run, so next-send = the next
// cron run at/after the row's due date. (Precise for due/overdue rows — the ones
// that matter; future-dated solicitor rows are approximate, which is fine here.)
//
// A row is handed to the agent when it's already been handed back (fallbackKind),
// escalated, not an automated step, the pipeline is off for that file, or the
// recipient isn't reachable.

import { isClientChaseable } from "@/lib/chase/chaseable-milestones";
import { solicitorCodesForSide } from "@/lib/solicitor-confirm/codes";

export type AutopilotStatus =
  | { kind: "auto"; pipeline: "client" | "solicitor"; nextSend: string } // ISO
  | { kind: "manual"; reason: string | null };

export interface AutopilotFlags {
  clientChaseEnabled: boolean; // CLIENT_CHASE_ENABLED env
  solicitorGlobalEnabled: boolean; // SolicitorChaseSettings.enabledByDefault
  agencyClientChase: Map<string, boolean>; // agencyId -> Agency.chaseEmailsEnabled
  agencySolicitorChase: Map<string, boolean>; // agencyId -> Agency.solicitorChaseEnabled
}

interface LogShape {
  id: string;
  nextDueDate: Date;
  reminderRule: { targetMilestoneCode: string | null };
  chaseTasks: { status: string; priority: string; fallbackKind: string | null }[];
  transaction: {
    agencyId: string | null;
    clientEmailsPaused: boolean;
    vendorSolicitorEmailsPaused: boolean;
    purchaserSolicitorEmailsPaused: boolean;
    contacts: { roleType: string; email: string | null; portalToken: string | null; unsubscribedAt: Date | null }[];
    vendorSolicitorContact: { email: string | null } | null;
    purchaserSolicitorContact: { email: string | null } | null;
  };
}

const CLIENT_CRON = { hour: 9, minute: 30, days: [1, 2, 3, 4, 5, 6] }; // Mon–Sat
const SOLICITOR_CRON = { hour: 9, minute: 0, days: [1, 2, 3, 4, 5] }; // Mon–Fri

function nextCronRun(dueDate: Date, cron: { hour: number; minute: number; days: number[] }): string {
  const now = new Date();
  const base = dueDate > now ? dueDate : now; // due items chase at the next run from now
  const d = new Date(base);
  d.setUTCHours(cron.hour, cron.minute, 0, 0);
  for (let i = 0; i < 10; i++) {
    if (d >= base && cron.days.includes(d.getUTCDay())) return d.toISOString();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(cron.hour, cron.minute, 0, 0);
  }
  return d.toISOString();
}

// Short, honest reason a chase turned manual (handed back by the cron).
function fallbackReason(kind: string): string | null {
  switch (kind) {
    case "no_email_on_contact": return "No email on file";
    case "no_portalToken_on_contact": return "Client has no portal access";
    case "client_opted_out": return "Client opted out of emails";
    case "client_emails_paused": return "Client emails paused";
    case "max_chases_exhausted": return "Autopilot chased twice, no reply";
    case "days_cap_exhausted": return "Silent for 14 days";
    default: return null;
  }
}

export function resolveAutopilot(logs: LogShape[], flags: AutopilotFlags): Map<string, AutopilotStatus> {
  const out = new Map<string, AutopilotStatus>();

  for (const log of logs) {
    const task = log.chaseTasks.find((t) => t.status === "pending");
    const code = log.reminderRule.targetMilestoneCode;
    const tx = log.transaction;

    if (task?.fallbackKind) { out.set(log.id, { kind: "manual", reason: fallbackReason(task.fallbackKind) }); continue; }
    if (task?.priority === "escalated") { out.set(log.id, { kind: "manual", reason: "You've chased and escalated it" }); continue; }
    if (!code) { out.set(log.id, { kind: "manual", reason: null }); continue; }

    const side: "vendor" | "purchaser" = code.startsWith("PM") ? "purchaser" : "vendor";
    const dueDate = new Date(log.nextDueDate);
    const agencyClientOk = tx.agencyId ? flags.agencyClientChase.get(tx.agencyId) !== false : false;
    const agencySolOk = tx.agencyId ? flags.agencySolicitorChase.get(tx.agencyId) === true : false;

    // Client autopilot
    const clientOn = flags.clientChaseEnabled && agencyClientOk && !tx.clientEmailsPaused;
    const clientCode = isClientChaseable(code);
    if (clientOn && clientCode) {
      const clientRole = side === "vendor" ? "vendor" : "purchaser";
      const reachable = tx.contacts.some((c) => c.roleType === clientRole && c.email && c.portalToken && !c.unsubscribedAt);
      if (reachable) { out.set(log.id, { kind: "auto", pipeline: "client", nextSend: nextCronRun(dueDate, CLIENT_CRON) }); continue; }
    }

    // Solicitor autopilot
    const solPaused = side === "vendor" ? tx.vendorSolicitorEmailsPaused : tx.purchaserSolicitorEmailsPaused;
    const solOn = flags.solicitorGlobalEnabled && agencySolOk && !solPaused;
    const solCode = solicitorCodesForSide(side).has(code);
    const solContact = side === "vendor" ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;
    if (solOn && solCode) {
      if (solContact?.email) { out.set(log.id, { kind: "auto", pipeline: "solicitor", nextSend: nextCronRun(dueDate, SOLICITOR_CRON) }); continue; }
    }

    // Manual — say why, honestly.
    let reason: string | null = null;
    if (solCode && !solContact?.email) reason = "No solicitor on file yet";
    else if (clientCode && clientOn) reason = "No email on file for the client";
    else if (clientCode && !clientOn) reason = "Client auto-chase is off for this file";
    else if (solCode && !solOn) reason = "Solicitor auto-chase is off for this file";
    else reason = null; // not an automated step
    out.set(log.id, { kind: "manual", reason });
  }

  return out;
}
