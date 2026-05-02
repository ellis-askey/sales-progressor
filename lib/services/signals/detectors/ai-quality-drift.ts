// Detector: ai_quality_drift
// Tracks changes in AI message quality indicators week-over-week:
//   - edit rate (wasEdited / total AI messages)
//   - average message length (content character count)
// Confidence based on volume of AI messages in window (ADMIN_07 §5.1).

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const MIN_AI_MESSAGES = 20;
const MIN_EDIT_RATE_DELTA = 0.10;  // 10pp change in edit rate
const MIN_LENGTH_DELTA = 0.20;     // 20% change in avg length

type AiStats = {
  count: number;
  editRate: number;
  avgLength: number;
};

async function getAiStats(start: Date, end: Date): Promise<AiStats> {
  const messages = await prisma.outboundMessage.findMany({
    where: {
      wasAiGenerated: true,
      createdAt: { gte: start, lt: end },
    },
    select: { wasEdited: true, content: true },
  });

  if (messages.length === 0) return { count: 0, editRate: 0, avgLength: 0 };

  const edited = messages.filter((m) => m.wasEdited).length;
  const totalLength = messages.reduce((acc, m) => acc + (m.content?.length ?? 0), 0);

  return {
    count: messages.length,
    editRate: edited / messages.length,
    avgLength: totalLength / messages.length,
  };
}

export const aiQualityDrift: Detector = async (window) => {
  const [current, previous] = await Promise.all([
    getAiStats(window.current.start, window.current.end),
    getAiStats(window.previous.start, window.previous.end),
  ]);

  if (previous.count < MIN_AI_MESSAGES) return [];

  const signals: SignalResult[] = [];

  // Confidence scales with message volume (ADMIN_07 §5.1)
  const volumeScore = Math.min(previous.count / 100, 0.8);

  // Edit rate drift: increasing edit rate = users are correcting AI output more often
  const editRateDelta = current.editRate - previous.editRate;
  if (Math.abs(editRateDelta) >= MIN_EDIT_RATE_DELTA) {
    const confidence = Math.min(volumeScore + Math.abs(editRateDelta) * 0.5, 0.90);
    if (confidence >= 0.2) {
      signals.push({
        detectorName: "ai_quality_drift",
        dedupeKey: "ai_quality_drift:edit_rate",
        payload: {
          indicator: "edit_rate",
          current: Math.round(current.editRate * 100),
          previous: Math.round(previous.editRate * 100),
          deltaPP: Math.round(editRateDelta * 100),
          nMessagesCurrent: current.count,
          nMessagesPrevious: previous.count,
          interpretation:
            editRateDelta > 0
              ? "Users are editing AI drafts more often — possible quality drop"
              : "Users are editing AI drafts less often — possible quality improvement",
        },
        confidence,
        severity: editRateDelta > MIN_EDIT_RATE_DELTA ? "leak" : "opportunity",
        windowStart: window.current.start,
        windowEnd: window.current.end,
      });
    }
  }

  // Message length drift: significant change in avg length
  if (previous.avgLength > 0) {
    const lengthDelta = (current.avgLength - previous.avgLength) / previous.avgLength;
    if (Math.abs(lengthDelta) >= MIN_LENGTH_DELTA) {
      const confidence = Math.min(volumeScore + Math.abs(lengthDelta) * 0.3, 0.85);
      if (confidence >= 0.2) {
        signals.push({
          detectorName: "ai_quality_drift",
          dedupeKey: "ai_quality_drift:message_length",
          payload: {
            indicator: "avg_message_length",
            current: Math.round(current.avgLength),
            previous: Math.round(previous.avgLength),
            deltaPercent: Math.round(lengthDelta * 100),
            nMessagesCurrent: current.count,
          },
          confidence,
          severity: "info",
          windowStart: window.current.start,
          windowEnd: window.current.end,
        });
      }
    }
  }

  return signals;
};
