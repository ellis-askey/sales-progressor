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
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { LabelInput } from "@/components/ui/LabelInput";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";

const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

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
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            {latestInvitation.directorName}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
            {latestInvitation.directorEmail}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--agent-text-tertiary)" }}>
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
        <InlineAlert kind="warning">
          Your previous invitation to {latestInvitation.directorName} expired. You can send a new one below.
        </InlineAlert>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px 12px",
          "--lbi-top": "0px",
        } as React.CSSProperties}
      >
        <LabelInput
          label="Director's name" type="text" accent={CORAL} fullWidth required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => { if (e.target.value.trim()) setName(titleCaseKeepAcronyms(e.target.value)); }}
        />
        <LabelInput
          label="Director's email" type="email" accent={CORAL} fullWidth required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={(e) => { if (e.target.value.trim()) setEmail(e.target.value.trim().toLowerCase()); }}
        />
      </div>

      {error && <InlineAlert kind="danger">{error}</InlineAlert>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={isPending}
          disabled={isPending || !name.trim() || !email.trim()}
          style={coralVars}
        >
          Send invitation
        </Button>
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
    <div style={{ flexShrink: 0 }}>
      <Button type="button" variant="ghost" size="sm" onClick={handleResend} disabled={isPending} loading={isPending}>
        Resend
      </Button>
    </div>
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
