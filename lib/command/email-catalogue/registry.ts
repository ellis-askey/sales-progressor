// The Email Catalogue specimen registry (server-only — imports the real email
// builders). Each specimen renders from the SAME builder that emails real
// people, driven by fixtures, so the catalogue cannot drift from production.
//
// Law 8: lives under lib/command; imports shared builders, nothing imports it
// back. Law 13: a specimen is listed only when its render works for real.

import "server-only";

import {
  type Scenario,
  type EmailCategory,
  type SenderKind,
  type SignatureBehaviour,
  type ScenarioAxis,
  type Side,
} from "./scenario";
import {
  CATALOGUE_BASE,
  FIXTURE_AGENCY,
  FIXTURE_AGENT,
  FIXTURE_PROGRESSOR,
  FIXTURE_PROPERTY,
  FIXTURE_VENDORS,
  FIXTURE_PURCHASERS,
  FIXTURE_SOLICITORS,
  catalogueTheme,
  joinNames,
} from "./fixtures";

import { buildPortalInviteEmail } from "@/lib/email/portal-invite";
import {
  richMilestoneEmailHtml,
  portalStepConfirmedHtml,
  portalEmailHtml,
  renderCompletionPackBody,
} from "@/lib/services/portal";
import { assembleMilestoneDigest, type MilestoneDigestPayload } from "@/lib/email/milestone-digest";
import { assembleDigestPayload } from "@/lib/email/client-chase-digest";
import { buildReadyToExchangeEmail } from "@/lib/email/ready-to-exchange";
import { buildSolicitorDigestEmail } from "@/lib/solicitor-confirm/digest-email";
import { buildEnquiryChaseEmail } from "@/lib/enquiries/chase-email";
import { buildRaiseBuyerEmail, buildRaiseSolicitorEmail } from "@/lib/enquiries/raise-chase-email";
import { buildExchangeDayClientMorningEmail, buildExchangeDayClientAuthorityEmail } from "@/lib/exchange-day/emails";
import { buildPortalMessage } from "@/lib/emails/portal-message";
import { buildInHouseSignoff } from "@/lib/email/in-house-signoff";
import { buildChaseSignatureHtml, buildChaseSignatureText } from "@/lib/email/chase-signature";
import { agencyLogoHeaderHtml } from "@/lib/email/logo-header";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { COMPLETION_PACK_DEFAULTS, EXCHANGE_DAY_MORNING_DEFAULT, EXCHANGE_DAY_AUTHORITY_DEFAULT } from "@/lib/agency-email/templates";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";
// lib/emails/* — the Sales-Progressor-branded (navy hero) family.
import { buildChainInvite } from "@/lib/emails/chain-invite";
import { buildChainOverview } from "@/lib/emails/chain-overview";
import { buildChainUpdate } from "@/lib/emails/chain-update";
import { buildChainStillMoving } from "@/lib/emails/chain-still-moving";
import { buildPasswordReset } from "@/lib/emails/password-reset";
import { buildEmailVerification } from "@/lib/emails/email-verification";
import { buildDomainAuth } from "@/lib/emails/domain-auth";
import { buildAgencyInvitation } from "@/lib/emails/agency-invitation";
import { buildFirstExchange } from "@/lib/emails/first-exchange";
import { buildTeamInvitation } from "@/lib/emails/team-invitation";
import { buildTeamJoined } from "@/lib/emails/team-joined";
import { buildMorningBrief } from "@/lib/emails/morning-brief";
import { buildWeeklyBrief } from "@/lib/emails/weekly-brief";
import { buildRetentionEmail, RETENTION_EMAIL_KEYS } from "@/lib/emails/retention";

export type RenderedEmail = { subject: string; html: string };

export type SpecimenMeta = {
  id: string;
  category: EmailCategory;
  name: string;
  description: string;
  trigger: string; // plain-English "fires when ..."
  axes: ScenarioAxis[];
  senderKind: SenderKind;
  signatureBehaviour: SignatureBehaviour;
};

export type EmailSpecimen = SpecimenMeta & {
  render: (s: Scenario) => RenderedEmail;
};

// ── Fixture helpers ─────────────────────────────────────────────────────────
const PORTAL = `${CATALOGUE_BASE}/portal/PREVIEW`;
const SOL_URL = `${CATALOGUE_BASE}/s/PREVIEW`;

function firstName(side: Side): string {
  return side === "vendor" ? FIXTURE_VENDORS[0].firstName : FIXTURE_PURCHASERS[0].firstName;
}
function fullName(side: Side): string {
  return side === "vendor" ? FIXTURE_VENDORS[0].name : FIXTURE_PURCHASERS[0].name;
}
function sideNames(side: Side): string[] {
  return side === "vendor" ? FIXTURE_VENDORS.map((v) => v.name) : FIXTURE_PURCHASERS.map((p) => p.name);
}
function saleWord(side: Side): string {
  return side === "vendor" ? "sale" : "purchase";
}
function greeting(side: Side): string {
  return `Hi ${firstName(side)},`;
}
function logoBand(): string {
  return agencyLogoHeaderHtml({
    logoUrl: getAgencyLogoUrl(FIXTURE_AGENCY.logoPath),
    tileColor: FIXTURE_AGENCY.logoTileColor,
    scale: FIXTURE_AGENCY.logoScale as LogoScale | null,
    align: FIXTURE_AGENCY.logoAlign as LogoAlign | null,
  });
}

