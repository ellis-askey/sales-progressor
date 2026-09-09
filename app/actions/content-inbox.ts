"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { refreshInbox, type RefreshResult } from "@/lib/command/content/inbox";

// Content inbox actions (docs/active/content-brand/SPEC.md, Phase 1.3).
// Superadmin-gated: commandDb is full-access, so the guard lives here.

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
}

function revalidate() {
  revalidatePath("/command/content/inbox");
  revalidatePath("/command/content");
}

// Pull fresh candidates, enrich, and file them. Returns a summary so the UI can
// say exactly what happened ("3 new, 5 already seen, 2 saved for next time").
export async function refreshInboxAction(): Promise<RefreshResult> {
  await assertSuperadmin();
  const result = await refreshInbox(new Date());
  revalidate();
  return result;
}

const TERMINAL = new Set(["dismissed", "explored", "already_said", "not_me"]);
const VALID = new Set(["new", "saved", ...TERMINAL]);

export async function setInboxItemStatusAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (!id || !VALID.has(status)) return { ok: false };

  const item = await commandDb.contentInboxItem.findUnique({ where: { id } });
  if (!item) return { ok: false };

  await commandDb.contentInboxItem.update({
    where: { id },
    data: { status, decidedAt: TERMINAL.has(status) ? new Date() : null },
  });

  // "Already said this" feeds brand memory: the observation becomes a SUGGESTED
  // memory row (an inference, not an approved fact) for Ellis to confirm on the
  // Brand page. "Not me" records the decision only — the persona-learning that
  // consumes it lands in a later phase; we never fabricate a belief here.
  if (status === "already_said") {
    await commandDb.brandMemory.create({
      data: {
        kind: "belief",
        body: item.observation,
        claimClass: "inference",
        status: "suggested",
        source: "inbox_action",
      },
    });
    revalidatePath("/command/content/brand");
  }

  revalidate();
  return { ok: true };
}

// Hand off to drafting: create a ContentTopic from the item (optionally a chosen
// angle) so it lands in the existing composer's topic queue, and mark the item
// explored. When the guided Source -> Angle -> Post flow ships (Phase 1.4) this
// becomes that flow's entry point.
export async function draftFromInboxAction(formData: FormData): Promise<{ ok: boolean; topicId?: string }> {
  await assertSuperadmin();

  const id = formData.get("id") as string;
  const topicText = ((formData.get("topicText") as string) ?? "").trim();
  if (!id || !topicText) return { ok: false };

  const item = await commandDb.contentInboxItem.findUnique({ where: { id } });
  if (!item) return { ok: false };

  const topic = await commandDb.contentTopic.create({
    data: { text: topicText, source: item.sourceType === "saved_thought" ? "manual" : "activity_derived" },
  });

  await commandDb.contentInboxItem.update({
    where: { id },
    data: { status: "explored", decidedAt: new Date(), topicId: topic.id },
  });

  // If this came from one of Ellis's saved thoughts, mark that thought used so
  // it stops resurfacing.
  if (item.sourceThoughtId) {
    await commandDb.ellisThought.update({ where: { id: item.sourceThoughtId }, data: { status: "used" } }).catch(() => {});
    revalidatePath("/command/content/thoughts");
  }

  revalidate();
  return { ok: true, topicId: topic.id };
}
