// The humans on a file — the in-house-progression pairing rules (founder,
// 2026-11-10):
//
//  - Rule A, "who looks after it": the assigned progressor when one is set
//    (outsourced files AND in-house progression on self-managed), else the
//    agent who owns the file. Use for sender identity, sign-offs, attribution
//    and single-recipient reminders.
//  - Rule B, "both in the loop": things HAPPENING on a file (client confirms,
//    replies, escalations, portal events) alert BOTH people, deduped when
//    they're the same person. Use for bells, pushes and forwarded emails.
//
// Pure helpers over the two ownership columns — no queries, callers pass the
// fields they already selected.

type FilePeople = { assignedUserId: string | null; agentUserId: string | null };

/** Rule A: the single day-to-day person (assigned progressor, else agent). */
export function dayToDayUserId(tx: FilePeople): string | null {
  return tx.assignedUserId ?? tx.agentUserId;
}

/** Rule B: both people, deduped, for bells/pushes/forwards. */
export function filePeopleIds(tx: FilePeople): string[] {
  return [...new Set([tx.assignedUserId, tx.agentUserId].filter((x): x is string => !!x))];
}
