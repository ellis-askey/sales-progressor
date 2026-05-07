"use client";

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
  id:              string;
  negotiatorName:  string;
  negotiatorEmail: string;
  expiresAt:       string;
  createdAt:       string;
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

export function TeamListView({
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
    <div className="space-y-4">
      {directors.map((m) => (
        <div key={m.id} className="glass-card px-4 py-3 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
          >
            <Crown className="w-4 h-4 text-white" weight="fill" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900/90 truncate">{m.name}</p>
            <p className="text-xs text-slate-900/40 truncate">{m.email}</p>
          </div>
          <span className="flex-shrink-0 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Director
          </span>
        </div>
      ))}

      {negotiators.length === 0 && onAddClick && (
        <div className="glass-card px-5 py-8 text-center">
          <p className="text-sm text-slate-900/50">No negotiators yet.</p>
          <p className="text-xs text-slate-900/35 mt-1">Add a negotiator below to give them access to the portal.</p>
        </div>
      )}

      {negotiators.map((m) => (
        <div key={m.id} className="glass-card px-4 py-3 flex items-center gap-3">
          <UserAvatar user={{ name: m.name }} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900/90 truncate">{m.name}</p>
            <p className="text-xs text-slate-900/40 truncate">{m.email}</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1.5">
            <button
              onClick={() => onToggleViewAll?.(m)}
              title={
                m.canViewAllFiles
                  ? "Can see all agency files — click to restrict"
                  : "Can only see own files — click to allow all"
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                m.canViewAllFiles
                  ? "agent-badge-brand"
                  : "bg-white/30 text-slate-900/50 hover:bg-white/60"
              }`}
            >
              {m.canViewAllFiles ? (
                <><Eye className="w-3.5 h-3.5" /> All files</>
              ) : (
                <><EyeSlash className="w-3.5 h-3.5" /> Own files</>
              )}
            </button>
            {onRemove && m.id !== currentUserId && (
              <button
                onClick={() => onRemove(m.id, m.name)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-900/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove from team"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      {pendingInvitations.map((inv) => {
        const days = daysUntil(inv.expiresAt);
        return (
          <div key={inv.id} className="glass-card px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100">
              <EnvelopeSimple className="w-4 h-4 text-slate-400" weight="regular" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900/90 truncate">{inv.negotiatorName}</p>
              <p className="text-xs text-slate-900/40 truncate">
                {inv.negotiatorEmail}
                {" · "}
                <span className={days <= 0 ? "text-red-400" : "text-slate-900/35"}>
                  {days <= 0 ? "Expired" : `Expires in ${days}d`}
                </span>
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                Pending
              </span>
              {onResendInvitation && (
                <button
                  onClick={() => onResendInvitation(inv.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-900/50 hover:text-slate-900/80 hover:bg-white/40 transition-colors"
                  title="Resend invitation email"
                >
                  Resend
                </button>
              )}
              {onCancelInvitation && (
                <button
                  onClick={() => onCancelInvitation(inv.id, inv.negotiatorName)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-900/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Cancel invitation"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {onAddClick && (
        <button
          onClick={onAddClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-medium hover:bg-black/[0.03] transition-colors"
          style={{ borderColor: "rgba(var(--agent-coral-base-rgb),0.45)", color: "var(--agent-coral-deep)" }}
        >
          <UserPlus className="w-4 h-4" />
          Add a negotiator
        </button>
      )}
    </div>
  );
}
