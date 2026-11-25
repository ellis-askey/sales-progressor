import { promises as fs } from "fs";
import path from "path";
import { getProposalSession } from "@/lib/proposal/auth";
import { resolveInvitation } from "@/lib/proposal/invitations";
import { ProposalGate } from "./ProposalGate";
import { ProposalExperience } from "@/components/proposal/ProposalExperience";

// Never statically cached — confidential, and the authed/unauthed branch depends
// on the request's cookies.
export const dynamic = "force-dynamic";

export default async function ProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ i?: string }>;
}) {
  const sp = await searchParams;
  const inviteToken = typeof sp.i === "string" ? sp.i : null;

  const session = await getProposalSession();

  if (!session) {
    // Greet by the invited name when the link resolves (and isn't the owner's
    // own review link). The password is still required regardless.
    const inv = await resolveInvitation(inviteToken);
    const label = inv && !inv.revoked && !inv.isOwner ? inv.label : null;
    return <ProposalGate inviteToken={inviteToken} inviteLabel={label} />;
  }

  // Literal path segments (not an imported variable) so the file tracer resolves
  // this precisely and doesn't over-bundle the function. See the note in
  // app/api/proposal/pdf/route.ts.
  let pdfAvailable = false;
  try {
    await fs.access(path.join(process.cwd(), "private", "proposal", "beyond-sales-progression.pdf"));
    pdfAvailable = true;
  } catch {
    pdfAvailable = false;
  }

  return <ProposalExperience pdfAvailable={pdfAvailable} />;
}
