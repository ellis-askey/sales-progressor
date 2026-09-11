// The structured assessment the progression agent must produce, plus tolerant
// parsing. The model returns this via the submitAssessment tool (preferred) or,
// as a fallback, as JSON in its final text. Parsing is deliberately lenient on
// shape but strict on enums, and returns null on anything unparseable so the
// caller can fail safe (record an error run, propose nothing).

export const PROPOSED_ACTION_TYPES = [
  "confirmMilestone",
  "addInternalNote",
  "setWaitingOn",
  "createTask",
  "resolveTask",
  "escalateToHuman",
  "doNothing",
] as const;
export type ProposedActionType = (typeof PROPOSED_ACTION_TYPES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export type ProposedAction = {
  actionType: ProposedActionType;
  milestoneCode: string | null; // for confirmMilestone
  note: string | null; // for addInternalNote / setWaitingOn / createTask
  confidence: Confidence;
  evidence: string | null; // short paraphrase/quote justifying it (not chain-of-thought)
};

export type AgentAssessment = {
  understood: string; // what the agent understood from the email
  changed: string; // what it believes materially changed on the file
  waitingOn: string; // who/what the file now appears to wait for
  nextExpected: string; // the next expected event/action
  humanAttention: boolean;
  confidence: Confidence; // overall
  proposedActions: ProposedAction[];
};

const MAX_STR = 600;
const MAX_ACTIONS = 12;

function str(v: unknown, max = MAX_STR): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}
function nullableStr(v: unknown, max = MAX_STR): string | null {
  const s = str(v, max);
  return s.length > 0 ? s : null;
}
function confidence(v: unknown): Confidence {
  return (CONFIDENCE_LEVELS as readonly string[]).includes(v as string) ? (v as Confidence) : "low";
}

function parseAction(raw: unknown): ProposedAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const actionType = a.actionType;
  if (!(PROPOSED_ACTION_TYPES as readonly string[]).includes(actionType as string)) return null;
  return {
    actionType: actionType as ProposedActionType,
    milestoneCode: nullableStr(a.milestoneCode, 20)?.toUpperCase() ?? null,
    note: nullableStr(a.note),
    confidence: confidence(a.confidence),
    evidence: nullableStr(a.evidence),
  };
}

// Validate/coerce a raw object into an AgentAssessment. Returns null if the
// input isn't a usable object.
export function parseAssessment(raw: unknown): AgentAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const actionsRaw = Array.isArray(o.proposedActions) ? o.proposedActions.slice(0, MAX_ACTIONS) : [];
  const proposedActions = actionsRaw.map(parseAction).filter((a): a is ProposedAction => a !== null);
  return {
    understood: str(o.understood),
    changed: str(o.changed),
    waitingOn: str(o.waitingOn, 200),
    nextExpected: str(o.nextExpected, 200),
    humanAttention: o.humanAttention === true,
    confidence: confidence(o.confidence),
    proposedActions,
  };
}

// Fallback: extract a JSON assessment from free text (fenced or bare).
export function parseAssessmentFromText(text: string | null | undefined): AgentAssessment | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return parseAssessment(JSON.parse(cleaned.slice(start, end + 1)));
  } catch {
    return null;
  }
}
