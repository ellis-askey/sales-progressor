"use server";

// AI-generated property-file summary, ellis-only prototype.
//
// Build context → strict PII redaction → Anthropic Haiku 4.5 → JSON schema
// matching the SummaryJson type below. No caching, no DB writes. console.log
// surfaces token counts + cost estimate so we can spot-check spend.
//
// PII rules match the existing chase-generation pattern at
// app/api/ai/generate-chase/route.ts:168-175 — see the helpers at the top
// of this file. If this prototype graduates beyond ellis-only, the redaction
// pass needs hardening (LLM-side post-check at minimum).

import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { getTransactionByScope } from "@/lib/services/transactions";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { getReminderLogsForTransaction } from "@/lib/services/reminders";
import { getActivityTimeline } from "@/lib/services/comms";
import { listManualTasksForTransaction } from "@/lib/services/manual-tasks";
import { anthropic } from "@/lib/anthropic";

const ALLOWED_EMAILS = new Set(["ellis@thesalesprogressor.co.uk"]);
const MODEL = "claude-haiku-4-5-20251001";

export type SummaryJson = {
  status: string;
  keyDates: Array<{ label: string; date: string; note?: string }>;
  whereItsStuck: string;
  recentActivity: string;
  watchOutFor: string;
};

export async function generateTransactionSummaryAction(transactionId: string):
  Promise<{ ok: true; summary: SummaryJson } | { ok: false; error: string }> {
  const session = await requireSession();

  if (!ALLOWED_EMAILS.has(session.user.email ?? "")) {
    return { ok: false, error: "Forbidden" };
  }

  const scope = getAccessScope(session);

  // Fetch everything in parallel. All five helpers are already-existing
  // queries used by the transaction detail page.
  const [transaction, milestoneData, reminderLogs, activityEntries, manualTasks] = await Promise.all([
    getTransactionByScope(transactionId, scope),
    getMilestonesForTransaction(transactionId, null).catch(() => null),
    getReminderLogsForTransaction(transactionId, null).catch(() => []),
    getActivityTimeline(transactionId, null).catch(() => []),
    listManualTasksForTransaction(transactionId, null).catch(() => []),
  ]);

  if (!transaction) return { ok: false, error: "Transaction not found" };

  // ── Build the list of contact first names for redaction. We pass this to
  // the string sanitiser so any free-text field containing them is censored.
  const contactFirstNames = transaction.contacts
    .map((c) => firstNameOf(c.name))
    .filter((n) => n.length > 1);

  // ── Redacted context object — only this object goes to Anthropic.
  const context = {
    property: {
      address: shortenAddress(transaction.propertyAddress),
      tenure: transaction.tenure,
      purchaseType: transaction.purchaseType,
      isShareOfFreehold: transaction.isShareOfFreehold,
      serviceType: transaction.serviceType,
      purchasePricePence: transaction.purchasePrice,
      status: transaction.status,
      agencyName: transaction.agency.name,
    },
    dates: {
      createdAt: transaction.createdAt.toISOString().slice(0, 10),
      expectedExchangeDate: transaction.expectedExchangeDate?.toISOString().slice(0, 10) ?? null,
      completionDate: transaction.completionDate?.toISOString().slice(0, 10) ?? null,
      holdPeriods: transaction.holdPeriods.map((h) => ({
        startedAt: h.startedAt.toISOString().slice(0, 10),
        endedAt: h.endedAt?.toISOString().slice(0, 10) ?? null,
      })),
      daysElapsed: Math.floor((Date.now() - transaction.createdAt.getTime()) / 86400000),
    },
    parties: {
      contactsByRole: countByRole(transaction.contacts),
      hasVendorSolicitor: !!transaction.vendorSolicitorContactId,
      hasPurchaserSolicitor: !!transaction.purchaserSolicitorContactId,
      hasBroker: !!transaction.brokerContactId,
      progressedBy: transaction.progressedBy,
    },
    // Steps — internal codes (VM*/PM*) are deliberately dropped here so they
    // can never reach the model. The model is told to use plain step names.
    steps: milestoneData
      ? [...milestoneData.vendor, ...milestoneData.purchaser]
          .map((m) => ({
            side: m.side === "vendor" ? "seller" : "buyer",
            name: m.name,
            state: m.isComplete ? "done" : m.isNotRequired ? "skipped" : m.completion?.state ?? "open",
            completedAt: m.completion?.completedAt?.toISOString().slice(0, 10) ?? null,
            eventDate: m.completion?.eventDate?.toISOString().slice(0, 10) ?? null,
            confirmedByClient: m.completion?.confirmedByPortal ?? false,
          }))
      : [],
    reminders: reminderLogs.map((l) => ({
      // ruleName is the human-readable rule; targetMilestoneCode intentionally
      // omitted so the model never sees the schema code.
      ruleName: l.reminderRule.name,
      status: l.status,
      snoozedUntil: l.snoozedUntil?.toISOString().slice(0, 10) ?? null,
      chaseableFrom: l.nextDueDate.toISOString().slice(0, 10),
      chaseCount: l.chaseTasks[0]?.chaseCount ?? 0,
      priority: l.chaseTasks[0]?.priority ?? "normal",
    })),
    manualTasks: manualTasks.map((t) => ({
      title: redact(t.title, contactFirstNames),
      status: t.status,
      dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
    })),
    // Recent timeline — milestone codes dropped, names only. Most recent first.
    activityRecent: activityEntries
      .slice(0, 30)
      .map((e) => {
        if (e.kind === "milestone") {
          return {
            kind: "step" as const,
            at: e.at?.toISOString().slice(0, 10) ?? null,
            stepName: e.milestoneName,
            skipped: e.isNotRequired,
            confirmedByClient: e.confirmedByClient,
          };
        }
        // Comm entry — withhold content if it names any contact, otherwise redact.
        const namesPresent = e.contactNames.length > 0;
        const safeContent = namesPresent
          ? "[contained contact name — content withheld]"
          : redact(e.content, contactFirstNames);
        return {
          kind: "comm" as const,
          at: e.at.toISOString().slice(0, 10),
          type: e.type,
          method: e.method,
          visibleToClient: e.visibleToClient,
          wasAiGenerated: e.wasAiGenerated,
          content: safeContent.length > 400 ? safeContent.slice(0, 400) + "…" : safeContent,
        };
      }),
  };

  const userMessage = JSON.stringify(context, null, 2);

  let msg;
  try {
    msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    console.error("[transaction-summary] anthropic call failed", err);
    return { ok: false, error: "Couldn't reach the AI service. Try again in a moment." };
  }

  const block = msg.content[0];
  if (block.type !== "text") {
    return { ok: false, error: "Unexpected response shape from the AI service." };
  }

  // Token + cost log — Haiku 4.5 pricing as of the prompt cutoff:
  // input ≈ $0.80/1M, output ≈ $4/1M. Real-time pricing may drift; this is a
  // gut-check, not an audit trail.
  const inTok = msg.usage.input_tokens;
  const outTok = msg.usage.output_tokens;
  const cost = (inTok / 1_000_000) * 0.80 + (outTok / 1_000_000) * 4.00;
  console.log(
    `[transaction-summary] tx=${transactionId} in=${inTok} out=${outTok} cost≈$${cost.toFixed(5)}`,
  );

  let parsed: SummaryJson;
  try {
    parsed = JSON.parse(stripJsonFence(block.text));
  } catch {
    return { ok: false, error: "Couldn't parse summary, try again." };
  }

  if (!validShape(parsed)) {
    return { ok: false, error: "Summary shape was invalid, try again." };
  }

  return { ok: true, summary: parsed };
}

