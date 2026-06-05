"use client";

// components/account/v2/TeamListViewPlain.tsx
//
// Team roster + pending invitations as hairline-divided rows on the
// clean Account canvas. Same shape and props as TeamListView (one row
// per director / negotiator / pending-invitation, same actions per
// row), restyled — no glass cards, no card-per-row containers, just
// a list with hairline separators. The original TeamListView remains
// in use by the legacy /agent/settings page.

import { Eye, EyeSlash, Crown, Trash, UserPlus, EnvelopeSimple, X } from "@phosphor-icons/react";
import { UserAvatar } from "@/components/ui/Avatar";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  canViewAllFiles: boolean;
};

export type PendingNegotiatorInvitation = {
  id: string;
  negotiatorName: string;
  negotiatorEmail: string;
  expiresAt: string;
  createdAt: string;
};

type Props = {
  directors: TeamMember[];
  negotiators: TeamMember[];
  currentUserId?: string;
  onToggleViewAll?: (member: TeamMember) => void;
  onRemove?: (id: string, name: string) => void;
  onAddClick?: () => void;
  pendingInvitations?: PendingNegotiatorInvitation[];
  onResendInvitation?: (id: string) => void;
  onCancelInvitation?: (id: string, name: string) => void;
};

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 4px",
  borderBottom: "0.5px solid rgba(0,0,0,0.06)",
};

const ICON_BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  background: "transparent",
  border: "none",
  borderRadius: 6,
  color: "#9ca3af",
  cursor: "pointer",
  transition: "color 150ms, background 150ms",
};

export function TeamListViewPlain({
  directors,
  negotiators,
  currentUserId,
  onToggleViewAll,
  onRemove,
  onAddClick,
  pendingInvitations = [],
  onResendInvitation,
  onCancelInvitation,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {directors.map((m) => (
        <div key={m.id} style={ROW_STYLE}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            }}
          >
            <Crown style={{ width: 15, height: 15, color: "#fff" }} weight="fill" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.name}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.email}
            </p>
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.7,
              padding: "3px 8px",
              borderRadius: 4,
              background: "#fef3c7",
              color: "#92400e",
            }}
          >
            Director
          </span>
        </div>
      ))}

      {negotiators.length === 0 && pendingInvitations.length === 0 && onAddClick && (
        <div
          style={{
            padding: "20px 4px",
            textAlign: "center",
            color: "#9ca3af",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>No negotiators yet.</p>
          <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#9ca3af" }}>
            Add a negotiator below to give them access to the portal.
          </p>
        </div>
      )}

      {negotiators.map((m) => (
        <div key={m.id} style={ROW_STYLE}>
          <UserAvatar user={{ name: m.name }} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.name}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.email}
            </p>
          </div>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => onToggleViewAll?.(m)}
              title={
                m.canViewAllFiles
                  ? "Can see all agency files. Click to restrict."
                  : "Can only see own files. Click to allow all."
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                fontSize: 11.5,
                fontWeight: 500,
                background: m.canViewAllFiles
                  ? "rgba(var(--agent-coral-rgb, 255, 107, 74), 0.10)"
                  : "#f3f4f6",
                color: m.canViewAllFiles ? "var(--agent-coral-deep, #E84F2D)" : "#6b7280",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                transition: "background 150ms",
              }}
            >
              {m.canViewAllFiles ? (
                <>
                  <Eye style={{ width: 13, height: 13 }} /> All files
                </>
              ) : (
                <>
                  <EyeSlash style={{ width: 13, height: 13 }} /> Own files
                </>
              )}
            </button>
            {onRemove && m.id !== currentUserId && (
              <button
                onClick={() => onRemove(m.id, m.name)}
                title="Remove from team"
                style={ICON_BTN_STYLE}
                className="hover:bg-red-50 hover:text-red-500"
              >
                <Trash style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        </div>
      ))}

      {pendingInvitations.map((inv) => {
        const days = daysUntil(inv.expiresAt);
        return (
          <div key={inv.id} style={ROW_STYLE}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: "#f3f4f6",
              }}
            >
              <EnvelopeSimple style={{ width: 15, height: 15, color: "#9ca3af" }} weight="regular" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inv.negotiatorName}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inv.negotiatorEmail}
                {" · "}
                <span style={{ color: days <= 0 ? "#dc2626" : "#9ca3af" }}>
                  {days <= 0 ? "Expired" : `Expires in ${days}d`}
                </span>
              </p>
            </div>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "#f3f4f6",
                  color: "#6b7280",
                }}
              >
                Pending
              </span>
              {onResendInvitation && (
                <button
                  onClick={() => onResendInvitation(inv.id)}
                  title="Resend invitation email"
                  style={{
                    padding: "5px 10px",
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "#6b7280",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "background 150ms, color 150ms",
                  }}
                  className="hover:bg-black/[0.04]"
                >
                  Resend
                </button>
              )}
              {onCancelInvitation && (
                <button
                  onClick={() => onCancelInvitation(inv.id, inv.negotiatorName)}
                  title="Cancel invitation"
                  style={ICON_BTN_STYLE}
                  className="hover:bg-red-50 hover:text-red-500"
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {onAddClick && (
        <button
          onClick={onAddClick}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 14,
            padding: "11px 16px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--agent-coral-deep, #E84F2D)",
            background: "transparent",
            border: "1px dashed rgba(var(--agent-coral-rgb, 255, 107, 74), 0.45)",
            borderRadius: 10,
            cursor: "pointer",
            transition: "background 150ms",
          }}
          className="hover:bg-black/[0.03]"
        >
          <UserPlus style={{ width: 15, height: 15 }} />
          Add a negotiator
        </button>
      )}
    </div>
  );
}
