// Renders the client-chase email EXACTLY as it would send for a single step, so
// the chasing settings page can show "here's what the client receives" per step.
//
// Truest form: it runs the real assembleDigestPayload with the agency's resolved
// chase copy (subject/intro/outro edits) AND the agency's real email branding
// (colours, studio theme, logo, sender). Branding is agency-level — the same for
// every file — so we resolve it from the agency's most recent file via the exact
// send-path resolver, then swap in placeholder address/name so no real client
// data appears. A code that is never client-chased returns { chaseable: false }.

import { prisma } from "@/lib/prisma";
import { assembleDigestPayload } from "@/lib/email/client-chase-digest";
import { resolveClientChaseContent } from "@/lib/agency-email/templates";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { resolveEmailTheme } from "@/lib/email/brand-theme";
import { isClientChaseable } from "@/lib/chase/chaseable-milestones";

export type ChasePreview =
  | { chaseable: false }
  | { chaseable: true; subject: string; html: string; source: "custom" | "default" };

export async function getClientChasePreview(args: {
  agencyId: string | null;
  progressionBusinessId: string | null;
  code: string;
  side: "seller" | "buyer";
}): Promise<ChasePreview> {
  const { agencyId, progressionBusinessId, code, side } = args;
  if (!isClientChaseable(code)) return { chaseable: false };

  const agencyCopy = await resolveClientChaseContent(agencyId, progressionBusinessId);
  const source: "custom" | "default" =
    agencyCopy.subject?.trim() || agencyCopy.intro?.trim() || agencyCopy.outro?.trim() ? "custom" : "default";

  // Resolve the agency's real branding from its most recent file (the exact send
  // path). Null (no files yet) falls back to the Sales Progressor default theme.
  const repTx = agencyId
    ? await prisma.propertyTransaction.findFirst({ where: { agencyId }, orderBy: { createdAt: "desc" }, select: { id: true } })
    : null;
  const sender = repTx ? await resolveAgencySenderForTransaction(repTx.id, { persona: "personal" }) : null;

  const agency = agencyId ? await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }) : null;
  const agencyName = sender?.brandName ?? agency?.name ?? "Your agency";
  const theme = sender?.theme ?? resolveEmailTheme(null);

  const payload = assembleDigestPayload({
    // Placeholder tokens — the branding + copy are real, the address/name are not.
    transaction: { id: "preview", propertyAddress: "12 Example Avenue, Exampleton EX4 1MP" },
    contact: { id: "preview-contact", name: "Alex Taylor", portalToken: "preview" },
    milestones: [{ code }],
    agencyName,
    recipientSide: side === "seller" ? "vendor" : "purchaser",
    agencyCopy,
    theme,
    studioTheme: sender?.studioTheme,
    identityName: sender?.brandName ?? agencyName,
    logoUrl: sender?.logoUrl,
    tileColor: sender?.tileColor,
    supportEmail: sender?.visibleEmail ?? (sender?.canReply ? sender?.replyTo : undefined),
  });

  return { chaseable: true, subject: payload.subject, html: payload.html, source };
}
