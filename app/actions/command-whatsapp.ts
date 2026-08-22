"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { assignChatToTransaction, type Side } from "@/lib/integrations/whatsapp/ingest";
import { commandDb } from "@/lib/command/prisma";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
}

// Property search for manual assignment when there's no auto-suggested match.
export async function searchWhatsAppTargetsAction(
  q: string,
): Promise<{ id: string; address: string; status: string }[]> {
  await requireSuperAdmin();
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await commandDb.propertyTransaction.findMany({
    where: {
      status: { in: ["draft", "active", "on_hold"] },
      propertyAddress: { contains: term, mode: "insensitive" },
    },
    select: { id: true, propertyAddress: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  return rows.map((r) => ({ id: r.id, address: r.propertyAddress, status: r.status }));
}

// Assign a whole WhatsApp conversation (group or DM) to a property. Remembers
// the chat → property + side and replays every held message onto the file.
export async function assignWhatsAppChatAction(waChatId: string, transactionId: string, side: Side) {
  await requireSuperAdmin();
  if (!waChatId || !transactionId || (side !== "BUYER" && side !== "SELLER")) return;
  await assignChatToTransaction(waChatId, transactionId, side);
  revalidatePath("/command/whatsapp");
}
