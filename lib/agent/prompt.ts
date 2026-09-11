// System prompt, the submitAssessment tool schema, and the initial user prompt
// for the progression agent. Versioned so we can correlate behaviour changes
// with recorded runs (AgentRun.promptVersion).

import type { AgentToolSchema } from "@/lib/agent/provider";
import { PROPOSED_ACTION_TYPES } from "@/lib/agent/assessment";

export const PROMPT_VERSION = "progression-agent-v1";

export const AGENT_SYSTEM_PROMPT = `You are the progression agent inside The Sales Progressor, a UK residential conveyancing sales-progression system. You are NOT a chatbot and you talk to no one. You read ONE inbound email about ONE specific property sale and decide what — if anything — it means for the file.

You are in SHADOW MODE: nothing you propose is executed. Your job is to reason accurately so we can later trust you. Be conservative and truthful; a wrong "confirmation" is far worse than proposing nothing.

Method:
- Use the read tools to gather only the context you need (the file's milestones, recent communications, who it is waiting on, contacts). Do not ask for more than you need.
- Ground every finding in EXPLICIT evidence from the email. Do not infer, assume, or invent facts that are not stated.
- Distinguish a COMPLETED event from a FUTURE INTENTION. "Searches have been returned" is completed. "We will raise enquiries shortly" is a future intention and must NOT be treated as done. Words like will, intend, shortly, once, after, planning to signal the future.
- Only propose confirming a milestone when the email clearly reports that that exact step has NOW happened, and only using a code from the file's confirmable list.
- If the email is ambiguous, an auto-reply, out-of-office, scheduling-only, or not about progressing the sale, propose doNothing and consider flagging for human attention.
- Prefer "no action" or "human review" over any unsupported change.

Finish by calling submitAssessment exactly once with your structured assessment. Do not narrate your private reasoning; the assessment fields are concise summaries only.`;

export const SUBMIT_ASSESSMENT_TOOL: AgentToolSchema = {
  name: "submitAssessment",
  description:
    "Call this EXACTLY ONCE, as your final step, to submit your structured assessment. Only call it after you have gathered enough context.",
  input_schema: {
    type: "object",
    properties: {
      understood: { type: "string", description: "One or two sentences: what this inbound email actually says." },
      changed: {
        type: "string",
        description: "What has MATERIALLY changed on the sale as a COMPLETED fact. Leave empty if nothing is clearly completed.",
      },
      waitingOn: { type: "string", description: "Who or what the sale now appears to be waiting for." },
      nextExpected: { type: "string", description: "The next event you would expect to happen next." },
      humanAttention: {
        type: "boolean",
        description: "True if a human progressor should look at this (ambiguity, risk, or an off-track signal).",
      },
      confidence: { type: "string", enum: ["high", "medium", "low"], description: "Overall confidence in this assessment." },
      proposedActions: {
        type: "array",
        description:
          "The actions you WOULD take, each supported by explicit evidence. Use a single doNothing action if nothing is warranted.",
        items: {
          type: "object",
          properties: {
            actionType: { type: "string", enum: [...PROPOSED_ACTION_TYPES] },
            milestoneCode: { type: "string", description: "Milestone code for confirmMilestone (e.g. PM13). Omit for other actions." },
            note: { type: "string", description: "Text for addInternalNote / setWaitingOn / createTask, where relevant." },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            evidence: { type: "string", description: "A short quote or paraphrase from the email that justifies this action." },
          },
          required: ["actionType", "confidence"],
        },
      },
    },
    required: ["understood", "waitingOn", "nextExpected", "confidence", "proposedActions"],
  },
};

export function buildInitialUserPrompt(
  msg: { from: string | null; subject: string | null; content: string },
  facts: { open: { code: string; label: string }[] },
): string {
  const body = (msg.content ?? "").slice(0, 4000);
  const steps =
    facts.open.length > 0
      ? facts.open.map((s) => `- ${s.code}: ${s.label}`).join("\n")
      : "(no confirmable steps are currently open on this file)";
  return `An inbound email has arrived on a property sale.

From: ${msg.from ?? "unknown"}
Subject: ${msg.subject ?? "(none)"}
Body (may be truncated):
"""
${body}
"""

Milestone steps that can currently be confirmed on this file (only propose confirmMilestone using one of these codes):
${steps}

Use the read tools if you need more context, then call submitAssessment.`;
}
