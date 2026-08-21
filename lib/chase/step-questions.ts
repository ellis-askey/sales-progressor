// WhatsApp check-in message builder (2026-08-19, upgraded same day on
// founder feedback: greeting by time of day, warm intro/sign-off,
// solicitor-owned steps included, natural connectors so a run of
// questions doesn't read robotic).
//
// Copy rules:
//   - Every question is FULLY hand-written per milestone code, verb and
//     tense baked in. No prefix-gluing, so there is no tense matrix.
//   - "{firm}" interpolates the side's solicitor firm name, falling back
//     to "your solicitor".
//   - Each question stands alone AND reads naturally in a run.
//   - The map doubles as the allowlist: codes absent here are never
//     copyable (bilateral gates, exchange/completion, agent actions).
//   - This is the AGENT's own WhatsApp voice, not platform copy, so the
//     founder-approved intro keeps its exclamation mark.

export const STEP_QUESTIONS: Record<string, string> = {
  // ── Seller side: client-owned ────────────────────────────────────────
  VM1:  "Have you instructed your solicitor yet?",
  VM2:  "Have you received the memorandum of sale?",
  VM3:  "Have you received the welcome pack from {firm}?",
  VM4:  "Have you been able to complete your ID checks with {firm}?",
  VM5:  "Have the property information forms arrived from {firm}?",
  VM6:  "Have you returned the completed property forms to {firm}?",
  VM11: "Have you been able to give {firm} your input on the enquiries?",
  VM14: "Have you been able to give {firm} your input on the follow-up enquiries?",
  VM16: "Have your contract documents arrived from {firm} for signing?",
  VM17: "Have you signed and returned your contract documents?",

  // ── Seller side: solicitor-owned, asked from the client's vantage ────
  VM7:  "Has {firm} sent the draft contract pack over to the buyer's solicitor yet?",
  VM8:  "Has {firm} requested the management pack yet?",
  VM9:  "Has the management pack come back to {firm} yet?",
  VM10: "Have the buyer's enquiries come through to {firm} yet?",
  VM12: "Has {firm} sent the replies to the enquiries across yet?",
  VM13: "Have the buyer's follow-up enquiries come through to {firm} yet?",
  VM15: "Has {firm} sent the replies to the follow-up enquiries yet?",

  // ── Buyer side: client-owned ─────────────────────────────────────────
  PM1:  "Have you instructed your solicitor yet?",
  PM2:  "Have you received the memorandum of sale?",
  PM3:  "Have you been able to complete your ID checks with {firm}?",
  PM4:  "Have you paid the money on account to {firm}?",
  PM5:  "Have you submitted your full mortgage application?",
  PM9:  "Have you booked your survey?",
  PM10: "Have you received your survey report?",
  PM21: "Have you received the final report from {firm}?",
  PM22: "Have your contract documents arrived from {firm} for signing?",
  PM23: "Have you signed and returned your contract documents?",
  PM24: "Have you transferred your deposit to {firm}?",

  // ── Buyer side: solicitor / lender owned ─────────────────────────────
  PM6:  "Has your lender booked the valuation yet?",
  PM7:  "Has the draft contract pack arrived with {firm} yet?",
  PM8:  "Has {firm} ordered the searches yet?",
  PM11: "Has your mortgage offer come through yet?",
  PM12: "Has the management pack arrived with {firm} yet?",
  PM13: "Have the search results come back yet?",
  PM14: "Has {firm} raised the initial enquiries with the seller's side yet?",
  PM15: "Have the replies to the enquiries come back to {firm} yet?",
  PM16: "Has {firm} finished reviewing the replies to the enquiries?",
  PM17: "Has {firm} raised the follow-up enquiries yet?",
  PM18: "Have the replies to the follow-up enquiries come back yet?",
  PM19: "Has {firm} finished reviewing the follow-up replies?",
  PM20: "Has {firm} confirmed all enquiries are now satisfied?",
};

export type MilestoneForQuestions = {
  code: string;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
};

export type DueStep = { code: string; question: string };

/** Outstanding check-in-able steps for a side, journey order preserved,
 * firm name interpolated ("your solicitor" when the file has no firm). */
export function buildDueSteps(
  milestones: MilestoneForQuestions[],
  firmName: string | null,
): DueStep[] {
  const firm = firmName?.trim() || "your solicitor";
  return milestones
    .filter((m) => !m.isComplete && !m.isNotRequired && m.isAvailable && STEP_QUESTIONS[m.code])
    .map((m) => ({ code: m.code, question: STEP_QUESTIONS[m.code].replaceAll("{firm}", firm) }));
}

// Connectors keep a run of questions from sounding robotic. First
// question is bare; later ones cycle through these. The following
// question keeps its own grammar; only its first letter drops to
// lowercase after a connector.
const CONNECTORS = ["Also, ", "And ", "Plus, "] as const;

function withConnector(question: string, index: number): string {
  if (index === 0) return question;
  const connector = CONNECTORS[(index - 1) % CONNECTORS.length];
  return connector + question.charAt(0).toLowerCase() + question.slice(1);
}

/** The full message the button puts on the clipboard. clientCount is the
 * number of clients in the side's group (drives "both"/"all"). `now`
 * injectable for tests; the component passes the click moment so the
 * greeting matches the agent's clock. */
export function buildCheckInMessage(args: {
  steps: DueStep[];
  clientCount: number;
  now?: Date;
}): string | null {
  const { steps, clientCount } = args;
  if (steps.length === 0) return null;
  const now = args.now ?? new Date();

  const hour = now.getHours();
  const timeWord = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const groupWord = clientCount === 2 ? " both" : clientCount >= 3 ? " all" : "";

  const intro = "Hope you are well. Just checking in to see how things are coming along!";
  const questions = steps.map((s, i) => withConnector(s.question, i)).join(" ");
  const closing = "Any updates when you get a chance would be great, thanks.";

  return `Good ${timeWord}${groupWord},\n\n${intro} ${questions}\n\n${closing}`;
}
