// DB-backed resolver for the sign-off phrase that heads an agent's composed
// emails (New email + chase), kept separate from the pure lib/email/sign-off.ts
// so that module stays client-safe (EmailSignatureCard imports its choices).
//
// Resolution mirrors the signature branch: an external progression business's
// file uses the per-client sign-off (ProgressionBusinessClient.signOff); every
// other file (self-managed agent, or an internal/TSP staffer) uses the sender's
// own User.emailSignOff. Always coerced to an allowed choice, never blank.

import { prisma } from "@/lib/prisma";
import { normalizeSignOff } from "./sign-off";

export async function resolveSignOffPhrase(opts: {
  userId: string;
  progressionBusinessId?: string | null;
  agencyId?: string | null;
}): Promise<string> {
  if (opts.progressionBusinessId && opts.agencyId) {
    const link = await prisma.progressionBusinessClient.findUnique({
      where: {
        progressionBusinessId_agencyId: {
          progressionBusinessId: opts.progressionBusinessId,
          agencyId: opts.agencyId,
        },
      },
      select: { signOff: true },
    });
    if (link) return normalizeSignOff(link.signOff);
  }
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { emailSignOff: true },
  });
  return normalizeSignOff(user?.emailSignOff);
}
