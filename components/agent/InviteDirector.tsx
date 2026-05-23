"use client";

import { useState, useTransition } from "react";
import { inviteDirector, resendInvitation } from "@/app/actions/invite-director";
import { useAgentToast } from "@/components/agent/AgentToaster";

// Dates come from the server serialised as ISO strings — never Date objects.
export interface LatestInvitation {
  id: string;
  directorName: string;
  directorEmail: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

interface InviteDirectorProps {
  latestInvitation: LatestInvitation | null;
}

const FIELD = "w-full px-4 py-3 text-base rounded-xl bg-white/60 border border-white/30 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/80";
const LABEL = "text-xs font-semibold text-slate-900/50 uppercase tracking-wide";

export function InviteDirector({ latestInvitation }: InviteDirectorProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useAgentToast();

  const now = new Date();
  const hasActiveInvitation =
    latestInvitation &&
    !latestInvitation.acceptedAt &&
    new Date(latestInvitation.expiresAt) > now;

  const hasExpiredInvitation =
    latestInvitation &&
    !latestInvitation.acceptedAt &&
    new Date(latestInvitation.expiresAt) <= now;

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
      <div className="glass-card p-6">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-slate-900/80 mb-1">Invite your director</h2>
          <p className="text-xs text-slate-900/50">
            Bring your director onto Sales Progressor — they'll be able to see all of your active sales.
          </p>
        </div>

        <div style={{
          padding: "14px 16px",
          background: "rgba(255,255,255,0.40)",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.50)",
        }}>
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900/80">
                {latestInvitation.directorName}
              </p>
              <p className="text-xs text-slate-900/50 mt-0.5">
                {latestInvitation.directorEmail}
              </p>
              <p className="text-xs text-slate-900/40 mt-1.5">
                Sent {formatRelativeTime(latestInvitation.createdAt)} · Expires {formatRelativeDate(latestInvitation.expiresAt)}
              </p>
            </div>
            <ResendButton invitationId={latestInvitation.id} />
          </div>
        </div>
      </div>
    );
  }

  // ── FORM (no invitation or expired) ───────────────────────────────────────
  return (
    <div className="glass-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-slate-900/80 mb-1">Invite your director</h2>
        <p className="text-xs text-slate-900/50">
          Bring your director onto Sales Progressor — they&apos;ll be able to see all of your active sales.
        </p>
        {hasExpiredInvitation && (
          <p className="text-xs text-amber-600 bg-amber-50/80 rounded-lg px-3 py-2 border border-amber-200/60 mt-3">
            Your previous invitation to {latestInvitation.directorName} expired. You can send a new one below.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="invite-director-name" className={LABEL}>
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
              className={FIELD}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="invite-director-email" className={LABEL}>
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
              className={FIELD}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !name.trim() || !email.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%)",
              boxShadow: "0 4px 12px rgba(var(--agent-coral-rgb),0.30)",
            }}
          >
            {isPending ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>
    </div>
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
      className="shrink-0 text-xs font-semibold text-slate-900/50 hover:text-slate-900/80 transition-colors disabled:opacity-40 underline underline-offset-2"
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
