"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";

// Server actions for Ellis's thoughts (docs/active/content-brand/SPEC.md, Phase
// 1.1). Every action is superadmin-gated: commandDb is a full-access client, so
// the guard has to live here (Law 7 / Law 8).

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
}

function revalidate() {
  revalidatePath("/command/content/thoughts");
  revalidatePath("/command/content");
}

// Capture a new thought. Returns a result (rather than void) so the global
// quick-capture can confirm inline without a full navigation.
export async function captureThoughtAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const body = ((formData.get("body") as string) ?? "").trim();
  if (!body) return { ok: false };

  const topic = ((formData.get("topic") as string) ?? "").trim() || null;
  const source = (formData.get("source") as string) === "global_capture" ? "global_capture" : "manual";

  await commandDb.ellisThought.create({ data: { body, topic, source } });
  revalidate();
  return { ok: true };
}

export async function editThoughtAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  const body = ((formData.get("body") as string) ?? "").trim();
  if (!id || !body) return { ok: false };
  const topic = ((formData.get("topic") as string) ?? "").trim() || null;

  await commandDb.ellisThought.update({ where: { id }, data: { body, topic } });
  revalidate();
  return { ok: true };
}

export async function setThoughtStatusAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (!id || !["open", "used", "archived"].includes(status)) return { ok: false };

  await commandDb.ellisThought.update({ where: { id }, data: { status } });
  revalidate();
  return { ok: true };
}

export async function deleteThoughtAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  if (!id) return { ok: false };

  await commandDb.ellisThought.delete({ where: { id } }).catch(() => {});
  revalidate();
  return { ok: true };
}
