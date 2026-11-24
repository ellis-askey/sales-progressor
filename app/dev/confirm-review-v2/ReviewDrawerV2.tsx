"use client";

import { useEffect, useState, useTransition } from "react";
import { ContactAvatar } from "@/components/ui/Avatar";
import { nameWithoutTitle } from "@/lib/contacts/displayName";
import { renderEditedPreviewAction } from "./actions";

export type PreviewRecipient = {
  id: string;
  name: string;              // raw, with title e.g. "Mrs Debbie Knight"
  role: "vendor" | "purchaser";
  email: string;
  from: string;
  address: string;
  portalUrl: string;
  greeting: string;
  subject: string;
  text: string;
  html: string;              // the REAL rendered email HTML (byte-for-byte what sends)
  digestIntro?: string;      // present = digest (merged) email
  digestUpdates?: { id: string; line: string }[];
};

const roleLabel = (r: PreviewRecipient["role"]) => (r === "vendor" ? "Vendor" : "Purchaser");

function digestBodyText(r: PreviewRecipient, updates: { line: string }[]): string {
  return [r.greeting, "", r.digestIntro ?? "", "", ...updates.map((u) => `• ${u.line}`)].join("\n");
}

export function ReviewDrawerV2({ label, recipients: initial }: { label: string; recipients: PreviewRecipient[] }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [recipients, setRecipients] = useState(initial);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftText, setDraftText] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, startSave] = useTransition();

  const active = recipients[activeIdx];

  function openDrawer() { setRecipients(initial); setOpen(true); setClosing(false); setEditing(false); setActiveIdx(0); }
  function closeDrawer() { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); setEditing(false); }, 180); }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { editing ? setEditing(false) : closeDrawer(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing]);

  function startEdit() {
    if (!active) return;
    setDraftSubject(active.subject);
    setDraftText(active.text);
    setEditing(true);
  }
  function rerenderActive(subject: string, text: string, patch: Partial<PreviewRecipient> = {}) {
    startSave(async () => {
      const html = await renderEditedPreviewAction({ address: active.address, subject, text, portalUrl: active.portalUrl });
      setRecipients((rs) => rs.map((r, i) => (i === activeIdx ? { ...r, subject, text, html, ...patch } : r)));
    });
  }
  function save() {
    if (!active) return;
    rerenderActive(draftSubject, draftText);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }
  function removeUpdate(uid: string) {
    if (!active?.digestUpdates) return;
    const remaining = active.digestUpdates.filter((u) => u.id !== uid);
    rerenderActive(active.subject, digestBodyText(active, remaining), { digestUpdates: remaining });
  }

  const displayName = active ? nameWithoutTitle(active.name) : "";
  const isDigest = !!active?.digestUpdates;

  return (
    <div style={{ display: "inline-block" }}>
      <button className="crv-btn crv-btn-primary" onClick={openDrawer} style={{ fontSize: 13 }}>{label}</button>

      {open && active && (
        <>
          <div className={`crv-ov${closing ? " out" : ""}`} onClick={() => closeDrawer()} />
          <div className={`crv-modal${closing ? " out" : ""}`} role="dialog" aria-label="Review outgoing client updates">
            {/* Header band — title + subtext (no eyebrow) */}
            <header className="crv-band">
              <div style={{ minWidth: 0 }}>
                <h2 className="crv-title">Review before send</h2>
                <p className="crv-sub">See exactly what your clients will receive. Review, make any changes, then send.</p>
              </div>
              <button className="crv-x" aria-label="Close" onClick={() => closeDrawer()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </header>

            {/* Recipient selector — avatar + role-above-name (clickable when >1) */}
            <div className="crv-rcards" role={recipients.length > 1 ? "tablist" : undefined}>
              {recipients.map((r, i) => {
                const dn = nameWithoutTitle(r.name);
                const selectable = recipients.length > 1;
                return (
                  <button
                    key={r.id}
                    role={selectable ? "tab" : undefined}
                    aria-selected={selectable ? i === activeIdx : undefined}
                    className={`crv-rcard${selectable && i === activeIdx ? " active" : ""}${selectable ? " sel" : ""}`}
                    onClick={() => { if (selectable) { setActiveIdx(i); setEditing(false); } }}
                  >
                    <ContactAvatar contact={{ name: dn, roleType: r.role }} image={null} size={22} art />
                    <span className="crv-rcard-text">
                      <span className="crv-rcard-role" data-side={r.role}>{roleLabel(r.role)}</span>
                      <span className="crv-rcard-name">{dn}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="crv-body">
              <div className="crv-env">
                <div className="crv-env-row"><span className="crv-env-label">From</span><span className="crv-env-value">{active.from}</span></div>
                <div className="crv-env-row"><span className="crv-env-label">To</span><span className="crv-env-value">{displayName} <span className="crv-muted">&lt;{active.email}&gt;</span></span></div>
                <div className="crv-env-row">
                  <span className="crv-env-label">Subject</span>
                  <span className="crv-env-subject">{active.subject}</span>
                  {!editing && <button className="crv-edit" onClick={startEdit}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>Edit
                  </button>}
                  {saved && !editing && <span className="crv-saved">✓ Saved</span>}
                </div>
              </div>

              {/* Digest: the updates this one email covers, each removable */}
              {isDigest && !editing && (
                <div className="crv-updates">
                  <p className="crv-updates-h">This one email covers {active.digestUpdates!.length} update{active.digestUpdates!.length === 1 ? "" : "s"}</p>
                  {active.digestUpdates!.map((u) => (
                    <div key={u.id} className="crv-update">
                      <span className="crv-update-line">{u.line}</span>
                      <button className="crv-update-rm" disabled={busy || active.digestUpdates!.length === 1} onClick={() => removeUpdate(u.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}

              {editing ? (
                <div className="crv-editwrap">
                  <label className="crv-field"><span className="crv-field-label">Subject</span><input className="crv-input" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} /></label>
                  <label className="crv-field"><span className="crv-field-label">Body</span><textarea className="crv-textarea" rows={isDigest ? 12 : 10} value={draftText} onChange={(e) => setDraftText(e.target.value)} /></label>
                  <div className="crv-edit-actions">
                    <button className="crv-btn crv-btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
                    <button className="crv-btn crv-btn-primary" onClick={save} disabled={busy || !draftSubject.trim() || !draftText.trim()}>{busy ? "Saving…" : "Save & preview"}</button>
                  </div>
                  <p className="crv-note">Saving re-renders the real branded email below — exactly as it sends.</p>
                </div>
              ) : (
                <>
                  <div className="crv-inbox-label">What {displayName} receives</div>
                  <iframe title="Email preview" className="crv-frame" sandbox="" srcDoc={active.html} />
                  <button className="crv-dontsend">Don&apos;t send to {displayName}</button>
                </>
              )}
            </div>

            {/* Footer */}
            <footer className="crv-foot">
              <button className="crv-btn crv-btn-danger-ghost" onClick={() => closeDrawer()}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg>Cancel this batch
              </button>
              <div className="crv-foot-right">
                <button className="crv-btn crv-btn-secondary" onClick={() => closeDrawer()}>Keep queued</button>
                <button className="crv-btn crv-btn-primary crv-btn-send" onClick={() => closeDrawer()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z M22 2 11 13" /></svg>Send now
                </button>
              </div>
            </footer>
          </div>
        </>
      )}

      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .crv-ov{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,0.38);animation:crvOv 180ms ease}
  .crv-ov.out{animation:crvOvOut 180ms ease forwards}
  @keyframes crvOv{from{opacity:0}to{opacity:1}} @keyframes crvOvOut{to{opacity:0}}
  .crv-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1001;width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 64px);
    background:var(--agent-surface-elevated,#fff);border-radius:18px;box-shadow:0 30px 70px rgba(15,23,42,0.28);display:flex;flex-direction:column;overflow:hidden;
    animation:crvIn 220ms cubic-bezier(0.22,1,0.36,1)}
  .crv-modal.out{animation:crvOut 170ms cubic-bezier(0.4,0,0.6,1) forwards}
  @keyframes crvIn{from{opacity:0;transform:translate(-50%,-48%) scale(0.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  @keyframes crvOut{to{opacity:0;transform:translate(-50%,-48%) scale(0.98)}}

  .crv-band{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(135deg,#FF6F4E,#F04E2C);color:#fff}
  .crv-title{margin:0;font-size:18px;font-weight:700;letter-spacing:-0.01em}
  .crv-sub{margin:3px 0 0;font-size:12.5px;font-weight:500;color:rgba(255,255,255,0.9);line-height:1.4}
  .crv-x{flex:none;width:32px;height:32px;border-radius:10px;border:none;background:transparent;color:rgba(255,255,255,0.9);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 150ms,transform 120ms}
  .crv-x:hover{background:rgba(255,255,255,0.2)} .crv-x:active{transform:scale(0.92)} .crv-x:focus-visible{outline:2px solid #fff;outline-offset:1px}

  .crv-rcards{display:flex;flex-wrap:wrap;gap:8px;padding:12px 18px;border-bottom:0.5px solid var(--agent-border-subtle,rgba(45,24,16,0.09))}
  .crv-rcard{display:inline-flex;align-items:center;min-height:38px;box-sizing:border-box;gap:9px;padding:6px 14px 6px 7px;border-radius:12px;border:1px solid var(--agent-border-default,rgba(45,24,16,0.14));background:var(--agent-surface-elevated,#fff);box-shadow:0 2px 8px rgba(15,23,42,0.06);cursor:default;text-align:left;transition:background 140ms,border-color 140ms,box-shadow 140ms}
  .crv-rcard.sel{cursor:pointer}
  .crv-rcard.sel:not(.active):hover{border-color:var(--agent-border-strong,rgba(45,24,16,0.24))}
  .crv-rcard.active{border-color:var(--agent-coral-deep,#F04E2C);box-shadow:0 2px 10px rgba(var(--agent-coral-rgb,240,78,44),0.16)}
  .crv-rcard.sel:focus-visible{outline:2px solid var(--agent-coral-deep,#F04E2C);outline-offset:1px}
  .crv-rcard-text{display:flex;flex-direction:column;min-width:0}
  .crv-rcard-role{font-size:10px;font-weight:700;letter-spacing:0.02em;line-height:1.1}
  .crv-rcard-role[data-side="vendor"]{color:#4F46E5}
  .crv-rcard-role[data-side="purchaser"]{color:#BE185D}
  .crv-rcard-name{font-size:13.5px;font-weight:600;color:var(--agent-text-primary,#2A2320);line-height:1.2;white-space:nowrap}

  .crv-body{flex:1;overflow:auto;padding:16px 20px 18px}
  .crv-env{border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.12));border-radius:12px;background:var(--agent-bg-paper,#FBF7F1);padding:8px 14px;margin-bottom:14px}
  .crv-env-row{display:flex;align-items:center;gap:10px;padding:5px 0}
  .crv-env-row + .crv-env-row{border-top:0.5px solid var(--agent-border-subtle,rgba(45,24,16,0.07))}
  .crv-env-label{flex:none;width:52px;font-size:11.5px;font-weight:600;color:var(--agent-text-muted,#8A8178)}
  .crv-env-value{font-size:13px;color:var(--agent-text-primary,#2A2320);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .crv-env-subject{flex:1;font-size:13px;font-weight:600;color:var(--agent-text-primary,#2A2320);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .crv-muted{color:var(--agent-text-muted,#8A8178)}
  .crv-edit{flex:none;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.14));background:transparent;color:var(--agent-coral-deep,#F04E2C);font-size:11px;font-weight:600;cursor:pointer;transition:border-color 140ms,color 140ms,transform 120ms}
  .crv-edit:hover{border-color:var(--agent-coral-deep,#F04E2C)} .crv-edit:active{transform:translateY(0.5px)}
  .crv-saved{flex:none;font-size:11px;font-weight:600;color:var(--agent-success,#2E9E6B)}

  .crv-updates{margin-bottom:14px}
  .crv-updates-h{margin:0 0 6px 2px;font-size:11px;font-weight:600;color:var(--agent-text-muted,#8A8178)}
  .crv-update{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:9px;border:1px solid var(--agent-border-default,rgba(45,24,16,0.12));background:transparent}
  .crv-update + .crv-update{margin-top:6px}
  .crv-update-line{font-size:12.5px;color:var(--agent-text-secondary,#5C544C);line-height:1.45}
  .crv-update-rm{flex:none;padding:3px 10px;border-radius:999px;border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.14));background:transparent;color:var(--agent-danger,#C73E3E);font-size:11px;font-weight:500;cursor:pointer;transition:border-color 140ms,color 140ms}
  .crv-update-rm:hover:not(:disabled){border-color:var(--agent-danger,#C73E3E)} .crv-update-rm:disabled{opacity:0.4;cursor:not-allowed}

  .crv-inbox-label{font-size:11px;font-weight:600;color:var(--agent-text-muted,#8A8178);margin:0 0 8px 2px}
  .crv-frame{width:100%;height:430px;border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.12));border-radius:12px;background:#fff;box-shadow:0 6px 20px rgba(30,20,12,0.08)}
  .crv-dontsend{margin-top:12px;padding:6px 13px;border-radius:999px;border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.14));background:var(--agent-surface-elevated,#fff);color:var(--agent-danger,#C73E3E);font-size:11px;font-weight:500;cursor:pointer;transition:background 140ms,border-color 140ms}
  .crv-dontsend:hover{background:rgba(199,62,62,0.06);border-color:rgba(199,62,62,0.4)}

  .crv-editwrap{display:flex;flex-direction:column;gap:12px}
  .crv-field{display:flex;flex-direction:column;gap:4px}
  .crv-field-label{font-size:11.5px;font-weight:600;color:var(--agent-text-muted,#8A8178)}
  .crv-input,.crv-textarea{width:100%;padding:9px 11px;font-size:13px;border-radius:9px;border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.14));background:var(--agent-surface-elevated,#fff);color:var(--agent-text-primary,#2A2320);outline:none;font-family:inherit;transition:border-color 140ms,box-shadow 140ms}
  .crv-textarea{resize:vertical;line-height:1.55}
  .crv-input:focus,.crv-textarea:focus{border-color:var(--agent-coral-deep,#F04E2C);box-shadow:0 0 0 3px rgba(240,78,44,0.14)}
  .crv-edit-actions{display:flex;justify-content:flex-end;gap:8px}
  .crv-note{margin:0;font-size:11px;color:var(--agent-text-muted,#8A8178)}

  .crv-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 20px;border-top:0.5px solid var(--agent-border-subtle,rgba(45,24,16,0.09));background:var(--agent-bg-paper,#FBF7F1)}
  .crv-foot-right{display:flex;gap:8px}
  .crv-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:10px;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;transition:background 140ms,border-color 140ms,box-shadow 140ms,transform 120ms;border:0.5px solid transparent}
  .crv-btn:active{transform:translateY(0.5px)} .crv-btn:disabled{opacity:0.5;cursor:not-allowed}
  .crv-btn:focus-visible{outline:2px solid var(--agent-coral-deep,#F04E2C);outline-offset:1px}
  .crv-btn-primary{background:var(--agent-coral-deep,#F04E2C);color:#fff;box-shadow:0 1px 0 #C63E20,0 3px 8px rgba(240,78,44,0.26)}
  .crv-btn-primary:hover:not(:disabled){background:#D8421F;box-shadow:0 1px 0 #B0351B,0 5px 14px rgba(240,78,44,0.34)}
  .crv-btn-secondary{background:var(--agent-surface-elevated,#fff);border-color:var(--agent-border-default,rgba(45,24,16,0.14));color:var(--agent-text-primary,#2A2320)}
  .crv-btn-secondary:hover:not(:disabled){background:var(--agent-bg-paper,#F3EDE4);border-color:var(--agent-border-strong,rgba(45,24,16,0.24))}
  .crv-btn-ghost{background:transparent;color:var(--agent-text-muted,#8A8178)}
  .crv-btn-ghost:hover:not(:disabled){background:var(--agent-bg-paper,#F3EDE4);color:var(--agent-text-secondary,#5C544C)}
  .crv-btn-danger-ghost{background:var(--agent-surface-elevated,#fff);border-color:var(--agent-border-default,rgba(45,24,16,0.14));color:var(--agent-danger,#C73E3E)}
  .crv-btn-danger-ghost:hover:not(:disabled){background:rgba(199,62,62,0.06);border-color:rgba(199,62,62,0.4)}
  .crv-btn-send svg{transition:transform 180ms cubic-bezier(0.22,1,0.36,1)}
  .crv-btn-send:hover:not(:disabled) svg{transform:translate(2px,-2px) rotate(6deg)}
`;
