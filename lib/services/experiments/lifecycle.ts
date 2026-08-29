// Experiment lifecycle management (ADMIN_08 §10).
// State machine: proposed → active → concluded | abandoned
// start(): snapshots baseline metrics, marks active
// conclude(): snapshots result metrics, sets outcome + conclusion note
// abandon(): marks abandoned with reason

import { prisma } from "@/lib/prisma";
import type { ExperimentOutcome } from "@prisma/client";
import { computeExperimentMetrics } from "@/lib/command/experiment-metrics";

type MetricSnapshot = {
  capturedAt: string;
  metrics: Record<string, number | null>;
};

async function captureMetricSnapshot(
  windowDays: number,
  anchorDate: Date
): Promise<MetricSnapshot> {
  const windowStart = new Date(anchorDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  // Shared vocabulary: platform metrics + feature metrics, all over the window.
  const metrics = await computeExperimentMetrics(windowStart, anchorDate);

  return {
    capturedAt: anchorDate.toISOString(),
    metrics: { ...metrics, windowDays },
  };
}

export async function startExperiment(
  id: string,
  now: Date = new Date()
): Promise<void> {
  const experiment = await prisma.experiment.findUniqueOrThrow({ where: { id } });

  if (experiment.status !== "proposed") {
    throw new Error(`Cannot start experiment in status '${experiment.status}'`);
  }

  const baseline = await captureMetricSnapshot(experiment.baselineWindowDays, now);

  await prisma.experiment.update({
    where: { id },
    data: {
      status: "active",
      startedAt: now,
      baselineSnapshot: baseline as object,
    },
  });
}

export async function concludeExperiment(
  id: string,
  outcome: ExperimentOutcome,
  conclusionNote: string,
  now: Date = new Date()
): Promise<void> {
  const experiment = await prisma.experiment.findUniqueOrThrow({ where: { id } });

  if (experiment.status !== "active") {
    throw new Error(`Cannot conclude experiment in status '${experiment.status}'`);
  }

  const result = await captureMetricSnapshot(experiment.resultWindowDays, now);

  await prisma.experiment.update({
    where: { id },
    data: {
      status: "concluded",
      outcome,
      conclusionNote,
      concludedAt: now,
      resultSnapshot: result as object,
    },
  });
}

export async function abandonExperiment(
  id: string,
  reason: string,
  now: Date = new Date()
): Promise<void> {
  const experiment = await prisma.experiment.findUniqueOrThrow({ where: { id } });

  if (experiment.status === "concluded" || experiment.status === "abandoned") {
    throw new Error(`Cannot abandon experiment in status '${experiment.status}'`);
  }

  await prisma.experiment.update({
    where: { id },
    data: {
      status: "abandoned",
      concludedAt: now,
      conclusionNote: reason,
    },
  });
}
