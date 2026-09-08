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
];

export function specimenIndex(): SpecimenMeta[] {
  return EMAIL_SPECIMENS.map(({ render, ...meta }) => meta);
}

export function findSpecimen(id: string): EmailSpecimen | undefined {
  return EMAIL_SPECIMENS.find((s) => s.id === id);
}
