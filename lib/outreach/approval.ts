// Approval snapshot + tamper-evident content hash (Build Order G). At approval we
// capture the EXACT approved content and hash it canonically. H must verify this
// hash before doing anything external; any drift means the approved content was
// mutated and the launch is refused.

import { createHash } from "crypto";

export type ApprovalSnapshot = {
  control: unknown; // control variant emails (frozen incumbent)
  challenger: unknown; // challenger variant emails
  targetSegment: unknown;
  exclusions: unknown;
  allocationPct: number | null;
  primaryMetric: string | null;
  secondaryMetrics: unknown;
};

// Stable, key-sorted representation so the hash is deterministic regardless of
// property order.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function canonical(v: any): any {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.keys(v)
      .sort()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((o: any, k) => {
        o[k] = canonical(v[k]);
        return o;
      }, {});
  }
  return v;
}

export function contentHash(snapshot: ApprovalSnapshot): string {
  return createHash("sha256").update(JSON.stringify(canonical(snapshot))).digest("hex");
}

// ── Controlled string domains (application-validated; never arbitrary) ──

// StrategyCycle.outcome
export const CYCLE_OUTCOMES = [
  "succeeded",
  "failed_strategist",
  "failed_reviewer",
  "failed_revision",
  "failed_guardrail",
] as const;
export type CycleOutcome = (typeof CYCLE_OUTCOMES)[number];

// StrategyCycle.failedStage
export const CYCLE_STAGES = [
  "strategist",
  "strategist_guardrail",
  "reviewer",
  "revision",
  "revision_guardrail",
  "persist",
] as const;
export type CycleStage = (typeof CYCLE_STAGES)[number];

export function isCycleOutcome(v: unknown): v is CycleOutcome {
  return typeof v === "string" && (CYCLE_OUTCOMES as readonly string[]).includes(v);
}
export function isCycleStage(v: unknown): v is CycleStage {
  return typeof v === "string" && (CYCLE_STAGES as readonly string[]).includes(v);
}

// Map an orchestrator fail-stage to a controlled cycle outcome.
export function outcomeForStage(stage: CycleStage): CycleOutcome {
  switch (stage) {
    case "strategist":
      return "failed_strategist";
    case "strategist_guardrail":
      return "failed_guardrail";
    case "reviewer":
      return "failed_reviewer";
    case "revision":
      return "failed_revision";
    case "revision_guardrail":
      return "failed_guardrail";
    case "persist":
      return "failed_strategist"; // persistence failure is rare; treat as pipeline failure
  }
}
