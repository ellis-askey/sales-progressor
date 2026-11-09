"use client";

// Review modal — opened from the ConfirmReviewTray pill. Groups queued
// milestone-confirmation emails by recipient, one carded avatar per recipient.
//
// What each recipient shows is BYTE-FOR-BYTE what will land in that inbox
// (2026-11-09 redesign): a sandboxed iframe of the REAL rendered email HTML —
//   • 1 pending row  → the single email's payload.html, editable inline
//     (updateEmailPayload re-renders payload.html from the edited text).
//   • 2+ pending rows → the MERGED digest the drain will send, rendered via the
//     drain's own decideSendForGroup so preview and send can't drift. Per-update
//     remove (cancels just that update's rows) + whole-body edit
//     (updateDigestForRecipient).
//
// Send now → sendPendingConfirmEmailsNow flushes the batch immediately.
// Cancel this batch → cancelPendingConfirmEmails deletes queued rows silently.
//
// The preview chrome (band header, recipient cards, envelope, iframe, footer)
// is the founder-approved /dev/confirm-review-v2 design, ported verbatim.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  cancelPendingConfirmEmails,
  sendPendingConfirmEmailsNow,
  updateDigestForRecipient,
  type PendingQueueItem,
  type RecipientDigest,
  type ReviewButtonTheme,
} from "@/app/actions/confirm-review-queue";
import { updateEmailPayload } from "@/app/actions/automation";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { ContactAvatar } from "@/components/ui/Avatar";
import { nameWithoutTitle } from "@/lib/contacts/displayName";

type SaveResult = { ok: boolean; error?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  items: PendingQueueItem[];
  /** Merged-email previews for recipients with 2+ queued rows. */
  digests?: RecipientDigest[];
  /** Accepted for tray compatibility; the CTA now renders inside the real
   *  HTML iframe, so this is no longer used for the preview. */
  button?: ReviewButtonTheme;
  /** The agency sender address, shown in the envelope's "From" row. */
  fromEmail?: string | null;
  loading: boolean;
  /** Called after any mutation so the tray + list refresh. */
  onChange: () => void;
};

type RecipientGroup = {
  contactId: string;
  name: string;
  role: string; // "vendor" | "purchaser" | …
  email: string;
  items: PendingQueueItem[];
};

function groupByRecipient(items: PendingQueueItem[]): RecipientGroup[] {
  const map = new Map<string, RecipientGroup>();
  for (const it of items) {
    let g = map.get(it.recipientContactId);
    if (!g) {
      g = {
        contactId: it.recipientContactId,
        name: it.recipientName ?? it.recipientEmail,
        role: it.recipientRole ?? "recipient",
        email: it.recipientEmail,
        items: [],
      };
      map.set(it.recipientContactId, g);
    }
    g.items.push(it);
  }
  // Vendor first, then purchaser, then others.
  return Array.from(map.values()).sort((a, b) => {
    const rank = (r: string) => (r === "vendor" ? 0 : r === "purchaser" ? 1 : 2);
    return rank(a.role) - rank(b.role);
  });
}

const roleLabel = (r: string) => (r === "vendor" ? "Vendor" : r === "purchaser" ? "Purchaser" : r.charAt(0).toUpperCase() + r.slice(1));

