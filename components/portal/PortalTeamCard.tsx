// "Your team" card for the portal overview (audit #16).
//
// Shows the human looking after the file (progressor / agent) with a photo,
// a WhatsApp button + email, and the client's own-side solicitor firm (name
// only). People trust people, not portals — this puts a face and a name in
// front of a nervous buyer or seller. Server component: the only interactive
// bits are plain links (WhatsApp, mailto).

import { P, PORTAL_BTN } from "@/components/portal/portal-ui";
import type { PortalTeam } from "@/lib/services/portal";
import { OpenAgentsButton } from "@/components/portal/OpenAgentsButton";

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

export function PortalTeamCard({ team }: { team: PortalTeam }) {
  const { managing, solicitorFirmName, chainAgent } = team;
  // Buyers only, per Ellis: show their "selling agent" row (the chain link
  // below them). Sellers' onward-purchase agent is left off the card for now,
  // though both can still add theirs from the drawer.
  const showAgentRow = chainAgent.direction === "below" && chainAgent.canManage;
  const agentHas = chainAgent.present && !!(chainAgent.agentName || chainAgent.agencyName);
  if (!managing && !solicitorFirmName && !showAgentRow) return null;

  return (
    <div style={{ background: P.cardBg, borderRadius: P.radiusLg, boxShadow: P.shadowSm, overflow: "hidden" }}>
      <p
        style={{
          margin: 0,
          padding: "14px 18px 4px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: P.textMuted,
        }}
      >
        Your team
      </p>

      {managing && (
        <div style={{ display: "flex", gap: 13, padding: "13px 18px", alignItems: "flex-start" }}>
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
            </div>

            {managing.email && (
              <p style={{ margin: "8px 0 0", fontSize: 11.5, color: P.textMuted, wordBreak: "break-all" }}>
                {managing.email}
              </p>
            )}
          </div>
        </div>
      )}

      {solicitorFirmName && (
        <div
          style={{
            display: "flex",
            gap: 13,
            padding: "13px 18px",
            alignItems: "center",
            borderTop: `1px solid ${P.borderSubtle}`,
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
          </div>
        </div>
      )}

      {showAgentRow && (
        <div style={{ display: "flex", gap: 13, padding: "13px 18px", alignItems: "center", borderTop: `1px solid ${P.borderSubtle}` }}>
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
              {agentHas ? (chainAgent.agentName || chainAgent.agencyName) : "Your selling agent"}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: P.textSecondary, lineHeight: 1.4 }}>
              {agentHas
                ? (chainAgent.agencyName && chainAgent.agentName ? chainAgent.agencyName : "Your selling agent")
                : "Selling somewhere too? Add your agent to keep the chain moving."}
            </p>
          </div>
          <OpenAgentsButton label={agentHas ? "Edit" : "Add"} />
        </div>
      )}
    </div>
  );
}
