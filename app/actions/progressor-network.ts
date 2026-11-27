"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { isFounderEmail } from "@/lib/security/founder";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import {
  resolveBusinessOwner,
  requestConnectProgressor,
  respondToNetworkRequest,
  withdrawNetworkRequest,
} from "@/lib/services/progression-clients";
import { toggleProgressorSave } from "@/lib/services/progressor-network";

// Server actions for the Progressor Network connect handshake (agency → business).
// The agency side is founder-gated while the network is in preview; the business
// side (accept/decline) is owner-gated so the real progression business can respond.
// All are flag-gated on the progression-businesses feature and enforce the caller's
// own role/ownership — never trusting a client-supplied agency or business id.

type Result = { ok: true } | { ok: false; error: string };

/** Agency requests to connect with a network-listed progressor. Founder-gated (preview) + director-only. */
export async function requestConnectProgressorAction(input: { businessId: string; message?: string }): Promise<Result> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  if (!isFounderEmail(session.user.email)) return { ok: false, error: "The Progressor Network isn't open yet." };
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only an agency director can request a connection." };
  }
  const res = await requestConnectProgressor({
    requester: { userId: session.user.id, agencyId: session.user.agencyId },
    businessId: input.businessId,
    message: input.message ?? null,
  });
  if (!res.ok) return res;
  revalidatePath("/agent/progressor-network");
  return { ok: true };
}

/** Agency withdraws its own pending network request. Founder-gated (preview) + director-only. */
export async function withdrawNetworkRequestAction(input: { requestId: string }): Promise<Result> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  if (!isFounderEmail(session.user.email)) return { ok: false, error: "The Progressor Network isn't open yet." };
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only an agency director can do this." };
  }
  const res = await withdrawNetworkRequest({ requestId: input.requestId, agencyId: session.user.agencyId });
  if (!res.ok) return res;
  revalidatePath("/agent/progressor-network");
  return { ok: true };
}

/** Agency toggles a bookmark of a network business. Founder-gated (preview) + director-only. Returns the new saved state. */
export async function toggleProgressorSaveAction(input: { businessId: string }): Promise<Result & { saved?: boolean }> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  if (!isFounderEmail(session.user.email)) return { ok: false, error: "The Progressor Network isn't open yet." };
  if (session.user.role !== "director" || !session.user.agencyId) {
    return { ok: false, error: "Only an agency director can do this." };
  }
  const res = await toggleProgressorSave({
    agencyId: session.user.agencyId,
    businessId: input.businessId,
    savedByUserId: session.user.id,
  });
  if (!res.ok) return res;
  revalidatePath("/agent/progressor-network");
  return { ok: true, saved: res.saved };
}

/** Business owner accepts/declines a network request. Owner-gated (the real business responds). */
export async function respondToNetworkRequestAction(input: { requestId: string; accept: boolean }): Promise<Result> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can respond to connection requests." };
  const res = await respondToNetworkRequest({ requestId: input.requestId, accept: !!input.accept, owner });
  if (!res.ok) return res;
  revalidatePath("/agent/hub");
  revalidatePath("/agent/clients");
  return { ok: true };
}
