"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { assignChatToTransaction, reassignChat, unassignChat, dismissChat, type Side } from "@/lib/integrations/whatsapp/ingest";
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

// Dismiss a junk / non-property chat from the "needs assigning" queue: ignore it
// so future messages are dropped, and clear its pending rows.
export async function dismissWhatsAppChatAction(waChatId: string, title: string | null) {
  await requireSuperAdmin();
  if (!waChatId) return;
  await dismissChat(waChatId, title);
  revalidatePath("/command/whatsapp");
}

// Move a mis-assigned chat (and its messages) to the correct file.
export async function reassignWhatsAppChatAction(waChatId: string, transactionId: string, side: Side) {
  await requireSuperAdmin();
  if (!waChatId || !transactionId || (side !== "BUYER" && side !== "SELLER")) return;
  await reassignChat(waChatId, transactionId, side);
  revalidatePath("/command/whatsapp");
}

// Stop capturing a chat: future messages return to the queue. Existing messages
// stay on the file (use reassign to move them).
export async function unassignWhatsAppChatAction(waChatId: string) {
  await requireSuperAdmin();
  if (!waChatId) return;
  await unassignChat(waChatId);
  revalidatePath("/command/whatsapp");
}

// Force the bridge to re-pair: clears its credentials and restarts pairing so a
// fresh QR is emitted (recovers a logged-out / stuck bridge without a host reset).
export async function repairWhatsAppBridgeAction(): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  const base = process.env.WHATSAPP_BRIDGE_URL?.trim().replace(/\/$/, "");
  const secret = process.env.WHATSAPP_BRIDGE_SECRET?.trim();
  if (!base || !secret) return { ok: false, error: "Bridge not configured." };
  try {
    const res = await fetch(`${base}/repair`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Bridge returned ${res.status}.` };
    revalidatePath("/command/whatsapp");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach the bridge." };
  }
}
