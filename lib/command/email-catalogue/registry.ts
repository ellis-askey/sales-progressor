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
  type AudienceBucket,
} from "./scenario";
import {
  CATALOGUE_BASE,
  FIXTURE_AGENCY,
  FIXTURE_AGENT,
  FIXTURE_PROGRESSOR,
  FIXTURE_BUSINESS,
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
import { buildExchangeDayClientMorningEmail, buildExchangeDayClientAuthorityEmail, buildExchangeDaySolicitorEmail } from "@/lib/exchange-day/emails";
import { buildPortalMessage } from "@/lib/emails/portal-message";
import { buildClientUpdateEmail } from "@/lib/emails/client-update-email";
import { buildOnwardNudgeEmail } from "@/lib/emails/onward-nudge";
import { buildOutsourceIntroEmail } from "@/lib/emails/outsource-intro-template";
import { buildAgentSupportEmail } from "@/lib/emails/agent-support";
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
import {
  buildCelebrationEmailPayload,
  buildLostBuyerEmailPayload,
  buildLostPurchaseEmailPayload,
  buildAskedToWaitEmailPayload,
  buildBuyerFoundEmailPayload,
  buildChainDetachedEmailPayload,
  buildWaitNudgeEmailPayload,
  buildDeclineEmailPayload,
  buildExchangeEmailPayload,
  buildCompletionEmailPayload,
  buildBounceNoticeEmailPayload,
} from "@/lib/email/chainNotifications";
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
import { buildMailboxSendingTest, buildMailboxSendingStopped } from "@/lib/email/mailbox-sending-notices";
import { buildClientAgentInvite } from "@/lib/emails/client-agent-invite";
import { buildTeammateInvite } from "@/lib/emails/teammate-invite";
import { buildProgressionWelcome } from "@/lib/emails/retention";

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
  // Fixed audience bucket. Omit for a FILE-DRIVEN email (client / solicitor /
  // on-file notification) — its bucket follows who runs the file
  // (free_agency / tsp_outsourced / external_progression). See audienceBucketFor.
  bucket?: AudienceBucket;
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
  claim_quiet_14d: "Retention · 14-day claim check-in",
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
    id: "onward-nudge-setup",
    category: "client",
    name: "Onward / related nudge (set up)",
    description: "Asks a client to set up tracking of their other move in their portal. Onward for a seller buying on; related for a buyer who is also selling.",
    trigger: "An agent presses \"Ask [client] to set it up\" on the chain card.",
    axes: ["side", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) =>
      buildOnwardNudgeEmail({
        agencyName: FIXTURE_AGENCY.name,
        greeting: greeting(s.side),
        direction: s.side === "vendor" ? "onward" : "related",
        mode: "setup",
        propertyAddress: FIXTURE_PROPERTY.address,
        portalUrl: PORTAL,
        theme: catalogueTheme(s.theme),
      }),
  },
  {
    id: "onward-nudge-update",
    category: "client",
    name: "Onward / related nudge (update)",
    description: "Asks a client to update where their other move is up to, once tracking is live.",
    trigger: "An agent presses \"Ask [client] to update it\" in the tracker menu.",
    axes: ["side", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) =>
      buildOnwardNudgeEmail({
        agencyName: FIXTURE_AGENCY.name,
        greeting: greeting(s.side),
        direction: s.side === "vendor" ? "onward" : "related",
        mode: "update",
        propertyAddress: FIXTURE_PROPERTY.address,
        portalUrl: PORTAL,
        theme: catalogueTheme(s.theme),
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
    id: "exchange-and-completed",
    category: "client",
    name: "Exchanged and completed (same day)",
    description: "One combined email when a sale exchanges and completes on the same day, instead of separate exchange + completion notes.",
    trigger: "Exchange and completion are confirmed close together for the same client.",
    axes: ["side", "theme"],
    senderKind: "client_automated",
    signatureBehaviour: "none",
    render: (s) => {
      const codes = s.side === "vendor" ? ["VM19", "VM20"] : ["PM26", "PM27"];
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
    category: "perfected",
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
    bucket: "free_agency",
    category: "perfected",
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
    bucket: "free_agency",
    category: "perfected",
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
    bucket: "free_agency",
    category: "perfected",
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
    bucket: "free_agency",
    category: "perfected",
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

  // ── Progression business (invites it sends) ──────────────────────────────────
  {
    id: "progression-client-agent-invite",
    bucket: "progression_invite",
    category: "perfected",
    name: "Client agent invite",
    description: "Sets up an estate agent's login when a progression business adds them as a client. White-labelled to the business (its name as wordmark, no Sales Progressor hero/logo), replies to the business's own address, with a light 'powered by Sales Progressor' footer (audit W1).",
    trigger: "A progression business adds an agency agent as a client.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      wrap(
        buildClientAgentInvite({
          setupUrl: `${CATALOGUE_BASE}/reset-password?token=PREVIEW`,
          businessName: FIXTURE_BUSINESS.name,
        }),
      ),
  },
  {
    id: "progression-teammate-invite",
    bucket: "progression_invite",
    category: "perfected",
    name: "Teammate invite",
    description: "Sets up a progressor colleague's login when a business adds them to its team. Greets by first name, colleague-framed (critique #180).",
    trigger: "A progression-business owner invites a teammate on /agent/team.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      wrap(
        buildTeammateInvite({
          setupUrl: `${CATALOGUE_BASE}/reset-password?token=PREVIEW`,
          businessName: FIXTURE_BUSINESS.name,
          firstName: "Alex",
        }),
      ),
  },
  {
    id: "progression-welcome",
    bucket: "progression_invite",
    category: "perfected",
    name: "Business welcome",
    description: "Welcomes a new progression-business owner and points them at adding their first client.",
    trigger: "A new progression business completes sign-up.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      wrap(
        buildProgressionWelcome({
          firstName: FIXTURE_BUSINESS.owner.firstName,
          ctaUrl: `${CATALOGUE_BASE}/agent/clients`,
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },

  // ── Chain ────────────────────────────────────────────────────────────────────
  {
    id: "chain-invite",
    bucket: "free_agency",
    category: "perfected",
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
    bucket: "free_agency",
    category: "perfected",
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
    bucket: "free_agency",
    category: "perfected",
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
    bucket: "free_agency",
    category: "perfected",
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
  {
    id: "chain-completed-celebration",
    bucket: "free_agency",
    category: "chain",
    name: "Chain completed (HALTED)",
    description: "HALTED. Not currently sent (founder decision 2026-10-05, pending the email-polish pass). When live it goes to every claimed chain-mate agent once the last sale in the chain completes. Shown here so the catalogue records it exists and is switched off.",
    trigger: "HALTED. (Would fire when the final file in a chain reaches completion, VM20 / PM27.)",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildCelebrationEmailPayload({
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },

  // ── Platform / system ─────────────────────────────────────────────────────────
  {
    id: "mailbox-sending-test",
    category: "agent",
    name: "Mailbox sending confirmed",
    description:
      "One-off proof email fired the moment an agent switches on sending from a connected inbox. Sends FROM the agent's own mailbox TO itself, through the newly enabled route, so its arrival is the proof it works.",
    trigger: "An agent turns on sending for a connected inbox (or connects one with the send option ticked).",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () => {
      const t = buildMailboxSendingTest();
      return asText(t.subject, t.text);
    },
  },
  {
    id: "mailbox-sending-stopped",
    category: "agent",
    name: "Mailbox sending stopped",
    description:
      "Tells the agent their connected inbox's app-password no longer works, sending has switched itself off, and their emails go out from our address (replies still reaching them) until they reconnect. Sent once per outage, from our own address.",
    trigger: "Two consecutive sends through a connected inbox fail authentication.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () => {
      const t = buildMailboxSendingStopped(FIXTURE_AGENT.email);
      return asText(t.subject, t.text);
    },
  },
  {
    id: "password-reset",
    bucket: "platform_admin",
    category: "perfected",
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
    bucket: "platform_admin",
    category: "perfected",
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
    bucket: "platform_admin",
    category: "perfected",
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
    bucket: "platform_admin",
    category: "perfected",
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
    bucket: "free_agency",
    category: "perfected",
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
      bucket: "free_agency",
      category: "perfected",
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
    description: "A free-text update a person posts to a client: the comms panel, Draft for everyone, and the after-chase keep-posted updates all use this one branded template.",
    trigger: "An agent or progressor sends a written update to a client (comms panel, Draft for everyone, keep-the-other-side-posted, or a portal reply).",
    axes: ["side", "theme"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) => {
      // Renders through the real shared builder, so the catalogue can't drift
      // from what actually sends (lib/emails/client-update-email.ts).
      const email = buildClientUpdateEmail({
        agencyName: FIXTURE_AGENCY.name,
        address: FIXTURE_PROPERTY.address,
        saleWord: saleWord(s.side),
        greeting: greeting(s.side),
        content: "Quick note to say the searches are back and everything looks clear. Your solicitor is reviewing them now and we'll be in touch as things progress.",
        portalUrl: `${PORTAL}/updates`,
        theme: catalogueTheme(s.theme),
      });
      return { subject: email.subject, html: email.html };
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

  // ── Client / counterparty (completeness pass) ──────────────────────────────────
  {
    id: "outsource-intro",
    category: "client",
    name: "Outsource intro (getting your sale moving)",
    description: "White-labelled welcome to the buyer and seller when an agency hands us a managed-tier sale. Reads as the agency, not Sales Progressor.",
    trigger: "A managed (outsourced) sale is created.",
    axes: ["side"],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: (s) =>
      wrap(
        buildOutsourceIntroEmail({
          clientFirstName: firstName(s.side),
          address: FIXTURE_PROPERTY.address,
          agentFirstName: FIXTURE_AGENT.firstName,
          agentLastName: FIXTURE_AGENT.name.split(" ").slice(1).join(" "),
          agencyName: FIXTURE_AGENCY.name,
          portalUrl: PORTAL,
          saleNoun: s.side === "vendor" ? "sale" : "purchase",
          whatsappUrl: null,
        }),
      ),
  },
  {
    id: "exchange-day-solicitor-morning",
    category: "solicitor",
    name: "Exchange day solicitor(morning)",
    description: "First of up to three exchange-day check-ins to each solicitor: confirms we're aiming to exchange today and offers help.",
    trigger: "Exchange day is activated and the morning slot (08:45) comes due.",
    axes: [],
    senderKind: "solicitor",
    signatureBehaviour: "none",
    render: () =>
      wrap(
        buildExchangeDaySolicitorEmail("morning", {
          firstName: FIXTURE_SOLICITORS.handlerFirstName,
          address: FIXTURE_PROPERTY.address,
          addressShort: FIXTURE_PROPERTY.addressShort,
          completionDate: FIXTURE_PROPERTY.completionDateLong,
          senderName: FIXTURE_AGENT.name,
          agencyName: FIXTURE_AGENCY.name,
        }),
      ),
  },
  {
    id: "exchange-day-solicitor-midday",
    category: "solicitor",
    name: "Exchange day solicitor(midday)",
    description: "Midday chase to each solicitor if exchange hasn't confirmed yet, asking for an update.",
    trigger: "Exchange day is activated and the midday slot (12:30) comes due.",
    axes: [],
    senderKind: "solicitor",
    signatureBehaviour: "none",
    render: () =>
      wrap(
        buildExchangeDaySolicitorEmail("midday", {
          firstName: FIXTURE_SOLICITORS.handlerFirstName,
          address: FIXTURE_PROPERTY.address,
          addressShort: FIXTURE_PROPERTY.addressShort,
          completionDate: FIXTURE_PROPERTY.completionDateLong,
          senderName: FIXTURE_AGENT.name,
          agencyName: FIXTURE_AGENCY.name,
        }),
      ),
  },
  {
    id: "exchange-day-solicitor-afternoon",
    category: "solicitor",
    name: "Exchange day solicitor(end of day)",
    description: "End-of-day touch to each solicitor when exchange still hasn't confirmed, so we can manage client expectations.",
    trigger: "Exchange day is activated and the afternoon slot (15:30) comes due.",
    axes: [],
    senderKind: "solicitor",
    signatureBehaviour: "none",
    render: () =>
      wrap(
        buildExchangeDaySolicitorEmail("afternoon", {
          firstName: FIXTURE_SOLICITORS.handlerFirstName,
          address: FIXTURE_PROPERTY.address,
          addressShort: FIXTURE_PROPERTY.addressShort,
          completionDate: FIXTURE_PROPERTY.completionDateLong,
          senderName: FIXTURE_AGENT.name,
          agencyName: FIXTURE_AGENCY.name,
        }),
      ),
  },
  {
    id: "quote-link-buyer",
    category: "client",
    name: "Survey quote link (to buyer)",
    description: "Agent-sent nudge giving the buyer a link to request survey quotes. Plain-text email.",
    trigger: "An agent presses \"Send quote link\" on the file.",
    axes: [],
    senderKind: "client_personal",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors the inline text in app/actions/send-quote-link.ts.
      asText(
        `Get a survey quote for ${FIXTURE_PROPERTY.address}`,
        `Hi ${FIXTURE_PURCHASERS[0].firstName},

Most buyers arrange a survey before exchange. It's worth getting quotes from a couple of firms so you can compare.

We've put together a short form: pick the type of survey, pick from surveyors that cover your area, and they'll come back to you with a quote directly.

Get started here:
${CATALOGUE_BASE}/quote/PREVIEW

If you'd rather sort this yourself, no problem. Just wanted to make it easy.

${FIXTURE_AGENT.name}
`,
      ),
  },
  {
    id: "broker-callback-agent",
    category: "agent",
    name: "Broker call-back request (to agent)",
    description: "Tells the agency agent a buyer asked to speak with the agency's recommended mortgage broker, so the agent can pass it on. Plain-text.",
    trigger: "A buyer taps \"Request a call back\" on an agent-sourced broker card.",
    axes: [],
    senderKind: "agent_internal",
    signatureBehaviour: "none",
    render: () => {
      // Mirrors the inline text in app/actions/broker-callback.ts (agent branch).
      const detail = `${FIXTURE_PURCHASERS[0].name}
Phone: 07700 900123
Email: james.carter@example.com
Preferred contact: phone or email

Property: ${FIXTURE_PROPERTY.address}
Purchase price: £450,000
Tenure: Freehold`;
      const text = [
        `${FIXTURE_PURCHASERS[0].name} has asked to speak with your recommended mortgage broker (Hamilton Mortgages) about ${FIXTURE_PROPERTY.address}.`,
        ``,
        detail,
        ``,
        `They're expecting a call back, so please pass this to Hamilton Mortgages or get in touch yourself.`,
      ].join("\n");
      return asText(`Broker call-back requested: ${FIXTURE_PROPERTY.address}`, text);
    },
  },
  {
    id: "broker-callback-firm",
    category: "provider",
    name: "Broker call-back request (to broker firm)",
    description: "Sent to the Sales Progressor mortgage broker firm when a buyer requests a call back, sharing the details they consented to. Plain-text.",
    trigger: "A buyer taps \"Request a call back\" on a Sales-Progressor-sourced broker card.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () => {
      // Mirrors the inline text in app/actions/broker-callback.ts (TSP-broker branch).
      const detail = `${FIXTURE_PURCHASERS[0].name}
Phone: 07700 900123
Email: james.carter@example.com
Preferred contact: phone or email

Property: ${FIXTURE_PROPERTY.address}
Purchase price: £450,000
Tenure: Freehold`;
      const text = [
        `${FIXTURE_PURCHASERS[0].name} has requested a call back about their mortgage for ${FIXTURE_PROPERTY.address}.`,
        ``,
        detail,
        ``,
        `This was requested through their Sales Progressor portal, and they've agreed to these details being shared with you. Please get in touch with them directly.`,
      ].join("\n");
      return asText(`Mortgage call-back request: ${FIXTURE_PROPERTY.address}`, text);
    },
  },

  // ── Chain cascade + notifications (agent-facing) ───────────────────────────────
  {
    id: "chain-lost-buyer",
    bucket: "free_agency",
    category: "chain",
    name: "Chain cascade:buyer pulled out",
    description: "Tells a connected agent that a buyer further down the chain has pulled out.",
    trigger: "A withdrawal removes the buyer below this agent's file.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildLostBuyerEmailPayload({
          recipientAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-lost-purchase",
    bucket: "free_agency",
    category: "chain",
    name: "Chain cascade:onward purchase fell through",
    description: "Tells a connected agent that an onward purchase in the chain has fallen through.",
    trigger: "A withdrawal removes the onward purchase above this agent's file.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildLostPurchaseEmailPayload({
          recipientAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-asked-to-wait",
    bucket: "free_agency",
    category: "chain",
    name: "Chain cascade:asked to wait",
    description: "Asks a connected agent whether their client will wait while the onward chain re-forms.",
    trigger: "The onward chain is re-forming after a break.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildAskedToWaitEmailPayload({
          recipientAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-buyer-found",
    bucket: "free_agency",
    category: "chain",
    name: "Chain cascade:buyer found (default)",
    description: "Tells a connected agent the chain has reformed below them with a new buyer.",
    trigger: "A new buyer is found below, where the agent had no prior waiting response.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildBuyerFoundEmailPayload({
          recipientAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
          variant: "default",
        }),
      ),
  },
  {
    id: "chain-buyer-found-waiting",
    bucket: "free_agency",
    category: "chain",
    name: "Chain cascade:buyer found (was waiting)",
    description: "The buyer-found note tailored to an agent whose client had agreed to wait.",
    trigger: "A new buyer is found below, for an agent who previously responded WAITING.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildBuyerFoundEmailPayload({
          recipientAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
          variant: "WAITING",
        }),
      ),
  },
  {
    id: "chain-buyer-found-remarketing",
    bucket: "free_agency",
    category: "chain",
    name: "Chain cascade:buyer found (was remarketing)",
    description: "The buyer-found note tailored to an agent who had gone back to market.",
    trigger: "A new buyer is found below, for an agent who previously responded REMARKETING.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildBuyerFoundEmailPayload({
          recipientAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
          variant: "REMARKETING",
        }),
      ),
  },
  {
    id: "chain-detached",
    bucket: "free_agency",
    category: "chain",
    name: "Chain cascade:chain shortened",
    description: "Tells the top remaining agent that their chain has been shortened after a break.",
    trigger: "A withdrawal splits the chain and detaches a segment.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildChainDetachedEmailPayload({
          recipientAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-wait-nudge",
    bucket: "free_agency",
    category: "chain",
    name: "Chain:still waiting?",
    description: "Follows up a connected agent who said their client would wait, two weeks on.",
    trigger: "An agent responded WAITING 14+ days ago and the chain hasn't moved.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildWaitNudgeEmailPayload({
          recipientAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-invite-declined",
    bucket: "free_agency",
    category: "chain",
    name: "Chain invite declined",
    description: "Tells the inviting agent that the agent they invited declined to join the chain.",
    trigger: "An invited stub agent uses the decline link.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildDeclineEmailPayload({
          stubAgentEmail: "agent@rivalhomes.co.uk",
          stubAddress: FIXTURE_PROPERTY.address,
          originatorTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-invite-bounce",
    category: "chain",
    name: "Chain invite bounced",
    description: "One-time note to the inviting agent when their chain invite hard-bounces.",
    trigger: "A chain invite email bounces (the address can't be reached).",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      wrap(
        buildBounceNoticeEmailPayload({
          originatorName: FIXTURE_AGENT.firstName,
          bouncedEmail: "agent@rivalhomes.co.uk",
          address: FIXTURE_PROPERTY.address,
        }),
      ),
  },
  {
    id: "chain-exchange-notification",
    bucket: "free_agency",
    category: "chain",
    name: "Chain:a sale exchanged",
    description: "Tells connected agents that a sale in the chain has exchanged contracts.",
    trigger: "A file in the chain reaches exchange (VM19 / PM26).",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildExchangeEmailPayload({
          exchangedAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-completion-notification",
    bucket: "free_agency",
    category: "chain",
    name: "Chain:a sale completed",
    description: "Tells connected agents that a sale in the chain has completed.",
    trigger: "A file in the chain reaches completion (VM20 / PM27).",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "sp",
    render: () =>
      wrap(
        buildCompletionEmailPayload({
          completedAddress: FIXTURE_PROPERTY.address,
          recipientTransactionId: "PREVIEW",
          unsubscribeUrl: `${CATALOGUE_BASE}/unsubscribe/PREVIEW`,
        }),
      ),
  },
  {
    id: "chain-neighbour-chase",
    category: "chain",
    name: "Chain neighbour chase (agent to agent)",
    description: "An AI-drafted agent-to-agent nudge to a connected agent for an update on their side of the chain. The body is generated per send; shown here with a representative draft in the real email shell plus the agent's signature.",
    trigger: "An agent sends a neighbour chase from the chain card.",
    axes: [],
    senderKind: "client_personal",
    signatureBehaviour: "agent_or_inhouse",
    render: () => {
      // Body is model-generated at send time; mirrors the assembly in
      // sendNeighbourChase (lib/services/neighbour-chase.ts) with a sample body.
      const sampleBody = `<p>Hi,</p><p>Hope things are going well at your end. I'm acting on the sale at ${FIXTURE_PROPERTY.address} further up the chain and wanted to check in on where things are with your buyer's side. If there's any update on searches or enquiries, it would really help us keep everyone moving.</p><p>Anything you can share would be appreciated.</p>`;
      const signOff = `<p style="margin:22px 0 0;font-size:14px;color:#111827;line-height:1.6;">Kind regards,</p>`;
      const sig = agentSignature();
      const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6;">${sampleBody}${signOff}${sig.html}</div>`;
      return { subject: `Quick update on ${FIXTURE_PROPERTY.address}?`, html };
    },
  },

  // ── Internal / admin / ops (completeness pass) ─────────────────────────────────
  {
    id: "join-request-directors",
    bucket: "platform_admin",
    category: "platform",
    name: "Join request (to directors)",
    description: "Tells an agency's directors that someone has signed up and asked to join their agency.",
    trigger: "A new user requests to join an existing agency.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors notifyDirectorsOfJoinRequest in lib/services/agency-join-requests.ts.
      asText(
        `Jordan Mills has asked to join ${FIXTURE_AGENCY.name} on The Sales Progressor`,
        `Jordan Mills (jordan.mills@previewestates.co.uk) signed up and asked to join ${FIXTURE_AGENCY.name} as a negotiator.

Review the request and approve or decline it here:
${CATALOGUE_BASE}/agent/account/team

If this isn't someone from your team, decline it and no account will be added.`,
      ),
  },
  {
    id: "join-request-support",
    bucket: "platform_admin",
    category: "internal",
    name: "Join request (no-director fallback)",
    description: "Routes a join request to our support inbox when the agency has no active director to approve it.",
    trigger: "A join request lands on an agency with no active director.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors the no-director branch in lib/services/agency-join-requests.ts.
      asText(
        `[No director] Jordan Mills has asked to join ${FIXTURE_AGENCY.name} on The Sales Progressor`,
        `No active director on ${FIXTURE_AGENCY.name} to approve this join request.

Jordan Mills (jordan.mills@previewestates.co.uk) signed up and asked to join ${FIXTURE_AGENCY.name} as a negotiator.

Review the request and approve or decline it here:
${CATALOGUE_BASE}/agent/account/team

If this isn't someone from your team, decline it and no account will be added.`,
      ),
  },
  {
    id: "join-request-approved",
    bucket: "platform_admin",
    category: "platform",
    name: "Join request approved",
    description: "Tells the requester their request to join the agency was approved.",
    trigger: "A director approves a join request.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors approveJoinRequest in lib/services/agency-join-requests.ts.
      asText(
        "You've been approved on The Sales Progressor",
        `Good news, Jordan Mills. Your request to join your agency has been approved.

Log in to get started:
${CATALOGUE_BASE}/login`,
      ),
  },
  {
    id: "join-request-rejected",
    bucket: "platform_admin",
    category: "platform",
    name: "Join request declined",
    description: "Tells the requester their request to join the agency wasn't approved.",
    trigger: "A director declines a join request.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors rejectJoinRequest in lib/services/agency-join-requests.ts.
      asText(
        "Update on your request to join",
        `Hello Jordan Mills. Your request to join your agency on The Sales Progressor wasn't approved.

If you think this is a mistake, contact your agency administrator. You can also set up your own agency at ${CATALOGUE_BASE}/register.`,
      ),
  },
  {
    id: "join-request-expired",
    bucket: "platform_admin",
    category: "platform",
    name: "Join request expired",
    description: "Tells the requester their unactioned join request has expired.",
    trigger: "A stale join request expires on the cron.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors expireStaleJoinRequests in lib/services/agency-join-requests.ts.
      asText(
        "Your request to join has expired",
        `Hello Jordan Mills. Your request to join your agency wasn't actioned in time and has expired.

Ask your agency administrator to invite you, or set up your own agency at ${CATALOGUE_BASE}/register.`,
      ),
  },
  {
    id: "agency-move-support",
    bucket: "platform_admin",
    category: "internal",
    name: "Agency move needs action",
    description: "Internal flag to support when a user accepting a move can't be auto-moved because their old agency holds real data.",
    trigger: "A user accepts a move invite but their current agency has sales or other staff.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors flagForSupport in lib/services/agency-moves.ts.
      asText(
        `[Agency move] Jordan Mills needs moving into ${FIXTURE_AGENCY.name}`,
        `Jordan Mills (jordan.mills@previewestates.co.uk) has accepted an invite to move into ${FIXTURE_AGENCY.name}.

Their current agency "Old Town Lettings" can't be auto-moved because it has real data:
  - sales on it: 3
  - other staff on it: 2

From agency id: agency_old_town_123
To agency id: agency_preview_456
Invited by user id: user_director_789

Complete the move by hand, then mark the AgencyMoveRequest row completed.`,
      ),
  },
  {
    id: "outsource-lead-support",
    bucket: "platform_admin",
    category: "internal",
    name: "New outsource lead (to support)",
    description: "Internal notice when an agent hands us a sale via the public outsource page.",
    trigger: "The outsource page \"hand us a file\" form is submitted.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors the lead email in app/outsource/actions.ts.
      asText(
        `New sale to progress: ${FIXTURE_AGENCY.name}`,
        `A new sale has been handed over via the outsource page.

Name: Jordan Mills
Agency: ${FIXTURE_AGENCY.name}
Email: jordan.mills@previewestates.co.uk
Phone: 07700 900456
Property: ${FIXTURE_PROPERTY.address}
Notes: Chain of three, keen to move quickly.
`,
      ),
  },
  {
    id: "outsource-lead-confirm",
    bucket: "platform_admin",
    category: "platform",
    name: "Outsource lead confirmation",
    description: "Reassures the agent who handed us a sale that we've got it and there's nothing to pay unless it exchanges.",
    trigger: "The outsource page form is submitted (sent to the submitter).",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors the confirmation email in app/outsource/actions.ts.
      asText(
        "We've got your sale",
        `Hi Jordan,

Thanks for handing us ${FIXTURE_PROPERTY.address}. We've received the details and we'll be in touch shortly to get started.

There's nothing to pay unless it exchanges.

Sales Progressor
support@thesalesprogressor.co.uk
`,
      ),
  },
  {
    id: "agent-support-checkin",
    bucket: "platform_admin",
    category: "platform",
    name: "Agent support check-in",
    description: "A warm \"getting set up\" check-in from Customer Support, sent to a single agent.",
    trigger: "Superadmin sends the support check-in from the Command Centre.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () => wrap(buildAgentSupportEmail(FIXTURE_AGENT.name)),
  },
  {
    id: "dns-instructions",
    bucket: "platform_admin",
    category: "platform",
    name: "DNS setup instructions",
    description: "The CNAME records an agent forwards to their IT/admin so we can send email on their domain.",
    trigger: "An agent sends their domain's DNS records from Settings.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors app/api/agent/send-instructions-email/route.ts.
      asText(
        `DNS setup required for ${FIXTURE_AGENCY.domain} — Sales Progressor`,
        `Hi,

${FIXTURE_AGENT.name} needs the following DNS records added to ${FIXTURE_AGENCY.domain} so that Sales Progressor can send emails on their behalf.

Please add these CNAME records in your DNS settings:

s1._domainkey.${FIXTURE_AGENCY.domain}  CNAME  s1.domainkey.u123.wl.sendgrid.net
s2._domainkey.${FIXTURE_AGENCY.domain}  CNAME  s2.domainkey.u123.wl.sendgrid.net
em1234.${FIXTURE_AGENCY.domain}  CNAME  u123.wl.sendgrid.net

Once added, the records typically propagate within 30 minutes (up to 48 hours in some cases).

If you have any questions, please reply to this email.`,
      ),
  },
  {
    id: "feedback-submission",
    bucket: "platform_admin",
    category: "internal",
    name: "Feedback submission",
    description: "The in-app feedback widget (bug / suggestion / question) routed to our inbox, reply-to the submitter.",
    trigger: "Anyone submits the feedback widget.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () => {
      // Mirrors sendFeedbackEmail in app/api/feedback/route.ts (bug example).
      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:32px auto;padding:0 16px">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="padding:24px 28px;border-bottom:1px solid #f3f4f6">
      <span style="display:inline-block;padding:4px 10px;border-radius:99px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Bug Report</span>
      <p style="margin:12px 0 4px;font-size:13px;color:#374151">
        <strong>${FIXTURE_AGENT.name}</strong>
         · Director
         · ${FIXTURE_AGENCY.name}
      </p>
      <p style="margin:0;font-size:12px;color:#6b7280">${FIXTURE_AGENT.email}</p>
    </div>
    <div style="padding:24px 28px;border-bottom:1px solid #f3f4f6">
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">What they were trying to do</p>
      <p style="font-size:14px;color:#111827;white-space:pre-wrap;margin:0 0 20px">Confirm a milestone from the file Steps tab</p>
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">What happened instead</p>
      <p style="font-size:14px;color:#111827;white-space:pre-wrap;margin:0">The confirm button spun and nothing saved</p>
    </div>
    <div style="padding:20px 28px;background:#f9fafb">
      <p style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Context</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>URL:</strong> ${CATALOGUE_BASE}/transactions/PREVIEW</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>Browser:</strong> Chrome 128 on macOS</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>Viewport:</strong> 1440×900</p>
      <p style="font-size:11px;color:#d1d5db;margin:12px 0 0">ID: fb_preview_001 · Reply to this email to respond directly to the user</p>
    </div>
  </div>
</div>
</body></html>`;
      return { subject: "[Bug Report] Confirm a milestone from the file Steps tab", html };
    },
  },
  {
    id: "prospect-followup-digest",
    bucket: "platform_admin",
    category: "internal",
    name: "Prospect follow-up digest",
    description: "Internal weekday reminder of prospect follow-ups due and flow emails to approve. Nothing is sent to prospects from this.",
    trigger: "The prospect-followup-digest cron runs (07:30 weekdays) and something is due.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () =>
      // Mirrors app/api/cron/prospect-followup-digest/route.ts.
      asText(
        "Prospects: 3 follow-ups, 2 to approve (1 overdue)",
        `Follow-ups due (3):
- Harbour & Co · Priya Shah
- Meadow Residential · overdue
- Castle Estates · Dan Obi

To approve (2):
- Harbour & Co · LinkedIn email
- Castle Estates · intro email

Open your prospects: ${CATALOGUE_BASE}/command/prospects

Nothing has been sent to anyone. This is your reminder to work the queue and approve any flow emails.`,
      ),
  },
  {
    id: "content-reminder",
    bucket: "platform_admin",
    category: "internal",
    name: "Content publish reminder",
    description: "Internal reminder of scheduled content posts due to publish today.",
    trigger: "The content-schedule-reminder cron runs and posts are due today.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () => {
      // Mirrors app/api/cron/content-schedule-reminder/route.ts.
      const html = `<p>You have 2 posts due to publish today.</p><ul><li>[linkedin] Five things that quietly derail a sale between offer and exchange</li><li>[twitter] The average sale has 60+ touchpoints. Here's how we track them.</li></ul><p><a href="https://portal.thesalesprogressor.co.uk/command/content/calendar">Open the calendar</a></p>`;
      return { subject: "2 posts to publish today", html };
    },
  },
  {
    id: "content-batch",
    bucket: "platform_admin",
    category: "internal",
    name: "Content batch digest",
    description: "Internal digest of freshly drafted content posts ready to review.",
    trigger: "The content-batch cron drafts a new set of posts.",
    axes: [],
    senderKind: "platform",
    signatureBehaviour: "none",
    render: () => {
      // Mirrors buildHtml in app/api/cron/content-batch/route.ts.
      const date = "2026-09-04";
      const items = [
        { channel: "linkedin", topicSeed: "Why chains break after offer-accepted", text: "Most sales don't fall through because of the property. They fall through in the silence between offer and exchange...", charCount: 612 },
        { channel: "twitter", topicSeed: "Sales progression basics", text: "A sale isn't agreed when the offer's accepted. That's when the real work starts.", charCount: 92 },
      ];
      const rows = items
        .map(
          (item, i) => `
    <tr>
      <td style="padding:20px 0; border-top:1px solid #f0ebe6;">
        <p style="margin:0 0 8px 0; font-size:11px; font-weight:700; color:#FF6B4A; text-transform:uppercase; letter-spacing:0.08em;">
          ${i + 1} — ${item.channel === "linkedin" ? "LinkedIn" : "Twitter / X"}
          <span style="color:#aaa; font-weight:400; margin-left:8px;">${item.charCount} chars</span>
        </p>
        <p style="margin:0 0 8px 0; font-size:12px; color:#888;">
          Topic: ${item.topicSeed}
        </p>
        <div style="background:#fdf8f3; border-left:3px solid #FF6B4A; padding:14px 16px; border-radius:0 6px 6px 0;">
          <p style="margin:0; font-size:14px; line-height:1.65; color:#2D1810; white-space:pre-wrap;">${item.text}</p>
        </div>
      </td>
    </tr>`
        )
        .join("");
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f9f5f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f0; padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; max-width:600px;">
        <tr>
          <td style="background:#0a0a0a; padding:28px 32px;">
            <p style="margin:0; font-size:13px; font-weight:700; color:#FF6B4A; letter-spacing:0.05em; text-transform:uppercase;">Sales Progressor</p>
            <p style="margin:6px 0 0; font-size:22px; font-weight:700; color:#f5f5f5; letter-spacing:-0.02em;">Content batch — ${date}</p>
            <p style="margin:6px 0 0; font-size:13px; color:rgba(255,255,255,0.4);">${items.length} post${items.length !== 1 ? "s" : ""} ready to publish</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${rows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px; border-top:1px solid #f0ebe6;">
            <p style="margin:0; font-size:12px; color:#aaa;">
              Approve or remove drafts at
              <a href="https://portal.thesalesprogressor.co.uk/command/content" style="color:#FF6B4A;">command centre → content</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
      return { subject: `Content batch — ${date} (${items.length} posts)`, html };
    },
  },
];

export function specimenIndex(): SpecimenMeta[] {
  return EMAIL_SPECIMENS.map(({ render, ...meta }) => meta);
}

export function findSpecimen(id: string): EmailSpecimen | undefined {
  return EMAIL_SPECIMENS.find((s) => s.id === id);
}
