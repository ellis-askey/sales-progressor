"use client";

// components/account/v2/TeamListViewPlain.tsx
//
// Team roster + pending invitations as rows on the Account card. Same props /
// wiring as before (one row per director / negotiator / pending invite, same
// actions). Redesign: every row shows a role badge; a negotiator's file access
// is a dropdown (All files / Own files); per-row actions live in a "…" menu
// (Remove / Resend / Cancel). The add trigger moved to the card header.

import { Crown, EnvelopeSimple, CaretDown } from "@phosphor-icons/react";
import { UserAvatar } from "@/components/ui/Avatar";
import { RowActionsMenu, type RowAction } from "@/components/account/chrome/RowActionsMenu";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  canViewAllFiles: boolean;
  image?: string | null;
  imageFocusX?: number | null;
  imageFocusY?: number | null;
  jobTitle?: string | null;
  directMobile?: string | null;
};

export type PendingInvitation = {
  id: string;
  name: string;
  email: string;
  role: "director" | "negotiator";
  expiresAt: string;
  createdAt: string;
};

type Props = {
  directors: TeamMember[];
  negotiators: TeamMember[];
  currentUserId?: string;
  // Read-only roster (a negotiator viewing their own team): shows everyone with
  // their details, but none of the management controls (no file-access dropdown,
  // no row menu, no pending invitations).
  readOnly?: boolean;
  onToggleViewAll?: (member: TeamMember) => void;
  savingAccessId?: string | null;
  onRemove?: (id: string, name: string) => void;
  onManage?: (member: TeamMember) => void;
  onAddClick?: () => void;
  pendingInvitations?: PendingInvitation[];
  onResendInvitation?: (id: string, role: "director" | "negotiator") => void;
  onCancelInvitation?: (id: string, name: string, role: "director" | "negotiator") => void;
};

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "13px 2px",
  borderBottom: "0.5px solid rgba(0,0,0,0.06)",
};

function Badge({ label, tone }: { label: string; tone: "director" | "neutral" }) {
  const styles =
    tone === "director"
      ? { background: "#fef3c7", color: "#92400e" }
      : { background: "#f3f4f6", color: "#6b7280" };
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        padding: "3px 8px",
        borderRadius: 5,
        ...styles,
      }}
    >
      {label}
    </span>
  );
}

function FileAccessSelect({ member, onToggle, saving }: { member: TeamMember; onToggle?: (m: TeamMember) => void; saving?: boolean }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <select
        value={member.canViewAllFiles ? "all" : "own"}
        onChange={() => onToggle?.(member)}
        disabled={saving}
        aria-label={`File access for ${member.name}`}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          padding: "6px 28px 6px 11px",
          fontSize: 12.5,
          fontWeight: 500,
          color: "#374151",
          background: "#fff",
          border: "0.5px solid rgba(0,0,0,0.16)",
          borderRadius: 8,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
          outline: "none",
        }}
      >
        <option value="all">All files</option>
        <option value="own">Own files</option>
      </select>
      <CaretDown
        size={11}
        weight="bold"
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }}
      />
    </div>
  );
}

// Second line under a member's name: email, plus job title and mobile when set.
// The management branch doesn't pass those extra fields, so it's unchanged there;
// the read-only roster passes them so a negotiator sees full team details.
function memberDetail(m: TeamMember): string {
  return [m.email, m.jobTitle?.trim() || null, m.directMobile?.trim() || null].filter(Boolean).join(" · ");
}

export function TeamListViewPlain({
  directors,
  negotiators,
  currentUserId,
  readOnly,
  onToggleViewAll,
  savingAccessId,
  onRemove,
  onManage,
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
              width: 34,
              height: 34,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            }}
          >
            <Crown style={{ width: 16, height: 16, color: "#fff" }} weight="fill" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.name}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {memberDetail(m)}
            </p>
          </div>
          <Badge label="Director" tone="director" />
        </div>
      ))}

      {negotiators.length === 0 && pendingInvitations.length === 0 && (
        <div style={{ padding: "22px 4px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>No negotiators yet.</p>
          {!readOnly && (
            <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#9ca3af" }}>
              Add a team member to give them access to Sales Progressor.
            </p>
          )}
        </div>
      )}

      {negotiators.map((m) => {
        const actions: RowAction[] = [];
        if (onManage) actions.push({ label: "Manage member", onClick: () => onManage(m) });
        if (onRemove && m.id !== currentUserId) {
          actions.push({ label: "Remove from team", onClick: () => onRemove(m.id, m.name), danger: true });
        }
        return (
          <div key={m.id} style={ROW_STYLE}>
            <UserAvatar user={{ name: m.name, image: m.image ?? null, imageFocusX: m.imageFocusX ?? undefined, imageFocusY: m.imageFocusY ?? undefined }} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.email}
              </p>
            </div>
            <Badge label="Negotiator" tone="neutral" />
            {!readOnly && <FileAccessSelect member={m} onToggle={onToggleViewAll} saving={savingAccessId === m.id} />}
            {!readOnly && <RowActionsMenu items={actions} />}
          </div>
        );
      })}

      {!readOnly && pendingInvitations.map((inv) => {
        const days = daysUntil(inv.expiresAt);
        const actions: RowAction[] = [];
        if (onResendInvitation) actions.push({ label: "Resend invitation", onClick: () => onResendInvitation(inv.id, inv.role) });
        if (onCancelInvitation) actions.push({ label: "Cancel invitation", onClick: () => onCancelInvitation(inv.id, inv.name, inv.role), danger: true });
        const roleLabel = inv.role === "director" ? "Director" : "Negotiator";
        return (
          <div key={inv.id} style={ROW_STYLE}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: "#f3f4f6",
              }}
            >
              <EnvelopeSimple style={{ width: 16, height: 16, color: "#9ca3af" }} weight="regular" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inv.name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inv.email}
                {" · "}
                <span>Invited as {roleLabel.toLowerCase()}</span>
                {" · "}
                <span style={{ color: days <= 0 ? "#dc2626" : "#9ca3af" }}>
                  {days <= 0 ? "Expired" : `Expires in ${days}d`}
                </span>
              </p>
            </div>
            <Badge label={roleLabel} tone={inv.role === "director" ? "director" : "neutral"} />
            <RowActionsMenu items={actions} />
          </div>
        );
      })}
    </div>
  );
}
