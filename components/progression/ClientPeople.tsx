"use client";

// People tab for one client agency. The progressor manages the agency's team on
// their behalf: the main contact (director) + colleagues they invite. Each row
// shows avatar, role, file access and invite/sign-in status; the full lifecycle
// (invite, resend, copy link, edit, make main contact, remove/cancel, reinstate)
// lives in a per-row RowActionsMenu so the surface stays calm. Every mutation is
// an owner-scoped action gated by assertOwnerOfClient.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, UserPlus, ArrowClockwise, Clock, Check, CaretDown, ArrowUUpLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { RowActionsMenu, type RowAction } from "@/components/account/chrome/RowActionsMenu";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import {
  inviteClientColleagueAction,
  resendClientPersonInviteAction,
  removeClientPersonAction,
  setClientPersonFileAccessAction,
  makeClientMainContactAction,
  editClientPersonAction,
  cancelClientInviteAction,
  reinstateClientPersonAction,
  createClientSetupLinkAction,
} from "@/app/actions/progression-clients";
import type { AgencyPerson, RemovedPerson } from "@/lib/services/progression-clients";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function expiryText(ms: number | null): string {
  if (ms == null) return "";
  const days = Math.ceil((ms - Date.now()) / 86400000);
  return days <= 0 ? "link expired" : `expires in ${days}d`;
}
function relTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 28) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function Avatar({ name, image, lead }: { name: string; image: string | null; lead?: boolean }) {
  return (
    <span className={`cp-av ${lead ? "lead" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image ? <img src={image} alt="" /> : initials(name)}
      {lead && <span className="cp-crown"><Crown size={10} weight="fill" /></span>}
    </span>
  );
}

export function ClientPeople({
  agencyId, agencyName, people, removed,
}: {
  agencyId: string; agencyName: string; people: AgencyPerson[]; removed: RemovedPerson[];
}) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyPerson | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removedOpen, setRemovedOpen] = useState(false);

  const director = people.find((p) => p.role === "director") ?? null;
  const colleagues = people.filter((p) => p.role !== "director");
  const pendingCount = people.filter((p) => p.pending).length;

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, ok: () => void) {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (res.ok) { ok(); router.refresh(); }
    else toast.error(res.error ?? "Something went wrong.");
  }

  const resend = (p: AgencyPerson) => run(p.id, () => resendClientPersonInviteAction(agencyId, p.id), () => toast.success("Invite re-sent", { description: `We've emailed ${p.email}.` }));
  const toggleAccess = (p: AgencyPerson) => run(p.id, () => setClientPersonFileAccessAction(agencyId, p.id, !p.canViewAll), () => toast.success(p.canViewAll ? "Now sees their own files only" : "Now sees all the agency's sales"));
  const makeMain = (p: AgencyPerson) => { if (window.confirm(`Make ${p.name} the main contact? ${director?.name ?? "The current contact"} becomes a colleague.`)) run(p.id, () => makeClientMainContactAction(agencyId, p.id), () => toast.success(`${p.name} is now the main contact`)); };
  const remove = (p: AgencyPerson) => { if (window.confirm(`Remove ${p.name}? They'll no longer be able to log in.`)) run(p.id, () => removeClientPersonAction(agencyId, p.id), () => toast.success("Colleague removed")); };
  const cancel = (p: AgencyPerson) => { if (window.confirm(`Cancel ${p.name}'s invite? Their pending account will be deleted.`)) run(p.id, () => cancelClientInviteAction(agencyId, p.id), () => toast.success("Invite cancelled")); };
  const reinstate = (rp: RemovedPerson) => run(rp.id, () => reinstateClientPersonAction(agencyId, rp.id), () => toast.success(`${rp.name} reinstated`, { description: "They can log in again." }));
  async function copyLink(p: AgencyPerson) {
    setBusyId(p.id);
    const res = await createClientSetupLinkAction(agencyId, p.id);
    setBusyId(null);
    if (!res.ok) { toast.error(res.error); return; }
    try { await navigator.clipboard.writeText(res.url); toast.success("Set-up link copied", { description: "Share it with them directly." }); }
    catch { toast.error("Couldn't copy the link. Try again."); }
  }

  function menuItems(p: AgencyPerson): RowAction[] {
    const isDir = p.role === "director";
    const items: RowAction[] = [];
    if (!isDir && !p.pending) items.push({ label: "Make main contact", onClick: () => makeMain(p) });
    items.push({ label: "Edit details", onClick: () => setEditing(p) });
    if (p.pending) items.push({ label: "Copy set-up link", onClick: () => copyLink(p) });
    if (!isDir) {
      if (p.pending) items.push({ label: "Cancel invite", onClick: () => cancel(p), danger: true });
      else items.push({ label: "Remove from team", onClick: () => remove(p), danger: true });
    }
    return items;
  }

  function Row({ p }: { p: AgencyPerson }) {
    const isDir = p.role === "director";
    return (
      <div className="cp-row">
        <Avatar name={p.name} image={p.image} lead={isDir} />
        <div className="cp-main">
          <div className="cp-name">{p.name} <span className={`cp-badge ${isDir ? "lead" : ""}`}>{isDir ? "Main contact" : "Colleague"}</span></div>
          <div className="cp-email">{p.email}</div>
        </div>
        {!isDir && (
          <button className={`cp-acc ${p.canViewAll ? "" : "own"}`} onClick={() => toggleAccess(p)} disabled={busyId === p.id} title="Click to change what they can see">
            {p.canViewAll ? "All sales" : "Own files"}
          </button>
        )}
        <div className={`cp-stat ${p.pending ? "pend" : "ok"}`}>
          <span className="top">{p.pending ? <Clock size={11} weight="bold" /> : <Check size={11} weight="bold" />}{p.pending ? "Invite sent" : "Signed in"}</span>
          {p.pending
            ? (p.inviteExpiresAt != null && <span className="sub">{expiryText(p.inviteExpiresAt)}</span>)
            : (p.lastLoginAt != null && <span className="sub">active {relTime(p.lastLoginAt)}</span>)}
        </div>
        <div className="cp-actions">
          {p.pending && (
            <button className="cp-act" onClick={() => resend(p)} disabled={busyId === p.id}>
              <ArrowClockwise size={14} weight="bold" /> {busyId === p.id ? "…" : "Resend"}
            </button>
          )}
          <RowActionsMenu items={menuItems(p)} label={`Actions for ${p.name}`} />
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
          <span className="cp-ico" aria-hidden>👤</span> Invite a colleague
        </Button>
      </div>

      <div className="cp-list">
        {director && <Row p={director} />}
        {colleagues.map((p) => <Row key={p.id} p={p} />)}
      </div>

      {colleagues.length === 0 && (
        <p className="cp-hint">No colleagues yet. Invite one so more of {agencyName}&rsquo;s team can follow the sales you progress for them.</p>
      )}

      {removed.length > 0 && (
        <div className="cp-removed">
          <button className="cp-removed-h" onClick={() => setRemovedOpen((o) => !o)} aria-expanded={removedOpen}>
            <CaretDown size={12} weight="bold" style={{ transform: removedOpen ? "none" : "rotate(-90deg)", transition: "transform .18s" }} />
            Removed · {removed.length}
          </button>
          {removedOpen && (
            <div className="cp-list" style={{ marginTop: 9 }}>
              {removed.map((rp) => (
                <div className="cp-row gone" key={rp.id}>
                  <Avatar name={rp.name} image={rp.image} />
                  <div className="cp-main">
                    <div className="cp-name">{rp.name} <span className="cp-badge">Removed</span></div>
                    <div className="cp-email">{rp.email}</div>
                  </div>
                  <button className="cp-reinstate" onClick={() => reinstate(rp)} disabled={busyId === rp.id}>
                    <ArrowUUpLeft size={13} weight="bold" /> {busyId === rp.id ? "…" : "Reinstate"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="cp-note">
        Colleagues get their own login and can follow the sales you progress for {agencyName}. &ldquo;All sales&rdquo; sees every sale on the agency; &ldquo;Own files&rdquo; sees only the ones assigned to them. Removing someone ends their access straight away.
      </p>

      {addOpen && <InviteModal agencyId={agencyId} agencyName={agencyName} onClose={() => setAddOpen(false)} />}
      {editing && <EditModal agencyId={agencyId} person={editing} onClose={() => setEditing(null)} />}

      <style>{`
        .cp { width: 100%; }
        .cp-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .cp-title { margin: 0 0 3px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-text-muted); }
        .cp-sub { margin: 0; font-size: 13px; color: var(--agent-text-secondary); }
        .cp-primary { gap: 7px; background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); }
        .cp-ico { font-size: 14px; line-height: 1; }
        .cp-primary:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .cp-primary:active:not(:disabled) { transform: scale(0.98); }

        .cp-list { display: flex; flex-direction: column; gap: 9px; }
        .cp-row { display: flex; align-items: center; gap: 13px; padding: 13px 15px; border-radius: 14px; border: 1px solid var(--agent-border-subtle); background: var(--agent-glass-bg, rgba(255,255,255,0.5)); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); transition: border-color .18s; }
        .cp-row:hover { border-color: var(--agent-border-default, rgba(0,0,0,0.12)); }
        .cp-row.gone { opacity: 0.72; background: var(--agent-glass-bg, rgba(0,0,0,0.03)); }
        /* No overflow:hidden here — it clipped the crown badge. The photo rounds
           itself instead, so the crown can sit outside the avatar. */
        .cp-av { position: relative; width: 40px; height: 40px; border-radius: 50%; background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); display: grid; place-items: center; font-size: 13px; font-weight: 800; flex-shrink: 0; }
        .cp-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .cp-av.lead { background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); color: #fff; }
        .cp-crown { position: absolute; bottom: -3px; right: -3px; width: 17px; height: 17px; border-radius: 50%; background: #B5831E; color: #fff; display: grid; place-items: center; border: 2px solid var(--agent-surface, #fff); }
        :root[data-theme="dark"] .cp-crown { background: #E0B050; color: #1a1a1a; }
        .cp-main { min-width: 0; flex: 1; }
        .cp-name { font-size: 14px; font-weight: 700; color: var(--agent-text-primary); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cp-badge { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 999px; background: var(--agent-glass-bg, rgba(0,0,0,0.05)); color: var(--agent-text-muted); }
        .cp-badge.lead { color: #fff; background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), 0 2px 5px -2px rgba(var(--agent-coral-rgb),0.55); }
        .cp-email { font-size: 12px; color: var(--agent-text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .cp-acc { flex-shrink: 0; font-size: 11.5px; font-weight: 650; color: var(--agent-text-primary); background: var(--agent-glass-bg, rgba(0,0,0,0.04)); border: 1px solid var(--agent-border-subtle); border-radius: 999px; padding: 5px 11px; cursor: pointer; transition: border-color .15s, background .15s; }
        .cp-acc:hover:not(:disabled) { border-color: var(--agent-border-default, rgba(0,0,0,0.2)); }
        .cp-acc.own { color: var(--agent-text-muted); }
        .cp-acc:disabled { opacity: 0.55; cursor: default; }

        .cp-stat { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; min-width: 96px; }
        .cp-stat .top { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; }
        .cp-stat.ok .top { color: var(--agent-success, #2F7D53); }
        .cp-stat.pend .top { color: #B5831E; } :root[data-theme="dark"] .cp-stat.pend .top { color: #E0B050; }
        .cp-stat .sub { font-size: 10px; color: var(--agent-text-faint, var(--agent-text-muted)); margin-top: 2px; }

        .cp-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .cp-act { appearance: none; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 650; color: var(--agent-text-secondary); background: none; border: 1px solid var(--agent-border-subtle); border-radius: 9px; padding: 6px 10px; cursor: pointer; transition: background .15s, color .15s, border-color .15s, transform .09s; }
        .cp-act:hover:not(:disabled) { background: var(--agent-glass-bg, rgba(0,0,0,0.04)); color: var(--agent-text-primary); }
        .cp-act:active:not(:disabled) { transform: scale(0.97); }
        .cp-act:disabled { opacity: 0.55; cursor: default; }

        .cp-hint { margin: 12px 0 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.6; }
        .cp-removed { margin-top: 16px; }
        .cp-removed-h { display: inline-flex; align-items: center; gap: 7px; background: none; border: none; cursor: pointer; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-text-muted); padding: 4px 0; }
        .cp-removed-h:hover { color: var(--agent-text-primary); }
        .cp-reinstate { flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--agent-coral-ink, #BE3C1C); background: none; border: 1px solid var(--agent-border-subtle); border-radius: 9px; padding: 6px 11px; cursor: pointer; transition: border-color .15s, background .15s; }
        .cp-reinstate:hover:not(:disabled) { border-color: rgba(var(--agent-coral-rgb),0.4); background: rgba(var(--agent-coral-rgb),0.06); }
        .cp-reinstate:disabled { opacity: 0.55; cursor: default; }

        .cp-note { margin: 16px 0 0; font-size: 11.5px; color: var(--agent-text-muted); line-height: 1.6; padding-top: 14px; border-top: 1px solid var(--agent-border-subtle); }

        @media (max-width: 640px) {
          .cp-row { flex-wrap: wrap; }
          .cp-acc { order: 3; }
          .cp-stat { order: 4; align-items: flex-start; min-width: auto; }
          .cp-actions { order: 5; margin-left: auto; }
        }
      `}</style>
    </div>
  );
}

// ── Invite-a-colleague modal ──────────────────────────────────────────────────

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
      <ModalStyles />
    </Modal>
  );
}

// ── Edit-person modal (name always; email while pending) ──────────────────────

function EditModal({ agencyId, person, onClose }: { agencyId: string; person: AgencyPerson; onClose: () => void }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const emailInvalid = person.pending && email.trim().length > 0 && !emailValid;
  const canSubmit = !!name.trim() && (!person.pending || emailValid) && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const cleanName = titleCaseKeepAcronyms(name.trim());
    const res = await editClientPersonAction(agencyId, person.id, cleanName, person.pending ? email.trim().toLowerCase() : undefined);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    toast.success("Details updated");
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} ariaLabel="Edit details" size="md" closeTone="onDark">
      <Modal.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader icon={<UserPlus size={18} weight="bold" />} title="Edit details" subtitle={person.role === "director" ? "The agency's main contact." : "A colleague on the team."} />
      </Modal.Header>
      <Modal.Body>
        <div className="cpm-field">
          <label className="cpm-label" htmlFor="cpe-name">Name</label>
          <input id="cpe-name" className="agent-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { const v = name.trim(); if (v) setName(titleCaseKeepAcronyms(v)); }} maxLength={100} />
        </div>
        <div className="cpm-field">
          <label className="cpm-label" htmlFor="cpe-email">Email address</label>
          <input id="cpe-email" className="agent-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => { const v = email.trim(); if (v) setEmail(v.toLowerCase()); }} maxLength={255} disabled={!person.pending} aria-invalid={emailInvalid || undefined} />
          {!person.pending && <p className="cpm-help" style={{ marginTop: 6 }}>Their email can only be changed while the invite is still pending.</p>}
        </div>
        {emailInvalid && <p className="cpm-err">Enter a valid email address.</p>}
        {error && <p className="cpm-err">{error}</p>}
        {person.pending && <p className="cpm-help">If you change the email, re-send the set-up link so the new address gets it.</p>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" className="cpm-primary" onClick={submit} disabled={!canSubmit} loading={saving}>Save</Button>
      </Modal.Footer>
      <ModalStyles />
    </Modal>
  );
}

function ModalStyles() {
  return (
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
  );
}
