import { headers } from "next/headers";
import { getProposalOverview, listInvitationLinks } from "@/lib/proposal/analytics";
import { ensureSeedInvitations } from "@/lib/proposal/invitations";
import { ProposalAdmin } from "@/components/command/proposal/ProposalAdmin";

export const dynamic = "force-dynamic";

export default async function CommandProposalPage() {
  // Seed the three default links the first time this opens after the migration.
  await ensureSeedInvitations();

  const [overview, links, h] = await Promise.all([getProposalOverview(), listInvitationLinks(), headers()]);

  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "portal.thesalesprogressor.co.uk";
  const origin = `${proto}://${host}`;

  return <ProposalAdmin overview={overview} links={links} origin={origin} />;
}
