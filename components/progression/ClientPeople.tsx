"use client";

// People tab for one client agency. The progressor manages the agency's team on
// their behalf: the director (the main contact) plus any colleagues they invite.
// Mirrors the director-only team-settings UI (crown for the main contact,
// role/status badges, pending + resend, soft-remove) but is wired to the
// owner-scoped actions in app/actions/progression-clients, each gated by
// assertOwnerOfClient. A colleague is a pending negotiator on the client agency,
// invited with the same setup-email flow as the director.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, UserPlus, ArrowClockwise, Trash, Clock, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import {
  inviteClientColleagueAction,
  resendClientPersonInviteAction,
  removeClientPersonAction,
} from "@/app/actions/progression-clients";
import type { AgencyPerson } from "@/lib/services/progression-clients";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function ClientPeople({ agencyId, agencyName, people }: { agencyId: string; agencyName: string; people: AgencyPerson[] }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const director = people.find((p) => p.role === "director") ?? null;
  const colleagues = people.filter((p) => p.role !== "director");
  const pendingCount = people.filter((p) => p.pending).length;

  async function resend(p: AgencyPerson) {
    setBusyId(p.id);
    const res = await resendClientPersonInviteAction(agencyId, p.id);
    setBusyId(null);
    if (res.ok) toast.success("Invite re-sent", { description: `We've emailed ${p.email}.` });
    else toast.error(res.error);
  }

  async function remove(p: AgencyPerson) {
    if (!window.confirm(`Remove ${p.name}? They'll no longer be able to log in.`)) return;
    setBusyId(p.id);
    const res = await removeClientPersonAction(agencyId, p.id);
    setBusyId(null);
    if (res.ok) { toast.success("Colleague removed", { description: `${p.name} can no longer access ${agencyName}'s sales.` }); router.refresh(); }
    else toast.error(res.error);
  }

  function Row({ p }: { p: AgencyPerson }) {
    const isDirector = p.role === "director";
    return (
      <div className="cp-row">
        <span className={`cp-av ${isDirector ? "lead" : ""}`}>
          {initials(p.name)}
          {isDirector && <span className="cp-crown"><Crown size={10} weight="fill" /></span>}
        </span>
        <div className="cp-main">
          <div className="cp-name">{p.name} <span className={`cp-badge ${isDirector ? "lead" : ""}`}>{isDirector ? "Main contact" : "Colleague"}</span></div>
          <div className="cp-email">{p.email}</div>
        </div>
        <span className={`cp-stat ${p.pending ? "pend" : "ok"}`}>
          {p.pending ? <Clock size={11} weight="bold" /> : <Check size={11} weight="bold" />}
          {p.pending ? "Invite sent" : "Signed in"}
        </span>
        <div className="cp-actions">
          {p.pending && (
            <button className="cp-act" onClick={() => resend(p)} disabled={busyId === p.id}>
              <ArrowClockwise size={14} weight="bold" /> {busyId === p.id ? "Sending…" : "Resend"}
            </button>
          )}
          {!isDirector && (
            <button className="cp-act danger" onClick={() => remove(p)} disabled={busyId === p.id} aria-label={`Remove ${p.name}`}>
              <Trash size={14} weight="bold" /> Remove
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cp">
      <div className="cp-head">
        <div>
          <h4 className="cp-title">People</h4>
          <p className="cp-sub">
            {people.length} {people.length === 1 ? "person" : "people"}
            {pendingCount > 0 ? ` · ${pendingCount} invite${pendingCount === 1 ? "" : "s"} pending` : ""}
          </p>
        </div>
        <Button variant="primary" size="sm" className="cp-primary" onClick={() => setAddOpen(true)}>
          <UserPlus size={15} weight="bold" /> Invite a colleague
        </Button>
      </div>

      <div className="cp-list">
        {director && <Row p={director} />}
        {colleagues.map((p) => <Row key={p.id} p={p} />)}
      </div>

      {colleagues.length === 0 && (
        <p className="cp-hint">No colleagues yet. Invite one so more of {agencyName}&rsquo;s team can follow the sales you progress for them.</p>
      )}

      <p className="cp-note">
        Colleagues get their own login and can follow the sales you progress for {agencyName}. Removing someone ends their access straight away.
      </p>

      {addOpen && <InviteModal agencyId={agencyId} agencyName={agencyName} onClose={() => setAddOpen(false)} />}

      <style>{`
        .cp { width: 100%; }
        .cp-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .cp-title { margin: 0 0 3px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-text-muted); }
        .cp-sub { margin: 0; font-size: 13px; color: var(--agent-text-secondary); }
        .cp-primary { gap: 7px; background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); }
        .cp-primary:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .cp-primary:active:not(:disabled) { transform: scale(0.98); }

        .cp-list { display: flex; flex-direction: column; gap: 9px; }
        .cp-row { display: flex; align-items: center; gap: 13px; padding: 13px 15px; border-radius: 14px; border: 1px solid var(--agent-border-subtle); background: var(--agent-glass-bg, rgba(255,255,255,0.5)); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); transition: border-color .18s; }
        .cp-row:hover { border-color: var(--agent-border-default, rgba(0,0,0,0.12)); }
        .cp-av { position: relative; width: 40px; height: 40px; border-radius: 50%; background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); display: grid; place-items: center; font-size: 13px; font-weight: 800; flex-shrink: 0; }
        .cp-av.lead { background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); color: #fff; }
        .cp-crown { position: absolute; bottom: -3px; right: -3px; width: 17px; height: 17px; border-radius: 50%; background: #B5831E; color: #fff; display: grid; place-items: center; border: 2px solid var(--agent-surface, #fff); }
        :root[data-theme="dark"] .cp-crown { background: #E0B050; color: #1a1a1a; }
        .cp-main { min-width: 0; flex: 1; }
        .cp-name { font-size: 14px; font-weight: 700; color: var(--agent-text-primary); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cp-badge { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 999px; background: var(--agent-glass-bg, rgba(0,0,0,0.05)); color: var(--agent-text-muted); }
        .cp-badge.lead { background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); }
        .cp-email { font-size: 12px; color: var(--agent-text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cp-stat { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .cp-stat.ok { color: var(--agent-success, #2F7D53); }
        .cp-stat.pend { color: #B5831E; } :root[data-theme="dark"] .cp-stat.pend { color: #E0B050; }
        .cp-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .cp-act { appearance: none; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 650; color: var(--agent-text-secondary); background: none; border: 1px solid var(--agent-border-subtle); border-radius: 9px; padding: 6px 10px; cursor: pointer; transition: background .15s, color .15s, border-color .15s, transform .09s; }
        .cp-act:hover:not(:disabled) { background: var(--agent-glass-bg, rgba(0,0,0,0.04)); color: var(--agent-text-primary); }
        .cp-act:active:not(:disabled) { transform: scale(0.97); }
        .cp-act:disabled { opacity: 0.55; cursor: default; }
        .cp-act.danger:hover:not(:disabled) { color: #C7401F; border-color: rgba(199,64,31,0.4); background: rgba(199,64,31,0.06); }

        .cp-hint { margin: 12px 0 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.6; }
        .cp-note { margin: 16px 0 0; font-size: 11.5px; color: var(--agent-text-muted); line-height: 1.6; padding-top: 14px; border-top: 1px solid var(--agent-border-subtle); }

        @media (max-width: 620px) {
          .cp-row { flex-wrap: wrap; }
          .cp-stat { order: 3; }
          .cp-actions { order: 4; margin-left: auto; }
        }
      `}</style>
    </div>
  );
}

// ── Invite-a-colleague modal (canonical Modal + band header) ──────────────────

function InviteModal({ agencyId, agencyName, onClose }: { agencyId: string; agencyName: string; onClose: () => void }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const emailInvalid = email.trim().length > 0 && !emailValid;
  const canSubmit = !!name.trim() && emailValid && !adding;

  async function submit() {
    if (!canSubmit) return;
    setAdding(true);
    setError(null);
    const cleanName = titleCaseKeepAcronyms(name.trim());
    const cleanEmail = email.trim().toLowerCase();
    const fd = new FormData();
    fd.set("name", cleanName);
    fd.set("email", cleanEmail);
    const res = await inviteClientColleagueAction(agencyId, fd);
    setAdding(false);
    if (!res.ok) { setError(res.error); return; }
    toast.success("Colleague invited", { description: `We've emailed ${cleanName} an invite to set up their login.` });
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} ariaLabel="Invite a colleague" size="md" closeTone="onDark">
      <Modal.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader icon={<UserPlus size={18} weight="bold" />} title="Invite a colleague" subtitle={`Add someone at ${agencyName} to the team.`} />
      </Modal.Header>

      <Modal.Body>
        <div className="cpm-field">
          <label className="cpm-label" htmlFor="cpm-name">Name</label>
          <input id="cpm-name" className="agent-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { const v = name.trim(); if (v) setName(titleCaseKeepAcronyms(v)); }} placeholder="e.g. James Okafor" maxLength={100} />
        </div>
        <div className="cpm-field">
          <label className="cpm-label" htmlFor="cpm-email">Email address</label>
          <input id="cpm-email" className="agent-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => { const v = email.trim(); if (v) setEmail(v.toLowerCase()); }} placeholder="james@oakandkey.co.uk" maxLength={255} aria-invalid={emailInvalid || undefined} />
        </div>
        {emailInvalid && <p className="cpm-err">Enter a valid email address.</p>}
        {error && <p className="cpm-err">{error}</p>}
        <p className="cpm-help">We&rsquo;ll email them an invite to set up their login. They&rsquo;ll be able to follow the sales you progress for {agencyName}.</p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" className="cpm-primary" onClick={submit} disabled={!canSubmit} loading={adding}>
          <UserPlus size={16} weight="bold" /> Send invite
        </Button>
      </Modal.Footer>

      <style>{`
        .cpm-field { margin-bottom: 12px; }
        .cpm-field:last-of-type { margin-bottom: 0; }
        .cpm-label { display: block; font-size: 12px; font-weight: 600; color: var(--agent-text-secondary); margin-bottom: 6px; }
        .cpm-err { margin: 12px 0 0; font-size: 12.5px; color: #C7401F; }
        .cpm-help { margin: 14px 0 0; font-size: 12px; color: var(--agent-text-muted); line-height: 1.5; }
        .cpm-primary { gap: 8px; background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); }
        .cpm-primary:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .cpm-primary:active:not(:disabled) { transform: scale(0.98); }
      `}</style>
    </Modal>
  );
}
