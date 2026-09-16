// Phase D2 — gather a file's OUTSTANDING milestones + onward/related chain steps
// and run the AI read (Phase D1) over one inbound email. Server-only: pulls from
// the milestone engine and the onward/related trackers. Best-effort throughout —
// any source failing degrades to an empty list, and the engine handles that.

import "server-only";
import { getMilestonesCached } from "@/lib/services/cached-fetchers";
import { getOnwardTrackerView, type OnwardTrackerView } from "@/lib/services/onward";
import { readEmailForSuggestions, type EmailReadResult } from "@/lib/services/email-read";

// Outstanding tracker steps → { id: milestone code, name }. Available + not done.
function outstandingSteps(view: OnwardTrackerView | null): { id: string; name: string }[] {
  return (view?.steps ?? [])
    .filter((s) => s.isAvailable && !s.isComplete)
    .map((s) => ({ id: s.code, name: s.name }));
}

export async function readInboundEmail(
  transactionId: string,
  agencyId: string | null,
  email: { subject: string; body: string },
): Promise<EmailReadResult> {
  const [milestones, onward, related] = await Promise.all([
    getMilestonesCached(transactionId, agencyId).catch(() => null),
    getOnwardTrackerView(transactionId).catch(() => null),
    getOnwardTrackerView(transactionId, "related_sale").catch(() => null),
  ]);

  const outstandingMilestones = [
    ...(milestones?.vendor ?? [])
      .filter((m) => !m.isComplete && !m.isNotRequired && m.isAvailable)
      .map((m) => ({ code: m.code, name: m.name, side: "vendor" as const })),
    ...(milestones?.purchaser ?? [])
      .filter((m) => !m.isComplete && !m.isNotRequired && m.isAvailable)
      .map((m) => ({ code: m.code, name: m.name, side: "purchaser" as const })),
  ];

  return readEmailForSuggestions({
    subject: email.subject,
    body: email.body,
    outstandingMilestones,
    onwardSteps: outstandingSteps(onward),
    relatedSteps: outstandingSteps(related),
  });
}
