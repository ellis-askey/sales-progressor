"use server";

// Server actions for the agent-side Checkpoints card (critique #21 + #23).
// Every action is scope-guarded: the caller must be able to see the file, and
// the checkpoint must belong to that file, before anything is written.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import {
  createCheckpoint,
  confirmCheckpoint,
  unconfirmCheckpoint,
  nudgeCheckpoint,
  archiveCheckpoint,
} from "@/lib/services/checkpoints";
import type { CheckpointAudience, CheckpointParty } from "@prisma/client";

type Result = { ok: true } | { ok: false; error: string };

async function guardFile(transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return null;
  return session;
}

// A checkpoint action must target a checkpoint that lives on the guarded file.
async function guardCheckpoint(transactionId: string, checkpointId: string) {
  const session = await guardFile(transactionId);
  if (!session) return null;
  const cp = await prisma.checkpoint.findFirst({
    where: { id: checkpointId, transactionId },
    select: { id: true },
  });
  if (!cp) return null;
  return session;
}

export async function createCheckpointAction(input: {
  transactionId: string;
  label: string;
  showTo: CheckpointAudience;
  targetDate?: string | null;
  blocksExchange?: boolean;
}): Promise<Result> {
  const session = await guardFile(input.transactionId);
  if (!session) return { ok: false, error: "Not found." };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Give the checkpoint a name." };
  await createCheckpoint({
    transactionId: input.transactionId,
    label,
    showTo: input.showTo,
    targetDate: input.targetDate ?? null,
    blocksExchange: input.blocksExchange ?? false,
    createdById: session.user.id,
  });
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}

export async function confirmCheckpointAction(input: {
  transactionId: string;
  checkpointId: string;
  party: CheckpointParty;
  eventDate?: string | null;
}): Promise<Result> {
  const session = await guardCheckpoint(input.transactionId, input.checkpointId);
  if (!session) return { ok: false, error: "Not found." };
  await confirmCheckpoint({
    checkpointId: input.checkpointId,
    party: input.party,
    by: { kind: "user", id: session.user.id, name: session.user.name ?? "your team" },
    eventDate: input.eventDate ?? null,
  });
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}

export async function unconfirmCheckpointAction(input: {
  transactionId: string;
  checkpointId: string;
  party: CheckpointParty;
}): Promise<Result> {
  const session = await guardCheckpoint(input.transactionId, input.checkpointId);
  if (!session) return { ok: false, error: "Not found." };
  await unconfirmCheckpoint({ checkpointId: input.checkpointId, party: input.party });
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}

export async function nudgeCheckpointAction(input: {
  transactionId: string;
  checkpointId: string;
  side: "vendor" | "purchaser";
}): Promise<{ ok: true; delivered: number } | { ok: false; error: string }> {
  const session = await guardCheckpoint(input.transactionId, input.checkpointId);
  if (!session) return { ok: false, error: "Not found." };
  const res = await nudgeCheckpoint({ checkpointId: input.checkpointId, side: input.side });
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true, delivered: res.delivered };
}

export async function archiveCheckpointAction(input: {
  transactionId: string;
  checkpointId: string;
}): Promise<Result> {
  const session = await guardCheckpoint(input.transactionId, input.checkpointId);
  if (!session) return { ok: false, error: "Not found." };
  await archiveCheckpoint(input.checkpointId);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}
