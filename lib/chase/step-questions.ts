// WhatsApp check-in questions per client-actionable milestone (2026-08-19,
// founder brief: a quick-links button that copies "what's due" as natural
// questions to paste into WhatsApp).
//
// Copy rules:
//   - Each question must stand alone AND read naturally in a run of
//     questions pasted as one paragraph ("Have you been able to complete
//     your ID checks? Have you received the welcome pack from your
//     solicitor?").
//   - Plain voice: no em dashes, no exclamation marks, no jargon.
//   - The map doubles as the allowlist: codes absent here are never
//     copyable (bilateral gates, solicitor/lender-owned steps, agent
//     actions). It covers exactly the portal-copy who:"you" codes.

export const STEP_QUESTIONS: Record<string, string> = {
  // ── Seller side ──────────────────────────────────────────────────────
  VM1:  "Have you instructed your solicitor yet?",
  VM2:  "Have you received the memorandum of sale?",
  VM3:  "Have you received the welcome pack from your solicitor?",
  VM4:  "Have you been able to complete your ID checks with your solicitor?",
  VM5:  "Have the property information forms arrived from your solicitor?",
  VM6:  "Have you returned the completed property forms to your solicitor?",
  VM11: "Have you been able to give your solicitor your input on the enquiries?",
  VM14: "Have you been able to give your solicitor your input on the follow-up enquiries?",
  VM16: "Have your contract documents arrived for signing?",
  VM17: "Have you signed and returned your contract documents?",

  // ── Buyer side ───────────────────────────────────────────────────────
  PM1:  "Have you instructed your solicitor yet?",
  PM2:  "Have you received the memorandum of sale?",
  PM3:  "Have you been able to complete your ID checks with your solicitor?",
  PM4:  "Have you paid the money on account to your solicitor?",
  PM5:  "Have you submitted your full mortgage application?",
  PM9:  "Have you booked your survey?",
  PM10: "Have you received your survey report?",
  PM21: "Have you received the final report from your solicitor?",
  PM22: "Have your contract documents arrived for signing?",
  PM23: "Have you signed and returned your contract documents?",
  PM24: "Have you transferred your deposit to your solicitor?",
};

export type MilestoneForQuestions = {
  code: string;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
};

/** Outstanding client-actionable steps → one standalone question each,
 * journey order preserved (caller passes milestones in journey order). */
export function buildDueStepQuestions(milestones: MilestoneForQuestions[]): string[] {
  return milestones
    .filter((m) => !m.isComplete && !m.isNotRequired && m.isAvailable && STEP_QUESTIONS[m.code])
    .map((m) => STEP_QUESTIONS[m.code]);
}

/** The paragraph the copy button puts on the clipboard, or null when the
 * side has nothing due. */
export function buildDueStepCopyText(milestones: MilestoneForQuestions[]): string | null {
  const questions = buildDueStepQuestions(milestones);
  if (questions.length === 0) return null;
  return questions.join(" ");
}
