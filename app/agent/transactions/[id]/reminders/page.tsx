// File-detail — Reminders tab (route segment). Identical to the /agent/work-queue
// Reminders page — same data pipeline (getAgentReminderLogs + resolveAutopilot) and
// the same AgentRemindersList (Needs you / Coming up / Chased / On autopilot, and
// every interaction) — scoped to this one property.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { getAgentReminderLogs } from "@/lib/services/reminders";
import { AgentRemindersList } from "@/components/reminders/AgentRemindersList";
import { prisma } from "@/lib/prisma";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { getMilestoneContext, getMilestoneResponsible } from "@/lib/chase/milestone-glossary";
import { resolveAutopilot, type AutopilotFlags } from "@/lib/services/reminder-autopilot";
import { toUKDateStr } from "@/lib/utils";
import { classifyReminder, countActionable } from "@/lib/reminders/classify";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";
import { TabBadgeReporter } from "@/components/transaction/TabBadgeReporter";

export const unstable_dynamicStaleTime = 300;

function isSunday(d: Date) { return d.getDay() === 0; }
function addBusinessDays(from: Date, days: number): Date {
  const r = new Date(from);
  let added = 0;
  while (added < days) { r.setDate(r.getDate() + 1); if (!isSunday(r)) added++; }
  return r;
}

export default async function RemindersTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalStaff, isAdminRole } = await loadFilePageContext(id);

  // Same visibility resolution the work-queue Reminders page uses, then scope the
  // fetch to this one (already-authorised) file.
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, session.user.role, isAdminRole)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const reminderLogs = await getAgentReminderLogs(vis, { transactionId: transaction.id });

  // Property photo (one file), keyed by tx for the list header.
  const signedPhotos = await getSignedUrlMap(
    reminderLogs.map((l) => l.transaction.photoStoragePath).filter((p): p is string => !!p),
  );
  const photoByTx = new Map<string, string | null>();
  for (const l of reminderLogs) {
    const p = l.transaction.photoStoragePath;
    photoByTx.set(l.transaction.id, p ? signedPhotos.get(p) ?? null : null);
  }

  // Per-milestone-code glossary + full step names (server-only reads).
  const milestoneInfo: Record<string, { outstanding: string; responsible: "client" | "solicitor" | null; name?: string }> = {};
  const targetCodes = new Set(reminderLogs.map((l) => l.reminderRule.targetMilestoneCode).filter((c): c is string => !!c));
  const milestoneNames = targetCodes.size
    ? new Map(
        (await prisma.milestoneDefinition.findMany({
          where: { code: { in: [...targetCodes] } },
          select: { code: true, name: true },
        })).map((d) => [d.code, d.name]),
      )
    : new Map<string, string>();
  for (const code of targetCodes) {
    const ctx = getMilestoneContext(code);
    milestoneInfo[code] = {
      outstanding: ctx?.outstanding ?? "",
      responsible: ctx ? getMilestoneResponsible(code) : null,
      name: milestoneNames.get(code),
    };
  }

  // Autopilot split — needs the on/off state of both send pipelines for the file.
  const agencyIds = [...new Set(reminderLogs.map((l) => l.transaction.agencyId).filter((a): a is string => !!a))];
  const [solSettings, agencies] = await Promise.all([
    prisma.solicitorChaseSettings.findFirst({ select: { enabledByDefault: true } }),
    agencyIds.length
      ? prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, chaseEmailsEnabled: true, solicitorChaseEnabled: true } })
      : Promise.resolve([]),
  ]);
  const flags: AutopilotFlags = {
    clientChaseEnabled: process.env.CLIENT_CHASE_ENABLED === "true",
    solicitorGlobalEnabled: solSettings?.enabledByDefault ?? false,
    agencyClientChase: new Map(agencies.map((a) => [a.id, a.chaseEmailsEnabled])),
    agencySolicitorChase: new Map(agencies.map((a) => [a.id, a.solicitorChaseEnabled])),
  };
  const autopilot = resolveAutopilot(reminderLogs, flags);

  // Header stat pills — same three groups as the Reminders page.
  const now = new Date();
  const upcomingCutoffStr = toUKDateStr(addBusinessDays(now, 3));
  let needsYouCount = 0, comingUpCount = 0, autopilotCount = 0;
  for (const l of reminderLogs) {
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) continue;
    if (autopilot.get(l.id)?.kind === "auto") { autopilotCount++; continue; }
    const bucket = classifyReminder(l, now);
    if (bucket === "escalated" || bucket === "overdue" || bucket === "due_today") needsYouCount++;
    else if (bucket === "upcoming" && toUKDateStr(l.nextDueDate) <= upcomingCutoffStr) comingUpCount++;
  }

  const statSegments: { label: string; anchor: string; colorKey: PillColor }[] = [];
  if (needsYouCount > 0)  statSegments.push({ label: `${needsYouCount} need${needsYouCount === 1 ? "s" : ""} you`, anchor: "#section-needs-you", colorKey: "danger" });
  if (comingUpCount > 0)  statSegments.push({ label: `${comingUpCount} coming up`, anchor: "#section-coming-up", colorKey: "warning" });
  if (autopilotCount > 0) statSegments.push({ label: `${autopilotCount} on autopilot`, anchor: "#section-autopilot", colorKey: "muted" });

  // On-hold files pause everywhere, so the tab badge reads 0 (as before).
  const actionable = transaction.status === "on_hold" ? 0 : countActionable(reminderLogs, now);
  const hideChase = session.user.role === "admin";

  return (
    <div className="space-y-4">
      <TabBadgeReporter tabKey="reminders" count={actionable} />
      {statSegments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {statSegments.map((seg) => (
            <StatPill key={seg.anchor} href={seg.anchor} label={seg.label} color={seg.colorKey} />
          ))}
        </div>
      )}
      <AgentRemindersList
        logs={reminderLogs}
        photoByTx={photoByTx}
        milestoneInfo={milestoneInfo}
        autopilot={autopilot}
        hideChase={hideChase}
        currentUserId={session.user.id}
      />
    </div>
  );
}