// The fixture agent's own signature (a BASIC card stand-in — real agents may use
// an image/custom signature; the catalogue shows the standard card as the
// representative "agent's own signature").
function agentSignature(): { html: string; text: string } {
  const sigInput = {
    agentName: FIXTURE_AGENT.name,
    agentImageUrl: null,
    jobTitle: FIXTURE_AGENT.jobTitle,
    directMobile: FIXTURE_AGENT.directMobile,
    phone: FIXTURE_AGENT.phone,
    agencyName: FIXTURE_AGENCY.name,
    agencyLogoBandHtml: logoBand(),
  };
  return { html: buildChaseSignatureHtml(sigInput), text: buildChaseSignatureText(sigInput) };
}

// Verbatim copy of composeHtml from app/api/agent/send-email/route.ts.
function composeManualHtml(body: string, sigHtml: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = esc(body).replace(/\r?\n/g, "<br>");
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6;">${bodyHtml}${sigHtml}</div>`;
}

function interp(t: string, vars: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// Default extra vars for milestone copy tokens, so a representative render
// doesn't show raw {tokens}.
function milestoneVars(): Record<string, string> {
  return {
    address: FIXTURE_PROPERTY.address,
    eventDate: "",
    eventDateClause: "shortly",
    completionDate: FIXTURE_PROPERTY.completionDateLong,
    surveyorClause: "",
    valuationNote: "",
    purchaserPhysicalNote: "",
    vendorVisitNote: "",
    attendClause: "",
  };
}

// The builders in lib/emails/* return { subject, html, text }; the catalogue
// only needs subject + html.
function wrap(r: { subject: string; html: string }): RenderedEmail {
  return { subject: r.subject, html: r.html };
}

// Some emails (quote requests) send plain text only; show it monospaced.
function asText(subject: string, text: string): RenderedEmail {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    subject,
    html: `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;padding:28px 24px;margin:0;color:#1f2937;background:#fff">${esc(text)}</pre>`,
  };
}

const RETENTION_LABELS: Record<string, string> = {
  activation_day_1: "Retention · day 1 activation",
  claim_welcome: "Retention · claim welcome",
  stuck_day_3: "Retention · day 3 stuck",
  first_exchange: "Retention · first exchange",
  quiet_30d: "Retention · 30-day quiet",
  send_to_us_drop_21d: "Retention · 21-day send-to-us",
  last_touch_60d: "Retention · 60-day last touch",
};

