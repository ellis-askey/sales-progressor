// Agency team queries for the director "assign sale to an agent" flow.
// The list returned is the set of agency users a director can legitimately
// hand a self-managed sale to: themselves, plus every other director and
// negotiator in the same agency. Internal staff (admin / sales_progressor
// / superadmin / viewer) are excluded.

import { prisma } from "@/lib/prisma";

export type AssignableAgent = {
  id: string;
  name: string;
  email: string;
  role: "director" | "negotiator";
};

export async function listAssignableAgentsForAgency(agencyId: string): Promise<AssignableAgent[]> {
  if (!agencyId) return [];
  const users = await prisma.user.findMany({
    where: {
      agencyId,
      role: { in: ["director", "negotiator"] },
      // Exclude the made-up demo staff member who manages demo showcase files.
      isDemo: false,
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    role: u.role as "director" | "negotiator",
  }));
}

// The agency's in-house progressor pool — the users who can be set as the
// progressor (assignedUserId) on a self-managed sale. See
// docs/active/in-house-progression/00-spec.md.
export async function listInHouseProgressors(agencyId: string): Promise<AssignableAgent[]> {
  if (!agencyId) return [];
  const users = await prisma.user.findMany({
    where: { agencyId, isInHouseProgressor: true, isDemo: false, deactivatedAt: null },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    role: u.role as "director" | "negotiator",
  }));
}