export function ConfirmReviewModal({ open, onClose, transactionId, items, digests, fromEmail, loading, onChange }: Props) {
  const { theme, isNight } = usePortalTheme();
  const groups = useMemo(() => groupByRecipient(items), [items]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [closing, setClosing] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<"all" | string | null>(null);

  // Animate out, then let the parent unmount us.
  function requestClose() {
    setClosing(true);
    window.setTimeout(() => onClose(), 180);
  }

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Reset the tab if the active recipient's items all get removed while open.
  useEffect(() => {
    if (activeIdx >= groups.length) setActiveIdx(Math.max(0, groups.length - 1));
  }, [groups.length, activeIdx]);

  const activeGroup = groups[activeIdx];
  const activeDigest = activeGroup ? digests?.find((d) => d.recipientContactId === activeGroup.contactId) ?? null : null;

  function handleSendNow() {
    setError(null);
    startTransition(async () => {
      const res = await sendPendingConfirmEmailsNow({ transactionId });
      if (res.ok) { onChange(); requestClose(); }
      else setError(res.error);
    });
  }

  function handleCancelAll() {
    setError(null);
    startTransition(async () => {
      const res = await cancelPendingConfirmEmails({ transactionId });
      if (res.ok) { onChange(); requestClose(); }
      else setError(res.error);
    });
  }

  function handleCancelRecipient(group: RecipientGroup) {
    setError(null);
    const ids = group.items.map((i) => i.id);
    startTransition(async () => {
      const res = await cancelPendingConfirmEmails({ transactionId, emailIds: ids });
      if (res.ok) { onChange(); setConfirmingCancel(null); }
      else setError(res.error);
    });
  }

  if (!open) return null;

  return (
    <>
      <div
        className={`crv-ov${closing ? " out" : ""}`}
        onClick={requestClose}
        data-theme={theme} data-night={isNight ? "" : undefined}
      />
      <div
        className={`crv-modal${closing ? " out" : ""}`}
        role="dialog"
        aria-label="Review outgoing client updates"
        data-theme={theme} data-night={isNight ? "" : undefined}
      >
        {/* Header — Ribbon coral band, title + subtext (no kicker) */}
        <header style={{ ...SHEET_BAND_STYLE, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SheetBandHeader title="Review before send" subtitle="See exactly what your clients will receive. Review, make any changes, then send." />
          <button className="crv-x" aria-label="Close" onClick={requestClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        {/* Recipient selector — carded avatar + role-above-name (clickable when >1) */}
        {groups.length > 0 && (
          <div className="crv-rcards" role={groups.length > 1 ? "tablist" : undefined}>
            {groups.map((g, i) => {
              const dn = nameWithoutTitle(g.name);
              const selectable = groups.length > 1;
              return (
                <button
                  key={g.contactId}
                  type="button"
                  role={selectable ? "tab" : undefined}
                  aria-selected={selectable ? i === activeIdx : undefined}
                  className={`crv-rcard${selectable && i === activeIdx ? " active" : ""}${selectable ? " sel" : ""}`}
                  onClick={() => { if (selectable) setActiveIdx(i); }}
                >
                  <ContactAvatar contact={{ name: dn, roleType: g.role }} image={null} size={22} art />
                  <span className="crv-rcard-text">
                    <span className="crv-rcard-role" data-side={g.role}>{roleLabel(g.role)}</span>
                    <span className="crv-rcard-name">{dn}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="crv-body">
          {loading && items.length === 0 ? (
            <p className="crv-empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="crv-empty">Nothing queued right now.</p>
          ) : activeGroup ? (
            <RecipientBody
              key={activeGroup.contactId}
              group={activeGroup}
              digest={activeDigest}
              fromEmail={fromEmail ?? null}
              transactionId={transactionId}
              onChange={onChange}
              onCancelRecipient={() => setConfirmingCancel(activeGroup.contactId)}
            />
          ) : null}

          {error && <p className="crv-error">{error}</p>}
        </div>

        {/* Footer */}
        <footer className="crv-foot">
          <button
            type="button"
            className="crv-btn crv-btn-danger-ghost"
            onClick={() => setConfirmingCancel("all")}
            disabled={busy || items.length === 0}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg>
            Cancel this batch
          </button>
          <div className="crv-foot-right">
            <button type="button" className="crv-btn crv-btn-secondary" onClick={requestClose} disabled={busy}>Keep queued</button>
            <button type="button" className="crv-btn crv-btn-primary crv-btn-send" onClick={handleSendNow} disabled={busy || items.length === 0}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z M22 2 11 13" /></svg>
              {busy ? "Sending…" : "Send now"}
            </button>
          </div>
        </footer>
      </div>

      {/* Cancel confirmations */}
      {confirmingCancel !== null && (
        <ConfirmCancelDialog
          scope={confirmingCancel === "all" ? "all" : "recipient"}
          recipientName={confirmingCancel !== "all" ? groups.find((g) => g.contactId === confirmingCancel)?.name ?? "" : ""}
          updateCount={confirmingCancel === "all" ? items.length : groups.find((g) => g.contactId === confirmingCancel)?.items.length ?? 0}
          busy={busy}
          onCancel={() => setConfirmingCancel(null)}
          onConfirm={() => {
            if (confirmingCancel === "all") handleCancelAll();
            else {
              const g = groups.find((gg) => gg.contactId === confirmingCancel);
              if (g) handleCancelRecipient(g);
            }
          }}
        />
      )}

      <style>{STYLES}</style>
    </>
  );
}

// ─── Per-recipient body ──────────────────────────────────────────────
// 1 row → single email (payload.html, edited via updateEmailPayload).
// 2+ rows with a digest → the merged email (digest.html, edited via
// updateDigestForRecipient, per-update remove). 2+ rows without a digest
// (assembly failed server-side) → each row shown on its own as a fallback.
function RecipientBody({
  group, digest, fromEmail, transactionId, onChange, onCancelRecipient,
}: {
  group: RecipientGroup;
  digest: RecipientDigest | null;
  fromEmail: string | null;
  transactionId: string;
  onChange: () => void;
  onCancelRecipient: () => void;
}) {
  const toName = nameWithoutTitle(group.name);
  const merged = group.items.length > 1 && digest !== null;

  const removeUpdate = (emailIds: string[]): Promise<SaveResult> =>
    cancelPendingConfirmEmails({ transactionId, emailIds }).then((r) => { if (r.ok) onChange(); return r; });

  return (
    <div className="crv-recipient">
      {merged ? (
        <EmailBlock
          fromEmail={fromEmail}
          toName={toName}
          toEmail={group.email}
          subject={digest.subject}
          html={digest.html}
          bodyText={digest.bodyText}
          editRows={12}
          overridden={digest.overridden}
          updates={digest.sections.flatMap((s) => s.bullets)}
          onRemoveUpdate={removeUpdate}
          onSave={(subject, text) =>
            updateDigestForRecipient({ transactionId, recipientContactId: group.contactId, subject, bodyText: text })
              .then((r) => { if (r.ok) onChange(); return r; })
          }
        />
      ) : group.items.length > 1 ? (
        <>
          <p className="crv-fallback-note">We couldn&apos;t merge these into one preview, so each is shown on its own. They still send as one combined email.</p>
          {group.items.map((item) => (
            <EmailBlock
              key={item.id}
              fromEmail={fromEmail}
              toName={toName}
              toEmail={item.recipientEmail}
              subject={item.subject}
              html={item.html}
              bodyText={item.bodyText}
              editRows={10}
              overridden={item.editedAt !== null}
              onSave={(subject, text) =>
                updateEmailPayload(item.id, { subject, text }).then((r) => { if (r.ok) onChange(); return r; })
              }
            />
          ))}
        </>
      ) : (
        <EmailBlock
          fromEmail={fromEmail}
          toName={toName}
          toEmail={group.email}
          subject={group.items[0].subject}
          html={group.items[0].html}
          bodyText={group.items[0].bodyText}
          editRows={10}
          overridden={group.items[0].editedAt !== null}
          onSave={(subject, text) =>
            updateEmailPayload(group.items[0].id, { subject, text }).then((r) => { if (r.ok) onChange(); return r; })
          }
        />
      )}

      <button type="button" className="crv-dontsend" onClick={onCancelRecipient}>
        Don&apos;t send to {toName}
      </button>
    </div>
  );
}

// ─── One email: envelope + (optional) removable updates + byte-faithful
// iframe, with inline whole-body edit ────────────────────────────────
function EmailBlock({
  fromEmail, toName, toEmail, subject, html, bodyText, editRows, overridden, updates, onRemoveUpdate, onSave,
}: {
  fromEmail: string | null;
  toName: string;
  toEmail: string;
  subject: string;
  html: string;
  bodyText: string;
  editRows: number;
  overridden?: boolean;
  updates?: { line: string; emailIds: string[] }[];
  onRemoveUpdate?: (emailIds: string[]) => Promise<SaveResult>;
  onSave: (subject: string, text: string) => Promise<SaveResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftText, setDraftText] = useState(bodyText);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // Keep the view in sync with refreshed props while not mid-edit.
  useEffect(() => {
    if (!editing) { setDraftSubject(subject); setDraftText(bodyText); }
  }, [editing, subject, bodyText]);

  function startEdit() { setDraftSubject(subject); setDraftText(bodyText); setErr(null); setEditing(true); }

  function save() {
    setErr(null);
    start(async () => {
      const res = await onSave(draftSubject.trim(), draftText.trim());
      if (res.ok) { setEditing(false); setSaved(true); window.setTimeout(() => setSaved(false), 1600); }
      else setErr(res.error ?? "Couldn't save");
    });
  }

  function remove(emailIds: string[]) {
    if (!onRemoveUpdate) return;
    setErr(null);
    start(async () => {
      const res = await onRemoveUpdate(emailIds);
      if (!res.ok) setErr(res.error ?? "Couldn't remove");
    });
  }

  const isDigest = !!updates;

  return (
    <div className="crv-emailblock">
      <div className="crv-env">
        {fromEmail && <div className="crv-env-row"><span className="crv-env-label">From</span><span className="crv-env-value">{fromEmail}</span></div>}
        <div className="crv-env-row"><span className="crv-env-label">To</span><span className="crv-env-value">{toName} <span className="crv-muted">&lt;{toEmail}&gt;</span></span></div>
        <div className="crv-env-row">
          <span className="crv-env-label">Subject</span>
          <span className="crv-env-subject">{subject}{overridden && <span className="crv-muted"> · edited</span>}</span>
          {!editing && <button type="button" className="crv-edit" onClick={startEdit}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>Edit
          </button>}
          {saved && !editing && <span className="crv-saved">✓ Saved</span>}
        </div>
      </div>

      {isDigest && !editing && (
        <div className="crv-updates">
          <p className="crv-updates-h">This one email covers {updates!.length} update{updates!.length === 1 ? "" : "s"}</p>
          {updates!.map((u) => {
            const key = u.emailIds.join(",");
            return (
              <div key={key} className="crv-update">
                <span className="crv-update-line">{u.line}</span>
                <button type="button" className="crv-update-rm" disabled={busy || updates!.length === 1} onClick={() => remove(u.emailIds)}>Remove</button>
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <div className="crv-editwrap">
          <label className="crv-field"><span className="crv-field-label">Subject</span><input className="crv-input" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} /></label>
          <label className="crv-field"><span className="crv-field-label">Body</span><textarea className="crv-textarea" rows={editRows} value={draftText} onChange={(e) => setDraftText(e.target.value)} /></label>
          <div className="crv-edit-actions">
            <button type="button" className="crv-btn crv-btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="button" className="crv-btn crv-btn-primary" onClick={save} disabled={busy || !draftSubject.trim() || !draftText.trim()}>{busy ? "Saving…" : "Save & preview"}</button>
          </div>
          {err && <p className="crv-fielderr">{err}</p>}
          <p className="crv-note">Saving re-renders the real branded email below — exactly as it sends.</p>
        </div>
      ) : (
        <>
          <div className="crv-inbox-label">What {toName} receives</div>
          <iframe title="Email preview" className="crv-frame" sandbox="" srcDoc={html} />
          {err && <p className="crv-fielderr">{err}</p>}
        </>
      )}
    </div>
  );
}

// ─── Cancel confirm dialog ──────────────────────────────────────────
function ConfirmCancelDialog({
  scope, recipientName, updateCount, busy, onCancel, onConfirm,
}: {
  scope: "all" | "recipient";
  recipientName: string;
  updateCount: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { theme, isNight } = usePortalTheme();
  return (
    <div
      onClick={onCancel}
      data-theme={theme} data-night={isNight ? "" : undefined}
      style={{
        // Nested confirm above the review modal (1001).
        position: "fixed", inset: 0, zIndex: 1010,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--agent-surface-elevated)", borderRadius: 14,
          maxWidth: 400, width: "100%",
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ ...SHEET_BAND_STYLE }}>
          <SheetBandHeader
            kicker="Cancel updates"
            title={scope === "all" ? "Cancel all queued client updates?" : `Don't send to ${recipientName}?`}
          />
        </div>
        <div style={{ padding: "16px 20px" }}>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
            {scope === "all"
              ? `This stops all ${updateCount} queued update${updateCount === 1 ? "" : "s"} across every recipient.`
              : `This stops ${updateCount === 1 ? "the 1 update" : `all ${updateCount} updates`} queued for ${recipientName}.`}
            {" "}The milestone confirmations stay on the file.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              style={{
                padding: "8px 14px", fontSize: 12, fontWeight: 500,
                borderRadius: 10, border: "0.5px solid var(--agent-border-default)",
                background: "var(--agent-surface-elevated)", color: "var(--agent-text-primary)", cursor: "pointer",
              }}
            >Keep queued</button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              style={{
                padding: "8px 14px", fontSize: 12, fontWeight: 600,
                borderRadius: 10, border: "none",
                background: "#991b1b", color: "#fff", cursor: "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >{busy ? "…" : (scope === "all" ? "Cancel batch" : "Don't send")}</button>
          </div>
        </div>
      </div>
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
  .crv-empty{text-align:center;color:var(--agent-text-muted,#8A8178);font-size:13px;padding:40px 0}
  .crv-error{margin-top:12px;padding:8px 12px;border-radius:8px;background:var(--agent-danger-bg,rgba(199,62,62,0.08));color:var(--agent-danger,#C73E3E);font-size:12px}
  .crv-recipient{display:flex;flex-direction:column}
  .crv-fallback-note{margin:0 0 12px;padding:8px 12px;border-radius:10px;background:var(--agent-bg-paper,#FBF7F1);border:0.5px solid var(--agent-border-subtle,rgba(45,24,16,0.09));font-size:11px;color:var(--agent-text-muted,#8A8178);line-height:1.45}
  .crv-emailblock + .crv-emailblock{margin-top:16px;padding-top:16px;border-top:0.5px solid var(--agent-border-subtle,rgba(45,24,16,0.09))}

  .crv-env{border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.12));border-radius:12px;background:var(--agent-bg-paper,#FBF7F1);padding:8px 14px;margin-bottom:14px}
  .crv-env-row{display:flex;align-items:center;gap:10px;padding:5px 0}
  .crv-env-row + .crv-env-row{border-top:0.5px solid var(--agent-border-subtle,rgba(45,24,16,0.07))}
  .crv-env-label{flex:none;width:52px;font-size:11.5px;font-weight:600;color:var(--agent-text-muted,#8A8178)}
  .crv-env-value{font-size:13px;color:var(--agent-text-primary,#2A2320);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .crv-env-subject{flex:1;font-size:13px;font-weight:600;color:var(--agent-text-primary,#2A2320);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .crv-muted{color:var(--agent-text-muted,#8A8178);font-weight:500}
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
  .crv-dontsend{align-self:flex-start;margin-top:14px;padding:6px 13px;border-radius:999px;border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.14));background:var(--agent-surface-elevated,#fff);color:var(--agent-danger,#C73E3E);font-size:11px;font-weight:500;cursor:pointer;transition:background 140ms,border-color 140ms}
  .crv-dontsend:hover{background:rgba(199,62,62,0.06);border-color:rgba(199,62,62,0.4)}

  .crv-editwrap{display:flex;flex-direction:column;gap:12px}
  .crv-field{display:flex;flex-direction:column;gap:4px}
  .crv-field-label{font-size:11.5px;font-weight:600;color:var(--agent-text-muted,#8A8178)}
  .crv-input,.crv-textarea{width:100%;padding:9px 11px;font-size:13px;border-radius:9px;border:0.5px solid var(--agent-border-default,rgba(45,24,16,0.14));background:var(--agent-surface-elevated,#fff);color:var(--agent-text-primary,#2A2320);outline:none;font-family:inherit;transition:border-color 140ms,box-shadow 140ms;box-sizing:border-box}
  .crv-textarea{resize:vertical;line-height:1.55}
  .crv-input:focus,.crv-textarea:focus{border-color:var(--agent-coral-deep,#F04E2C)}
  .crv-edit-actions{display:flex;justify-content:flex-end;gap:8px}
  .crv-note{margin:0;font-size:11px;color:var(--agent-text-muted,#8A8178)}
  .crv-fielderr{margin:0;font-size:12px;color:var(--agent-danger,#C73E3E)}

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
