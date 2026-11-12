"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import {
  createPlatformUpdateUploadUrl,
  platformUpdateObjectExists,
  deletePlatformUpdateObject,
} from "@/lib/platform-updates/storage";
import type { PlatformUpdateCategory, PlatformUpdateAudience } from "@prisma/client";

// Platform Updates management — founder-only (Command Centre, Phase 1). commandDb
// is a full-access client, so every action re-asserts the superadmin guard here
// (Law 7 / Law 8), never relying on the layout alone. Mirrors app/actions/
// critique.ts. Nothing here is reachable by ordinary agents.

const MANAGE_PATH = "/command/updates";

const CATEGORIES: PlatformUpdateCategory[] = ["new_feature", "improvement", "moved"];
const AUDIENCES: PlatformUpdateAudience[] = ["everyone", "agency_staff", "progression_business", "tsp_internal"];

async function assertSuperadmin(): Promise<{ id: string | null; email: string | null }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    throw new Error("Unauthorised");
  }
  return { id: session.user.id ?? null, email: session.user.email ?? null };
}

// Create (no id) or update (id present) an entry. New entries are always born
// Hidden — this action never sets status, so a freshly created row keeps the
// schema default (draft). Publishing is a separate, explicit action.
export async function savePlatformUpdateAction(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const who = await assertSuperadmin();

  const id = ((formData.get("id") as string) ?? "").trim() || null;
  const title = ((formData.get("title") as string) ?? "").trim();
  const body = ((formData.get("body") as string) ?? "").trim();
  if (!title) return { ok: false, error: "A title is required." };

  const categoryRaw = (formData.get("category") as string) ?? "improvement";
  const audienceRaw = (formData.get("audience") as string) ?? "everyone";
  const category = (CATEGORIES.includes(categoryRaw as PlatformUpdateCategory)
    ? categoryRaw
    : "improvement") as PlatformUpdateCategory;
  const audience = (AUDIENCES.includes(audienceRaw as PlatformUpdateAudience)
    ? audienceRaw
    : "everyone") as PlatformUpdateAudience;

  const linkRaw = ((formData.get("linkUrl") as string) ?? "").trim();
  const technicalRaw = ((formData.get("technicalSummary") as string) ?? "").trim();
  const publishedAtRaw = ((formData.get("publishedAt") as string) ?? "").trim();

  const data = {
    title: title.slice(0, 200),
    body: body.slice(0, 5000),
    category,
    audience,
    linkUrl: linkRaw ? linkRaw.slice(0, 2000) : null,
    technicalSummary: technicalRaw ? technicalRaw.slice(0, 5000) : null,
    // Date-only input ("YYYY-MM-DD"); blank clears it. Interpreted at UTC midnight.
    publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
  };

  if (id) {
    await commandDb.platformUpdate.update({ where: { id }, data });
    revalidatePath(MANAGE_PATH);
    return { ok: true, id };
  }

  const created = await commandDb.platformUpdate.create({
    data: { ...data, createdById: who.id, createdByEmail: who.email },
  });
  revalidatePath(MANAGE_PATH);
  return { ok: true, id: created.id };
}

// Publish (make visible) or hide (back to draft). Publishing stamps publishedAt
// if one wasn't already chosen; hiding keeps the date so re-publishing restores
// it. Nothing becomes public except through this explicit action.
export async function setPlatformUpdateStatusAction(formData: FormData): Promise<{ ok: boolean }> {
  const who = await assertSuperadmin();
  const id = ((formData.get("id") as string) ?? "").trim();
  const publish = formData.get("publish") === "true";
  if (!id) return { ok: false };

  const existing = await commandDb.platformUpdate.findUnique({
    where: { id },
    select: { publishedAt: true },
  });

  await commandDb.platformUpdate.update({
    where: { id },
    data: publish
      ? {
          status: "published",
          publishedAt: existing?.publishedAt ?? new Date(),
          publishedById: who.id,
          publishedByEmail: who.email,
        }
      : { status: "draft" },
  });
  revalidatePath(MANAGE_PATH);
  return { ok: true };
}

// Hard-delete an entry (and its image).
export async function deletePlatformUpdateAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const id = ((formData.get("id") as string) ?? "").trim();
  if (!id) return { ok: false };

  const existing = await commandDb.platformUpdate.findUnique({
    where: { id },
    select: { screenshotPath: true },
  });
  if (existing?.screenshotPath) await deletePlatformUpdateObject(existing.screenshotPath);

  await commandDb.platformUpdate.delete({ where: { id } });
  revalidatePath(MANAGE_PATH);
  return { ok: true };
}

// Mint a signed upload URL so the browser PUTs the image straight to the private
// bucket (past the serverless body limit). The entry must already exist (so the
// path is namespaced by its id).
export async function requestPlatformUpdateImageUploadAction(
  id: string,
  ext: string,
): Promise<{ uploadUrl: string; path: string } | { error: string }> {
  await assertSuperadmin();
  if (!id) return { error: "Missing id" };
  const safeExt = /^(png|jpg|jpeg|webp)$/i.test(ext) ? ext.toLowerCase() : "png";
  const stamp = String(Date.now());
  const r = await createPlatformUpdateUploadUrl(`${id}/${stamp}.${safeExt}`);
  return r ?? { error: "Couldn't start the upload." };
}

// Record the uploaded image's path on the entry, after confirming it landed.
export async function attachPlatformUpdateImageAction(
  id: string,
  path: string,
): Promise<{ ok: boolean; error?: string }> {
  await assertSuperadmin();
  if (!id || !path) return { ok: false, error: "Missing id or path" };
  if (!(await platformUpdateObjectExists(path))) {
    return { ok: false, error: "Upload not found in storage." };
  }
  // Replacing an image? Remove the previous object so it doesn't linger private.
  const prev = await commandDb.platformUpdate.findUnique({
    where: { id },
    select: { screenshotPath: true },
  });
  if (prev?.screenshotPath && prev.screenshotPath !== path) {
    await deletePlatformUpdateObject(prev.screenshotPath);
  }
  await commandDb.platformUpdate.update({
    where: { id },
    data: { screenshotPath: path, screenshotFilename: path.split("/").pop() ?? "image.png" },
  });
  revalidatePath(MANAGE_PATH);
  return { ok: true };
}

// Remove the image from an entry (and delete the object).
export async function removePlatformUpdateImageAction(formData: FormData): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const id = ((formData.get("id") as string) ?? "").trim();
  if (!id) return { ok: false };
  const existing = await commandDb.platformUpdate.findUnique({
    where: { id },
    select: { screenshotPath: true },
  });
  if (existing?.screenshotPath) await deletePlatformUpdateObject(existing.screenshotPath);
  await commandDb.platformUpdate.update({
    where: { id },
    data: { screenshotPath: null, screenshotFilename: null },
  });
  revalidatePath(MANAGE_PATH);
  return { ok: true };
}
