// Client-facing identity for a professionally-progressed (outsourced) file,
// resolved from the responsible progression business.
//
// A null business (or the TSP business row) yields The Sales Progressor's own
// values, byte-identical to the pre-generalisation hardcoded constants, so
// TSP/legacy files are unchanged. An external progression business uses its own
// configured identity — never TSP's WhatsApp number, sending domain, or org
// name leaks onto its files.
//
// Pure (no DB): callers load the `progressionBusiness` relation and pass it in.

export type ProgressionBusinessIdentityInput = {
  name: string;
  contactWhatsapp: string | null;
  senderEmail: string | null;
  senderDomain: string | null;
  isTsp: boolean;
} | null;

export type ProgressionIdentity = {
  // Org name shown to clients (vCard org, etc.).
  orgName: string;
  // Stored WhatsApp number, e.g. "+447508862929"; null = no WhatsApp shown.
  contactWhatsapp: string | null;
  // Verified/authenticated sending address to fall back to.
  senderEmail: string;
  // Sending domain — a progressor's own address on this domain is preferred.
  senderDomain: string;
  isTsp: boolean;
};

// The Sales Progressor (platform operator) identity. These are the EXACT
// pre-generalisation hardcoded values, kept here so null/TSP files render
// identically without depending on the seeded ProgressionBusiness row.
const TSP_IDENTITY: ProgressionIdentity = {
  orgName: "The Sales Progressor",
  contactWhatsapp: "+447508862929",
  senderEmail: "ellis@thesalesprogressor.co.uk",
  senderDomain: "thesalesprogressor.co.uk",
  isTsp: true,
};

// Platform sending fallback for an external business that hasn't configured its
// own verified sender (bulletproof-sender: we can only send from a verified
// address). Shows the platform domain, NOT a personal TSP address, until the
// business verifies its own domain.
const PLATFORM_FALLBACK_SENDER = "updates@thesalesprogressor.co.uk";
const PLATFORM_FALLBACK_DOMAIN = "thesalesprogressor.co.uk";

/**
 * Resolve the client-facing identity for a file from its progression business.
 * Null or the TSP business → The Sales Progressor's values (unchanged).
 */
export function clientFacingIdentity(
  business: ProgressionBusinessIdentityInput,
): ProgressionIdentity {
  if (!business || business.isTsp) return TSP_IDENTITY;
  return {
    orgName: business.name,
    contactWhatsapp: business.contactWhatsapp,
    senderEmail: business.senderEmail ?? PLATFORM_FALLBACK_SENDER,
    senderDomain: business.senderDomain ?? PLATFORM_FALLBACK_DOMAIN,
    isTsp: false,
  };
}

/** wa.me link from a stored number (digits only). Null when no number set. */
export function whatsappLink(contactWhatsapp: string | null): string | null {
  if (!contactWhatsapp) return null;
  const digits = contactWhatsapp.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

/**
 * The outbound sender address for a professionally-progressed file: the assigned
 * progressor's own address when it's on the business's sending domain (a real
 * inbox we control), else the business's configured sender. Generalises the old
 * TSP-only progressorFallbackAddress.
 */
export function progressorSenderAddress(
  identity: ProgressionIdentity,
  assignedEmail?: string | null,
): string {
  const domain = identity.senderDomain.toLowerCase();
  if (assignedEmail && assignedEmail.toLowerCase().endsWith(`@${domain}`)) {
    return assignedEmail;
  }
  return identity.senderEmail;
}
