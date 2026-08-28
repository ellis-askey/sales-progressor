import { callClaude } from "@/lib/anthropic";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { resolveDisplayStages, type ResolvedStage } from "@/lib/milestones/display-stages";

// The client "what's happening?" narrative — a short, warm, per-file weekly
// update, drafted from the file's REAL state (its current stage + whether it
// moved this week + any exchange date). Grounded, not free-form: it only sees a
// handful of high-confidence facts, so it can't invent progress or leak the
// other side's business. Returns null on any failure or a too-thin file, and
// the weekly-update caller falls back to the safe generic message.
//
// It NEVER auto-decides to send — it just produces text. The weekly cron owns
// the (agency-gated, quiet-clients-only) send, which is off until switched on.

// Replicated from agent-weekly-brief (not exported there): the stage the file
// is actually in right now, read like the file-page timeline strip.
function currentStageLabel(stages: ResolvedStage[]): string {
  const inProgress = stages.filter((s) => s.status === "in_progress");
  if (inProgress.length > 0) return inProgress[inProgress.length - 1].name;
  const upNext = stages.find((s) => s.status === "up_next");
  if (upNext) return upNext.name;
  if (stages.length > 0 && stages.every((s) => s.status === "complete")) return "Completing";
  const complete = stages.filter((s) => s.status === "complete");
  if (complete.length > 0) return complete[complete.length - 1].name;
  return "Getting started";
}

const SYSTEM = `You write one short, warm weekly update from a UK estate agency to a client about their property purchase or sale.

You are given the client's first name, whether it is a purchase or a sale, the property, the current stage, whether anything progressed this week, and any target exchange date. Write 2 or 3 short sentences in plain English, no jargon. Say where things are and reassure them it is in hand.

Hard rules:
- Use ONLY the facts you are given. Never invent specific steps, dates, documents, names, or anything about the other side of the chain.
- Never mention numbers of "steps" or internal progress counts.
- If nothing progressed this week, reassure that these stages naturally take time and you are watching it closely and chasing where needed. Do not imply a problem.
- Address the client by first name. Do not add a sign-off or signature.
- Voice: no dashes used as punctuation; no exclamation marks; never say "the system", "the platform" or "automatically" (say "we"); no titles (Mr/Mrs).

Return the message text only, nothing else.`;

export async function buildClientNarrative(input: {
  transactionId: string;
  agencyId: string;
  side: "purchaser" | "vendor";
  address: string;
  clientFirstName: string;
  expectedExchangeDate: Date | null;
  overridePredictedDate: Date | null;
  completionDate: Date | null;
}): Promise<string | null> {
  try {
    const { vendor, purchaser } = await getMilestonesForTransaction(input.transactionId, input.agencyId);
    const rows = [...vendor, ...purchaser];
    if (rows.length === 0) return null; // too thin → caller uses the generic fallback

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const movedThisWeek = rows.some(
      (r) => r.isComplete && r.completion?.completedAt && new Date(r.completion.completedAt) >= sevenDaysAgo,
    );
    const stageLabel = currentStageLabel(
      resolveDisplayStages(rows, {
        expectedExchangeDate: input.expectedExchangeDate,
        overridePredictedDate: input.overridePredictedDate,
        targetCompletionDate: input.completionDate,
      }),
    );

    const exch = input.overridePredictedDate ?? input.expectedExchangeDate ?? null;
    const exchStr = exch && exch.getTime() > Date.now()
      ? exch.toLocaleDateString("en-GB", { day: "numeric", month: "long" })
      : null;

    const facts = [
      `Client first name: ${input.clientFirstName}`,
      `This is their ${input.side === "purchaser" ? "purchase" : "sale"} at ${input.address}.`,
      `Current stage: ${stageLabel}.`,
      movedThisWeek ? `Something progressed this week.` : `Nothing has completed in the last week.`,
      exchStr ? `Target exchange date on record: ${exchStr}.` : `No exchange date set yet.`,
    ].join("\n");

    const narrative = (await callClaude(SYSTEM, facts, 400)).trim();
    return narrative.length > 0 ? narrative : null;
  } catch {
    return null;
  }
}
