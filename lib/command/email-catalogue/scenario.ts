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

export type EmailIdentity = {
  // The resolved example (fixture values) for this scenario.
  from: string;
  replyTo: string;
  // The RULE behind the From, in placeholder terms, plus the fallback chain, so
  // the actual resolution logic can be verified (not just the filled example).
  fromRule: string;
  fromFallback: string;
  replyToRule: string;
};

// Mirrors resolveAgencySenderForTransaction + the founder-approved sender map
// against the fixtures. Returns the resolved example AND the rule + fallbacks.
export function resolveCatalogueIdentity(kind: SenderKind, fileType: FileType): EmailIdentity {
  if (kind === "platform") {
    return {
      from: `Sales Progressor <${SP_ADDRESS}>`,
      replyTo: SP_ADDRESS,
      fromRule: "Always our platform address (system email).",
      fromFallback: "No fallback.",
      replyToRule: "Our platform inbox.",
    };
  }
  if (kind === "agent_internal") {
    return {
      from: `${FIXTURE_AGENCY.name} <${SP_ADDRESS}>`,
      replyTo: SP_ADDRESS,
      fromRule: "«{agency}» via our platform address; never the agency's outsourced sender.",
      fromFallback: "No fallback; always our address.",
      replyToRule: "Our platform inbox.",
    };
  }
  if (kind === "quote") {
    const fromAddr = fileType === "outsourced" ? FIXTURE_PROGRESSOR.email : "quotes@thesalesprogressor.co.uk";
    return {
      from: `${FIXTURE_AGENCY.name} <${fromAddr}>`,
      replyTo: "«the client's email»",
      fromRule:
        fileType === "outsourced"
          ? "«{agency}» via the assigned progressor's @thesalesprogressor.co.uk."
          : "«{agency}» via quotes@thesalesprogressor.co.uk.",
      fromFallback: "Self-managed → quotes@thesalesprogressor.co.uk; outsourced → the assigned progressor's address.",
      replyToRule: "The client's own email, so the firm replies to them directly.",
    };
  }

  // client_personal | client_automated | solicitor
  const personal = kind === "client_personal" || kind === "solicitor";
  if (fileType === "outsourced") {
    return {
      from: `${display(FIXTURE_PROGRESSOR.firstName)} <${FIXTURE_AGENCY.quoteSenderEmail}>`,
      replyTo: FIXTURE_PROGRESSOR.email,
      fromRule: "Agency's verified sending address, shown as «{progressor first} at {agency}».",
      fromFallback:
        "No verified agency sender → the assigned progressor's @thesalesprogressor.co.uk → ellis@thesalesprogressor.co.uk.",
      replyToRule:
        "The assigned progressor (when the agency address is domain-authenticated) or the agency's own inbox (when it's a verified single sender).",
    };
  }
  // self-managed on an authenticated agency domain
  return {
    from: `${display(FIXTURE_AGENT.firstName)} <${personal ? FIXTURE_AGENT.email : `updates@${FIXTURE_AGENCY.domain}`}>`,
    replyTo: FIXTURE_AGENT.email,
    fromRule: personal
      ? "The agent's own address, shown as «{agent first} at {agency}» (when their domain is authenticated)."
      : "«{agent first} at {agency}» via updates@{agency domain} (when authenticated).",
    fromFallback: "Agent's domain not authenticated → updates@thesalesprogressor.co.uk.",
    replyToRule: "The agent's own login address (noreply@thesalesprogressor.co.uk only if the agent has no email on file).",
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
