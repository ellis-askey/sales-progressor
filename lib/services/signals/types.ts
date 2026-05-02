import type { SignalSeverity } from "@prisma/client";

export type TimeWindow = {
  current: { start: Date; end: Date; days: number };
  previous: { start: Date; end: Date; days: number };
};

export type SignalResult = {
  detectorName: string;
  /** Unique key within detectorName + windowStart — used for deduplication */
  dedupeKey: string;
  payload: Record<string, unknown>;
  confidence: number; // 0.0–1.0
  severity: SignalSeverity;
  windowStart: Date;
  windowEnd: Date;
};

export type Detector = (window: TimeWindow) => Promise<SignalResult[]>;
