"use client";

// components/account/v2/InviteDirectorPlain.tsx
//
// "Invite your director" surface for negotiators whose agency has no
// director yet. Same three states as the original InviteDirector:
//   - active pending invitation → show invitation card + Resend button
//   - expired previous invitation → form + amber banner explaining the
//     previous attempt expired
//   - no invitation → form
//
// Same wiring: inviteDirector + resendInvitation server actions, same
// optimistic reload-on-success, same toast behaviour, same date
// helpers. Presentation restyled to the clean Account register — no
// glass cards, hairlines, flat coral submit button.

import { useState, useTransition } from "react";
import { inviteDirector, resendInvitation } from "@/app/actions/invite-director";
import { useAgentToast } from "@/components/agent/AgentToaster";

export interface LatestInvitation {
  id: string;
  directorName: string;
  directorEmail: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

interface InviteDirectorPlainProps {
  latestInvitation: LatestInvitation | null;
}

export function InviteDirectorPlain({ latestInvitation }: InviteDirectorPlainProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useAgentToast();

  const now = new Date();
  const hasActiveInvitation =
    latestInvitation && !latestInvitation.acceptedAt && new Date(latestInvitation.expiresAt) > now;
  const hasExpiredInvitation =
    latestInvitation && !latestInvitation.acceptedAt && new Date(latestInvitation.expiresAt) <= now;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.append("directorName", name);
    formData.append("directorEmail", email);
    startTransition(async () => {
      const result = await inviteDirector(formData);
      if (result.ok) {
        toast.success(`Invite sent to ${email}`);
        window.location.reload();
      } else {
        setError(result.error ?? "Couldn't send invitation");
      }
    });
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: 500,
    marginBottom: 5,
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13.5,
    color: "#111827",
    background: "#fff",
    border: "0.5px solid rgba(0,0,0,0.16)",
    borderRadius: 8,
    outline: "none",
  };

  // ── ACTIVE PENDING INVITATION ──────────────────────────────────────────────
  if (hasActiveInvitation) {
    return (
      <div
        style={{
          padding: "14px 16px",
          background: "#fff",
          border: "0.5px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827" }}>
            {latestInvitation.directorName}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
            {latestInvitation.directorEmail}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9ca3af" }}>
            Sent {formatRelativeTime(latestInvitation.createdAt)} · Expires{" "}
            {formatRelativeDate(latestInvitation.expiresAt)}
          </p>
        </div>
        <ResendButton invitationId={latestInvitation.id} />
      </div>
    );
  }

  // ── FORM (no invitation or expired) ───────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {hasExpiredInvitation && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "#92400e",
            background: "#fef3c7",
            border: "0.5px solid #fde68a",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          Your previous invitation to {latestInvitation.directorName} expired. You can send a
          new one below.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <label htmlFor="invite-director-name" style={labelStyle}>
            Director&apos;s name
          </label>
          <input
            id="invite-director-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. James Hartwell"
            required
            disabled={isPending}
            style={fieldStyle}
          />
        </div>
        <div>
          <label htmlFor="invite-director-email" style={labelStyle}>
            Director&apos;s email
          </label>
          <input
            id="invite-director-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="director@youragency.co.uk"
            required
            disabled={isPending}
            style={fieldStyle}
          />
        </div>
      </div>

      {error && <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={isPending || !name.trim() || !email.trim()}
          style={{
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background: "var(--agent-coral, #FF6B4A)",
            border: "none",
            borderRadius: 8,
            cursor:
              isPending || !name.trim() || !email.trim() ? "default" : "pointer",
            opacity: isPending || !name.trim() || !email.trim() ? 0.45 : 1,
          }}
        >
          {isPending ? "Sending…" : "Send invitation"}
        </button>
      </div>
    </form>
  );
}

function ResendButton({ invitationId }: { invitationId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();

  function handleResend() {
    if (!confirm("Resend the invitation email to your director?")) return;
    startTransition(async () => {
      const result = await resendInvitation(invitationId);
      if (result.ok) {
        toast.success("Invite resent");
      } else {
        toast.error(result.error ?? "Couldn't resend");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={isPending}
      style={{
        flexShrink: 0,
        padding: "5px 10px",
        fontSize: 12,
        fontWeight: 500,
        color: "#6b7280",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: isPending ? "default" : "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 2,
        opacity: isPending ? 0.4 : 1,
        transition: "color 150ms, background 150ms",
      }}
      className="hover:bg-black/[0.04]"
    >
      {isPending ? "Resending…" : "Resend"}
    </button>
  );
}

function formatRelativeTime(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoStr).toLocaleDateString("en-GB");
}

function formatRelativeDate(isoStr: string): string {
  const diffMs = new Date(isoStr).getTime() - Date.now();
  const diffDay = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDay <= 0) return "today";
  if (diffDay === 1) return "tomorrow";
  if (diffDay < 7) return `in ${diffDay} days`;
  return new Date(isoStr).toLocaleDateString("en-GB");
}
