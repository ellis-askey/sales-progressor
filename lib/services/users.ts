// lib/services/users.ts
// User queries used across the app.

import { prisma } from "@/lib/prisma";

/** List all users in an agency (for assignment dropdowns etc.) */
export async function listAgencyUsers(agencyId: string) {
  return prisma.user.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
}

// Removed listProgressorUsers (2026-10-09): an unscoped cross-business
// `role: "sales_progressor"` query with no callers. It would have returned every
// progressor on the platform, including EXTERNAL progression-business members, to
// whoever wired it up — the same leak class fixed in /api/agency/users. If an
// admin progressor list is ever needed, add it back scoped to TSP's own
// (progressionBusinessId null or the seeded TSP business).
