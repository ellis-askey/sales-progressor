"use server";

// Free-form professionals on a file (the Professionals tab "Add professional").
// Contact-card only: nothing automated reads TransactionProfessional — the
// wired slots (solicitors, broker) keep the chasing. All writes scope-gated via
// the access-scope helper (Law 7). Activity-logged like the housing association.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";

type ProfessionalInput = {
  name: string;
  role: string;
  firmName: string;
  email: string;
  phone: string;
};

async function assertOwns(transactionId: string) {
  const session = await requireSession();
  // Founder-gated while being checked — the same condition as the render site in
  // OverviewPanel (showOtherProfessionals === superadmin). Ungate by dropping
  // this check AND that render condition, nothing else to flip.
  if (session.user.role !== "superadmin") throw new Error("Not permitted");
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
  return session;
}

function cleanInput(input: ProfessionalInput) {
  const name = input.name.trim();
  const role = input.role.trim();
  const firmName = input.firmName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (!name) throw new Error("A name is needed");
  if (!role) throw new Error("Say what they do, e.g. Surveyor");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email address doesn't look right");
  return { name, role, firmName: firmName || null, email: email || null, phone: phone || null };
}

function revalidateTx(id: string) {
  revalidatePath(`/agent/transactions/${id}`, "page");
}

export async function addProfessionalAction(transactionId: string, input: ProfessionalInput): Promise<void> {
  const session = await assertOwns(transactionId);
  const data = cleanInput(input);
  await prisma.transactionProfessional.create({
    data: { transactionId, ...data, createdById: session.user.id },
  });
  await logActivity(transactionId, `${session.user.name} added ${data.name} (${data.role}) to the professionals on this file`, session.user.id);
  revalidateTx(transactionId);
}

export async function updateProfessionalAction(transactionId: string, id: string, input: ProfessionalInput): Promise<void> {
  const session = await assertOwns(transactionId);
  const data = cleanInput(input);
  // The row must belong to the file the caller is scoped to — never trust the id alone.
  const row = await prisma.transactionProfessional.findFirst({ where: { id, transactionId }, select: { id: true } });
  if (!row) throw new Error("Professional not found");
  await prisma.transactionProfessional.update({ where: { id }, data });
  await logActivity(transactionId, `${session.user.name} updated ${data.name} (${data.role}) in the professionals on this file`, session.user.id);
  revalidateTx(transactionId);
}

export async function removeProfessionalAction(transactionId: string, id: string): Promise<void> {
  const session = await assertOwns(transactionId);
  const row = await prisma.transactionProfessional.findFirst({ where: { id, transactionId }, select: { id: true, name: true, role: true } });
  if (!row) throw new Error("Professional not found");
  await prisma.transactionProfessional.delete({ where: { id } });
  await logActivity(transactionId, `${session.user.name} removed ${row.name} (${row.role}) from the professionals on this file`, session.user.id);
  revalidateTx(transactionId);
}
