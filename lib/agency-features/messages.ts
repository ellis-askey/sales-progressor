// Native messaging (pilot) — the SINGLE server-side gate shared by navigation,
// the file Messages tab, every server action/API, notifications, attachments
// and the (later) real-time subscription auth. Keeping the allowlists and the
// checks in one plain server module means they can never drift — and avoids the
// client/server proxy outage caused by exporting a Set from a "use client" file
// (see lib/agent/experimental-shell.ts header, 2026-11-11).
//
// FAIL CLOSED. Every allowlist comes from an env var; missing / empty / invalid
// means the Set is empty, so every check returns false and NOTHING is exposed.
// There are deliberately NO hardcoded transaction/user id fallbacks.
//
// Pilot (decided with founder, 2026-11-14):
//   - MESSAGES_PILOT_STAFF_IDS        — User ids with staff messaging access
//                                       (pilot: Ellis only).
//   - MESSAGES_PILOT_TRANSACTION_IDS  — the five explicit files the pilot
//                                       operates on. NOT derived from
//                                       assignedUserId, so new sales never
//                                       auto-join.
//   - MESSAGES_CLIENT_ACTIVE_TX_IDS   — files whose buyers/sellers can SEE
//                                       messaging + be notified. Independent of
//                                       the pilot list and EMPTY throughout
//                                       Phase 0, so clients see nothing while we
//                                       build and test.
//
// Pattern mirrors lib/agency-features/migrate-sale.ts ("ships dark" env
// allowlist). Gating is by id, never by name.

import type { Session } from "next-auth";

// Parse once per call. Trim + drop blanks so stray spaces/commas are safe.
function parseIdSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function messagesPilotStaffIds(): Set<string> {
  return parseIdSet(process.env.MESSAGES_PILOT_STAFF_IDS);
}

export function messagesPilotTransactionIds(): Set<string> {
  return parseIdSet(process.env.MESSAGES_PILOT_TRANSACTION_IDS);
}

export function messagesClientActiveTransactionIds(): Set<string> {
  return parseIdSet(process.env.MESSAGES_CLIENT_ACTIVE_TX_IDS);
}

// Staff access: only a signed-in user whose id is on the staff allowlist. An
// empty allowlist (the default) returns false for everyone.
export function canUseMessages(session: Session | null | undefined): boolean {
  const id = session?.user?.id;
  if (!id) return false;
  return messagesPilotStaffIds().has(id);
}

// Whether a file is in the pilot at all (staff may message on it). This is the
// per-file gate every server action / API / notification / attachment / real-
// time check must apply ALONGSIDE the normal tenant access-scope guard — the
// two are independent.
export function fileInMessagesPilot(transactionId: string | null | undefined): boolean {
  if (!transactionId) return false;
  return messagesPilotTransactionIds().has(transactionId);
}

// Whether the CLIENTS of a file may see messaging + receive notifications. A
// file must be on BOTH the pilot list AND the separate client-activation list.
// The client list is empty in Phase 0, so this is false for every file until we
// explicitly activate after sign-off — independent of client visibility by
// design (decision 4).
export function clientMessagingActive(transactionId: string | null | undefined): boolean {
  if (!transactionId) return false;
  if (!fileInMessagesPilot(transactionId)) return false;
  return messagesClientActiveTransactionIds().has(transactionId);
}
