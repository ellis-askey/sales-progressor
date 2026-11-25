import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { PROPOSAL_SLUG } from "./config";

// Revocable, opaque invitation links. The link identifies WHICH link was used,
// not necessarily who used it (a forwarded link looks the same) — the admin view
// surfaces that caveat. The shared password is still required regardless.

export interface ResolvedInvitation {
  id: string;
  label: string;
  isOwner: boolean;
  revoked: boolean;
}

export async function resolveInvitation(
  token: string | null | undefined,
  slug = PROPOSAL_SLUG,
): Promise<ResolvedInvitation | null> {
  if (!token) return null;
  try {
    const inv = await prisma.proposalInvitation.findUnique({ where: { token } });
    if (!inv || inv.slug !== slug) return null;
    return { id: inv.id, label: inv.label, isOwner: inv.isOwner, revoked: !!inv.revokedAt };
  } catch {
    return null;
  }
}

// The three links we seed the first time the admin view is opened after the
// migration. Tokens are random and opaque; they persist once created.
const SEED_INVITATIONS: { label: string; isOwner: boolean }[] = [
  { label: "Nick", isOwner: false },
  { label: "Jack", isOwner: false },
  { label: "Ellis (review)", isOwner: true },
];

/** Ensures the default invitations exist. Idempotent, best-effort. */
export async function ensureSeedInvitations(slug = PROPOSAL_SLUG): Promise<void> {
  try {
    const count = await prisma.proposalInvitation.count({ where: { slug } });
    if (count > 0) return;
    for (const seed of SEED_INVITATIONS) {
      await prisma.proposalInvitation.create({
        data: {
          slug,
          token: crypto.randomBytes(16).toString("base64url"),
          label: seed.label,
          isOwner: seed.isOwner,
        },
      });
    }
  } catch {
    // Table not migrated yet — the gate still works, links just aren't seeded.
  }
}
