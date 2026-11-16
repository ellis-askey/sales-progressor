// Can this agent-app user access (read or act on) one specific file?
//
// Mirrors the file-open gate in lib/services/file-page-context.ts so the Files
// list preview, the file page, and the mutation routes all agree on who may
// touch a file. Internal staff and directors are already bounded by the
// access-scope helper upstream (scopeOwnershipWhere / getTransactionByScope), so
// they pass here. A negotiator needs one of:
//   - ownership (they are the file's agentUser), or
//   - the assigned slot (an in-house progressor the file was handed to), or
//   - a director-granted see-all CEILING (canToggleViewAll). The ceiling is
//     deliberately NOT the narrowed `seeAll`: the "All files / Mine" list toggle
//     is a display preference and must never revoke access the ceiling allows.
//
// Why this exists: getFilePreviewExtras, PATCH /api/transactions/[id] and
// POST /api/transaction-notes each previously checked only `agentUserId`, so an
// in-house progressor (assigned, not owner) was blocked — and the preview read
// was wider than the file-open gate, exposing client/solicitor PII to a
// negotiator for files they can't open. One helper closes both.

import { prisma } from "@/lib/prisma";
import { resolveAgentVisibility } from "@/lib/services/agent";

export async function canAgentAccessFile(
  session: { user: { id: string; role: string; agencyId: string | null } },
  file: { agentUserId: string | null; assignedUserId: string | null },
): Promise<boolean> {
  // Non-negotiators (director + internal staff) are scoped by the access-scope
  // helper that already bounded the query that produced `file`.
  if (session.user.role !== "negotiator") return true;

  if (file.agentUserId === session.user.id || file.assignedUserId === session.user.id) return true;
  if (!session.user.agencyId) return false;

  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  if (!vis.canToggleViewAll) return false;
  if (!vis.firmName) return true; // whole-agency ceiling

  // Firm-scoped colleague: only files owned by their firm (mirrors the list).
  const owner = file.agentUserId
    ? await prisma.user.findUnique({ where: { id: file.agentUserId }, select: { firmName: true } })
    : null;
  return owner?.firmName === vis.firmName;
}
