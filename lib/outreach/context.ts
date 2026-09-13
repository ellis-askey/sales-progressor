// Aggregated model context for the outreach engine (Build Order D).
//
// This is the ONLY business/prospect information the strategist and reviewer ever
// see. It is deliberately compact and cost-controlled: aggregate counts, short
// static positioning/voice/rules, the current control baseline, and recent
// learnings. It contains NO prospect PII (no names, emails, addresses) and NO
// inferred attributes (independent/owner-led/eXp/etc.) — only verified structure.
//
// Never dump raw prospect rows or full email history into a model. Everything the
// model needs to reason about performance is pre-aggregated here.

import { commandDb } from "@/lib/command/prisma";
import { DEFAULT_SEQUENCE, FLOW_SENDER_NAME, buildStepDraft } from "@/lib/prospects/flow";
import { getOutreachMetrics, getAllSegmentFunnels, type OutreachMetrics, type SegmentFunnel } from "./metrics";
import { PERSONALISATION_ALLOWLIST, FORBIDDEN_INFERRED_ATTRIBUTES, type SegmentDimension } from "./segments";

// Placeholders shown to the model so it sees WHERE personalisation lands without
// any real prospect value. These are the only two personalisation fields allowed.
const PH = { firstName: "{{firstName}}", agencyName: "{{agencyName}}", senderName: FLOW_SENDER_NAME };

// Static positioning — the commercial truth the model may rely on. Kept short.
export const TSP_POSITIONING = {
  oneLiner: "The silence ends at offer accepted.",
  whatItIs:
    "Sales Progressor is UK estate-agency sales-progression software: it manages a sale from offer-accepted to completion with structured milestones, automated client updates, and live visibility for everyone in the chain.",
  commercials: [
    "Self-progressed files: free to use.",
    "Progression service: the first progressed sale is free, then charged only on a successful exchange.",
    "Do not lead with the word 'outsource' as the main positioning.",
  ],
  presentation: "Present the software naturally. It is not heavy sales copy.",
};

// Voice rules the model must follow when it writes copy (mirrors VOICE.md / Law 21).
export const VOICE_RULES = [
  "Ellis writing personally: straightforward, informal but professional, concise.",
  "No corporate waffle, no fake familiarity, no exaggerated claims.",
  "Do not open with 'I hope you're well'.",
  "Avoid sounding mass-generated; avoid gimmicky subject lines; avoid desperation.",
  "No em dashes. No exclamation marks in client-facing copy.",
  "No system self-references ('the system', 'the platform', 'automatically'); use 'we'll'.",
  "No hedging ('kind of', 'perhaps', 'we think', 'should be').",
];

// Hard rules the model does NOT control — stated so it designs within them.
export const OUTREACH_HARD_RULES = [
  "Application code owns eligibility, suppression, deduplication and contact limits, not the model.",
  "Only personalise using the allow-listed fields below, and only when a value is actually present.",
  "Never assert an unsupported fact about a prospect (e.g. agency type, owner-led, size, recent events).",
  "Follow-ups stop automatically on reply, opt-out, or bounce.",
  "Nothing sends without explicit human approval.",
];

export type OutreachContext = {
  objective: {
    definition: string;
    ordering: string[];
    note: string;
  };
  performance: {
    metrics: OutreachMetrics;
    segments: Record<SegmentDimension, SegmentFunnel[]>;
  };
  eligibility: {
    eligibleNow: number;
    suppressedOptedOut: number;
    suppressedBounced: number;
    alreadyConverted: number;
    note: string;
  };
  controlBaseline: {
    name: string;
    steps: { index: number; templateKey: string; label: string; gapDays: number; subject: string; body: string }[];
    note: string;
  };
  learnings: {
    statement: string;
    status: string;
    segment: string | null;
    metric: string | null;
    sampleSize: number | null;
    evidenceSummary: string | null;
  }[];
  positioning: typeof TSP_POSITIONING;
  voiceRules: string[];
  hardRules: string[];
  personalisation: {
    allowed: typeof PERSONALISATION_ALLOWLIST;
    forbiddenInferredAttributes: string[];
  };
};

export async function buildOutreachContext(): Promise<OutreachContext> {
  const [metrics, segments, eligibleNow, optedOut, bounced, converted, learningRows] = await Promise.all([
    getOutreachMetrics(),
    getAllSegmentFunnels(),
    commandDb.prospect.count({
      where: {
        archivedAt: null,
        optedOutAt: null,
        bouncedAt: null,
        convertedAgencyId: null,
        OR: [{ generalEmail: { not: null } }, { contacts: { some: { email: { not: null } } } }],
      },
    }),
    commandDb.prospect.count({ where: { optedOutAt: { not: null } } }),
    commandDb.prospect.count({ where: { bouncedAt: { not: null } } }),
    commandDb.prospect.count({ where: { convertedAgencyId: { not: null } } }),
    commandDb.outreachLearning.findMany({
      where: { stillActive: true },
      orderBy: { lastReviewedAt: "desc" },
      take: 20,
      select: { statement: true, status: true, segment: true, metric: true, sampleSize: true, evidenceSummary: true },
    }),
  ]);

  const steps = DEFAULT_SEQUENCE.map((s, index) => {
    const draft = buildStepDraft(s.templateKey, PH);
    return {
      index,
      templateKey: s.templateKey,
      label: s.label,
      gapDays: s.gapDays,
      subject: draft?.subject ?? "",
      body: draft?.body ?? "",
    };
  });

  return {
    objective: {
      definition:
        "Deepest reliable objective = ACTIVATED AGENCY: a contacted prospect converted to an agency AND that agency created at least one genuine sale (non-demo, non-migrated).",
      ordering: [
        "delivered",
        "reply",
        "interested (positive reply)",
        "convertedToAgency (signup)",
        "activatedAgency (>=1 genuine sale) [primary]",
        "furtherActivity (>=2 genuine sales)",
        "revenue (sparse; tracked not optimised)",
      ],
      note: "Opens and clicks are diagnostic leading indicators only. Never optimise primarily for them.",
    },
    performance: { metrics, segments },
    eligibility: {
      eligibleNow,
      suppressedOptedOut: optedOut,
      suppressedBounced: bounced,
      alreadyConverted: converted,
      note: "Eligibility/suppression are deterministic (application code). These are counts only; the model receives no prospect identities.",
    },
    controlBaseline: {
      name: "DEFAULT_SEQUENCE (current incumbent)",
      steps,
      note: "This is the current control. At launch its exact content + timing are snapshotted into the experiment so historical results never depend on this mutable config.",
    },
    learnings: learningRows,
    positioning: TSP_POSITIONING,
    voiceRules: VOICE_RULES,
    hardRules: OUTREACH_HARD_RULES,
    personalisation: {
      allowed: PERSONALISATION_ALLOWLIST,
      forbiddenInferredAttributes: FORBIDDEN_INFERRED_ATTRIBUTES,
    },
  };
}

// Compact JSON string sent to a model, plus a rough token estimate (chars / 4).
// The orchestrator (Build Order F) uses this; the budget guard keeps cost bounded.
export function serializeContext(ctx: OutreachContext): { json: string; approxTokens: number } {
  const json = JSON.stringify(ctx);
  return { json, approxTokens: Math.ceil(json.length / 4) };
}

// Sanity ceiling for the assembled context. Aggregates + static text should sit
// well under this; a breach means something unbounded leaked in (e.g. raw rows).
export const CONTEXT_TOKEN_BUDGET = 8000;
