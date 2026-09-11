import { Prisma } from "@prisma/client";
import { commandDb } from "@/lib/command/prisma";
import { callClaude } from "@/lib/anthropic";
import { getBrandProfile } from "@/lib/command/content/brand";
import { getBalance } from "@/lib/command/content/balance";
import { buildWeeklyPlanPrompt, parseWeeklyPlan } from "@/lib/command/content/prompts/weekly-plan-prompt";

// Content settings service (docs/active/content-brand/SPEC.md, Phase 5.2).
// Autopilot level + the AI-proposed week. Superadmin gating lives in the callers.

export type PlanItem = { day: string; pillar: string; idea: string; inboxItemId: string | null };
export type ContentSettingsData = {
  autopilotLevel: string;
  weeklyPlan: PlanItem[];
  weeklyPlanAt: Date | null;
};

export async function getContentSettings(): Promise<ContentSettingsData> {
  const row = await commandDb.contentSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  return {
    autopilotLevel: row?.autopilotLevel ?? "manual",
    weeklyPlan: row && Array.isArray(row.weeklyPlan) ? (row.weeklyPlan as PlanItem[]) : [],
    weeklyPlanAt: row?.weeklyPlanAt ?? null,
  };
}

async function upsert(data: Prisma.ContentSettingsUncheckedUpdateInput & Prisma.ContentSettingsUncheckedCreateInput): Promise<void> {
  const existing = await commandDb.contentSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existing) {
    await commandDb.contentSettings.update({ where: { id: existing.id }, data });
  } else {
    await commandDb.contentSettings.create({ data });
  }
}

export async function setAutopilotLevel(level: string): Promise<void> {
  await upsert({ autopilotLevel: level });
}

export async function refreshWeeklyPlan(): Promise<{ ok: boolean }> {
  const [profile, balance, inbox] = await Promise.all([
    getBrandProfile(),
    getBalance(),
    commandDb.contentInboxItem.findMany({
      where: { status: { in: ["new", "saved"] } },
      orderBy: { freshnessAt: "desc" },
      take: 8,
      select: { id: true, observation: true },
    }),
  ]);

  const balanceSummary = balance.enoughData
    ? balance.window.filter((s) => s.count > 0).map((s) => `${s.label}: ${s.count}`).join(", ") || "No pillar data yet."
    : "Not enough published posts yet to read balance.";

  const { system, user } = buildWeeklyPlanPrompt(profile, balanceSummary, inbox.map((i) => ({ observation: i.observation })));

  let raw: string;
  try {
    raw = await callClaude(system, user, 900);
  } catch {
    return { ok: false };
  }

  const slots = parseWeeklyPlan(raw);
  if (slots.length === 0) return { ok: false };

  const plan: PlanItem[] = slots.map((s) => ({
    day: s.day,
    pillar: s.pillar,
    idea: s.idea,
    inboxItemId: s.sourceIndex != null && inbox[s.sourceIndex] ? inbox[s.sourceIndex].id : null,
  }));

  await upsert({ weeklyPlan: plan as unknown as Prisma.InputJsonValue, weeklyPlanAt: new Date() });
  return { ok: true };
}
