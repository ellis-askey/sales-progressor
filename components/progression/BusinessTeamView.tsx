"use client";

// The owner's "Your team" roster: one row per business member with a two-way
// Own-files / All-sales toggle. The owner's own row is locked to All sales. Visual
// language + hover-lift rows + SectionReveal entrance match the Clients workspace;
// the segmented toggle reuses the app's coral/cream treatment.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Clock } from "@phosphor-icons/react";
import { SectionReveal } from "@/components/hub/SectionReveal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { setBusinessMemberViewAllAction, inviteTeamMemberAction, removeTeamMemberAction } from "@/app/actions/progression-clients";
import type { BusinessTeamMember } from "@/lib/services/progression-clients";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function BusinessTeamView({ team }: { team: BusinessTeamMember[] }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [pending, startTransition] = useTransition();
  // Optimistic see-all state per member, so the toggle responds instantly.
  const [viewAll, setViewAll] = useState<Record<string, boolean>>(
    () => Object.fromEntries(team.map((m) => [m.id, m.canViewAllFiles])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  // Invite form + per-row remove confirm.
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  function invite() {
    const name = inviteName.trim();
    const email = inviteEmail.trim();
    if (!name || !email || pending) return;
    const fd = new FormData();
    fd.append("name", name);
    fd.append("email", email);
    startTransition(async () => {
      const res = await inviteTeamMemberAction(fd);
      if (res.ok) {
        setInviting(false); setInviteName(""); setInviteEmail("");
        toast.success("Invite sent", { description: `We've emailed ${email} a set-up link.` });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(member: BusinessTeamMember) {
    if (pending) return;
    startTransition(async () => {
      const res = await removeTeamMemberAction(member.id);
      setConfirmRemoveId(null);
      if (res.ok) { toast.success(`${member.name} removed`); router.refresh(); }
      else { toast.error(res.error); }
    });
  }

  function setMember(member: BusinessTeamMember, next: boolean) {
    if (member.role === "owner" || viewAll[member.id] === next || pending) return;
    const prev = viewAll[member.id];
    setViewAll((v) => ({ ...v, [member.id]: next }));
    setSavingId(member.id);
    startTransition(async () => {
      const res = await setBusinessMemberViewAllAction(member.id, next);
      setSavingId(null);
      if (res.ok) {
        router.refresh();
      } else {
        setViewAll((v) => ({ ...v, [member.id]: prev })); // revert
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="bt">
      <SectionReveal order={0}>
        <div className="bt-top">
          <div className="bt-top-head">
            <div>
              <h1 className="bt-h1">Your team</h1>
              <p className="bt-sub">Who&rsquo;s in your business, and how much of your book each person can see.</p>
            </div>
            <button type="button" className="bt-invite-btn" onClick={() => setInviting((v) => !v)}>
              <UserPlus size={16} weight="bold" /> Invite teammate
            </button>
          </div>
          {inviting && (
            <div className="bt-invite-form">
              <input
                className="bt-inp" placeholder="Their name" value={inviteName}
                onChange={(e) => setInviteName(e.target.value)} disabled={pending} autoFocus
              />
              <input
                className="bt-inp" type="email" placeholder="their@email.co.uk" value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") invite(); }} disabled={pending}
              />
              <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" onClick={invite} disabled={pending || !inviteName.trim() || !inviteEmail.trim()}>
                {pending ? "Sending…" : "Send invite"}
              </button>
              <button type="button" className="agent-btn agent-btn-ghost agent-btn-sm" onClick={() => { setInviting(false); setInviteName(""); setInviteEmail(""); }} disabled={pending}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </SectionReveal>

      <SectionReveal order={1}>
        <div className="bt-rows">
          {team.map((m) => {
            const on = viewAll[m.id];
            const isOwner = m.role === "owner";
            return (
              <div key={m.id} className="bt-row">
                <span className={`bt-av${isOwner ? " bt-av-owner" : ""}`}>{initials(m.name)}</span>
                <div className="bt-main">
                  <div className="bt-name">{m.name}{m.isYou && <span className="bt-you">You</span>}</div>
                  <div className="bt-email">{m.email}</div>
                </div>
                {m.pending && <span className="bt-pending"><Clock size={11} weight="bold" /> Invite sent</span>}
                <span className={`bt-role${isOwner ? " is-owner" : ""}`}>{isOwner ? "Owner" : "Progressor"}</span>
                <div className={`bt-seg${isOwner ? " locked" : ""}${savingId === m.id ? " saving" : ""}`} role="group" aria-label="File visibility">
                  <button
                    type="button"
                    className={`bt-seg-btn${!on && !isOwner ? " on-own" : ""}`}
                    aria-pressed={!on}
                    disabled={isOwner || pending}
                    onClick={() => setMember(m, false)}
                  >
                    Own files
                  </button>
                  <button
                    type="button"
                    className={`bt-seg-btn${on || isOwner ? " on-all" : ""}`}
                    aria-pressed={on || isOwner}
                    disabled={isOwner || pending}
                    onClick={() => setMember(m, true)}
                  >
                    All sales
                  </button>
                </div>
                {!isOwner && (
                  confirmRemoveId === m.id ? (
                    <div className="bt-rm-confirm">
                      <button type="button" className="bt-rm-yes" onClick={() => remove(m)} disabled={pending}>{pending ? "…" : "Remove"}</button>
                      <button type="button" className="bt-rm-no" onClick={() => setConfirmRemoveId(null)} disabled={pending}>Cancel</button>
                    </div>
                  ) : (
                    <button type="button" className="bt-rm" onClick={() => setConfirmRemoveId(m.id)} title="Remove teammate" aria-label={`Remove ${m.name}`}>Remove</button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </SectionReveal>

      <SectionReveal order={2}>
        <p className="bt-foot">A team member on <strong>Own files</strong> sees only the sales assigned to them. The change takes effect the next time they open a page. The owner always sees everything.</p>
      </SectionReveal>

      <style>{`
        .bt { width: 100%; display: flex; flex-direction: column; gap: 20px; max-width: 760px; }
        .bt-top-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .bt-h1 { margin: 0 0 3px; font-size: clamp(24px, 4vw, 32px); font-weight: 820; letter-spacing: -0.03em; color: var(--agent-text-primary); }
        .bt-sub { margin: 0; font-size: 14px; color: var(--agent-text-secondary); }
        .bt-invite-btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 15px; border-radius: 11px; border: 1px solid var(--agent-coral); background: rgba(var(--agent-coral-rgb),0.08); color: var(--agent-coral-deep, #E2452A); font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0; transition: background .15s, transform .15s; }
        .bt-invite-btn:hover { background: rgba(var(--agent-coral-rgb),0.14); transform: translateY(-1px); }
        .bt-invite-form { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; margin-top: 14px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--agent-border-subtle); background: var(--agent-glass-bg, rgba(255,255,255,0.5)); }
        .bt-inp { flex: 1; min-width: 160px; padding: 9px 12px; font-size: 13.5px; color: var(--agent-text-primary); background: var(--agent-surface, #fff); border: 1px solid var(--agent-border-strong, rgba(0,0,0,0.16)); border-radius: 9px; outline: none; }
        .bt-inp:focus { border-color: var(--agent-coral); }

        .bt-pending { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; color: #B5831E; background: rgba(181,131,30,0.12); padding: 3px 8px; border-radius: 999px; flex-shrink: 0; }
        :root[data-theme="dark"] .bt-pending { color: #E0B050; }
        .bt-rm { font-family: inherit; font-size: 12px; font-weight: 650; padding: 7px 11px; border-radius: 9px; border: 1px solid var(--agent-border-subtle); background: transparent; color: var(--agent-text-muted); cursor: pointer; flex-shrink: 0; transition: color .15s, border-color .15s; }
        .bt-rm:hover { color: var(--agent-coral-ink, #BE3C1C); border-color: var(--agent-coral-ink, #BE3C1C); }
        .bt-rm-confirm { display: inline-flex; gap: 6px; flex-shrink: 0; }
        .bt-rm-yes { font-family: inherit; font-size: 12px; font-weight: 700; padding: 7px 11px; border-radius: 9px; border: none; background: var(--agent-coral-ink, #BE3C1C); color: #fff; cursor: pointer; }
        .bt-rm-yes:disabled { opacity: 0.6; cursor: default; }
        .bt-rm-no { font-family: inherit; font-size: 12px; font-weight: 650; padding: 7px 11px; border-radius: 9px; border: 1px solid var(--agent-border-subtle); background: transparent; color: var(--agent-text-muted); cursor: pointer; }

        .bt-rows { display: flex; flex-direction: column; gap: 10px; }
        .bt-row {
          display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-radius: 16px;
          border: 1px solid var(--agent-border-subtle); background: var(--agent-glass-bg, rgba(255,255,255,0.5));
          -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
          transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s, border-color .2s;
        }
        .bt-row:hover { transform: translateY(-2px); border-color: var(--agent-border-default, rgba(0,0,0,0.12)); box-shadow: 0 16px 34px -20px rgba(40,26,20,0.38); }
        :root[data-theme="dark"] .bt-row:hover { box-shadow: 0 18px 36px -20px rgba(0,0,0,0.6); }

        .bt-av { width: 42px; height: 42px; border-radius: 999px; flex-shrink: 0; display: grid; place-items: center; font-size: 14px; font-weight: 800; letter-spacing: -0.01em; background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); }
        .bt-av-owner { background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,0.28); }

        .bt-main { min-width: 0; flex: 1; }
        .bt-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 7px; }
        .bt-you { font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--agent-coral-deep, #E2452A); background: rgba(var(--agent-coral-rgb),0.12); padding: 1px 6px; border-radius: 999px; }
        .bt-email { font-size: 12.5px; color: var(--agent-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }

        .bt-role { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 3px 9px; border-radius: 999px; color: var(--agent-text-muted); background: var(--agent-surface-overlay, rgba(0,0,0,0.04)); flex-shrink: 0; }
        .bt-role.is-owner { color: var(--agent-coral-deep, #E2452A); background: rgba(var(--agent-coral-rgb),0.12); }

        .bt-seg { display: inline-flex; border: 1px solid var(--agent-border-strong, rgba(0,0,0,0.16)); border-radius: 999px; overflow: hidden; background: var(--agent-surface-overlay, rgba(0,0,0,0.03)); flex-shrink: 0; transition: opacity .15s; }
        .bt-seg.saving { opacity: 0.6; }
        .bt-seg-btn {
          font-family: inherit; font-size: 12px; font-weight: 650; padding: 7px 14px; border: none;
          background: transparent; color: var(--agent-text-secondary); cursor: pointer; white-space: nowrap;
          transition: background .18s ease, color .18s ease;
        }
        .bt-seg-btn:not(:disabled):hover { background: var(--agent-hover-tint, rgba(255,107,74,0.08)); color: var(--agent-coral-deep); }
        .bt-seg-btn:disabled { cursor: default; }
        .bt-seg-btn.on-own { background: var(--agent-info, #2563eb); color: #fff; }
        .bt-seg-btn.on-all { background: var(--agent-success, #2F7D53); color: #fff; }
        .bt-seg.locked .bt-seg-btn.on-all { background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); }
        .bt-seg-btn.on-own:hover, .bt-seg-btn.on-all:hover { background: var(--agent-info); color: #fff; } /* active side ignores hover tint */
        .bt-seg-btn.on-all:hover { background: var(--agent-success); }

        .bt-foot { margin: 4px 2px 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.55; }
        .bt-foot strong { color: var(--agent-text-secondary); font-weight: 600; }

        @media (max-width: 560px) {
          .bt-row { flex-wrap: wrap; }
          .bt-role { order: 3; }
          .bt-seg { order: 4; margin-left: auto; }
        }
      `}</style>
    </div>
  );
}