// ── PII redaction helpers ─────────────────────────────────────────────────

// Strip postcode + town. Keep street line only. Lifted from
// app/api/ai/generate-chase/route.ts:168-175 — duplicated here rather than
// extracted to avoid touching the existing chase flow on a prototype.
function shortenAddress(full: string): string {
  const parts = full.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return full;
  const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
  const hasPostcode = POSTCODE_RE.test(parts[parts.length - 1]);
  if (hasPostcode && parts.length >= 3) return parts.slice(0, -2).join(", ");
  return parts.slice(0, -1).join(", ");
}

function firstNameOf(fullName: string): string {
  return (fullName.trim().split(/\s+/)[0] ?? "").trim();
}

// Replace any of the supplied first names with "[redacted]" (whole-word, case-
// insensitive). False-negative-prone — a name like "Will" or "Mark" gets
// scrubbed everywhere. The prompt instructs Claude to use role labels only,
// which is the primary defence; this is belt-and-braces.
function redact(input: string, firstNames: string[]): string {
  if (!input) return input;
  let out = input;
  for (const n of firstNames) {
    if (n.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegex(n)}\\b`, "gi");
    out = out.replace(re, "[redacted]");
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countByRole(contacts: { roleType: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of contacts) {
    out[c.roleType] = (out[c.roleType] ?? 0) + 1;
  }
  return out;
}

// Strip a ```json … ``` fence if Claude wrapped the output despite the
// instruction not to.
function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

function validShape(x: unknown): x is SummaryJson {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.status === "string" &&
    Array.isArray(o.keyDates) &&
    typeof o.whereItsStuck === "string" &&
    typeof o.recentActivity === "string" &&
    typeof o.watchOutFor === "string"
  );
}

// System prompt — written to docs/polish-pass/VOICE_GUIDELINES.md.
// Audience: the platform owner reading a file summary on his phone between
// meetings. Voice: brisk professional colleague, plain English, no system
// self-references, no schema codes ever.
const SYSTEM_PROMPT = `You write internal summaries of UK property-sale files for a senior reader.
The reader is reviewing the file on a phone. Summaries must be scannable, plain,
factual. You receive a JSON snapshot — PII is already redacted; internal codes
are already stripped.

VOICE — non-negotiable
- Sound like a competent colleague, brisk and efficient. No filler, no hedging.
- Active voice. Present tense for current states. Imperative for actions.
- One or two short sentences per point. No paragraphs.
- No exclamation marks. No "Oops", "Hmm", "we're working on it".
- Say "step" not "milestone". Say "sale" or "the file" not "transaction".
  Say "buyer" / "seller" — not "purchaser" / "vendor" — in the prose.
- Refer to parties by role only: "the buyer", "the seller's solicitor",
  "the broker". Never invent names.
- Industry terms stay verbatim: searches, survey, enquiries, exchange,
  completion, solicitor, freehold, leasehold, EPC, MOS, Land Registry,
  stamp duty.

BANNED PHRASES (do not use)
- "blocked waiting on", "locked awaiting", "flow through", "critical path",
  "pending in queue", "surfacing", "the system shows", "downstream",
  "upstream", "in progress" used as a state label, "outstanding milestones".
- Anything that describes what the platform is doing rather than what the
  file's status actually is.

BANNED OUTPUT
- Internal codes of any kind. Step codes (VM*, PM*) must never appear. If
  you see codes anywhere in the input, treat them as system-only noise and
  use the human step name instead.
- Schema field names ("nextDueDate", "snoozedUntil", "chaseCount").
- Anything not present in the input data. No invented dates, steps, or
  advice. If a field has nothing useful to say, keep the field empty or
  one short factual sentence — never fabricate.

OUTPUT FORMAT
STRICT JSON only. No markdown, no commentary, no code fence. Schema:
{
  "status": "one short sentence on where the file sits in its journey",
  "keyDates": [
    { "label": "Created" | "Expected exchange" | "Last activity" | "Completion" | "On hold from" | "On hold to",
      "date": "YYYY-MM-DD",
      "note": "optional one-liner" }
  ],
  "whereItsStuck": "Lead with who's the hold-up. Name the open steps in plain English. Flag overdue items. 1-3 short sentences total.",
  "recentActivity": "Most recent items first, each with its date. What's been confirmed, what's been chased. 1-3 short sentences.",
  "watchOutFor": "What's chaseable next and from when. Note what each unblocks if relevant. 1-2 short sentences."
}

CALIBRATION
Bad: "Purchaser side is now blocked waiting on: searches to be ordered (PM8),
survey to be booked (PM9), and initial enquiries to be raised (PM14). Vendor
side is locked awaiting purchaser's enquiries to flow through before
proceeding to exchange phase."
Good: "The buyer's side is the hold-up. Three steps still open: searches
ordered, survey booked, and initial enquiries raised. The seller's side
can't move toward exchange until the buyer's enquiries are in. Nothing
overdue yet."

Bad: "Monitor purchaser's search orders and survey booking closely — both
due chaseable 1 June. Initial enquiries chase active from 3 June. Ensure
no slippage on searches/survey as these are critical path items before
contract exchange."
Good: "Searches and the survey are both chaseable from 1 June, initial
enquiries from 3 June. These are the steps that hold up exchange — keep
them moving."

Total length: under 500 words across all fields. Return ONLY the JSON.`;
