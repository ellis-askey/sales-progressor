import type { ProspectStatus, ProspectSource } from "@prisma/client";

// Pure constants for Prospects — no server imports, so client components can use
// them. The data layer (lib/command/prospects.ts) re-exports these.

export const PROSPECT_STATUSES: ProspectStatus[] = ["new", "contacted", "replied", "interested", "trial", "active", "lost"];
export const PROSPECT_SOURCES: ProspectSource[] = ["cold", "google", "linkedin", "referral", "chain", "solicitor", "existing_contact", "inbound", "other"];

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  new: "New", contacted: "Contacted", replied: "Replied", interested: "Interested",
  trial: "Trial / first sale", active: "Active", lost: "Lost",
};
export const SOURCE_LABEL: Record<ProspectSource, string> = {
  cold: "Cold outreach", google: "Google", linkedin: "LinkedIn", referral: "Referral",
  chain: "Chain exposure", solicitor: "Solicitor", existing_contact: "Existing contact",
  inbound: "Inbound", other: "Other",
};

// Status pill colours for the list + drawer.
export const STATUS_TONE: Record<ProspectStatus, string> = {
  new: "bg-neutral-800 text-neutral-300 border-neutral-700",
  contacted: "bg-blue-950 text-blue-300 border-blue-900",
  replied: "bg-cyan-950 text-cyan-300 border-cyan-900",
  interested: "bg-violet-950 text-violet-300 border-violet-900",
  trial: "bg-amber-950 text-amber-300 border-amber-900",
  active: "bg-emerald-950 text-emerald-300 border-emerald-900",
  lost: "bg-red-950 text-red-400 border-red-900",
};
