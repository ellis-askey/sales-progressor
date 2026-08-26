// Command Centre "Email senders" reference. Encodes every outbound email type
// and how its sender resolves, so the CC page can show it live per agency with
// an in-house/outsourced toggle.
//
// describeSender() MIRRORS the real resolver policy in lib/email/agency-sender.ts
// + resolveSenderForTransaction (lib/email.ts). Keep the two in step: when a
// sender changes, update the matching row's `kind` here. Pure + client-safe.

export type FileType = "outsourced" | "self_managed";

// agencyPerson  — per-file agency mail, branded "{person} at {Agency}", file-type-aware fallback
// agencyPlain   — agency-level mail (digests, invites, chain), plain "{Agency}", updates@ fallback
// agentOwn      — the acting sender's own verified address, else agency, else file-type fallback
// sp            — Sales Progressor platform/chain email (intended)
// spGap         — client mail that STILL sends from SP (a gap, not yet routed to the agency)
export type SenderKind = "agencyPerson" | "agencyPlain" | "agentOwn" | "sp" | "spGap";

export type EmailSender = {
  id: string;
  name: string;
  group: string;
  kind: SenderKind;
  reply?: string; // override for the reply-to description
  note?: string;
  scope?: FileType; // only shown for this file type (e.g. outsource-intro)
};

export const SENDER_GROUPS = [
  "Solicitors",
  "Buyers & sellers (clients)",
  "Surveyors & providers",
  "Agents & agency users",
  "External agents & chain",
  "Platform & internal",
] as const;

export const EMAIL_SENDERS: EmailSender[] = [
  // Solicitors
  { id: "sol-confirm", group: "Solicitors", name: "Solicitor confirmation / chase digest", kind: "agencyPerson" },
  { id: "enq-chase", group: "Solicitors", name: "Enquiry chase (reply-loop)", kind: "agencyPerson" },
  { id: "enq-raise", group: "Solicitors", name: "Enquiry raise-chase", kind: "agencyPerson" },
  { id: "manual", group: "Solicitors", name: "Manual “email from a file”", kind: "agentOwn", note: "sender-chosen recipient" },

  // Buyers & sellers
  { id: "ms-confirm", group: "Buyers & sellers (clients)", name: "Milestone confirmation (single + digest)", kind: "agencyPerson" },
  { id: "ms-rich", group: "Buyers & sellers (clients)", name: "Portal-confirmed milestone (rich)", kind: "agencyPerson" },
  { id: "ms-step", group: "Buyers & sellers (clients)", name: "Step-confirmed thank-you", kind: "agencyPerson" },
  { id: "ms-other", group: "Buyers & sellers (clients)", name: "Progress update to the other side", kind: "agencyPerson" },
  { id: "ms-admin", group: "Buyers & sellers (clients)", name: "Admin-confirmed progress / date / completion", kind: "agencyPerson" },
  { id: "rte", group: "Buyers & sellers (clients)", name: "Ready to exchange", kind: "agencyPerson" },
  { id: "survey", group: "Buyers & sellers (clients)", name: "Completion survey / feedback", kind: "agencyPerson" },
  { id: "weekly", group: "Buyers & sellers (clients)", name: "Client weekly “all on track” update", kind: "agencyPerson" },
  { id: "chase", group: "Buyers & sellers (clients)", name: "Client chase digest", kind: "agencyPerson" },
  { id: "invite", group: "Buyers & sellers (clients)", name: "Portal invite / portal link", kind: "agencyPerson" },
  { id: "outsource-intro", group: "Buyers & sellers (clients)", name: "Outsource-intro to buyer + seller", kind: "agentOwn", note: "outsourced files only", scope: "outsourced" },
  { id: "gap-completion", group: "Buyers & sellers (clients)", name: "Completion pack (“what happens next”)", kind: "spGap" },
  { id: "gap-reply", group: "Buyers & sellers (clients)", name: "Progressor's reply to a client message", kind: "agencyPerson" },
  { id: "gap-visible", group: "Buyers & sellers (clients)", name: "“Visible update” to clients (comms tool)", kind: "agencyPerson" },
  { id: "gap-quotelink", group: "Buyers & sellers (clients)", name: "Survey-quote link to a buyer", kind: "agencyPerson", reply: "the agent's email" },

  // Surveyors & providers
  { id: "quote-req", group: "Surveyors & providers", name: "Survey quote request to a firm", kind: "agencyPlain", reply: "the client's email" },
  { id: "quote-heads", group: "Surveyors & providers", name: "Internal “quote requested” heads-up", kind: "sp", reply: "none", note: "to your ops inbox (ellis@…)" },

  // Agents & agency users
  { id: "ag-confirm-prog", group: "Agents & agency users", name: "“Client confirmed milestone” → progressor", kind: "agencyPerson" },
  { id: "ag-confirm-agent", group: "Agents & agency users", name: "“Client confirmed milestone” → agent", kind: "agencyPerson" },
  { id: "ag-note", group: "Agents & agency users", name: "Agent operational milestone note", kind: "agencyPerson" },
  { id: "prog-note", group: "Agents & agency users", name: "Progressor milestone note", kind: "agencyPerson" },
  { id: "gap-portalmsg", group: "Agents & agency users", name: "Portal message → agent (client wrote in)", kind: "spGap" },
  { id: "digest-morning", group: "Agents & agency users", name: "Morning digest", kind: "agencyPlain", note: "agency-level" },
  { id: "digest-weekly", group: "Agents & agency users", name: "Weekly brief", kind: "agencyPlain", note: "agency-level" },
  { id: "team", group: "Agents & agency users", name: "Team invites + accepted (director & negotiator)", kind: "agencyPlain", note: "agency-level" },
  { id: "chain-bounce", group: "Agents & agency users", name: "Chain-invite bounced notice", kind: "agencyPlain" },

  // External agents & chain
  { id: "chain-invite", group: "External agents & chain", name: "Chain invite (to unclaimed agent)", kind: "agencyPlain", note: "originator agency" },
  { id: "chain-cascade", group: "External agents & chain", name: "Chain cascade / exchange / completion / celebration", kind: "sp", reply: "support@thesalesprogressor.co.uk" },
  { id: "chain-wait", group: "External agents & chain", name: "Wait-nudge / invite-declined notice", kind: "sp", reply: "support@thesalesprogressor.co.uk" },

  // Platform & internal
  { id: "pw", group: "Platform & internal", name: "Password reset", kind: "sp", reply: "none" },
  { id: "welcome", group: "Platform & internal", name: "Welcome / activation", kind: "sp", reply: "none" },
  { id: "retention", group: "Platform & internal", name: "Retention sequence", kind: "sp", reply: "inbox@thesalesprogressor.co.uk" },
  { id: "verify", group: "Platform & internal", name: "Verified-email verification code", kind: "sp", reply: "none" },
  { id: "domain", group: "Platform & internal", name: "Domain-auth alert / DNS instructions", kind: "sp", reply: "none" },
  { id: "founder", group: "Platform & internal", name: "Founder brief / weekly / content digest", kind: "sp", reply: "none" },
];

