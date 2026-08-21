// "Your team" card for the portal overview (audit #16).
//
// Shows the human looking after the file (progressor / agent) with a photo,
// a WhatsApp button + email, and the client's own-side solicitor firm (name
// only). People trust people, not portals — this puts a face and a name in
// front of a nervous buyer or seller. Server component: the only interactive
// bits are plain links (WhatsApp, mailto).

import { P, PORTAL_BTN } from "@/components/portal/portal-ui";
import type { PortalTeam } from "@/lib/services/portal";
import { PortalTeamManageRow, PortalManagePencil } from "@/components/portal/PortalTeamManageRow";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
import { PortalFollowupButton, PortalAddConveyancerEmail } from "@/components/portal/PortalFollowupButton";
import type { FollowupNudge } from "@/lib/portal/followup-state";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const two = (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return two.toUpperCase() || "?";
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 22a9.9 9.9 0 01-5-1.4L3.3 21.6l1-3.6A9.9 9.9 0 1112 22" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2m0 4l-8 5-8-5V6l8 5 8-5z" />
    </svg>
  );
}

function SaveContactIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// Outlined "Save contact" download link (.vcf). Neutral, to sit apart from the
// filled WhatsApp / Email actions.
function SaveContactButton({ token, who }: { token: string; who: "progressor" | "solicitor" }) {
  return (
    <a
      href={`/api/portal/${token}/contact-card?who=${who}`}
      download={`${who}.vcf`}
      className="pbtn pbtn-press"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 12.5,
        fontWeight: 700,
        padding: "9px 14px",
        borderRadius: 11,
        textDecoration: "none",
        background: "transparent",
        border: `1px solid ${P.border}`,
        color: P.textSecondary,
      }}
    >
      <SaveContactIcon /> Save contact
    </a>
  );
}

