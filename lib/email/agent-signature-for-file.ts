// Resolve the agent's own email signature for a file's AUTOMATED chases
// (solicitor-confirm + enquiry chases), applying the self-managed vs outsourced
// rule in one place:
//
//   - Self-managed file (the agency runs it themselves): the person looking
//     after the file day-to-day signs off — the assigned in-house progressor
//     when one is set (founder Rule A, 2026-11-10), else the file's agent.
//     Their signature is whatever resolveEmailSignature returns for that user
//     (standard, image or custom; BASIC the universal fallback).
//   - Outsourced file (we progress it): returns null. The caller keeps its own
//     in-house sign-off (our team member's name / phone / avatar), unchanged.
//
// "Outsourced" is read from serviceType, NOT from assignedUserId. This matters:
// an in-house-progression agency (Boardwalk) sets assignedUserId on its OWN
// self-managed files (the in-house progressor), so assignedUserId is no longer a
// reliable "outsourced" signal. serviceType === "outsourced" is the real flag —
// and on self-managed files that same assignedUserId is exactly who should sign.

import { resolveEmailSignature, type SignatureAgencyContext } from "@/lib/email/signature";

export async function resolveAgentSignatureForFile(opts: {
  serviceType: "self_managed" | "outsourced" | null; // "outsourced" => no agent signature
  agentUserId: string | null; // the agency's own agent (self-managed owner)
  // The assigned in-house progressor on a self-managed file — signs when set.
  assignedUserId?: string | null;
  agentName?: string | null;
  agency: SignatureAgencyContext | null;
}): Promise<{ html: string; text: string } | null> {
  if (opts.serviceType === "outsourced") return null; // outsourced — caller keeps its own sign-off
  const signerId = opts.assignedUserId ?? opts.agentUserId;
  if (!signerId) return null; // nobody to sign as
  const sig = await resolveEmailSignature({
    userId: signerId,
    agency: opts.agency,
    fallbackName: opts.agentName,
  });
  return { html: sig.html, text: sig.text };
}