// ── Policy mirror ────────────────────────────────────────────────────────────

const SP_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";
const SP_ADDR = "updates@thesalesprogressor.co.uk";
// The outsourced fallback is the assigned progressor's own @thesalesprogressor
// address (whichever progressor is on the file). Ellis is the sole progressor
// today; shown as the concrete example.
const PROGRESSOR_FALLBACK = "ellis@thesalesprogressor.co.uk";

export type SenderResolution = {
  from: string; // display string, may contain a ⟨persona⟩ placeholder
  replyTo: string;
  fallback: string; // what it falls back to (shown even when not triggered)
  chip: "agency" | "own" | "sp" | "gap";
};

export type AgencyForSender = { name: string; quoteSenderEmail: string | null };

// The file-type-aware fallback for a PER-FILE send.
function fileFallback(fileType: FileType): { from: string; addr: string } {
  return fileType === "outsourced"
    ? { from: `⟨progressor⟩ <${PROGRESSOR_FALLBACK}>`, addr: PROGRESSOR_FALLBACK }
    : { from: SP_FROM, addr: SP_ADDR };
}

export function describeSender(email: EmailSender, fileType: FileType, agency: AgencyForSender): SenderResolution {
  const addr = agency.quoteSenderEmail?.trim() || null;
  const brand = agency.name.replace(/\s+(Ltd|Limited|LLP|PLC|plc)\.?$/i, "").trim();
  const persona = fileType === "outsourced" ? "⟨progressor⟩" : "⟨agency agent⟩";
  const ff = fileFallback(fileType);

  switch (email.kind) {
    case "agencyPerson":
      return addr
        ? { from: `${persona} at ${brand} <${addr}>`, replyTo: addr, fallback: ff.from, chip: "agency" }
        : { from: ff.from, replyTo: ff.addr, fallback: ff.from, chip: "agency" };
    case "agencyPlain":
      // Agency-level: no persona, always the plain updates@ fallback (not file-type-aware).
      return addr
        ? { from: `${brand} <${addr}>`, replyTo: email.reply ?? addr, fallback: SP_FROM, chip: "agency" }
        : { from: SP_FROM, replyTo: email.reply ?? SP_ADDR, fallback: SP_FROM, chip: "agency" };
    case "agentOwn":
      return {
        from: "the sender's own verified address",
        replyTo: email.reply ?? "matches the sender",
        fallback: `${addr ?? "agency address"} → ${ff.from}`,
        chip: "own",
      };
    case "sp":
    case "spGap":
      return { from: SP_FROM, replyTo: email.reply ?? "none", fallback: SP_FROM, chip: email.kind === "spGap" ? "gap" : "sp" };
  }
}
