import { commandDb } from "@/lib/command/prisma";
import { buildInsightContext } from "@/lib/services/insight/context";

// Candidate gathering for the content inbox (docs/active/content-brand/SPEC.md,
// Phase 1.3). Pulls real, ANONYMISED things worth talking about from three
// sources and hands them to the enricher. Nothing here names an agency or a
// customer (Law 20): only aggregate signals are whitelisted, and their payloads
// are stripped of any identifying keys before they leave this file.

export type Candidate = {
  dedupeKey: string; // stable — a re-run never duplicates the same source
  sourceType: string;
  observation: string;
  evidence?: Record<string, unknown>;
  sourceSignalId?: string;
  sourceThoughtId?: string;
  freshnessAt: Date;
};

// Only aggregate, non-identifying detectors are content-safe. Detectors that key
// on a single agency/customer (silent_agency, revenue_at_risk, portal_gone_quiet,
// chase_not_landing, solicitor_confirm_pending, quote_inbox_aging) are excluded
// on purpose — they must never turn into public copy.
const SAFE_DETECTORS = new Set([
  "metric_delta",
  "funnel_drop",
  "cohort_pattern",
  "source_performance",
  "content_performance",
]);

const DETECTOR_SOURCE_TYPE: Record<string, string> = {
  metric_delta: "product_data",
  funnel_drop: "product_data",
  cohort_pattern: "customer_behaviour",
  source_performance: "product_data",
  content_performance: "revisit",
};

const DETECTOR_LABEL: Record<string, string> = {
  metric_delta: "A platform metric moved week on week",
  funnel_drop: "A step in the journey is leaking",
  cohort_pattern: "A pattern showed up across a group of sales",
  source_performance: "One acquisition source is behaving differently",
  content_performance: "One of your past posts performed notably",
};

// Drop anything that could identify a real agency, customer, or person before
// the payload is shown to the model or stored.
const IDENTIFYING = /(name|agency|agencyid|firm|email|contact|address|postcode|user|client)/i;
function sanitisePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "dedupeKey") continue;
    if (IDENTIFYING.test(k)) continue;
    if (typeof v === "object" && v !== null) continue; // keep it flat + safe
    out[k] = v;
  }
  return out;
}

export async function gatherCandidates(now: Date): Promise<Candidate[]> {
  const [topics, thoughts, insight] = await Promise.all([
    commandDb.contentTopic.findMany({
      where: { status: "pending" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
    commandDb.ellisThought.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    buildInsightContext(now),
  ]);

  const candidates: Candidate[] = [];

  for (const t of topics) {
    candidates.push({
      dedupeKey: `topic:${t.id}`,
      sourceType: t.source === "manual" ? "manual" : "product_data",
      observation: t.text,
      freshnessAt: t.createdAt,
    });
  }

  for (const th of thoughts) {
    candidates.push({
      dedupeKey: `thought:${th.id}`,
      sourceType: "saved_thought",
      observation: th.body,
      sourceThoughtId: th.id,
      freshnessAt: th.createdAt,
    });
  }

  for (const s of insight.activeSignals) {
    if (!SAFE_DETECTORS.has(s.detectorName)) continue;
    const payload = sanitisePayload((s.payload ?? {}) as Record<string, unknown>);
    candidates.push({
      dedupeKey: `signal:${s.detectorName}:${(s.payload as Record<string, unknown>)?.dedupeKey ?? s.id}`,
      sourceType: DETECTOR_SOURCE_TYPE[s.detectorName] ?? "product_data",
      observation: DETECTOR_LABEL[s.detectorName] ?? s.detectorName.replace(/_/g, " "),
      evidence: {
        detector: s.detectorName,
        confidence: s.confidence,
        window: { start: s.windowStart, end: s.windowEnd },
        figures: payload,
      },
      sourceSignalId: s.id,
      freshnessAt: s.lastSeenAt ?? s.detectedAt,
    });
  }

  return candidates;
}
