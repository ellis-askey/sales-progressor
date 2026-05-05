// lib/chain/status.ts
// Derives chain link status from fields. Used everywhere a status badge is rendered.

export type ChainLinkStatusKind =
  | "unclaimed_no_email"    // stub with no email yet — cannot be invited
  | "unclaimed_unsent"      // stub with email, invite not yet sent
  | "invited"               // invite sent, awaiting claim
  | "bounced"               // invite bounced — originator must update email
  | "declined"              // recipient declined
  | "claimed_other"         // claimed by someone else
  | "claimed_own"           // claimed by the current viewing user ("Your file")
  | "your_transaction";     // this is the viewing user's own transaction (not via claim)

export type ChainLinkStatus =
  | { kind: "unclaimed_no_email" }
  | { kind: "unclaimed_unsent" }
  | { kind: "invited" }
  | { kind: "bounced" }
  | { kind: "declined" }
  | { kind: "claimed_other"; claimerName?: string | null; claimerAgency?: string | null }
  | { kind: "claimed_own" }
  | { kind: "your_transaction" };

type LinkStatusInput = {
  transactionId: string | null;
  claimedByUserId: string | null;
  stubAgentEmail: string | null;
  inviteStatus: string;
};

export function getChainLinkStatus(
  link: LinkStatusInput,
  currentUserId: string,
  options?: { claimerName?: string | null; claimerAgency?: string | null },
): ChainLinkStatus {
  // Claimed state
  if (link.transactionId !== null) {
    if (link.claimedByUserId === currentUserId) {
      return { kind: "claimed_own" };
    }
    return {
      kind: "claimed_other",
      claimerName: options?.claimerName,
      claimerAgency: options?.claimerAgency,
    };
  }

  // Unclaimed states — derive from inviteStatus
  if (link.inviteStatus === "DECLINED") return { kind: "declined" };
  if (link.inviteStatus === "BOUNCED") return { kind: "bounced" };
  if (link.inviteStatus === "SENT") return { kind: "invited" };

  // NOT_SENT or CLAIMED (defensive — CLAIMED shouldn't reach here)
  if (!link.stubAgentEmail) return { kind: "unclaimed_no_email" };
  return { kind: "unclaimed_unsent" };
}

// Human-readable badge label for each status
export function chainLinkStatusLabel(status: ChainLinkStatus): string {
  switch (status.kind) {
    case "unclaimed_no_email": return "Unclaimed";
    case "unclaimed_unsent":   return "Unclaimed";
    case "invited":            return "Invited";
    case "bounced":            return "Bounced";
    case "declined":           return "Declined";
    case "claimed_other":      return "Claimed";
    case "claimed_own":        return "Your file";
    case "your_transaction":   return "Your file";
  }
}

// Tailwind colour variant for each status badge
export function chainLinkStatusColour(status: ChainLinkStatus): string {
  switch (status.kind) {
    case "unclaimed_no_email": return "bg-slate-100 text-slate-500";
    case "unclaimed_unsent":   return "bg-slate-100 text-slate-600";
    case "invited":            return "bg-blue-100 text-blue-700";
    case "bounced":            return "bg-red-100 text-red-700";
    case "declined":           return "bg-orange-100 text-orange-700";
    case "claimed_other":      return "bg-emerald-100 text-emerald-700";
    case "claimed_own":        return "bg-coral-100 text-[#FF6B4A] border border-[#FF6B4A]/30";
    case "your_transaction":   return "bg-coral-100 text-[#FF6B4A] border border-[#FF6B4A]/30";
  }
}
