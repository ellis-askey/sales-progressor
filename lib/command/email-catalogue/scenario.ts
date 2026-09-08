// The scenario model for the Email Catalogue + the identity resolver.
//
// A scenario is the toolbar state (file type / side / theme / milestone). The
// identity resolver encodes the founder-approved sender map + signature rule so
// the catalogue shows the exact From / Reply-To / signature for each scenario.
// It MIRRORS lib/email/agency-sender.ts (resolveAgencySenderForTransaction) and
// lib/email/agent-signature-for-file.ts using the fixtures — see SPEC.md for the
// tracked follow-up to share one pure core so they cannot drift.

import { FIXTURE_AGENCY, FIXTURE_AGENT, FIXTURE_PROGRESSOR } from "./fixtures";

export type EmailCategory = "client" | "agent" | "internal" | "solicitor" | "provider" | "perfected" | "chain" | "platform";

export type FileType = "self_managed" | "outsourced";
export type Side = "vendor" | "purchaser";
export type ThemeKind = "coral" | "custom";
export type ScenarioAxis = "fileType" | "side" | "theme" | "milestoneCode";

export type Scenario = {
  fileType: FileType;
  side: Side;
  theme: ThemeKind;
  milestoneCode: string;
};

export const DEFAULT_SCENARIO: Scenario = {
  fileType: "self_managed",
  side: "vendor",
  theme: "coral",
  milestoneCode: "VM3",
};

// How an email chooses its sender identity.
export type SenderKind =
  | "client_personal" // chases/invites — self: agent's own; outsourced: agency/progressor
  | "client_automated" // milestone/status updates
  | "solicitor" // replyable agency sender to a solicitor
  | "agent_internal" // notification to the agency's own staff (from us)
  | "quote" // survey quote request to a surveyor firm
  | "platform"; // Sales Progressor system email

// How an email signs off.
export type SignatureBehaviour =
  | "agent_or_inhouse" // self: agent's own signature; outsourced: in-house block
  | "agent_or_none" // self: agent's own; outsourced: no personal sign-off
  | "none" // never carries a signature
  | "sp"; // Sales Progressor sign-off

const SP_ADDRESS = "updates@thesalesprogressor.co.uk";

function display(person: string): string {
  return `${person} at ${FIXTURE_AGENCY.name}`;
}

// One rung of the sender ladder: the address it resolves to, the condition under
// which that rung applies, and whether THIS scenario lands on it (the fixture is
// configured best-case, so the top rung is active).
export type IdentityTier = {
  label: string;
  value: string;
  condition: string;
  active: boolean;
};

export type EmailIdentity = { fromTiers: IdentityTier[]; replyToTiers: IdentityTier[] };

// Mirrors resolveAgencySenderForTransaction against the fixtures, expressed as a
// ranked ladder: best case at the top, then each fallback with its condition.
export function resolveCatalogueIdentity(kind: SenderKind, fileType: FileType): EmailIdentity {
  const brandProg = display(FIXTURE_PROGRESSOR.firstName);
  const brandAgent = display(FIXTURE_AGENT.firstName);
  const ELLIS = "ellis@thesalesprogressor.co.uk";
  const QUOTES = "quotes@thesalesprogressor.co.uk";
  const NOREPLY = "noreply@thesalesprogressor.co.uk";

  if (kind === "platform") {
    return {
      fromTiers: [{ label: "Always", value: `Sales Progressor <${SP_ADDRESS}>`, condition: "system email, sent from our platform address", active: true }],
      replyToTiers: [{ label: "Always", value: SP_ADDRESS, condition: "our platform inbox", active: true }],
    };
  }
  if (kind === "agent_internal") {
    return {
      fromTiers: [{ label: "Always", value: `${FIXTURE_AGENCY.name} <${SP_ADDRESS}>`, condition: "our platform address, never the agency's outsourced sender", active: true }],
      replyToTiers: [{ label: "Always", value: SP_ADDRESS, condition: "our platform inbox", active: true }],
    };
  }
  if (kind === "quote") {
    return {
      fromTiers: [
        { label: "Self-managed", value: `${FIXTURE_AGENCY.name} <${QUOTES}>`, condition: "on a self-managed file, sent via our quotes mailbox", active: fileType === "self_managed" },
        { label: "Outsourced", value: `${FIXTURE_AGENCY.name} <${ELLIS}>`, condition: "on an outsourced file, sent via the assigned progressor's address", active: fileType === "outsourced" },
      ],
      replyToTiers: [{ label: "Always", value: "the client's own email", condition: "so the surveyor firm replies to the client directly", active: true }],
    };
  }

  if (fileType === "outsourced") {
    return {
      fromTiers: [
        { label: "Best", value: `${brandProg} <${FIXTURE_AGENCY.quoteSenderEmail}>`, condition: "the agency's own verified sending address", active: true },
        { label: "Next best", value: `${brandProg} <${ELLIS}>`, condition: "if the agency has no verified sender: the assigned progressor's @thesalesprogressor.co.uk", active: false },
        { label: "Last resort", value: ELLIS, condition: "if that progressor has no @thesalesprogressor.co.uk address: our default ellis@thesalesprogressor.co.uk", active: false },
      ],
      replyToTiers: [
        { label: "Usually", value: ELLIS, condition: "the assigned progressor, when the agency's address is domain-authenticated (our fixture case)", active: true },
        { label: "Otherwise", value: FIXTURE_AGENCY.quoteSenderEmail, condition: "the agency's own inbox, when the sender is a verified single-sender", active: false },
      ],
    };
  }

  // self-managed on an authenticated agency domain
  const personal = kind === "client_personal" || kind === "solicitor";
  const bestAddr = personal ? FIXTURE_AGENT.email : `updates@${FIXTURE_AGENCY.domain}`;
  const bestCond = personal
    ? "the agent's own address, when the agency's domain DNS is authenticated in SendGrid"
    : "the generic mailbox on the agency's own domain, when its DNS is authenticated in SendGrid";
  return {
    fromTiers: [
      { label: "Best", value: `${brandAgent} <${bestAddr}>`, condition: bestCond, active: true },
      { label: "Next best", value: `${brandAgent} <${SP_ADDRESS}>`, condition: "if the agency's domain isn't authenticated: our updates@thesalesprogressor.co.uk", active: false },
    ],
    replyToTiers: [
      { label: "Best", value: FIXTURE_AGENT.email, condition: "the agent's own login address", active: true },
      { label: "Fallback", value: NOREPLY, condition: "only if the agent has no email on file", active: false },
    ],
  };
}

// Human description of the signature that renders for a scenario.
export function describeSignature(behaviour: SignatureBehaviour, fileType: FileType): string {
  switch (behaviour) {
    case "none":
      return "No signature (client-branded body only)";
    case "sp":
      return "Sales Progressor sign-off";
    case "agent_or_inhouse":
      return fileType === "self_managed"
        ? `Agent's own signature (${FIXTURE_AGENT.name})`
        : `In-house block (${FIXTURE_PROGRESSOR.name} · ${FIXTURE_AGENCY.name})`;
    case "agent_or_none":
      return fileType === "self_managed"
        ? `Agent's own signature (${FIXTURE_AGENT.name})`
        : "No personal sign-off (outsourced)";
  }
}
