// The prospect outreach flow: a fixed sequence of emails spaced over time,
// auto-queued for human approval. See the ProspectFlow / ProspectFlowStep models
// in the schema and app/actions/prospect-flow.ts for the actions. Pure config +
// helpers (no server imports) so the actions, the cron, and the UI all read the
// same source of truth. No em dashes in user-facing strings (Law 21).

import { buildTemplate, type TemplateCtx } from "./templates";

export type FlowStepDef = {
  templateKey: string;
  // Days after the PREVIOUS step actually sends before this step falls due.
  // 0 for the first step (due as soon as the flow starts).
  gapDays: number;
  // Short human label shown against the step in the prospect.
  label: string;
};

// The one built-in sequence. Editable per prospect at the draft level (the
// operator can change wording before approving each step) but the shape and
// timing are fixed here. Intro now, nudge +14d, re-engage +14d.
export const DEFAULT_SEQUENCE: FlowStepDef[] = [
  { templateKey: "cold_intro", gapDays: 0, label: "Intro" },
  { templateKey: "no_response", gapDays: 14, label: "Nudge" },
  { templateKey: "re_engage", gapDays: 14, label: "Re-engage" },
];

export const FLOW_SENDER_NAME = "Ellis";

export const FLOW_STEP_STATUS_LABEL: Record<string, string> = {
  scheduled: "Waiting",
  queued: "Ready to approve",
  sent: "Sent",
  skipped: "Skipped",
};

export const FLOW_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  halted: "Stopped",
  cancelled: "Cancelled",
};

// Why a flow stopped, phrased for the prospect UI ("Flow stopped because ...").
export const FLOW_HALT_REASON_LABEL: Record<string, string> = {
  replied: "they replied",
  opted_out: "they opted out",
  bounced: "an email bounced",
  manual: "you stopped it",
};

// Build a step's draft from its template. Pure: the caller supplies resolved
// context (first name, agency name, sender). Returns null for an unknown key.
export function buildStepDraft(templateKey: string, ctx: TemplateCtx) {
  return buildTemplate(templateKey, ctx);
}

export function sequenceStepLabel(index: number): string {
  return DEFAULT_SEQUENCE[index]?.label ?? `Step ${index + 1}`;
}

// Add whole days to a date without mutating the input.
export function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
