// Resolve the agent's own email signature for a file's AUTOMATED chases
// (solicitor-confirm + enquiry chases), applying the self-managed vs outsourced
// rule in one place:
//
//   - Self-managed file (the agency runs it themselves): the file's agent signs
//     off with THEIR signature — the standard one built from their details, or
//     the image / custom signature they've set up (whatever resolveEmailSignature
//     returns for that user, BASIC being the universal fallback).
//   - Outsourced file (we progress it): returns null. The caller keeps its own
//     in-house sign-off (our team member's name / phone / avatar), unchanged.
//
// "Outsourced" is read from serviceType, NOT from assignedUserId. This matters:
// an in-house-progression agency (Boardwalk) sets assignedUserId on its OWN
// self-managed files (the in-house progressor), so assignedUserId is no longer a
// reliable "outsourced" signal. serviceType === "outsourced" is the real flag.

import { resolveEmailSignature, type SignatureAgencyContext } from "@/lib/email/signature";

export async function resolveAgentSignatureForFile(opts: {
  serviceType: "self_managed" | "outsourced" | null; // "outsourced" => no agent signature
  agentUserId: string | null; // the agency's own agent (self-managed signer)
  agentName?: string | null;
  agency: SignatureAgencyContext | null;
}): Promise<{ html: string; text: string } | null> {
  if (opts.serviceType === "outsourced") return null; // outsourced — caller keeps its own sign-off
  if (!opts.agentUserId) return null; // no agency agent to sign as
  const sig = await resolveEmailSignature({
    userId: opts.agentUserId,
    agency: opts.agency,
    fallbackName: opts.agentName,
  });
  return { html: sig.html, text: sig.text };
}