// ── Specimens ────────────────────────────────────────────────────────────────
export const EMAIL_SPECIMENS: EmailSpecimen[] = [
  {
    id: "portal-invite",
    category: "client",
    name: "Portal invite",
    description: "The link to open a client's portal for the first time.",
    trigger: "An agent presses Send invite on a contact.",
    axes: ["fileType", "side", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) =>
      buildPortalInviteEmail({
        agencyName: FIXTURE_AGENCY.name,
        address: FIXTURE_PROPERTY.address,
        saleWord: saleWord(s.side),
        greeting: greeting(s.side),
        portalUrl: PORTAL,
        theme: catalogueTheme(s.theme),
        logoBand: logoBand(),
      }),
  },
  {
    id: "milestone-single",
    category: "client",
    name: "Milestone update (single step)",
    description: "The per-step update a client gets when a milestone is confirmed.",
    trigger: "A milestone is confirmed and no other steps are bundled with it.",
    axes: ["fileType", "side", "theme", "milestoneCode"],
    senderKind: "client_automated",
    signatureBehaviour: "none",
    render: (s) => {
      const rich = getMilestoneCopy(s.milestoneCode).emailCopy as Record<string, import("@/lib/portal-copy").RecipientEmailCopy> | null;
      const copy = rich?.[s.side] ?? rich?.vendor ?? rich?.purchaser;
      if (!copy) {
        return { subject: `(${s.milestoneCode})`, html: `<p style="font-family:sans-serif;padding:24px;color:#555">This milestone has no client email copy for the ${s.side} side.</p>` };
      }
      const vars = milestoneVars();
      const html = richMilestoneEmailHtml({
        greeting: greeting(s.side),
        copy,
        address: FIXTURE_PROPERTY.address,
        ctaUrl: PORTAL,
        progressorName: FIXTURE_PROGRESSOR.name,
        progressorEmail: FIXTURE_PROGRESSOR.email,
        serviceType: s.fileType,
        canReply: true,
        logo: { logoUrl: null, tileColor: null, scale: null, align: null },
        theme: catalogueTheme(s.theme),
        extraVars: vars,
      });
      return { subject: interp(copy.subject, vars), html };
    },
  },
  {
    id: "milestone-digest",
    category: "client",
    name: "Milestone update (digest)",
    description: "One email bundling several steps confirmed close together.",
    trigger: "Two or more steps are queued for the same client before the drain runs.",
    axes: ["side", "theme"],
    senderKind: "client_automated",
    signatureBehaviour: "none",
    render: (s) => {
      const codes = s.side === "vendor" ? ["VM3", "VM7"] : ["PM5", "PM14"];
      const payloads: MilestoneDigestPayload[] = codes.map((code) => ({
        subject: "",
        text: "",
        html: "",
        milestoneCode: code,
        recipientSide: s.side,
        address: FIXTURE_PROPERTY.address,
        firstName: firstName(s.side),
        portalUrl: PORTAL,
      }));
      const a = assembleMilestoneDigest(payloads, logoBand(), catalogueTheme(s.theme));
      return { subject: a.subject, html: a.html };
    },
  },
  {
    id: "step-confirmed",
    category: "client",
    name: "Step confirmed (portal self-confirm)",
    description: "Thank-you when a client confirms a step themselves in the portal.",
    trigger: "A client confirms a milestone with no matrix copy from their portal.",
    axes: ["side", "theme"],
    senderKind: "client_automated",
    signatureBehaviour: "none",
    render: (s) => ({
      subject: `Step confirmed: ${FIXTURE_PROPERTY.address}`,
      html: portalStepConfirmedHtml({
        firstName: firstName(s.side),
        address: FIXTURE_PROPERTY.address,
        saleWord: saleWord(s.side),
        stepLabel: getMilestoneCopy(s.milestoneCode).label ?? "Draft contract issued",
        portalUrl: PORTAL,
        logoBand: logoBand(),
        theme: catalogueTheme(s.theme),
      }),
    }),
  },
  {
    id: "progress-update-other-side",
    category: "client",
    name: "Progress update (other side)",
    description: "The lighter update the opposite side gets on a self-confirm fallback.",
    trigger: "A client self-confirms a milestone with no matrix copy (rare fallback).",
    axes: ["side", "theme"],
    senderKind: "client_automated",
    signatureBehaviour: "none",
    render: (s) => ({
      subject: `Progress update: ${FIXTURE_PROPERTY.address}`,
      html: portalEmailHtml({
        greeting: greeting(s.side),
        body: `There's an update on your ${saleWord(s.side)} at <strong>${FIXTURE_PROPERTY.address}</strong>. Log in to your portal to see the latest.`,
        ctaText: "View your portal",
        ctaUrl: PORTAL,
        theme: catalogueTheme(s.theme),
      }),
    }),
  },
  {
    id: "ready-to-exchange",
    category: "client",
    name: "Ready to exchange",
    description: "Sent to both sides once both have cleared the exchange gate.",
    trigger: "VM18 (seller ready) and PM25 (buyer ready) are both complete.",
    axes: ["side", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) =>
      buildReadyToExchangeEmail({
        first: firstName(s.side),
        address: FIXTURE_PROPERTY.address,
        agencyName: FIXTURE_AGENCY.name,
        theme: catalogueTheme(s.theme),
      }),
  },
  {
    id: "completion-pack",
    category: "client",
    name: "Completion pack",
    description: "\"What to expect on completion day\", sent on exchange.",
    trigger: "VM19 / PM26 (contracts exchanged) is confirmed.",
    axes: ["side", "theme"],
    senderKind: "client_automated",
    signatureBehaviour: "none",
    render: (s) => {
      const body = renderCompletionPackBody({
        side: s.side,
        contact: { id: "preview", name: fullName(s.side), email: "preview@example.com", portalToken: "PREVIEW" },
        address: FIXTURE_PROPERTY.address,
        completionDate: null,
        agentName: FIXTURE_AGENT.name,
        content: COMPLETION_PACK_DEFAULTS[s.side],
        theme: catalogueTheme(s.theme),
      });
      return { subject: body.subject, html: body.html };
    },
  },
  {
    id: "client-chase-digest",
    category: "client",
    name: "Client chase (nudge)",
    description: "The automated nudge asking a client to confirm outstanding steps.",
    trigger: "A chaseable milestone stays unconfirmed past its grace window.",
    axes: ["side", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) => {
      const a = assembleDigestPayload({
        transaction: { id: "preview", propertyAddress: FIXTURE_PROPERTY.address },
        contact: { id: "preview", name: fullName(s.side), portalToken: "PREVIEW" },
        milestones: [{ code: s.side === "vendor" ? "VM7" : "PM14" }],
        agencyName: FIXTURE_AGENCY.name,
        recipientSide: s.side,
        theme: catalogueTheme(s.theme),
      });
      return { subject: a.subject, html: a.html };
    },
  },
  {
    id: "exchange-day-morning",
    category: "client",
    name: "Exchange day (morning)",
    description: "The 9am informational note to a client on exchange day.",
    trigger: "Exchange day is activated on a file (morning slot).",
    axes: ["side"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) => {
      const vars = {
        firstName: firstName(s.side),
        address: FIXTURE_PROPERTY.address,
        addressShort: FIXTURE_PROPERTY.addressShort,
        completionDate: FIXTURE_PROPERTY.completionDateLong,
        senderName: FIXTURE_AGENT.name,
        agencyName: FIXTURE_AGENCY.name,
        saleWord: saleWord(s.side) as "sale" | "purchase",
      };
      return buildExchangeDayClientMorningEmail(vars, EXCHANGE_DAY_MORNING_DEFAULT);
    },
  },
  {
    id: "exchange-day-authority",
    category: "client",
    name: "Exchange day (authority)",
    description: "The 11am nudge with the \"I've given authority\" button.",
    trigger: "A client has not confirmed authority by the authority slot.",
    axes: ["side", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) => {
      const vars = {
        firstName: firstName(s.side),
        address: FIXTURE_PROPERTY.address,
        addressShort: FIXTURE_PROPERTY.addressShort,
        completionDate: FIXTURE_PROPERTY.completionDateLong,
        senderName: FIXTURE_AGENT.name,
        agencyName: FIXTURE_AGENCY.name,
        saleWord: saleWord(s.side) as "sale" | "purchase",
      };
      return buildExchangeDayClientAuthorityEmail(
        { ...vars, authorityUrl: `${PORTAL}?authority=1`, theme: catalogueTheme(s.theme) },
        EXCHANGE_DAY_AUTHORITY_DEFAULT,
      );
    },
  },
  {
    id: "enquiry-raise-buyer",
    category: "client",
    name: "Enquiry raise nudge (buyer)",
    description: "Nudges the buyer to check their solicitor has raised enquiries.",
    trigger: "Enquiries aren't confirmed raised on the founder-approved cadence.",
    axes: ["fileType", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "agent_or_none",
    render: (s) => {
      const sig = s.fileType === "self_managed" ? agentSignature() : null;
      return buildRaiseBuyerEmail({
        firstName: FIXTURE_PURCHASERS[0].firstName,
        address: FIXTURE_PROPERTY.address,
        senderName: s.fileType === "self_managed" ? FIXTURE_AGENT.name : FIXTURE_PROGRESSOR.name,
        agencyName: FIXTURE_AGENCY.name,
        fileUrl: PORTAL,
        theme: catalogueTheme(s.theme),
        agentSignatureHtml: sig?.html ?? null,
        agentSignatureText: sig?.text ?? null,
      });
    },
  },
  {
    id: "solicitor-confirm-chase",
    category: "solicitor",
    name: "Solicitor confirmation chase",
    description: "Asks a solicitor to confirm the steps waiting on them.",
    trigger: "Steps on a solicitor's side stay unconfirmed on the chase cadence.",
    axes: ["fileType", "side"],
    senderKind: "solicitor",
    signatureBehaviour: "agent_or_inhouse",
    render: (s) => {
      const sig = s.fileType === "self_managed" ? agentSignature() : null;
      const person = s.fileType === "self_managed" ? FIXTURE_AGENT : FIXTURE_PROGRESSOR;
      const own = s.side === "vendor" ? sideNames("vendor") : sideNames("purchaser");
      return buildSolicitorDigestEmail({
        brand: FIXTURE_AGENCY.name,
        address: FIXTURE_PROPERTY.address,
        pricePence: FIXTURE_PROPERTY.pricePence,
        sellerNames: joinNames(sideNames("vendor")),
        buyerNames: joinNames(sideNames("purchaser")),
        side: s.side,
        firmName: s.side === "vendor" ? FIXTURE_SOLICITORS.vendorFirm : FIXTURE_SOLICITORS.purchaserFirm,
        ownClientNames: joinNames(own),
        steps: [{ label: "Draft contract issued" }, { label: "Property information form completed" }],
        confirmUrl: SOL_URL,
        stopUrl: `${SOL_URL}/stop`,
        qrUrl: `${SOL_URL}/qr`,
        personName: person.name,
        personPhone: person.phone,
        avatarUrl: null,
        agentSignatureHtml: sig?.html ?? null,
        agentSignatureText: sig?.text ?? null,
      });
    },
  },
  {
    id: "enquiry-reply-chase",
    category: "solicitor",
    name: "Enquiry reply chase",
    description: "Chases a solicitor on outstanding enquiry replies.",
    trigger: "An enquiries loop stays silent past the chase cadence.",
    axes: ["fileType", "side"],
    senderKind: "solicitor",
    signatureBehaviour: "agent_or_inhouse",
    render: (s) => {
      const sig = s.fileType === "self_managed" ? agentSignature() : null;
      return buildEnquiryChaseEmail({
        court: s.side === "vendor" ? "seller_solicitor" : "buyer_solicitor",
        address: FIXTURE_PROPERTY.address,
        clientNames: sideNames(s.side),
        recipientFirstName: FIXTURE_SOLICITORS.handlerFirstName,
        senderName: s.fileType === "self_managed" ? FIXTURE_AGENT.name : FIXTURE_PROGRESSOR.name,
        agencyName: s.fileType === "self_managed" ? FIXTURE_AGENCY.name : "The Sales Progressor",
        provideUpdateUrl: SOL_URL,
        agentSignatureHtml: sig?.html ?? null,
        agentSignatureText: sig?.text ?? null,
      });
    },
  },
  {
    id: "enquiry-raise-solicitor",
    category: "solicitor",
    name: "Enquiry raise chase (solicitor)",
    description: "Chases the buyer's solicitor to raise their legal enquiries.",
    trigger: "Enquiries aren't confirmed raised and the solicitor slot is due.",
    axes: ["fileType"],
    senderKind: "solicitor",
    signatureBehaviour: "agent_or_inhouse",
    render: (s) => {
      const sig = s.fileType === "self_managed" ? agentSignature() : null;
      return buildRaiseSolicitorEmail({
        address: FIXTURE_PROPERTY.address,
        clientNames: sideNames("purchaser"),
        sellerFirmName: FIXTURE_SOLICITORS.vendorFirm,
        recipientFirstName: FIXTURE_SOLICITORS.handlerFirstName,
        senderName: s.fileType === "self_managed" ? FIXTURE_AGENT.name : FIXTURE_PROGRESSOR.name,
        agencyName: s.fileType === "self_managed" ? FIXTURE_AGENCY.name : "The Sales Progressor",
        provideUpdateUrl: SOL_URL,
        agentSignatureHtml: sig?.html ?? null,
        agentSignatureText: sig?.text ?? null,
      });
    },
  },
  {
    id: "manual-send",
    category: "internal",
    name: "Manual email from a file",
    description: "A one-off email an agent or internal person types on a file.",
    trigger: "Someone composes and sends an email from the file page.",
    axes: ["fileType"],
    senderKind: "client_personal",
    signatureBehaviour: "agent_or_inhouse",
    render: (s) => {
      const body =
        "Hi Rachel,\n\nJust following up on the draft contract for 12 Oakfield Road. Let me know if you need anything from our side to keep things moving.\n\nThanks";
      const sig =
        s.fileType === "self_managed"
          ? agentSignature()
          : buildInHouseSignoff({ name: FIXTURE_PROGRESSOR.name, agency: FIXTURE_AGENCY.name, phone: FIXTURE_PROGRESSOR.phone });
      return { subject: "12 Oakfield Road, Wandsworth", html: composeManualHtml(body, sig.html) };
    },
  },
  {
    id: "portal-message-to-agent",
    category: "agent",
    name: "Portal message (to the agent)",
    description: "Notifies the agent when a client sends a message on the file.",
    trigger: "A client posts a message in their portal.",
    axes: [],
    senderKind: "agent_internal",
    signatureBehaviour: "sp",
    render: () =>
      buildPortalMessage({
        senderFirstName: FIXTURE_PURCHASERS[0].firstName,
        senderName: FIXTURE_PURCHASERS[0].name,
        senderRole: "Buyer",
        addressLine1: FIXTURE_PROPERTY.address,
        addressLine2: FIXTURE_PROPERTY.postcode,
        timestamp: "Today at 16:42",
        message: "Hi, just checking whether the searches have come back yet. Keen to keep things moving. Thanks.",
        replyUrl: `${CATALOGUE_BASE}/transactions/PREVIEW`,
      }),
  },

  // ── Agent / internal notifications ──────────────────────────────────────────
  {
    id: "milestone-agent",
    category: "agent",
    name: "Milestone notification (agent)",
    description: "The agent's own copy when a milestone is confirmed on their file.",
    trigger: "A milestone completes on a file the agent runs.",
    axes: ["milestoneCode"],
    senderKind: "agent_internal",
    signatureBehaviour: "sp",
    render: (s) => {
      const rich = getMilestoneCopy(s.milestoneCode).emailCopy as Record<string, import("@/lib/portal-copy").RecipientEmailCopy> | null;
      const copy = rich?.vendorAgentPortal ?? rich?.vendorAgent ?? rich?.vendor ?? rich?.purchaser;
      if (!copy) {
        return { subject: `(${s.milestoneCode})`, html: `<p style="font-family:sans-serif;padding:24px;color:#555">This milestone has no agent copy.</p>` };
      }
      const vars = milestoneVars();
      const html = richMilestoneEmailHtml({
        greeting: `Hi ${FIXTURE_AGENT.firstName},`,
        copy,
        address: FIXTURE_PROPERTY.address,
        ctaUrl: `${CATALOGUE_BASE}/transactions/PREVIEW`,
        progressorName: FIXTURE_PROGRESSOR.name,
        progressorEmail: FIXTURE_PROGRESSOR.email,
        isProgressor: false,
        serviceType: "self_managed",
        extraVars: vars,
      });
      return { subject: interp(copy.subject, vars), html };
    },
  },
  {
    id: "client-confirmed-progressor",
    category: "internal",
    name: "Client confirmed (progressor notice)",
    description: "Internal heads-up to the assigned progressor on a portal confirm.",
    trigger: "A client confirms a step from their portal on an outsourced file.",
    axes: ["milestoneCode"],
    senderKind: "agent_internal",
    signatureBehaviour: "sp",
    render: (s) => {
      // Mirrors the inline progressor notice in logPortalMilestoneConfirm (portal.ts).
      const label = getMilestoneCopy(s.milestoneCode).label ?? "a step";
      const dashUrl = `${CATALOGUE_BASE}/transactions/PREVIEW`;
      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 20px;font-size:15px">Hi ${FIXTURE_PROGRESSOR.firstName},</p>
<div style="margin:0 0 24px;padding:16px 20px;background:#F8F9FB;border-radius:12px">
  <p style="margin:0 0 4px;font-size:13px;color:#8b91a3">${FIXTURE_PROPERTY.address}</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#1a1d29">${FIXTURE_VENDORS[0].name} confirmed "${label}"</p>
</div>
<p><a href="${dashUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View file</a></p>
</body></html>`;
      return { subject: `Client confirmed: "${label}" at ${FIXTURE_PROPERTY.address}`, html };
    },
  },
  {
    id: "morning-brief",
    category: "agent",
    name: "Morning brief",
    description: "The daily 7am digest of what needs the agent today.",
    trigger: "The morning-brief cron runs for an agent with active files.",
    axes: [],
    senderKind: "agent_internal",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildMorningBrief({
          firstName: FIXTURE_AGENT.firstName,
          activeSales: 7,
          actionsDue: 3,
          groups: [
            {
              kind: "attention",
              count: 2,
              files: [
                {
                  addressLine1: FIXTURE_PROPERTY.addressShort,
                  addressLine2: "Wandsworth, SW18 3RT",
                  url: `${CATALOGUE_BASE}/transactions/PREVIEW`,
                  items: [{ label: "Enquiries outstanding 6 days", detail: "Buyer's solicitor" }],
                },
              ],
            },
            {
              kind: "today",
              count: 1,
              files: [
                {
                  addressLine1: "8 Birchwood Close",
                  addressLine2: "Guildford, GU1 3RF",
                  url: `${CATALOGUE_BASE}/transactions/PREVIEW`,
                  items: [{ label: "Chase the mortgage offer" }],
                },
              ],
            },
          ],
          openUrl: `${CATALOGUE_BASE}/agent/hub`,
        }),
      ),
  },
  {
    id: "weekly-brief",
    category: "agent",
    name: "Weekly brief",
    description: "The Friday pipeline summary across the agent's active sales.",
    trigger: "The weekly-brief cron runs for an agent.",
    axes: [],
    senderKind: "agent_internal",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildWeeklyBrief({
          firstName: FIXTURE_AGENT.firstName,
          weekOf: "Friday 4 September",
          activeSales: 7,
          milestonesThisWeek: 12,
          needsAttention: 2,
          files: [
            { address: FIXTURE_PROPERTY.address, url: `${CATALOGUE_BASE}/transactions/PREVIEW`, state: "ontrack", stageLabel: "Enquiries", completed: 8, total: 20 },
            { address: "8 Birchwood Close, Guildford", url: `${CATALOGUE_BASE}/transactions/PREVIEW`, state: "attention", stageLabel: "Mortgage", completed: 5, total: 20, reason: "Offer expires in 9 days" },
          ],
          moreCount: 3,
          pipelineUrl: `${CATALOGUE_BASE}/agent/hub`,
        }),
      ),
  },
  {
    id: "team-invitation",
    category: "agent",
    name: "Team invite",
    description: "Invites a colleague to join the agency's account.",
    trigger: "A director invites a new team member.",
    axes: [],
    senderKind: "agent_internal",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildTeamInvitation({
          recipientName: "Alex Rivera",
          invitedByName: FIXTURE_AGENT.name,
          agencyName: FIXTURE_AGENCY.name,
          role: "negotiator",
          acceptUrl: `${CATALOGUE_BASE}/invite-negotiator/PREVIEW`,
        }),
      ),
  },
  {
    id: "team-joined",
    category: "agent",
    name: "Team joined",
    description: "Tells the inviter a colleague has accepted and joined.",
    trigger: "An invited colleague accepts their team invite.",
    axes: [],
    senderKind: "agent_internal",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildTeamJoined({
          recipientName: FIXTURE_AGENT.firstName,
          joinerName: "Alex Rivera",
          agencyName: FIXTURE_AGENCY.name,
          joinerRole: "negotiator",
          ctaUrl: `${CATALOGUE_BASE}/agent/team`,
        }),
      ),
  },

  // ── Chain ────────────────────────────────────────────────────────────────────
  {
    id: "chain-invite",
    category: "chain",
    name: "Chain invite",
    description: "Invites a neighbouring agent to connect their sale into the chain.",
    trigger: "An agent links a chain position to another agency's sale.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildChainInvite({
          addressLine1: "8 Birchwood Close",
          addressLine2: "Guildford, GU1 3RF",
          originatingAddress: FIXTURE_PROPERTY.address,
          chainUrl: `${CATALOGUE_BASE}/chain/PREVIEW`,
          declineUrl: `${CATALOGUE_BASE}/chain/PREVIEW/decline`,
        }),
      ),
  },
  {
    id: "chain-overview",
    category: "chain",
    name: "Chain overview",
    description: "Shows a connected agent the shape of the chain they're in.",
    trigger: "A chain reaches two or more connected agencies.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildChainOverview({
          saleAddress: "8 Birchwood Close",
          originatingAddress: FIXTURE_PROPERTY.address,
          chainSize: 4,
          connectedCount: 2,
          chainUrl: `${CATALOGUE_BASE}/chain/PREVIEW`,
          declineUrl: `${CATALOGUE_BASE}/chain/PREVIEW/decline`,
        }),
      ),
  },
  {
    id: "chain-update",
    category: "chain",
    name: "Chain update",
    description: "Tells connected agents a step moved on a linked sale.",
    trigger: "A milestone confirms on a file connected into a chain.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildChainUpdate({
          recipientName: "Bridgewater Estates",
          agencyName: FIXTURE_AGENCY.name,
          sellerName: "Marcus Fielding",
          onwardAddress: "22 Willow Road, Richmond, TW9 1PL",
          onwardAddressShort: "22 Willow Road, Richmond",
          labels: ["contracts exchanged on their sale"],
          chainUrl: `${CATALOGUE_BASE}/chain/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-still-moving",
    category: "chain",
    name: "Chain still moving",
    description: "A gentle nudge to an agent who hasn't connected yet.",
    trigger: "A chain invite stays unanswered while the chain progresses.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildChainStillMoving({
          addressLine1: "8 Birchwood Close",
          addressLine2: "Guildford, GU1 3RF",
          originatingAddress: FIXTURE_PROPERTY.address,
          chainUrl: `${CATALOGUE_BASE}/chain/PREVIEW`,
          declineUrl: `${CATALOGUE_BASE}/chain/PREVIEW/decline`,
        }),
      ),
  },

  // ── Platform / system ─────────────────────────────────────────────────────────
  {
    id: "password-reset",
    category: "platform",
    name: "Password reset",
    description: "The reset-password link.",
    trigger: "A user requests a password reset.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () => wrap(buildPasswordReset({ resetUrl: `${CATALOGUE_BASE}/reset/PREVIEW` })),
  },
  {
    id: "email-verification",
    category: "platform",
    name: "Email verification",
    description: "Confirms a new account's email address.",
    trigger: "A user signs up or changes their email.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(buildEmailVerification({ email: FIXTURE_AGENT.email, code: "482913", verifyUrl: `${CATALOGUE_BASE}/verify/PREVIEW` })),
  },
  {
    id: "domain-auth",
    category: "platform",
    name: "Domain authentication alert",
    description: "Tells an agency their sending domain needs DNS attention.",
    trigger: "An agency's sending domain falls out of authentication.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(buildDomainAuth({ firstName: FIXTURE_AGENT.firstName, domain: FIXTURE_AGENCY.domain, fixUrl: `${CATALOGUE_BASE}/agent/account/sending` })),
  },
  {
    id: "agency-invitation",
    category: "platform",
    name: "Agency invitation",
    description: "Invites a new agency to set up their account.",
    trigger: "We invite a prospect agency to join.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () => wrap(buildAgencyInvitation({ firstName: FIXTURE_AGENT.firstName, acceptUrl: `${CATALOGUE_BASE}/invite/PREVIEW` })),
  },
  {
    id: "first-exchange",
    category: "platform",
    name: "First exchange celebration",
    description: "Celebrates an agency's first exchange on the platform.",
    trigger: "An agency records their first exchange.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildFirstExchange({
          firstName: FIXTURE_AGENT.firstName,
          addressLine1: "8 Birchwood Close, Guildford",
          addressLine2: "GU1 3RF",
          fileUrl: `${CATALOGUE_BASE}/transactions/PREVIEW`,
          addSaleUrl: `${CATALOGUE_BASE}/agent/new`,
        }),
      ),
  },
  ...RETENTION_EMAIL_KEYS.map(
    (key): EmailSpecimen => ({
      id: `retention-${key}`,
      category: "platform",
      name: RETENTION_LABELS[key] ?? `Retention · ${key}`,
      description: "A lifecycle nudge in the retention series.",
      trigger: "The retention cron matches this key's inactivity window.",
      axes: [],
      senderKind: "platform",
      signatureBehaviour: "sp",
      render: () =>
        wrap(
          buildRetentionEmail(key, {
            firstName: FIXTURE_AGENT.firstName,
            address: FIXTURE_PROPERTY.address,
            ctaUrl: `${CATALOGUE_BASE}/agent/hub`,
            addSaleUrl: `${CATALOGUE_BASE}/agent/new`,
          }),
        ),
    }),
  ),

  // ── More client emails (mirror the inline markup in their send services) ─────
  {
    id: "comms-update",
    category: "client",
    name: "Update on your sale (comms)",
    description: "A free-text update an agent posts to a client's timeline.",
    trigger: "An agent sends a visible update from the file's comms panel.",
    axes: ["side", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) => {
      // Mirrors the inline body in lib/services/comms.ts.
      const theme = catalogueTheme(s.theme);
      const agency = FIXTURE_AGENCY.name;
      const address = FIXTURE_PROPERTY.address;
      const content = "Quick note to say the searches are back and everything looks clear. Your solicitor is reviewing them now and we'll be in touch as things progress.";
      const portalUrl = `${PORTAL}/updates`;
      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${theme.buttonBg}">${agency}</p>
<p style="margin:0 0 20px;font-size:14px;color:#4a5162">${address}</p>
<p style="margin:0 0 16px;font-size:15px">${greeting(s.side)}</p>
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#8b91a3;text-transform:uppercase;letter-spacing:0.06em">New update</p>
<div style="margin:0 0 24px;padding:16px 20px;background:#F8F9FB;border-radius:12px;font-size:14px;line-height:1.6;color:#1a1d29;white-space:pre-wrap">${content}</div>
<p><a href="${portalUrl}" style="display:inline-block;background:${theme.buttonBg};color:${theme.buttonText};padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View in portal</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">You're receiving this because you have a ${saleWord(s.side)} in progress with ${agency}.</p>
</body></html>`;
      return { subject: `Update on your ${saleWord(s.side)}: ${address}`, html };
    },
  },
  {
    id: "completion-survey",
    category: "client",
    name: "Completion feedback survey",
    description: "Invites a client to rate their experience once complete.",
    trigger: "A file reaches completion.",
    axes: ["side", "theme"],
    senderKind: "client_automated",
    signatureBehaviour: "none",
    render: (s) => {
      // Mirrors the inline body in lib/services/survey.ts.
      const theme = catalogueTheme(s.theme);
      const roleLabel = s.side === "vendor" ? "sale" : "purchase";
      const surveyUrl = `${CATALOGUE_BASE}/feedback/PREVIEW/survey`;
      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">Congratulations, ${firstName(s.side)}</h1>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Your ${roleLabel} at <strong>${FIXTURE_PROPERTY.address}</strong> is officially complete. We hope it was as smooth as possible.</p>
<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">If you've got a minute, we'd love to hear how it went. Your feedback helps us make the experience better for everyone who comes after you.</p>
<p style="margin:0 0 24px"><a href="${surveyUrl}" style="display:inline-block;background:${theme.buttonBg};color:${theme.buttonText};padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Rate your experience &rarr;</a></p>
<p style="margin:0;font-size:12px;color:#8b91a3">${FIXTURE_AGENCY.name}</p>
</body></html>`;
      return { subject: `Congratulations on your ${roleLabel}. How was your experience?`, html };
    },
  },
  {
    id: "client-weekly-update",
    category: "client",
    name: "Weekly client update",
    description: "A weekly reassurance note with a short per-file narrative.",
    trigger: "The client weekly-update cron runs for an active file.",
    axes: ["side", "theme"],
    senderKind: "client_automated",
    signatureBehaviour: "none",
    render: (s) => {
      // Mirrors the inline body in lib/services/client-weekly-update.ts.
      const theme = catalogueTheme(s.theme);
      const roleLabel = s.side === "vendor" ? "sale" : "purchase";
      const bodyParas = [
        `Quick check-in on your ${roleLabel} at ${FIXTURE_PROPERTY.address}. Everything is progressing as it should.`,
        "No news at this stage is genuinely good news. It means nothing unexpected is holding things up. Behind the scenes we're chasing solicitors, watching the process, and keeping everything moving.",
      ];
      const closing = "If anything needs your attention we'll be in touch right away. Otherwise, just reply to this email if you have questions.";
      const portalSection = `<p style="margin:0 0 20px"><a href="${PORTAL}" style="display:inline-block;background:${theme.buttonBg};color:${theme.buttonText};padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View your progress &rarr;</a></p>`;
      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">Friday 4 September</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">${greeting(s.side)}</h1>
${bodyParas.map((p) => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">${p}</p>`).join("\n")}
<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">${closing}</p>
${portalSection}
<p style="margin:0;font-size:12px;color:#8b91a3">${FIXTURE_AGENCY.name}</p>
</body></html>`;
      return { subject: `An update on your ${roleLabel} at ${FIXTURE_PROPERTY.address}`, html };
    },
  },

  // ── Booking (agent notifications) ────────────────────────────────────────────
  {
    id: "booking-diary",
    category: "agent",
    name: "Booking diary (survey booked)",
    description: "Tells the agent a survey/valuation is booked, with a calendar invite.",
    trigger: "A booking with key-collection is confirmed on an outsourced file.",
    axes: [],
    senderKind: "agent_internal",
    signatureBehaviour: "none",
    render: () => ({
      // Mirrors maybeSendBookingDiaryEmail in lib/services/booking-reminders.ts.
      subject: `Survey booked at ${FIXTURE_PROPERTY.addressShort}`,
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;line-height:1.6">
      <p>Hi ${FIXTURE_AGENT.firstName},</p>
      <p>A survey has been booked at ${FIXTURE_PROPERTY.address}.</p>
      <p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-radius:10px">
        <strong>Date:</strong> ${FIXTURE_PROPERTY.completionDateLong}<br/>
        The surveyor is collecting keys from you, so please have them ready.
      </p>
      <p style="color:#6b7280">We've attached a calendar invite so you can drop it straight into your diary.</p>
    </div>`,
    }),
  },
  {
    id: "booking-morning",
    category: "agent",
    name: "Booking morning reminder",
    description: "The 7am same-day reminder for a booked survey/valuation.",
    trigger: "The morning cron finds a booking scheduled for today.",
    axes: [],
    senderKind: "agent_internal",
    signatureBehaviour: "none",
    render: () => ({
      // Mirrors sendBookingMorningReminders in lib/services/booking-reminders.ts.
      subject: `Survey today at ${FIXTURE_PROPERTY.addressShort}`,
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;line-height:1.6">
      <p>Hi ${FIXTURE_AGENT.firstName},</p>
      <p>A reminder that the <strong>survey</strong> at ${FIXTURE_PROPERTY.address} is today.</p>
      <p style="color:#6b7280">The surveyor is collecting keys from you, so please have them ready.</p>
    </div>`,
    }),
  },

  // ── Provider / surveyor ──────────────────────────────────────────────────────
  {
    id: "quote-request-firm",
    category: "provider",
    name: "Survey quote request (to firm)",
    description: "Requests a quote from a surveyor firm on a client's behalf.",
    trigger: "A client requests survey quotes from the portal.",
    axes: ["fileType"],
    senderKind: "quote",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors renderQuoteEmailText in app/quote/[token]/actions.ts.
      asText(
        `Survey quote request: ${FIXTURE_PROPERTY.address}`,
        `Hi Kingsworth Surveyors,

A client of ours has requested a quote for the following:

Property:      ${FIXTURE_PROPERTY.address}
Postcode:      ${FIXTURE_PROPERTY.postcode}
Price:         £450,000
Tenure:        Freehold
Service:       Level 2 HomeBuyer Report
Urgency:       Within a week

Client contact:
  Name:        ${FIXTURE_PURCHASERS[0].name}
  Email:       james.carter@example.com
  Phone:       07700 900123
  Prefers:     By phone
  Best time:   Morning

Notes: (none)

Please reply to this email with your quote and availability. This request came
from ${FIXTURE_AGENCY.name} via Sales Progressor.`,
      ),
  },
  {
    id: "quote-request-internal",
    category: "internal",
    name: "Survey quote requested (internal notice)",
    description: "Internal heads-up to Sales Progressor ops on each quote request.",
    trigger: "A client requests survey quotes (fires alongside the firm emails).",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors the internal notify in app/quote/[token]/actions.ts.
      asText(
        "Survey quote requested: Level 2 HomeBuyer Report",
        `A survey quote has been requested.

Agency:     ${FIXTURE_AGENCY.name}
Property:   ${FIXTURE_PROPERTY.address}
Survey:     Level 2 HomeBuyer Report
Surveyor:   Kingsworth Surveyors
Client:     ${FIXTURE_PURCHASERS[0].name}

Full details are in the Command Centre:
${CATALOGUE_BASE}/command/providers/quotes`,
      ),
  },
];

export function specimenIndex(): SpecimenMeta[] {
  return EMAIL_SPECIMENS.map(({ render, ...meta }) => meta);
}

export function findSpecimen(id: string): EmailSpecimen | undefined {
  return EMAIL_SPECIMENS.find((s) => s.id === id);
}
