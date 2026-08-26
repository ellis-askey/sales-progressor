// Server helper: build the agency logo band (Option B header) for any email
// keyed on an agencyId, rather than a transaction. Used by emails that don't go
// through resolveAgencySenderForTransaction (chain invites, the milestone
// digest). Templates driven by a transaction already get the logo fields from
// the sender resolver.
//
// Returns "" when the agency has no logo, so the header falls back to its plain
// coral top.

import { prisma } from "@/lib/prisma";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { agencyLogoHeaderHtml } from "@/lib/email/logo-header";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";

export async function agencyLogoBand(agencyId: string | null | undefined): Promise<string> {
  if (!agencyId) return "";
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true },
  });
  if (!agency?.logoPath) return "";
  return agencyLogoHeaderHtml({
    logoUrl: getAgencyLogoUrl(agency.logoPath),
    tileColor: agency.logoTileColor,
    scale: agency.logoScale as LogoScale | null,
    align: agency.logoAlign as LogoAlign | null,
  });
}
