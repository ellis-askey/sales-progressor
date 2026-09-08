// The scenario model for the Email Catalogue + the identity resolver.
//
// A scenario is the toolbar state (file type / side / theme / milestone). The
// identity resolver encodes the founder-approved sender map + signature rule so
// the catalogue shows the exact From / Reply-To / signature for each scenario.
// It MIRRORS lib/email/agency-sender.ts (resolveAgencySenderForTransaction) and
// lib/email/agent-signature-for-file.ts using the fixtures — see SPEC.md for the
// tracked follow-up to share one pure core so they cannot drift.

import { FIXTURE_AGENCY, FIXTURE_AGENT, FIXTURE_PROGRESSOR } from "./fixtures";

export type EmailCategory = "client" | "agent" | "internal" | "solicitor" | "provider" | "chain" | "platform";

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

export type EmailIdentity = { from: string; replyTo: string };

// Mirrors resolveAgencySenderForTransaction against the fixtures.
export function resolveCatalogueIdentity(kind: SenderKind, fileType: FileType): EmailIdentity {
  if (kind === "platform") {
    return { from: `Sales Progressor <${SP_ADDRESS}>`, replyTo: SP_ADDRESS };
  }
  if (kind === "agent_internal") {
    // Internal notification to the agency's own staff: their name, our address.
    return { from: `${FIXTURE_AGENCY.name} <${SP_ADDRESS}>`, replyTo: SP_ADDRESS };
  }
  if (kind === "quote") {
    // Survey quote request to a firm: self-managed from quotes@, outsourced from
    // the progressor; Reply-To is the client so the firm replies to them direct.
    const fromAddr = fileType === "outsourced" ? FIXTURE_PROGRESSOR.email : "quotes@thesalesprogressor.co.uk";
    return { from: `${FIXTURE_AGENCY.name} <${fromAddr}>`, replyTo: "james.carter@example.com" };
  }

  if (fileType === "outsourced") {
    // Agency verified sender (domain-authed) → Reply-To goes to the progressor.
    const from = `${display(FIXTURE_PROGRESSOR.firstName)} <${FIXTURE_AGENCY.quoteSenderEmail}>`;
    return { from, replyTo: FIXTURE_PROGRESSOR.email };
  }

  // Self-managed on an authenticated agency domain.
  const personal = kind === "client_personal" || kind === "solicitor";
  const fromAddr = personal ? FIXTURE_AGENT.email : `updates@${FIXTURE_AGENCY.domain}`;
  return { from: `${display(FIXTURE_AGENT.firstName)} <${fromAddr}>`, replyTo: FIXTURE_AGENT.email };
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