export function PortalTeamCard({ team, token, followup }: { team: PortalTeam; token: string; followup?: FollowupNudge | null }) {
  const { managing, solicitorFirmName, solicitorMailto, broker, chainAgent } = team;
  // Symmetric for both sides (2026-08-17): a buyer records their selling agent
  // (chain link below them), a seller their onward-purchase agent (link above).
  const showAgentRow = chainAgent.canManage && chainAgent.applicable;
  const agentNoun = chainAgent.direction === "below" ? "selling agent" : "onward agent";
  const agentHas = chainAgent.present && !!(chainAgent.agentName || chainAgent.agencyName);
  if (!managing && !solicitorFirmName && !showAgentRow && !broker) return null;

  // Order (Founder, 2026-08-16): solicitor first, the person managing the file
  // second, the client's chain agent last. Only the first shown row skips the
  // hairline divider.
  const firstRow = solicitorFirmName ? "sol" : managing ? "man" : "agent";
  const divider = `1px solid ${P.borderSubtle}`;

  return (
    <PortalGlassCard glassId="your-team" label="Your team" radius={20} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "14px 18px 4px" }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: P.textMuted,
          }}
        >
          Your team
        </p>
        {solicitorFirmName && <PortalManagePencil section="solicitor" label="Update your conveyancer" />}
      </div>

      {solicitorFirmName && (
        <div
          style={{
            display: "flex",
            gap: 13,
            padding: "13px 18px",
            alignItems: "flex-start",
            borderTop: firstRow === "sol" ? undefined : divider,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13,
              color: "#fff",
              background: "linear-gradient(135deg,#3f4a63,#243049)",
              boxShadow: "0 2px 6px rgba(36,48,73,0.28)",
            }}
          >
            {initials(solicitorFirmName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.textPrimary, lineHeight: 1.25 }}>
              {solicitorFirmName}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: P.textSecondary }}>Your conveyancer</p>

            {followup ? (
              // Smart follow-up: knows whose court the ball is in and pre-fills
              // a situation-appropriate email in the client's voice. Save-contact
              // sits alongside the button (wraps under it on a tight width).
              <PortalFollowupButton
                token={token}
                {...followup}
                trailing={<SaveContactButton token={token} who="solicitor" />}
              />
            ) : solicitorMailto ? (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <a
                  href={solicitorMailto}
                  className="pbtn pbtn-press"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 12.5,
                    fontWeight: 700,
                    padding: "9px 14px",
                    borderRadius: 11,
                    textDecoration: "none",
                    background: PORTAL_BTN.emailBg,
                    boxShadow: PORTAL_BTN.emailShadow,
                    color: "#fff",
                  }}
                >
                  <MailIcon /> Email
                </a>
                <SaveContactButton token={token} who="solicitor" />
              </div>
            ) : (
              // We have a conveyancer on file but no email — prompt to add it.
              <PortalAddConveyancerEmail />
            )}
          </div>
        </div>
      )}

      {managing && (
        <div style={{ display: "flex", gap: 13, padding: "13px 18px", alignItems: "flex-start", borderTop: firstRow === "man" ? undefined : divider }}>
          {/* Avatar: photo if uploaded, else initials on the coral gradient */}
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
              color: "#fff",
              background: managing.image ? "#eee" : P.heroGradient,
              boxShadow: "0 2px 6px rgba(255,107,74,0.30)",
              overflow: "hidden",
            }}
          >
            {managing.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={managing.image} alt={managing.name} width={46} height={46} style={{ width: 46, height: 46, objectFit: "cover" }} />
            ) : (
              initials(managing.name)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.textPrimary, lineHeight: 1.25 }}>
              {managing.name}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: P.textSecondary }}>{managing.roleLabel}</p>

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {managing.whatsappUrl && (
                <a
                  href={managing.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pbtn pbtn-press"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 12.5,
                    fontWeight: 700,
                    padding: "9px 14px",
                    borderRadius: 11,
                    textDecoration: "none",
                    background: PORTAL_BTN.waBg,
                    boxShadow: PORTAL_BTN.waShadow,
                    color: "#fff",
                  }}
                >
                  <WhatsAppIcon /> WhatsApp
                </a>
              )}
              {managing.email && (
                <a
                  href={`mailto:${managing.email}`}
                  className="pbtn pbtn-press"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 12.5,
                    fontWeight: 700,
                    padding: "9px 14px",
                    borderRadius: 11,
                    textDecoration: "none",
                    background: PORTAL_BTN.emailBg,
                    boxShadow: PORTAL_BTN.emailShadow,
                    color: "#fff",
                  }}
                >
                  <MailIcon /> Email
                </a>
              )}
              <SaveContactButton token={token} who="progressor" />
            </div>

            {managing.email && (
              <p style={{ margin: "8px 0 0", fontSize: 11.5, color: P.textMuted, wordBreak: "break-all" }}>
                {managing.email}
              </p>
            )}
          </div>
        </div>
      )}

      {showAgentRow && (
        <PortalTeamManageRow
          section="agents"
          icon={agentHas ? "edit" : "add"}
          label={agentHas ? `Edit your ${agentNoun}` : `Add your ${agentNoun}`}
          topBorder={firstRow !== "agent"}
        >
          <div
            style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: agentHas ? 13 : 22,
              color: agentHas ? "#fff" : P.textMuted,
              background: agentHas ? "linear-gradient(135deg,#3f4a63,#243049)" : P.pageBg,
              border: agentHas ? "none" : `1.5px dashed ${P.border}`,
              boxShadow: agentHas ? "0 2px 6px rgba(36,48,73,0.28)" : "none",
            }}
          >
            {agentHas ? initials(chainAgent.agentName || chainAgent.agencyName || "?") : "+"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.textPrimary, lineHeight: 1.25 }}>
              {agentHas ? (chainAgent.agentName || chainAgent.agencyName) : `Your ${agentNoun}`}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: P.textSecondary, lineHeight: 1.4 }}>
              {agentHas
                ? (chainAgent.agencyName && chainAgent.agentName ? chainAgent.agencyName : `Your ${agentNoun}`)
                : (chainAgent.direction === "below"
                    ? "Selling somewhere too? Add your agent to keep the chain moving."
                    : "Buying onward? Add your agent to keep the chain moving.")}
            </p>
          </div>
        </PortalTeamManageRow>
      )}

      {broker && (
        <div style={{ display: "flex", gap: 13, padding: "13px 18px", alignItems: "flex-start", borderTop: divider }}>
          <div
            style={{
              width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 15, color: "#fff",
              background: broker.logoUrl ? "#0f1729" : P.heroGradient,
              boxShadow: "0 2px 6px rgba(255,107,74,0.28)",
              overflow: "hidden",
            }}
          >
            {broker.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={broker.logoUrl} alt={broker.firmName} width={46} height={46} style={{ width: 46, height: 46, objectFit: "cover" }} />
            ) : (
              initials(broker.firmName)
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.textPrimary, lineHeight: 1.25 }}>
              {broker.firmName}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: P.textSecondary }}>
              {broker.contactName ? `${broker.contactName}, your mortgage broker` : "Your mortgage broker"}
            </p>
          </div>
        </div>
      )}
    </PortalGlassCard>
  );
}
