"use server";

// Read-only extras for the All Files floating property preview — the few things
// the list row doesn't already carry: the latest HUMAN note (gated), the next
// scheduled reminder, and the handling team's contact details. Everything here
// REUSES existing access-scoped services; it adds no business logic and writes
// nothing. Approved scope (2026-11-13): presentation + a read action only.
//
// Access safety: the file is loaded through getTransactionByScope (fail-closed,
// cross-agency safe) before anything else — a caller who can't read the file
// gets { ok:false, error:"not_found" }. The latest note is read via the SAME
// gated path the activity feed uses (getActivityTimeline with the real
// session agencyId), so a progression-business-private (businessOnly) note is
// never returned to the owning agency.

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope } from "@/lib/security/access-scope";
import { getTransactionByScope } from "@/lib/services/transactions";
import { getLatestVisibleNote } from "@/lib/services/comms";
import { getReminderLogsForTransaction } from "@/lib/services/reminders";
import { classifyReminder, type ReminderBucket } from "@/lib/reminders/classify";
import { isTerminalSale } from "@/lib/transactions/status";

export type PreviewPerson = {
  id: string;
  name: string;
  image: string | null;
  // Their job title verbatim (the preview renders it, falling back by slot).
  jobTitle: string | null;
  email: string;
  phone: string | null;
  // Which slot filled this — the owning agent/client-manager vs the assigned
  // progressor — so the panel can label sensibly when no job title is set.
  slot: "agent" | "assigned";
};

export type PreviewNote = {
  body: string;
  author: string | null;
  at: string; // ISO
  isSetup: boolean; // a new-sale setup note
};

export type PreviewReminder = {
  dueAt: string; // ISO
  label: string;
  state: ReminderBucket;
};

export type FilePreviewExtras = {
  ok: true;
  people: PreviewPerson[];
  note: PreviewNote | null;
  reminder: PreviewReminder | null;
};
export type FilePreviewResult = FilePreviewExtras | { ok: false; error: "not_found" | "failed" };

export async function getFilePreviewExtras(id: string): Promise<FilePreviewResult> {
  try {
    const session = await requireSession();
    const scope = getAccessScope(session);

    // Access gate — fail-closed. Also the source for the handling-team ids.
    const tx = await getTransactionByScope(id, scope);
    if (!tx) return { ok: false, error: "not_found" };

    const terminal = isTerminalSale(tx.status);

    // ── Handling team (the "Handled by" people, now preview-only) ──
    // getTransactionByScope selects assignedUser {id,name,image} but not the
    // agent, and neither with email/phone — so fetch both users directly.
    const ids = Array.from(new Set([tx.agentUserId, tx.assignedUserId].filter((x): x is string => !!x)));
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, image: true, jobTitle: true, email: true, phone: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const people: PreviewPerson[] = [];
    const seen = new Set<string>();
    for (const [uid, slot] of [[tx.agentUserId, "agent"], [tx.assignedUserId, "assigned"]] as const) {
      if (!uid || seen.has(uid)) continue;
      const u = byId.get(uid);
      if (!u) continue;
      seen.add(uid);
      people.push({ id: u.id, name: u.name, image: u.image, jobTitle: u.jobTitle, email: u.email, phone: u.phone, slot });
    }

    // ── Latest human note ── focused, access-scoped read that shares the
    // activity feed's EXACT visibility gating (lib/services/comms.ts →
    // visibleCommsWhere), narrowed to the newest non-automated internal_note. No
    // full timeline, no media signing. Private (businessOnly) progressor notes
    // stay hidden from agencies because the real agencyId is passed through.
    let note: PreviewNote | null = null;
    try {
      const latest = await getLatestVisibleNote(id, session.user.agencyId);
      if (latest) note = { body: latest.body, author: latest.author, at: latest.at.toISOString(), isSetup: latest.isSetup };
    } catch {
      /* note stays null — the panel shows its empty state */
    }

    // ── Next reminder ── live, un-paused sales only. A terminal sale has nothing
    // to chase; an on-hold sale's chasing is paused, so we surface the hold state
    // in the panel instead (from the row's existing holdInfo) rather than a
    // misleading "upcoming reminder".
    let reminder: PreviewReminder | null = null;
    if (!terminal && tx.status !== "on_hold") {
      try {
        const logs = await getReminderLogsForTransaction(id, session.user.agencyId);
        const now = new Date();
        // Logs are ordered nextDueDate asc; the first still-active one is "next".
        const next = logs.find((l) => classifyReminder(l, now) !== "inactive");
        if (next?.nextDueDate) {
          reminder = {
            dueAt: new Date(next.nextDueDate).toISOString(),
            label: next.reminderRule?.name ?? "Follow-up",
            state: classifyReminder(next, now),
          };
        }
      } catch {
        /* reminder stays null */
      }
    }

    return { ok: true, people, note, reminder };
  } catch {
    return { ok: false, error: "failed" };
  }
}
