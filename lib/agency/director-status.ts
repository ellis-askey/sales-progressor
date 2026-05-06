import { prisma } from "@/lib/prisma";

export async function getAgencyDirectorStatus(agencyId: string) {
  const director = await prisma.user.findFirst({
    where: { agencyId, role: "director" },
    select: { id: true, name: true },
  });

  return {
    hasDirector: !!director,
    director,
  };
}
