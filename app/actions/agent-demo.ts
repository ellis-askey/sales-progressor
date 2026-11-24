"use server";

// Agent-demo link action. A progression-business owner gets their shareable link
// to send to prospective agents. The link is stable (a signed per-business token);
// each agent who opens it gets their own fresh, isolated sandbox — so unlike the
// portal preview there is no per-org file to find-or-create here. Nothing sends,
// nothing touches real data. See docs/active/agent-demo/SPEC.md.

import { requireSession } from "@/lib/session";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { signDemoLaunchToken } from "@/lib/security/demo-launch-token";

type Result = { ok: true; url: string } | { ok: false; error: string };

function launchUrl(businessId: string): string {
  const base = process.env.NEXTAUTH_URL ?? "";
  return `${base}/agent-demo/launch/${signDemoLaunchToken(businessId)}`;
}

/** The business's shareable agent-demo link (stable; a fresh sandbox per visitor). */
export async function getBusinessAgentDemoUrl(): Promise<Result> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only the business owner can open the agent demo." };
  return { ok: true, url: launchUrl(owner.businessId) };
}
