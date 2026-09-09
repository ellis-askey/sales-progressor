import { Prisma } from "@prisma/client";
import { commandDb } from "@/lib/command/prisma";
import { callClaude } from "@/lib/anthropic";
import {
  buildVoiceLearningPrompt,
  parseCharacteristics,
  type EditPair,
  type VoiceCharacteristic,
} from "@/lib/command/content/prompts/voice-learning-prompt";

// Voice learning (docs/active/content-brand/SPEC.md, Phase 3.3). Read service +
// AI builder over the draft_edit_diff voice samples. Superadmin gating lives in
// the callers.

export type VoiceProfileData = {
  characteristics: VoiceCharacteristic[];
  generatedAt: Date | null;
  sampleCount: number;
  totalEdits: number;
};

// Don't draw conclusions from fewer than this many edits (anti-overfit).
export const MIN_EDITS = 3;

export async function getVoiceProfile(): Promise<VoiceProfileData> {
  const [row, totalEdits] = await Promise.all([
    commandDb.voiceProfile.findFirst({ orderBy: { updatedAt: "desc" } }),
    commandDb.voiceSample.count({ where: { sampleType: "draft_edit_diff" } }),
  ]);
  return {
    characteristics: row && Array.isArray(row.characteristics) ? (row.characteristics as VoiceCharacteristic[]) : [],
    generatedAt: row?.generatedAt ?? null,
    sampleCount: row?.sampleCount ?? 0,
    totalEdits,
  };
}

// Capture one AI-draft -> final edit as a voice sample. Content is Ellis's final
// (which also feeds the drafter's voice calibration); the AI baseline is kept in
// notes for the learning analysis.
export async function captureVoiceEdit(baseline: string, final: string): Promise<void> {
  const b = baseline.trim();
  const f = final.trim();
  if (!b || !f || b === f || f.length < 20) return; // only substantive edits
  await commandDb.voiceSample.create({
    data: { sampleType: "draft_edit_diff", content: f, notes: JSON.stringify({ baseline: b }) },
  });
}

export async function refreshVoiceProfile(): Promise<{ ok: boolean; reason?: "need_more" | "ai_error" }> {
  const samples = await commandDb.voiceSample.findMany({
    where: { sampleType: "draft_edit_diff" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { content: true, notes: true },
  });

  const pairs: EditPair[] = samples
    .map((s) => {
      let baseline = "";
      try {
        baseline = (JSON.parse(s.notes ?? "{}") as { baseline?: string }).baseline ?? "";
      } catch {
        baseline = "";
      }
      return { baseline, final: s.content };
    })
    .filter((p) => p.baseline);

  if (pairs.length < MIN_EDITS) return { ok: false, reason: "need_more" };

  const existing = await commandDb.voiceProfile.findFirst({ orderBy: { updatedAt: "desc" } });
  const dismissed = existing && Array.isArray(existing.dismissed) ? (existing.dismissed as string[]) : [];

  const { system, user } = buildVoiceLearningPrompt(pairs, dismissed);
  let raw: string;
  try {
    raw = await callClaude(system, user, 1000);
  } catch {
    return { ok: false, reason: "ai_error" };
  }

  const characteristics = parseCharacteristics(raw).filter((c) => !dismissed.includes(c.text));

  const data = {
    characteristics: characteristics as unknown as Prisma.InputJsonValue,
    generatedAt: new Date(),
    sampleCount: pairs.length,
  };
  if (existing) {
    await commandDb.voiceProfile.update({ where: { id: existing.id }, data });
  } else {
    await commandDb.voiceProfile.create({ data });
  }
  return { ok: true };
}

// Remove a characteristic and remember it as dismissed so a refresh won't re-add
// it (Ellis correcting a wrong assumption).
export async function dismissCharacteristic(text: string): Promise<void> {
  const existing = await commandDb.voiceProfile.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!existing) return;
  const chars = Array.isArray(existing.characteristics) ? (existing.characteristics as VoiceCharacteristic[]) : [];
  const dismissed = Array.isArray(existing.dismissed) ? (existing.dismissed as string[]) : [];
  await commandDb.voiceProfile.update({
    where: { id: existing.id },
    data: {
      characteristics: chars.filter((c) => c.text !== text) as unknown as Prisma.InputJsonValue,
      dismissed: [...dismissed, text] as unknown as Prisma.InputJsonValue,
    },
  });
}
