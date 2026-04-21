import { prisma } from "@/lib/prisma";

export type SolicitorContactWithFiles = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  activeFiles: { id: string; propertyAddress: string; role: "vendor" | "purchaser" }[];
};

export type SolicitorFirmWithStats = {
  id: string;
  name: string;
  totalActiveFiles: number;
  contacts: SolicitorContactWithFiles[];
};

export async function getSolicitorDirectory(agencyId: string): Promise<SolicitorFirmWithStats[]> {
  const firms = await prisma.solicitorFirm.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
    include: {
      handlers: {
        orderBy: { name: "asc" },
        include: {
          vendorForTransactions: {
            where: { agencyId, status: { in: ["active", "on_hold"] } },
            select: { id: true, propertyAddress: true },
          },
          purchaserForTransactions: {
            where: { agencyId, status: { in: ["active", "on_hold"] } },
            select: { id: true, propertyAddress: true },
          },
        },
      },
      vendorForTransactions: {
        where: { status: { in: ["active", "on_hold"] } },
        select: { id: true },
      },
      purchaserForTransactions: {
        where: { status: { in: ["active", "on_hold"] } },
        select: { id: true },
      },
    },
  });

  return firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    totalActiveFiles: new Set([
      ...firm.vendorForTransactions.map((t) => t.id),
      ...firm.purchaserForTransactions.map((t) => t.id),
    ]).size,
    contacts: firm.handlers.map((h) => ({
      id: h.id,
      name: h.name,
      phone: h.phone,
      email: h.email,
      activeFiles: [
        ...h.vendorForTransactions.map((t) => ({ ...t, role: "vendor" as const })),
        ...h.purchaserForTransactions.map((t) => ({ ...t, role: "purchaser" as const })),
      ],
    })),
  }));
}
