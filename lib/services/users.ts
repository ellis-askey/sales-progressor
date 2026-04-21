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
